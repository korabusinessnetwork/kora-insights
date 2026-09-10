# `supabase/` — banco, RLS e as funções do servidor

Tudo o que o produto faz longe do navegador mora aqui: o schema multi-tenant, as
políticas que isolam um tenant do outro, a coleta diária e o motor de regras.

A regra que organiza a pasta é a de `docs/01_ARQUITETURA/overview.md`: **o token
nunca cruza para cima e o diagnóstico nunca é calculado embaixo do usuário.**

## Mapa

| Arquivo | Papel |
|---|---|
| `schema.sql` | fonte de verdade do banco: tabelas, índices, funções, RLS e privilégios |
| `migrations/20260905120000_esquema_inicial.sql` | tabelas, índices, funções de pertencimento e de cofre |
| `migrations/20260905120100_politicas_rls.sql` | `enable row level security`, políticas e `grant` por coluna |
| `migrations/20260905120200_agendamento_da_coleta.sql` | pg_cron + pg_net: coleta 04:00 e motor 04:40 (America/Sao_Paulo) |
| `migrations/20260907140000_saude_das_contas.sql` | `saude_das_contas`: o painel de operação, sem limiar |
| `migrations/20260910120000_varredura_da_coleta.sql` | `contas_da_varredura`: quem a coleta varre, e quem dentro dela pode virar snapshot (ADR-011) |
| `seeds/metricas_canonicas.sql` | dicionário canônico espelhado no banco (ADR-003) |
| `functions/coleta-diaria/` | snapshot diário; toda falha vira linha em `coleta_eventos` (ADR-004). Também passa pela conta `pausada`, só para renovar o token (ADR-011) |
| `functions/gerar-diagnostico/` | motor de regras no servidor, grava com `ruleset_version` (ADR-005) |
| `functions/conectar-conta/` | troca o `code` do OAuth por token longo e guarda no Vault |
| `functions/excluir-dados/` | exclusão exigida pela LGPD e pelo App Review, com protocolo |
| `functions/_compartilhado/` | cliente da Graph API e envelope de resposta |
| `politicas.test.js` | teste de contrato sobre o SQL (ver "Testes") |

## As duas travas

RLS filtra **linha**. Nenhuma política esconde **coluna** — e `ig_contas.token_ref`
é justamente um problema de coluna: a linha da conta precisa ser legível pelo
dono, a referência do cofre não. Por isso o schema usa as duas travas:

1. **`grant`** — `revoke all ... from anon, authenticated` e, em seguida, `grant
   select (colunas)` explícito. `token_ref` fica de fora.
2. **RLS** — a linha só aparece se pertence a um tenant do usuário, sempre por
   `public.tenants_do_usuario()` / `public.contas_do_usuario()`.

Escolhemos privilégio de coluna em vez de uma view porque `src/lib/contas.js`
consulta `from('ig_contas')` e esse nome está fixado em `contratos.md` (seção 4):
a view obrigaria a renomear a tabela base. Além disso, a view protege quem passa
por ela, e o privilégio protege a coluna em todo caminho. Efeito colateral útil:
`select *` passa a falhar com *permission denied for column token_ref*, então a
regra "nada de `select *`" deixa de depender de review.

As duas funções de pertencimento são `security definer` de propósito. A política
de `tenant_membros` precisa consultar `tenant_membros`, e uma política que lê a
própria tabela reentra nela mesma — o Postgres aborta com recursão infinita
(42P17). `security definer` executa como o dono, que não passa pela RLS da tabela
lida, e corta o ciclo. O `search_path` fixo é obrigatório nesse tipo de função.

## Subir o banco

```bash
supabase start                      # Postgres local + Studio
supabase db reset                   # aplica migrations/ na ordem do nome
psql "$DATABASE_URL" -f supabase/seeds/metricas_canonicas.sql
```

As migrations `120000` e `120100` são **uma janela só**: entre as duas as tabelas
existem sem RLS. Nunca aplique só a primeira.

A `120200` (cron) só funciona depois que os segredos existirem no Vault:

```sql
select vault.create_secret('https://SEU-PROJETO.functions.supabase.co', 'kora_url_das_functions');
select vault.create_secret('<a service_role key do projeto>',           'kora_chave_de_servico');
```

O cron diário tem uma segunda função, e ela não é acessória: o Supabase Free
pausa projeto ocioso por 7 dias (doc 12, seção 1.1), e projeto pausado não
coleta. O job é o batimento cardíaco do ambiente gratuito.

`0 7 * * *` é 04:00 em America/Sao_Paulo. O pg_cron avalia no fuso do servidor,
que é UTC, e o Brasil não tem horário de verão desde 2019 — **se voltar a ter,
essa linha muda**.

## Variáveis das Edge Functions

Nenhuma leva prefixo `VITE_`: esse prefixo publica a variável no bundle do
navegador. `politicas.test.js` falha se alguma função ler uma.

