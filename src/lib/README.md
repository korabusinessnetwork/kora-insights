# `src/lib` — camada de serviços

Todo acesso ao backend passa por aqui, nunca no componente. Nenhuma tela importa
`@supabase/supabase-js`; nenhuma tela sabe se o dado veio do Postgres ou da
fixture (`overview.md`, "Fronteira").

## O contrato em três linhas

- Toda função devolve `Promise<Envelope>` — `{ data, error, meta }` — **inclusive
  em sucesso** (`contratos.md`, seção 1).
- `error.codigo` é estável e é por ele que a tela decide; `error.mensagem` é
  pt-BR e é o que o cliente lê.
- `meta.origem` é `supabase` ou `demonstracao`. É o único lugar em que a
  diferença entre os dois modos aparece.

Única exceção deliberada: `aoMudarSessao(cb)` devolve a função que cancela a
observação, porque é disso que um `useEffect` precisa para desmontar limpo. O
envelope continua existindo — ele chega no callback, a cada mudança.

## Mapa

| Arquivo | Papel |
|---|---|
| `supabase.js` | cliente singleton, modo de demonstração, execução com erro já traduzido |
| `envelope.js` | `ok` / `falha` / `montarMeta` |
| `erros.js` | `CODIGOS`, tradução de erro cru do PostgREST e da rede |
| `validacao.js` | validadores puros, usados **antes** de tocar o banco |
| `autenticacao.js` | sessão do usuário do produto (não a autorização da Meta) |
| `tenants.js`, `contas.js` | espaço de trabalho e contas conectadas |
| `diagnosticos.js` | lê e converte o diagnóstico pronto — nunca gera |
| `snapshots.js` | série semanal, agregada pelo `montarHistorico` do motor |
| `coleta.js` | eventos de coleta: a lacuna que a tela precisa mostrar (ADR-004) |
| `conexaoMeta.js` | OAuth da Meta e as Edge Functions de conexão e exclusão |
| `demonstracao/` | repositório local sobre a fixture, atrás do mesmo contrato |

## Regras que reprovam código nesta pasta

- Nenhum `select *`: cada módulo declara os campos em uma constante `CAMPOS`.
- `ig_contas.token_ref` nunca entra em lista de campos. O token da Meta vive no
  Vault e só a Edge Function o lê.
- Nenhuma mensagem crua do banco chega à tela: ela nomeia tabela e coluna. Fora
  de produção ela vai em `error.detalhe`, e só lá.
- Nenhum diagnóstico é calculado aqui. `diagnosticos.js` lê e converte (ADR-005);
  a agregação semanal é do motor, não desta camada.
- Nenhum `console.log` de payload.

## Ausência não é sempre "não encontrado"

RLS que nega **leitura** devolve conjunto vazio, não erro. Onde dá para
distinguir, a camada distingue, consultando se a conta dona é visível
(`contas.contaEstaVisivel`):

| Situação | Código |
|---|---|
| conta invisível para o usuário (Supabase) | `SEM_PERMISSAO` |
| conta invisível na demonstração (universo conhecido) | `NAO_ENCONTRADO` |
| conta visível, ainda sem diagnóstico ou sem coleta | `SEM_DADO_SUFICIENTE` |
| id fora de formato | `ENTRADA_INVALIDA`, sem tocar o banco |

A consulta extra só acontece quando a resposta veio vazia — o caminho feliz
continua com uma ida ao banco.

## Ambiente

| Variável | Uso |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | sem as duas, o produto entra em modo de demonstração |
| `VITE_META_APP_ID` | id do app da Meta no diálogo de consentimento |
| `VITE_META_OAUTH_URL` | URL do diálogo de OAuth (inclui a versão da Graph API) |
| `VITE_META_REDIRECT_URI` | opcional; sem ela, `origin + /conectar/retorno` |

Segredo de servidor **nunca** ganha prefixo `VITE_`: o que tem esse prefixo vai
para o bundle. O app secret da Meta e a `service_role` não existem neste código.

## Conflitos abertos com `supabase/schema.sql`

O schema é o esqueleto inicial e ainda não tem colunas que `contratos.md` e a
fixture exigem. Enquanto a migration não existir, estas leituras falham:

- `diagnosticos.limites` e `diagnosticos.cobertura` (jsonb) — fazem parte do
  `Diagnostico` de `contratos.md` (seção 3). Sem elas a tela mostraria veredito
  sem os limites que o sustentam.
- `ig_contas.nome` e `ig_contas.tem_trafego_pago` — a fixture já os tem, e o
  segundo alimenta `recursos.temTrafegoPago` do histórico.
- `tenants.identidade` (jsonb) — tokens de marca do white-label (`src/tema`).
