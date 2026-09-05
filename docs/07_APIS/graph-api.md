# Graph API — o que chamamos, e o que justifica cada permissão

> Instagram API with Facebook Login (ADR-002). Todas as chamadas partem de
> `supabase/functions/_compartilhado/graphApi.ts`, o **único** ponto do produto
> que fala com a Meta.
> Última revisão: 2026-09-05.

---

## 1. As permissões, e a tela de cada uma

Quatro permissões, congeladas em `PERMISSOES` (`src/lib/conexaoMeta.js`) e
comparadas caractere a caractere em teste. **Permissão sem tela correspondente é
causa clássica de reprovação no App Review** (`memory/restrictions.md`), então
esta tabela é material de submissão, não documentação interna.

| Permissão | O que ela habilita no produto | Tela que a justifica | O que o revisor vê |
|---|---|---|---|
| `instagram_basic` | ler id, `username` e nome da conta profissional, e listar as mídias publicadas | `/conectar/retorno` e o cabeçalho de `/contas/:contaId` | a conta aparece nomeada ("Casa Oliveira @casa.oliveira"); a contagem de publicações por semana sai da lista de mídias |
| `instagram_manage_insights` | ler alcance, visualizações, interações, visitas ao perfil, seguidores, salvamentos e compartilhamentos | `/contas/:contaId` (evidência e gráfico) e `/contas/:contaId/relatorio` | os três indicadores da tela de diagnóstico e a tabela do relatório |
| `pages_show_list` | listar as Páginas do Facebook que o usuário administra, para achar a conta do Instagram vinculada | `/conectar` e `/conectar/retorno` | a tela explica o requisito antes do clique, e o retorno mostra qual conta foi encontrada |
| `pages_read_engagement` | ler o vínculo `instagram_business_account` na Página administrada | `/conectar` e `/conectar/retorno` | mesma tela acima |

### O ponto frágil, dito antes que a Meta diga

`pages_read_engagement` é a permissão com o vínculo mais fraco com uma tela: o
produto **não exibe nenhum dado de engajamento da Página do Facebook**. Ela é
pedida porque é o que a variante exige para ler o vínculo entre a Página e a
conta profissional do Instagram em `/me/accounts`.

Se a revisão não aceitar a tela de conexão como justificativa, há duas saídas, e
nenhuma é reescrever o produto: demonstrar no screencast que sem ela
`descobrirContaProfissional` devolve vazio, ou remover a permissão do pedido e
verificar se o vínculo continua legível. **A verificação prática ainda não foi
feita** e é item de `docs/11_SEGURANCA/app-review.md`.

### O que NÃO pedimos, e por quê

`instagram_content_publish` e `instagram_manage_comments` ficam fora: não há tela
que as justifique, e pedir poder de publicar ou moderar comentário a um produto
de diagnóstico é pedir poder que o produto não usa (ADR-002). Pedir permissão a
mais é um pedido a mais para justificar no review e um risco a mais sobre a conta
do cliente.

`business_discovery` é Fase 2 (ADR-006) e **não é pedido hoje**.

---

## 2. As chamadas que existem

Base: `META_GRAPH_URL`, com a versão embutida (ex.: `https://graph.facebook.com/v23.0`).
Vem do ambiente porque a versão caduca.

### 2.1 Troca do código por token — `POST /oauth/access_token`

Duas chamadas, porque a Meta exige duas:

```
1. code + client_id + client_secret + redirect_uri  -> token de curta duracao
2. grant_type=fb_exchange_token + fb_exchange_token -> token de ~60 dias
```

- **Método POST com corpo `x-www-form-urlencoded`.** O app secret e o `code` não
  podem ir na query pelo mesmo motivo do token: URL aparece em log.
- O app secret só existe no servidor. Ele **não está no bundle do front e não
  pode estar**.
- `expires_in` vira `token_expira_em` em `ig_contas`; se a Meta não mandar, a
  coluna fica nula.

Chamada por: `conectar-conta`.

