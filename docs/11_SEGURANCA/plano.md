# Plano de segurança

> Superfície de ataque, onde vive cada segredo, o que nunca pode ser registrado e
> o checklist que reprova um PR. Escrito para ser conferido, não para tranquilizar.
> Última revisão: 2026-09-05.

---

## 1. A pergunta que organiza o plano

**Qual é a pior coisa que pode acontecer?**

Vazar o token da Meta de um cliente. Com ele, um terceiro lê os insights da conta
daquela marca — e, dependendo das permissões, faz mais do que ler. O produto
inteiro é desenhado em volta de reduzir a superfície desse dado: por isso o token
está no Vault, por isso `token_ref` não é concedido a `authenticated`, e por isso
só a Edge Function fala com a Meta.

A segunda pior é vazamento **entre tenants**: uma agência ver o diagnóstico da
conta de outra. É o que a RLS impede, e é o que ainda não temos teste automatizado
para provar (seção 7).

---

## 2. Superfície de ataque

| Superfície | O que está exposto | Como está protegida | Risco residual |
|---|---|---|---|
| Bundle do front | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_META_APP_ID`, `VITE_META_OAUTH_URL`, `VITE_META_REDIRECT_URI` | tudo aqui é público **por design**; o isolamento vem da RLS, não do sigilo da chave anon | nenhum, desde que nenhum segredo de servidor ganhe prefixo `VITE_` |
| PostgREST (`/rest/v1`) | todas as tabelas com `select` | `revoke all` + `grant select` por coluna + RLS por `tenant_membros` | política errada só aparece com banco real (seção 7) |
| RPC do Postgres | `guardar_token`, `ler_token`, `apagar_token`, `disparar_funcao_agendada` | `EXECUTE` revogado de `public`, `anon` e `authenticated`; só `service_role` | se um dia o `revoke` for esquecido numa migration, o Vault vira enfeite |
| Edge Functions com JWT | `conectar-conta`, `excluir-dados` | sessão validada pelo Supabase Auth; CORS por allowlist; pertencimento ao tenant conferido à mão | `service_role` ignora RLS: **toda função precisa conferir pertencimento** |
| Edge Functions do cron | `coleta-diaria`, `gerar-diagnostico` | `ehChamadaDeServico`, comparação em tempo constante | sem ela, qualquer um dispararia a coleta de todas as contas |
| Callback do OAuth | `/conectar/retorno` | `state` de 128 bits, de uso único; `redirect_uri` em allowlist | navegação privada pode recusar `sessionStorage`; o fluxo recomeça, que é melhor que aceitar retorno sem conferência |
| Graph API | token do cliente | cabeçalho `Authorization`, timeout de 20 s, orçamento de chamadas | mensagem de erro da Meta pode ecoar requisição: é cortada em 200 caracteres |
| Logs | painel de logs do Supabase | `registrar()` mascara token, JWT e pares de segredo | máscara é última linha de defesa, não primeira |
| Migrations no git | SQL versionado | segredos do cron ficam no Vault, lidos em execução | segredo em migration é segredo vazado, para sempre, no histórico |

### Ataques específicos que o código trata pelo nome

- **CSRF no OAuth.** Sem `state` imprevisível e de uso único, um terceiro monta
  um retorno com o `code` da conta dele, induz o cliente a clicar, e a conta do
  atacante fica vinculada ao tenant da vítima. `Math.random` não serve: a
  sequência é reconstruível a partir de saídas observadas.
- **Redirect aberto.** Sem `KORA_REDIRECIONAMENTOS_PERMITIDOS`, o servidor
  assinaria a troca do código apontando para o endereço que o atacante
  escolhesse.
- **Sequestro de conta entre tenants.** Sem a checagem de `ig_user_id`, um
  `upsert` moveria a conta e o histórico dela para quem conectasse por último.
- **CORS permissivo.** `*` num endpoint que aceita JWT convida qualquer site a
  chamar a função com a sessão do cliente aberta. Sem allowlist configurada,
  nenhuma origem é ecoada — falha fechada.
- **Timing na comparação da chave de serviço.** A comparação percorre os dois
  valores inteiros para não vazar o tamanho do prefixo correto pelo tempo.
- **Recursão de política (42P17).** Uma política que lê a própria tabela reentra
  nela mesma; `security definer` com `search_path` fixo corta o ciclo.

---

## 3. Onde vive cada segredo

| Segredo | Onde vive | Quem lê | Nunca aparece em |
|---|---|---|---|
| Token de acesso da Meta (por conta) | Supabase Vault, nome `ig_conta_<ig_user_id>` | `coleta-diaria`, via `ler_token` | banco em claro, front, log, URL, resposta de API |
| `META_APP_SECRET` | `supabase secrets` | `conectar-conta` | bundle do front, `.env` de repositório, migration |
| `SUPABASE_SERVICE_ROLE_KEY` | injetada pela plataforma; cópia no Vault como `kora_chave_de_servico` para o cron | Edge Functions e `disparar_funcao_agendada` | qualquer bundle de front, qualquer arquivo do git |
| URL das functions (para o cron) | Vault, `kora_url_das_functions` | `disparar_funcao_agendada` | migration |
| `SUPABASE_ANON_KEY` | ambiente e bundle | front e validação de JWT nas funções | — (é pública por design) |
| Sessão do usuário | Supabase Auth, no navegador | front | `console.log`; `converterSessao` remove `access_token` e `refresh_token` antes de a sessão sair da camada |

**Regra de ouro:** segredo de servidor **nunca** ganha prefixo `VITE_`. O que tem
esse prefixo vai para o bundle. `supabase/politicas.test.js` falha se alguma
função ler uma variável `VITE_`.

---

## 4. O que nunca pode ser registrado

```
NUNCA em log, em telemetria, em mensagem de erro ou em URL:
  - token de acesso da Meta, em qualquer forma
  - o `code` do OAuth
  - a referencia do cofre (token_ref)
  - JWT do usuario
  - app secret, service_role key, qualquer chave
  - payload cru da Graph API
  - mensagem crua do Postgres (nomeia tabela, coluna e formato de schema)
  - e-mail do usuario junto de identificador de conta do cliente
