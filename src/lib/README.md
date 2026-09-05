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

`VITE_META_OAUTH_URL` ainda **não está em `.env.example`** e precisa entrar: sem
ela, `urlDeConsentimento` devolve falha em vez de montar a URL. Ela é variável, e
não literal, porque a versão da Graph API vive dentro do endereço do diálogo —
no dia em que a Meta mudar de versão, quem troca é o ambiente, não o código.

## Edge Functions chamadas daqui

`FUNCOES`, em `conexaoMeta.js`, guarda o nome da pasta em `supabase/functions/` —
é por ele que `invoke` resolve a chamada:

| Função da camada | Pasta |
|---|---|
| `concluirConexao` | `conectar-conta` |
| `solicitarExclusaoDeDados` | `excluir-dados` |
| `desconectarConta` | `desconectar-conta` — **ainda não existe** |

A pasta de desconexão precisa nascer: apagar o token do Vault é operação de
`service_role` e não tem caminho pelo front. Enquanto ela não existir,
`desconectarConta` devolve falha em vez de desconectar.

## Testes

`envelope`, `erros`, `validacao`, `conexaoMeta` e `demonstracao/repositorio` têm
teste próprio (`npx vitest run src/lib`). Os que mais importam:

- o `scope` do diálogo da Meta é comparado caractere a caractere com as quatro
  permissões do ADR-002 — permissão a mais reprova no App Review;
- a mensagem crua do banco não aparece em `error.mensagem`, e `error.detalhe`
  some quando `import.meta.env.DEV` é falso;
- o diagnóstico da demonstração é recalculado pelo motor dentro do teste e
  comparado com o que o repositório serve: se alguém trocar o motor por texto
  fixo, o teste cai (ADR-005).

## As constantes `CAMPOS` espelham os `grant` do schema

`supabase/schema.sql` não concede a tabela inteira: concede coluna a coluna, e
`ig_contas.token_ref` fica de fora. Por isso a lista de cada módulo não é
preferência de estilo — pedir uma coluna a mais faz o banco recusar a consulta
inteira, e `select *` falha com "permission denied for column token_ref".

| Módulo | Tabela | Base da lista |
|---|---|---|
| `tenants.js` | `tenants` | `grant select (id, nome, plan, status, identidade, criado_em)` |
| `contas.js` | `ig_contas` | o `grant` da tabela, sem `token_ref` |
| `diagnosticos.js` | `diagnosticos` | colunas do `Diagnostico` (`contratos.md`, seção 3) |
| `snapshots.js` | `snapshots_conta`, `coleta_eventos` | só o que a série semanal usa |
| `coleta.js` | `coleta_eventos` | evento e motivo, para a tela nomear a lacuna |

Mudar uma dessas listas é mudança combinada com o schema, no mesmo commit.