### 2.2 Descobrir a conta profissional — `GET /me/accounts`

```
fields = id,name,instagram_business_account{id,username,name}
limit  = 50
```

Percorre as Páginas administradas e devolve a **primeira** que tem conta do
Instagram vinculada. Se nenhuma tiver, devolve vazio — e o fluxo responde
`ENTRADA_INVALIDA` com a instrução de vincular a conta à Página.

Consequência que precisa estar escrita: **quem administra várias Páginas com
contas vinculadas conecta a primeira que a Meta devolver.** Não há tela de
escolha. Não decidido; a decisão mora numa tela nova de seleção de conta.

Chamada por: `conectar-conta`.

### 2.3 Insights diários da conta — `GET /{ig-user-id}/insights`

```
metric = reach,views,total_interactions,profile_views,follower_count
period = day
since  = 00:00 UTC do dia coletado
until  = since + 86400
```

Uma chamada por conta por dia. O dia é sempre o **dia fechado anterior**, nunca o
dia em curso.

Chamada por: `coleta-diaria`.

### 2.4 Mídias publicadas — `GET /{ig-user-id}/media`

```
fields = id,media_product_type,media_type,timestamp,like_count,comments_count,
         insights.metric(reach,views,saved,shares,total_interactions)
since  = dia coletado - 7 dias
limit  = 50
```

`insights` vai **aninhado** de propósito: uma chamada por lote de mídias em vez
de uma por mídia. Com 200 chamadas por hora para todas as contas do usuário, cada
ida evitada é uma conta a mais coletada no mesmo dia.

Sete dias para trás porque métrica de mídia é total acumulado e continua se
movendo depois da publicação; a chave `unique (ig_media_id, data, metrica)`
garante que reler não duplica linha.

Chamada por: `coleta-diaria`.

---

## 3. Do payload da Meta ao dicionário canônico

Nenhuma das chamadas acima persiste o nome que a Meta usa (ADR-003). O adaptador
de `src/metricas/adaptadores/v1.js` traduz na entrada:

| Nome na Meta | Código canônico | Escopo |
|---|---|---|
| `reach` | `alcance` | conta, mídia |
| `views`, `impressions` | `visualizacoes` | conta, mídia |
| `total_interactions` | `interacoes` | conta, mídia |
| `profile_views` | `visitas_ao_perfil` | conta |
| `follower_count`, `followers_count` | `seguidores` | conta |
| `saved` | `salvamentos` | mídia |
| `shares` | `compartilhamentos` | mídia |
| `likes`, `like_count` | `curtidas` | mídia |
| `comments`, `comments_count` | `comentarios` | mídia |

`impressions` cai no mesmo código que `views` porque é a grafia antiga da mesma
ideia. Os pares `likes`/`like_count` e `comments`/`comments_count` são a mesma
contagem em duas portas: a primeira vem do endpoint de insights, a segunda vem
como campo do próprio nó da mídia.

`publicacoes` **não tem entrada aqui**: é derivada da contagem de mídias
publicadas no dia, e não vem da Meta.

Tipo de mídia também é traduzido (`tipoCanonicoDaMidia`): `STORY` → `story`,
`REELS` ou `VIDEO` → `reel`, `CAROUSEL_ALBUM` → `carrossel`, o resto → `imagem`.
É por esses nomes que a regra de formato agrupa as publicações.

**Métrica que a Meta manda e que não conhecemos entra em `ignoradas`** e aparece
no evento de coleta do dia. Ela nunca vira coluna nova.

O `end_time` da Meta **não** vira a data da leitura: ele vem no fuso do Pacífico
e aponta o começo do dia seguinte. Quem coleta sabe que dia está coletando e
passa `data` — converter fuso ali seria adivinhar em cima de adivinhação.

---

## 4. Limite de taxa

O teto é de **200 chamadas por hora por usuário** (`memory/restrictions.md`).

