# Edge Functions — contrato de cada função

> Quatro funções existem, uma está prevista e não existe. Todas respondem no
> envelope do produto e todas rodam em Deno, no Supabase, com `service_role`.
> Código: `supabase/functions/`. Última revisão: 2026-09-05.

---

## 1. Mapa

| Pasta | Quem chama | Autorização | Existe? |
|---|---|---|---|
| `conectar-conta` | front, via `src/lib/conexaoMeta.js` | JWT do usuário | sim |
| `coleta-diaria` | pg_cron, via `disparar_funcao_agendada` | `SUPABASE_SERVICE_ROLE_KEY` | sim |
| `gerar-diagnostico` | pg_cron, e manualmente no suporte | `SUPABASE_SERVICE_ROLE_KEY` | sim |
| `excluir-dados` | front, via `src/lib/conexaoMeta.js` | JWT do usuário | sim |
| `desconectar-conta` | front, via `src/lib/conexaoMeta.js` | JWT do usuário | **não** |

Os nomes de pasta são resolvidos por `invoke` a partir de `FUNCOES`, em
`src/lib/conexaoMeta.js`: **renomear pasta é mudança combinada** com aquele
arquivo, no mesmo commit.

## 2. Convenções comuns

- **Método:** `POST`. `OPTIONS` responde 200 com os cabeçalhos de CORS.
- **CORS:** a origem só é ecoada se estiver em `KORA_ORIGENS_PERMITIDAS`. Sem
  valor no ambiente, **nenhuma** origem é ecoada — falha fechada de propósito:
  `*` num endpoint que aceita JWT convida qualquer site a chamar a função com a
  sessão do cliente aberta.
- **Corpo:** JSON. Corpo torto vira `{}` em vez de derrubar a função.
- **Resposta:** sempre `{ data, error, meta }`, com o status HTTP do código.
- **Log:** `registrar(evento, dados)` mascara token, JWT e pares
  `access_token=`, `client_secret=`, `apikey=`, `authorization=`, `token=`. A
  máscara é a **última** linha de defesa, não a primeira: a regra continua sendo
  não passar segredo para lá.
- **Validação de identificador:** UUID v4 minúsculo, ou o identificador legível
  da fixture no front.

### Duplicação consciente

`_compartilhado/respostas.ts` repete a forma do envelope e a lista de códigos de
`src/lib/envelope.js` e `src/lib/erros.js`. Aqueles dois leem `import.meta.env`,
que só existe no bundle do Vite. O que foi copiado são dois contratos estáveis de
`contratos.md`, seção 1 — **não é lógica de produto**. Código novo lá precisa
nascer aqui no mesmo commit.

O que **não** foi duplicado: o adaptador de métricas, o motor e o ruleset. Eles
são importados de `src/` porque são módulos puros e porque duas cópias do
ruleset 0.3.0 divergiriam na primeira correção, fazendo `ruleset_version` mentir
— exatamente o que o ADR-005 existe para impedir.

---

## 3. `conectar-conta`

Conclui a conexão de uma conta profissional (ADR-002).

**Autorização:** JWT do usuário, validado pelo próprio Supabase Auth com a chave
anon — nunca decodificando o token à mão.

**Corpo**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `codigo` | string | sim | `code` do retorno do OAuth, `[A-Za-z0-9._\-#]{20,512}` |
| `redirecionamento` | string | sim | precisa estar em `KORA_REDIRECIONAMENTOS_PERMITIDOS` |
| `tenantId` | string | não | obrigatório na prática quando o usuário tem mais de um tenant |

**Resposta `data`:** a linha de `ig_contas` com os campos
`id, tenant_id, ig_user_id, username, nome, fb_page_id, status, conectada_em,
token_expira_em, tem_trafego_pago`. **`token_ref` nunca sai.**

**Falhas**

| Código | Quando |
|---|---|
| `SEM_SESSAO` | sem JWT válido |
| `ENTRADA_INVALIDA` | `code` fora de formato, `redirect_uri` não autorizada, ou nenhuma Página administrada tem conta do Instagram vinculada |
| `SEM_PERMISSAO` | usuário não pertence ao tenant pedido; usuário tem vários tenants e não escolheu; a conta já está conectada em outro tenant |
| `TOKEN_EXPIRADO`, `LIMITE_DE_TAXA`, `FALHA_DE_REDE` | vindos da classificação da Graph API |
| `FALHA_INESPERADA` | ambiente incompleto, falha do Vault ou do banco |