```bash
supabase secrets set META_GRAPH_URL=https://graph.facebook.com/v23.0
supabase secrets set META_APP_ID=...
supabase secrets set META_APP_SECRET=...
supabase secrets set KORA_ORIGENS_PERMITIDAS=https://app.exemplo.com.br
supabase secrets set KORA_REDIRECIONAMENTOS_PERMITIDOS=https://app.exemplo.com.br/conectar/retorno
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas
pela plataforma. Nenhum endereço da Meta é literal no código: a versão da Graph
API vive dentro de `META_GRAPH_URL`, e no dia da próxima depreciação quem troca é
o ambiente.

`KORA_ORIGENS_PERMITIDAS` e `KORA_REDIRECIONAMENTOS_PERMITIDOS` são listas
separadas por vírgula. Sem elas, o CORS não ecoa origem nenhuma e `conectar-conta`
recusa qualquer retorno — falha fechada, de propósito: `*` num endpoint que aceita
JWT convida qualquer site a chamar a função com a sessão do cliente aberta.

## Testes

```bash
npx vitest run supabase/politicas.test.js
```

O teste lê o SQL como texto e garante o que dá para garantir sem banco:

- toda tabela criada tem `enable row level security`;
- toda tabela com RLS tem política de **leitura para `authenticated`** (política
  só para `service_role` não conta: esse papel ignora RLS de qualquer forma);
- nenhuma política de escrita para `authenticated` nas tabelas de coleta, e
  nenhum `grant` além de `select` nelas;
- nenhum `grant` de coluna inclui `token_ref`, e as funções de cofre não são
  executáveis pelo usuário logado;
- nenhum arquivo da pasta contém chave, token ou senha literal;
- as migrations não divergiram do `schema.sql`;
- nenhuma função usa `select *`, lê variável `VITE_` ou põe token na query.

### Este teste NÃO substitui o teste de isolamento entre tenants

Ele prova que a política **existe**. Não prova que ela **filtra certo** — para
isso é preciso banco de verdade, dois tenants e duas sessões. Esse teste
continua no backlog (`docs/09_BACKLOG/`), e é `definition of done` de tabela
nova segundo `contratos.md` (seção 7). Até ele existir, rode o roteiro abaixo à
mão a cada mudança de política:

```bash
supabase start && supabase db reset
psql "$DATABASE_URL" -f supabase/seeds/metricas_canonicas.sql
```

```sql
-- 1. Dois tenants, dois usuários, uma conta em cada.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@exemplo.test'),
  ('22222222-2222-4222-8222-222222222222', 'b@exemplo.test');
insert into public.tenants (id, nome) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Agência A'),
  ('bbbbbbbb-2222-4222-8222-222222222222', 'Agência B');
insert into public.tenant_membros (tenant_id, user_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');
insert into public.ig_contas (id, tenant_id, ig_user_id, username, token_ref) values
  ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111',
   '1001', 'conta_a', 'ref-a'),
  ('dddddddd-2222-4222-8222-222222222222', 'bbbbbbbb-2222-4222-8222-222222222222',
   '1002', 'conta_b', 'ref-b');

-- 2. Vira o usuário A (é assim que o PostgREST chega ao banco).
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 3. As quatro perguntas que importam.
select count(*) from public.ig_contas;                   -- esperado: 1 (só a conta_a)
select token_ref from public.ig_contas;                  -- esperado: ERRO 42501
insert into public.snapshots_conta
  (ig_conta_id, data, metrica, valor, api_version, adapter_version)
  values ('cccccccc-1111-4111-8111-111111111111', current_date, 'alcance', 1, 'v', '1');
                                                          -- esperado: ERRO (sem grant)