| Mecanismo | Valor | O que faz |
|---|---|---|
| `LIMITE_DE_CHAMADAS_POR_HORA` | 200 | o teto da Meta, registrado no código |
| `FRACAO_UTIL_DO_ORCAMENTO` | 0,9 | paramos em 180; os 10% ficam para retentativa, chamada de suporte e o atraso entre a contagem da Meta e a nossa |
| `OrcamentoDeChamadas` | um por conta | o teto é por usuário, então gastar o de uma conta não pode consumir o das outras |
| `usoRelatadoPelaMeta` | `x-app-usage`, `x-business-use-case-usage` | lê o percentual que a Meta publica; a 90% o orçamento é esgotado antes do 429 |

Esperar o 429 significa descobrir o problema **depois** de já ter perdido a
janela da hora — e com ela a coleta de todas as contas que ainda não rodaram.

Cabeçalho fora do formato esperado não derruba a coleta: o orçamento local
continua valendo como teto.

---

## 5. Classificação de erro

`classificarErro` traduz a falha da Meta para o vocabulário do produto. Sem essa
tradução, quem chama não sabe se pede reconexão ou se tenta mais tarde.

| Situação | Código da Meta | Código do produto |
|---|---|---|
| Token inválido ou revogado | 190, 102, 463, 467 (código ou subcódigo) | `TOKEN_EXPIRADO` |
| Limite de chamadas | HTTP 429, ou 4, 17, 32, 613, 80001, 80002, 80003, 80004 | `LIMITE_DE_TAXA` |
| Erro do lado da Meta | HTTP 5xx | `FALHA_DE_REDE` |
| Falha de rede ou timeout de 20 s | — | `FALHA_DE_REDE` |
| Qualquer outra | — | `FALHA_INESPERADA` |

A mensagem da Meta entra no detalhe **cortada em 200 caracteres**: ela às vezes
ecoa parte da requisição, e requisição nossa carrega id de conta.

---

## 6. Higiene obrigatória

Três regras que valem para toda chamada, todas de `memory/restrictions.md`:

1. **Token no cabeçalho `Authorization`, nunca na query.** URL vai para log de
   proxy, histórico do navegador e relatório de erro.
2. **Falha da Meta vira código do produto**, nunca exceção anônima.
3. **O orçamento para antes de a Meta começar a recusar.**

E uma quarta, do CLAUDE.md: nenhum endereço da Meta é literal no código.
`META_GRAPH_URL` no servidor, `VITE_META_OAUTH_URL` no front — no dia da próxima
depreciação, quem troca é o ambiente.

---

## 7. Instabilidade da plataforma

Métricas mudam sem aviso útil. Precedente registrado em ADR-003: em junho de
2026 a Meta removeu impressões únicas e alcance do Facebook em todas as versões
da Graph API.

A defesa é arquitetural e já existe:

- adaptador por versão, com `versao` e `apiVersion` gravados em **cada linha** de
  snapshot;
- adaptador antigo **fica no repositório** para reler snapshot antigo — quando a
  Meta mudar, nasce um `v2.js` e o `v1.js` continua onde está;
- métrica descontinuada ganha `descontinuada_em` no dicionário e a tela mostra a
  descontinuidade; a série **não é apagada nem recalculada**.

---

## 8. O que ainda não está resolvido

| Item | Onde a decisão vai morar |
|---|---|
| Justificar `pages_read_engagement` com tela, ou removê-la do pedido | `docs/11_SEGURANCA/app-review.md` |
| Escolha de conta quando o usuário administra várias Páginas com IG vinculado | tela nova de seleção + ADR |
| Renovação do token de ~60 dias antes do vencimento | ADR novo (`modulo-conexao.md`, seção 4) |
| `business_discovery` da Fase 2, com os limites que ele impõe | ADR-006, quando a fase abrir |
| Divergência do formato aceito de `code`: o front aceita `[A-Za-z0-9._~-]{8,2048}` e a função aceita `[A-Za-z0-9._\-#]{20,512}` | um dos dois está errado; conferir contra um `code` real e unificar |