**Ambiente:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`META_GRAPH_URL`, `META_APP_ID`, `META_APP_SECRET`,
`KORA_REDIRECIONAMENTOS_PERMITIDOS`, `KORA_ORIGENS_PERMITIDAS`.

**Efeitos:** grava o token no Vault (`guardar_token`), insere ou atualiza
`ig_contas`, registra `conexao.concluida` com tenant, conta e se foi reconexão —
sem `code`, sem token, sem referência do cofre.

---

## 4. `coleta-diaria`

Snapshot diário (ADR-004).

**Autorização:** `ehChamadaDeServico` — comparação do `Authorization` com
`SUPABASE_SERVICE_ROLE_KEY` percorrendo os dois valores inteiros, para não vazar
o tamanho do prefixo correto pelo tempo de resposta. Sem essa checagem, qualquer
um na internet dispararia a coleta de todas as contas do produto.

**Corpo**

| Campo | Tipo | Padrão |
|---|---|---|
| `dia` | string `YYYY-MM-DD` | `diaFechadoAnterior(agora)` — o dia fechado anterior em America/Sao_Paulo |

**Resposta `data`:** `{ dia, contas, coletadas, comFalha }`.

**Falhas:** `SEM_PERMISSAO` (chamada sem chave de serviço), `FALHA_INESPERADA`
(ambiente incompleto, ou não foi possível listar as contas ativas — que também
vira evento com `ig_conta_id` nulo).

Falha **de uma conta** não é falha da função: ela vira linha em `coleta_eventos`
e a execução continua. A resposta 200 com `comFalha > 0` é o resultado esperado
num dia em que uma conta teve o token vencido.

**Efeitos:** `upsert` em `snapshots_conta` e `snapshots_midia`, `insert` em
`coleta_eventos` (uma linha por conta, sempre), e `update` de
`ig_contas.status` para `token_expirado` quando for o caso.

**Ambiente:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `META_GRAPH_URL`.

---

## 5. `gerar-diagnostico`

Motor de regras no servidor (ADR-005).

**Autorização:** `ehChamadaDeServico`.

**Corpo**

| Campo | Tipo | Efeito |
|---|---|---|
| `contaId` | string | diagnostica só essa conta; sem ele, todas as contas em `ativa`, `pausada` e `token_expirado` |

**Resposta `data`:** `{ contas, gerados, comFalha, ruleset }`.

**Falhas:** `SEM_PERMISSAO`, `NAO_ENCONTRADO` (quando `contaId` foi pedido e não
existe), `FALHA_INESPERADA`.

**Efeitos:** `upsert` em `diagnosticos` por `id` determinístico. Lê 24 semanas de
histórico por conta, em páginas de 1000 linhas — o PostgREST corta em 1000 em
silêncio, e série truncada produz um diagnóstico plausível e errado.

**A falha de uma conta não vira evento de coleta.** `montarHistorico` traduziria
isso em lacuna, e a coleta do dia pode ter ido bem: lacuna inventada é tão
desonesta quanto lacuna escondida. A falha fica no log, e por isso ela precisa de
monitoramento próprio, que ainda não existe.

**Ambiente:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 6. `excluir-dados`

Exclusão exigida pela LGPD e pelo App Review.

**Autorização:** JWT do usuário. Como `service_role` ignora RLS, o pertencimento
ao tenant é conferido **na mão** dentro da função — esquecer essa checagem
transformaria a função num apagador universal de contas alheias.

**Corpo**

| Campo | Tipo | Regra |
|---|---|---|
| `contaId` | string | UUID v4 |

**Resposta `data`:** `{ protocolo, solicitadoEm, concluidoEm, itensApagados }`.
O protocolo tem formato `KORA-AAAAMMDD-XXXXXXXX`, legível de propósito: o cliente
vai ditá-lo por telefone.

**Falhas:** `SEM_SESSAO`, `ENTRADA_INVALIDA`, `NAO_ENCONTRADO`, `SEM_PERMISSAO`,
`FALHA_INESPERADA` — esta última **com o protocolo na mensagem**, porque uma
exclusão interrompida precisa deixar rastro na mão do cliente.