```

O que **pode** ser registrado, e é o que os logs de hoje registram:

| Evento | Campos |
|---|---|
| `conexao.concluida` | tenant, conta, se foi reconexão |
| `conexao.recusada` | tenant, código do erro |
| `coleta.concluida` | dia, total de contas, coletadas, com falha |
| `coleta.evento_nao_registrado` | status, código de erro do banco |
| `diagnostico.gerado` | id do diagnóstico, versão do ruleset |
| `diagnostico.falhou` | conta, causa |
| `exclusao.concluida` | **só o protocolo** |

`registrar()` aplica três padrões de máscara (token da Meta, JWT, pares
`token=`/`secret=`/`apikey=`). Ela existe porque um dia alguém vai logar o
payload inteiro por engano, e nesse dia o token não pode acabar no painel de
logs. Mas contar com a máscara é errar duas vezes.

**Detalhe de erro fora de produção.** `error.detalhe` só é preenchido quando
`import.meta.env.DEV` é verdadeiro. Em produção, o cliente recebe a frase pt-BR
do código e nada mais.

---

## 5. Controles por camada

**Front (React).** Apenas chave anon. Nenhuma regra de diagnóstico. Autenticação
verificada **antes** de renderizar rota protegida. Nenhum token de terceiro em
memória do cliente. Acesso ao backend somente por `src/lib`.

**Camada de serviços (`src/lib`).** Envelope sempre; validação antes de tocar o
banco; campos explícitos que espelham o `grant` por coluna; erro do Supabase
traduzido para `CODIGOS`, nunca vazado cru; `token_ref` fora de toda lista de
campos.

**Banco (Supabase).** RLS habilitada **e com política** em toda tabela; acesso
derivado de `tenant_membros`; escrita de coleta e diagnóstico exclusiva de
`service_role`; `grant` por coluna como segunda trava, porque RLS filtra linha e
nunca coluna.

**Edge Functions.** Único ponto que toca a Graph API e o Vault. Validam entrada,
conferem pertencimento à mão (`service_role` ignora RLS), tratam
`LIMITE_DE_TAXA` e `TOKEN_EXPIRADO` como estados de negócio e não como exceção
silenciosa.

**Meta.** Mínimo de permissões (ADR-002). Token no cabeçalho. Orçamento de
chamadas que para antes de a Meta recusar.

---

## 6. Checklist de PR

Cada item reprova sozinho.

**Segredo e ambiente**
- [ ] Nenhuma chave, secret, senha ou URL de API literal no código
- [ ] Nenhuma variável de servidor com prefixo `VITE_`
- [ ] Nenhum endereço de aplicação hardcodado (sai de `origin` ou do ambiente)
- [ ] Variável nova documentada em `docs/07_APIS/edge-functions.md`, seção 9

**Banco**
- [ ] Tabela nova tem `enable row level security` **e** política de leitura para `authenticated`
- [ ] Tabela nova repete o próprio `revoke`/`grant` (o `revoke` do schema não alcança tabela criada depois)
- [ ] Nenhum `grant` inclui `token_ref`
- [ ] Nenhum `select *`; campos explícitos, espelhando o `grant`
- [ ] Migration e `schema.sql` mudaram no mesmo commit
- [ ] Função `security definer` nova tem `search_path` fixo e `EXECUTE` revogado de `anon` e `authenticated`

**Dado e log**
- [ ] Nenhum dado sensível em log (seção 4)
- [ ] Nenhuma mensagem crua do banco ou da Meta chega à tela
- [ ] Erro de backend tratado com `try/catch` ou checagem de `.error`

**Produto**
- [ ] Nenhum diagnóstico calculado na tela
- [ ] Nenhuma métrica persistida ou exibida com o nome da Meta
- [ ] Nenhuma lacuna de dado escondida da tela
- [ ] Nenhuma marca, cor, logo ou regra de cliente hardcodada
- [ ] Rota protegida verifica sessão antes de renderizar
- [ ] Os quatro estados renderizam: carregando, vazio, erro, sucesso

**Testes**
- [ ] Função pura nasceu com teste
- [ ] `npx vitest run` verde
- [ ] Tabela nova: teste de isolamento entre tenants (ver seção 7)

---

## 7. O buraco conhecido: teste de isolamento

`supabase/politicas.test.js` lê o SQL como texto e prova que a política
**existe**: RLS em toda tabela, política de leitura para `authenticated` em toda
tabela com RLS, nenhum `grant` com `token_ref`, funções de cofre inexecutáveis
pelo usuário logado, migrations sem divergir do `schema.sql`, nenhuma chave
literal, nenhum `select *`, nenhuma variável `VITE_` nas funções.

**Ele não prova que a política filtra certo.** Para isso é preciso banco de
verdade, dois tenants e duas sessões — e esse teste não existe.

Até ele existir, o roteiro manual de `supabase/README.md` roda a cada mudança de
política, e as quatro perguntas que importam são:

```sql
select count(*) from public.ig_contas;    -- 1, so a conta do proprio tenant
select token_ref from public.ig_contas;   -- ERRO 42501
insert into public.snapshots_conta ...;   -- ERRO, sem grant
select count(*) from public.diagnosticos; -- 0
```

Se qualquer uma responder diferente, a política está errada — e o teste de texto
não teria como saber. Isto é `definition of done` de tabela nova segundo
`contratos.md`, seção 7, e está em `docs/09_BACKLOG`.

---

## 8. O que falta, em ordem de urgência

| Pendência | Por que importa | Onde |
|---|---|---|
| Teste de isolamento com banco real | é o único que prova o isolamento entre tenants | backlog |
| Política de privacidade publicada | bloqueia o App Review | rota `/privacidade` |
| Prazo de retenção declarado | sem ele não há política de privacidade | ADR novo |
| `desconectar-conta` | hoje só existe exclusão total, que apaga mais do que o titular pediu | backlog |
| Renovação de token e aviso ao cliente | a conta quebra em silêncio até a coleta falhar | ADR novo |
| Exportação do histórico pelo cliente | prometida em ADR-004 e vendida em `docs/13_VENDA` | backlog |
| Monitoramento de falha do motor | hoje ela só existe no log | backlog |
| `VITE_META_OAUTH_URL` em `.env.example` | sem ela o OAuth não monta a URL e a falha parece bug | `.env.example` |