select count(*) from public.diagnosticos;                -- esperado: 0
reset role;
```

Se qualquer uma das quatro responder diferente, a política está errada — e o
`politicas.test.js` não teria como saber.

## Nota: import de `src/` nas Edge Functions

`coleta-diaria` importa o adaptador de `src/metricas/adaptadores/` e
`gerar-diagnostico` importa o motor e o ruleset de `src/motor/` e `src/rules/`.
São módulos puros — sem rede, sem DOM, sem relógio, sem `import.meta.env` — e
`overview.md` diz explicitamente que eles existem para "rodar iguais no navegador
(modo demonstração) e no Deno da Edge Function".

A alternativa seria duplicá-los em `_compartilhado/`, e ela foi descartada: uma
segunda implementação do ruleset 0.3.0 divergiria da primeira na primeira
correção, e `ruleset_version` passaria a mentir — exatamente o que o ADR-005
existe para impedir. O mesmo vale para o adaptador: duas cópias do mapa de
métricas são dois significados para "alcance" (ADR-003).

O que **foi** duplicado, e por quê: `_compartilhado/respostas.ts` repete a forma
do envelope e a lista de códigos de erro de `src/lib/envelope.js` e
`src/lib/erros.js`. Aqueles dois leem `import.meta.env`, que só existe no bundle
do Vite; o que foi copiado são dois contratos estáveis de `contratos.md` (seção 1),
e não lógica de produto. Código novo lá precisa nascer aqui no mesmo commit.

Ao fazer `supabase functions deploy`, confirme que o bundler seguiu os imports
relativos para fora de `supabase/functions/`. Se um dia ele deixar de seguir, a
saída é um passo de cópia em `scripts/` antes do deploy — nunca uma segunda
implementação do método.

Dependência externa das funções: `jsr:@supabase/supabase-js@2`, resolvida por URL
pelo Deno. Ela **não** foi adicionada a `package.json` — o front já usa o mesmo
pacote pelo npm, e as funções não passam pelo bundler do Vite.

## Conflitos abertos

- **`diagnosticos.id` é `text`, não `uuid`.** O esqueleto previa
  `uuid default gen_random_uuid()`, mas `idDoDiagnostico` do motor devolve
  `diag:<conta>:<início>:<fim>:<versão>` — determinístico de propósito, para que
  reprocessar o mesmo período caia na mesma linha (ADR-005). O tipo seguiu o
  contrato do motor.
- **`coleta_eventos.status`.** O comentário do esqueleto dizia
  `ok | falha | token_expirado | rate_limit`, mas `montarHistorico` traduz
  `token_expirado`, `limite_de_taxa` e `falha_de_rede`. O schema adotou o
  vocabulário do motor (nome de domínio em português) e fechou com `check`.
- **`desconectar-conta` passou a existir.** As três pastas que
  `src/lib/conexaoMeta.js` invoca estão escritas. Desconectar é diferente de
  excluir: apaga o token e para a coleta, mas **preserva o histórico já
  coletado** — e é essa diferença que dá ao cliente uma saída que não custa
  meses de dado.
- **Teste de isolamento entre tenants com banco real** existe e roda no CI:
  `./scripts/testar-isolamento.sh` sobe um PostgreSQL efêmero, aplica as
  migrations reais e faz as asserções descritas em `supabase/testes/README.md`.
  Junto dele vão as do cofre do token, as do painel de saúde e as da varredura
  diária.
- **A conta `pausada` renovava token? Não, e agora renova.** A renovação mora
  dentro da coleta (ADR-009) e a coleta só varria `ativa`, então uma pausa de
  mais de 60 dias matava o token e virava desconexão de fato. `contas_da_varredura`
  passou a responder quem é varrido e quem pode ser coletado (ADR-011). Hoje
  nenhum código grava `pausada` — o conserto veio antes do escritor, de
  propósito.

---

## Como saber se a coleta parou

Falha de coleta vira linha em `coleta_eventos`; falha do motor vira log. Nenhum
dos dois avisa ninguém. A tela cobre o **cliente** — declara a idade do
diagnóstico e pede reconexão quando o token está vencendo —, mas isso chega por
ele, e dias depois. Num produto em que dia sem coleta não volta, essa é a
diferença entre perder um dia e perder um mês.

A view `public.saude_das_contas` responde numa consulta só. No SQL editor do
Supabase (que roda como `service_role`):

```sql
select username, status, dias_sem_coleta, motivo_da_ultima_falha,
       dias_sem_diagnostico, dias_ate_o_token_vencer
  from public.saude_das_contas
 order by dias_sem_coleta desc nulls first;
```

O que procurar, e por quê:

| Coluna | Sinal de alarme | Por quê |
|---|---|---|
| `dias_sem_coleta` | `null` numa conta `ativa` conectada há mais de um dia | nunca coletou: a conexão nasceu quebrada |
| `dias_sem_coleta` | maior que 1 | o cron não rodou, ou esta conta falha há dias |
| `motivo_da_ultima_falha` | `token_expirado` | a renovação automática não deu conta (ADR-009) |
| `dias_sem_diagnostico` | maior que `dias_sem_coleta` | a coleta anda e o motor não — falha só no log |
| `dias_ate_o_token_vencer` | menor que 15 numa conta `ativa` ou `pausada` | deveria ter renovado sozinho — as duas entram na varredura (ADR-011); ver `src/token/validade.js` |

**A view não julga de propósito.** Ela devolve contagem de dias e nada mais: os
prazos do produto vivem em `src/token/validade.js` e `src/motor/frescor.js`, e
repeti-los em SQL criaria uma segunda verdade que envelheceria sozinha no
primeiro ajuste. Os números da tabela acima são leitura de quem opera, não
constante de código.

**Ela não é alcançável pelo cliente**, e isso é cobrado duas vezes: view comum
roda com os privilégios do dono e atravessaria a RLS, então esta declara
`security_invoker` **e** revoga o `GRANT` de `anon` e `authenticated`.
`supabase/politicas.test.js` cobra as duas travas de **toda** view do
repositório, não só desta; `20-isolamento.sql` prova no banco que o cliente é
recusado e o `service_role` não.

O que ainda falta é o alerta: alguém precisa **olhar**. Notificação por serviço
externo é decisão de custo, e está adiada por padrão (`memory/restrictions.md`).
A pendência está em `docs/09_BACKLOG`.