**Efeitos, nesta ordem:** grava o protocolo → apaga `snapshots_midia`,
`snapshots_conta`, `diagnosticos`, `coleta_eventos` → apaga o token do Vault →
apaga `ig_contas` → completa o protocolo com `concluido_em` e `itens_apagados`.

O comprovante é gravado **antes** de a exclusão começar; a ordem inversa deixaria
um apagamento parcial sem nenhum rastro de por que aconteceu. O log registra só o
protocolo: o log de uma exclusão não pode virar a cópia que sobrou do que foi
apagado.

**Ambiente:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 7. `desconectar-conta` — prevista, inexistente

`src/lib/conexaoMeta.js` invoca a pasta `desconectar-conta`, que não foi escrita.
Enquanto isso, `desconectarConta(contaId)` devolve falha em vez de desconectar, e
**o botão não pode ser oferecido na tela como se funcionasse**.

Contrato pretendido:

```
POST desconectar-conta
Autorizacao: JWT do usuario
Corpo:       { contaId: uuid }
Resposta:    { id, status: 'desconectada' }

Efeitos:
  1. conferir pertencimento ao tenant (service_role ignora RLS)
  2. apagar_token(conta.token_ref)
  3. ig_contas.status = 'desconectada'
  4. NAO apagar snapshots, diagnosticos nem eventos
```

Desconectar apaga o token e para a coleta; **preserva o histórico**. Excluir
apaga tudo e emite protocolo. Confundir os dois destrói dado que o cliente não
pediu para destruir.

Apagar o segredo do Vault é operação de `service_role` e não tem caminho pelo
front: não há atalho. Pendência registrada aqui, em `supabase/README.md`, em
`src/lib/README.md` e em `docs/09_BACKLOG`.

---

## 8. Agendamento

`supabase/migrations/20260905120200_agendamento_da_coleta.sql` cria dois jobs de
pg_cron que chamam as funções por pg_net:

| Job | Cron (UTC) | Hora em America/Sao_Paulo | Função |
|---|---|---|---|
| `kora-coleta-diaria` | `0 7 * * *` | 04:00 | `coleta-diaria` |
| `kora-gerar-diagnostico` | `40 7 * * *` | 04:40 | `gerar-diagnostico` |

Nem a URL das funções nem a chave de serviço aparecem no SQL: as duas vivem no
Vault (`kora_url_das_functions`, `kora_chave_de_servico`) e são lidas em tempo de
execução. **Migration entra no git, e segredo em git é segredo vazado.**

Sem segredo cadastrado o job não "segue em frente": registra
`falha_inesperada` em `coleta_eventos` e para. Cron que erra em silêncio produz
lacuna sem motivo, que é exatamente o que o ADR-004 proíbe.

O intervalo de 40 minutos entre os dois não é folga arbitrária: a coleta percorre
todas as contas respeitando o limite de 200 chamadas por hora, e apertar a janela
faria o diagnóstico nascer sobre uma série incompleta.

---

## 9. Variáveis de ambiente

**Nenhuma variável de servidor leva prefixo `VITE_`** — esse prefixo publica a
variável no bundle do navegador. `supabase/politicas.test.js` falha se alguma
função ler uma.

| Variável | Onde | Para quê |
|---|---|---|
| `META_GRAPH_URL` | servidor | base da Graph API, com a versão embutida |
| `META_APP_ID`, `META_APP_SECRET` | servidor | troca do `code` por token |
| `KORA_ORIGENS_PERMITIDAS` | servidor | lista de origens do CORS, separada por vírgula |
| `KORA_REDIRECIONAMENTOS_PERMITIDOS` | servidor | lista de `redirect_uri` aceitas |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | servidor | injetadas pela plataforma |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | front | sem as duas, o produto entra em modo de demonstração |
| `VITE_META_APP_ID`, `VITE_META_OAUTH_URL`, `VITE_META_REDIRECT_URI` | front | monta o diálogo de consentimento |

**`VITE_META_OAUTH_URL` ainda não está em `.env.example`** e precisa entrar: sem
ela, `urlDeConsentimento` devolve falha em vez de montar a URL. Ela é variável, e
não literal, porque a versão da Graph API vive dentro do endereço do diálogo.

Dependência externa das funções: `jsr:@supabase/supabase-js@2`, resolvida por URL
pelo Deno. Ela **não** foi adicionada a `package.json` — o front já usa o mesmo
pacote pelo npm, e as funções não passam pelo bundler do Vite.
