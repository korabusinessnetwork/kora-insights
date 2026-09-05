# Catálogo do kit visual

> Os 14 componentes de `src/components/shared/`, exportados por
> `src/components/shared/index.js`. Para cada um: o que recebe, que estados tem,
> que tokens consome e **quando não usar**.
> Tokens: `docs/02_DESIGN_SYSTEM/TOKENS.md`. Última revisão: 2026-09-05.

---

## Índice

| Componente | Papel na tela |
|---|---|
| [`Marca`](#marca) | a assinatura do produto na barra superior |
| [`Botao`](#botao) | ação, em três variantes |
| [`Cartao`](#cartao) | superfície de conteúdo |
| [`TituloDeSecao`](#titulodesecao) | rótulo de seção com apoio à direita |
| [`SeloDeSeveridade`](#selodeseveridade) | quadrado + palavra da severidade |
| [`Veredito`](#veredito) | **o herói**: a frase que o cliente repete em voz alta |
| [`Indicador`](#indicador) | um número da evidência, com a nota que o sustenta |
| [`GraficoCadencia`](#graficocadencia) | barras de volume + linha de alcance |
| [`Tabela`](#tabela) | a evidência do relatório, linha a linha |
| [`ListaDeLimites`](#listadelimites) | "o que este diagnóstico não sabe" |
| [`AvisoDeLacuna`](#avisodelacuna) | dias sem coleta, com motivo |
| [`Estado`](#estado) | carregando, vazio e erro |
| [`Aviso`](#aviso) | faixa de topo: demonstração, reconexão |
| [`ListaDePassos`](#listadepassos) | os passos numerados do estado vazio |

---

## Marca

Duas palavras, uma serifa, dois pesos de tinta — a assinatura da identidade.

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `nome` | string | `'Kora'` | primeira palavra, em tinta cheia |
| `sufixo` | string | `'Insights'` | segunda palavra, em tinta suave; vazio some |
| `como` | ElementType | `'span'` | elemento raiz |

**Estados:** nenhum. **Tokens:** `--fonte-display`, `--cor-tinta`,
`--cor-tinta-suave`.

**Por que o nome vem por prop:** a Fase 3 (white-label) troca a assinatura pela
da agência sem tocar em componente. Quem renderiza passa o nome do tenant, e
nada aqui muda.

**Quando NÃO usar:** como título de página. `Marca` é assinatura, não `h1`.

---

## Botao

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `variante` | `'primario'` \| `'secundario'` \| `'texto'` | `'secundario'` | vira `data-variante`; o CSS decide a pele |
| `tipo` | `'button'` \| `'submit'` \| `'reset'` | `'button'` | atributo `type` |
| `aoClicar` | função | — | handler |
| `carregando` | boolean | `false` | desabilita **de verdade** e anuncia "Carregando" |
| `desabilitado` | boolean | `false` | desabilita |
| `children` | node | — | o rótulo |

**Estados:** repouso, `:hover`, `:focus-visible`, `:disabled`, carregando
(`data-carregando="sim"`, `aria-busy`).

**Tokens:** `--cor-acao`, `--cor-superficie`, `--cor-linha`, `--raio-2`,
`--transicao-rapida`.

**Quando NÃO usar:**
- para navegar. Link é `<a>`; botão que navega quebra abrir em nova aba.
- mais de um `primario` por tela. A cor de acento aparece no máximo três vezes
  por tela — onde tudo é destaque, nada é.
- para passar cor: **não existe prop de cor**, e não vai existir.

---

## Cartao

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `como` | ElementType | `'section'` | elemento raiz |
| `alta` | boolean | `false` | sobe um degrau de superfície (`data-elevacao="alta"`) |
| `children` | node | — | conteúdo |
| `...resto` | — | — | repassado à raiz: é assim que `data-bloco` e `data-imprimir` chegam |

**Estados:** `base` e `alta`. **Tokens:** `--cor-superficie`,
`--cor-superficie-alta`, `--cor-linha`, `--raio-2`.

**Por que `...resto` existe:** `src/styles/impressao.css` decide o que vai ao
papel por `data-imprimir` e protege blocos de sentido por `data-bloco`. Sem o
repasse, cada bloco precisaria de uma `div` extra só para carregar o atributo.

**Quando NÃO usar:** para agrupar sem significado visual. Cartão é superfície,
não `<div>`. Empilhar cartão dentro de cartão é sinal de que falta uma seção.

---

## TituloDeSecao

| Prop | Tipo | O que faz |
|---|---|---|
| `children` | node | o rótulo (vira `h2`) |
| `apoio` | node | contexto curto, alinhado à direita |

**Estados:** nenhum. **Tokens:** `--texto-rotulo`, `--cor-tinta-suave`.

**O apoio não é decoração:** é ele que diz sobre qual janela o número abaixo está
falando — "Últimas 8 semanas, comparadas às 8 anteriores". Número sem janela não
se confere.

**Quando NÃO usar:** como título da página (é `h2`, não `h1`), ou com apoio longo
— apoio que quebra em duas linhas virou parágrafo e pertence ao corpo.

---

## SeloDeSeveridade

| Prop | Tipo | O que faz |
|---|---|---|
| `severidade` | `'ok'` \| `'atencao'` \| `'critico'` \| `'indeterminado'` | vira `data-severidade` |
| `children` | node | **a palavra que o cliente lê** |

**Estados:** os quatro da escala. **Tokens:** `--cor-severidade`, ligado ao
atributo por `tokens.css`.

**A palavra é obrigatória.** Cor sozinha não informa quem não distingue cor. Use
`PALAVRA_DE_SEVERIDADE`, exportada por `Veredito.jsx`: `ok` → "Estável",
`atencao` → "Atenção", `critico` → "Crítico", `indeterminado` → "Indeterminado".

**Quando NÃO usar:** para status que não é severidade de achado (status da
conta, estado de assinatura). Reaproveitar a escala corrói o significado dela —
e `critico` é raro de propósito.

---

## Veredito

O cartão claro com a frase que o cliente repete em voz alta. É o herói da tela.

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `severidade` | escala | — | `data-severidade`, e a cor da barra |
| `rotulo` | string | — | ex: "Frequência de publicação, causa nomeada" |
| `frase` | string | — | **o veredito**, vinda pronta do motor |
| `apoio` | string | — | parágrafo curto que sustenta a frase |
| `como` | ElementType | `'section'` | elemento raiz |

**Tokens:** `--texto-veredito` (`clamp(1.75rem, 3.4vw, 2.75rem)`),
`--largura-veredito` (24ch), `--cor-veredito-barra`, `--borda-acento` (3px, a
única exceção à borda de 1px do sistema).

**A largura curta é regra de leitura, não acaso:** quebrar em duas ou três linhas
é o que faz a frase soar como fala e não como parágrafo.

**Quando NÃO usar:**
- para texto que o componente teria de resumir. Ele **não calcula, não resume e
  não reescreve** — a frase chega pronta (ADR-005).
- mais de uma vez por tela. O veredito é o achado de maior peso, e é um só.
- sem os limites ao lado. A tela é proibida de mostrar veredito sem o bloco "o
  que este diagnóstico não sabe".

> **Divergência aberta.** O comentário de `Veredito.css` afirma que o JSX marca o
> cartão com `[data-superficie="papel"]` — é esse atributo que faz a folha clara
> viver dentro do app escuro e garante o contraste do selo sobre o osso. O JSX
> hoje escreve só `data-severidade` e `data-bloco`. Ou o JSX passa a marcar a
> superfície, ou quem renderiza precisa envolvê-lo. Enquanto isso não for
> resolvido, o veredito não sai como na identidade.

---

## Indicador

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `rotulo` | string | — | ex: "Publicações por semana" |
| `valor` | string \| number | — | **já formatado em pt-BR** |
| `nota` | string | — | a comparação por escrito: "40% abaixo, era 3,0" |
| `tom` | `'bom'` \| `'ruim'` \| `'neutro'` | `'neutro'` | vira `data-tom` |

**Estados:** os três tons. **Tokens:** `--texto-numero` (30px),
`--texto-rotulo`, `--cor-positivo`, `--cor-critico`,
`font-variant-numeric: tabular-nums`.

**O tom é decisão da regra, nunca do CSS:** cair nem sempre é ruim. O componente
recebe o tom pronto no achado.

**Quando NÃO usar:**
- para número sem comparação. Indicador sem `nota` é um número solto, e número
  solto é a pergunta em forma de dashboard que o produto ataca.
- para formatar. Ele não formata: o valor chega pronto de quem exibe, e a
  variação é calculada sobre o valor exibido (ADR-008).

---

## GraficoCadencia

Barras discretas para o volume, linha fina para o alcance. SVG próprio, sem
biblioteca — o desenho é simples e uma dependência a mais custaria peso de página
e superfície de atualização sem contrapartida.

| Prop | Tipo | O que faz |
|---|---|---|
| `pontos` | `{ rotulo, barra: number\|null, linha: number\|null }[]` | a série, uma entrada por semana |
| `rotuloBarra` | string | ex: "Publicações na semana" |
| `rotuloLinha` | string | ex: "Contas alcançadas" |
| `descricao` | string | a história do gráfico em uma frase — vira `aria-label` e legenda |

**Estados:** com dado, com lacuna (`barra`/`linha` nulas), série vazia.

**A honestidade deste componente está em `segmentosDaLinha`:** a linha **quebra**
nos pontos sem leitura e volta quando o dado volta. Ligar dois pontos por cima de
uma semana sem coleta desenharia uma tendência que ninguém mediu (ADR-004). Uma
leitura isolada entre duas lacunas vira um ponto, para não sumir.

As barras partem do zero, porque comparar volume com base cortada engana. A linha
não tem eixo numérico e ocupa faixa própria: ela mostra o desenho da tendência, e
o valor dela é dito por escrito nos indicadores.

Não há tooltip nem grade: o número exato mora nos indicadores e na tabela.

**Quando NÃO usar:**
- como abertura. Gráfico entra como **prova** do veredito, nunca como abertura
  (`docs/13_VENDA/plano-de-apresentacao.md`, tela 7).
- para série de duas métricas sem relação. As duas séries existem juntas porque a
  frase do veredito afirma algo sobre a relação entre elas.
- com `null` trocado por `0`. Zero é afirmação, `null` é lacuna.

---

## Tabela

| Prop | Tipo | O que faz |
|---|---|---|
| `colunas` | `{ chave, rotulo, numerica? }[]` | ordem e alinhamento |
| `linhas` | `{ id?, celulas: Celula[] }[]` | cada `celulas` segue a ordem das colunas |
| `legenda` | string | nome acessível da tabela |

`Celula` é texto puro **ou** `{ texto, tom }` — é assim que a coluna de variação
ganha cor sem nenhum `if` de estilo: o tom vira `data-tom` e o CSS reage.

**Estados:** célula neutra, boa, ruim; coluna numérica alinhada à direita.

**Tokens:** `--texto-apoio`, `--cor-linha`, `tabular-nums`.

A `<caption>` fica só para leitor de tela: na folha quem nomeia a tabela é o
título da seção, e repetir roubaria linha do relatório.

**Quando NÃO usar:** para layout. Se não há cabeçalho de coluna com significado,
não é tabela — é grade, e grade é CSS.

---

## ListaDeLimites

"O que este diagnóstico não sabe" — o bloco que o produto inteiro existe para não
esconder.

| Prop | Tipo | O que faz |
|---|---|---|
| `titulo` | string | ex: "O que este diagnóstico não sabe" |
| `limites` | `(string \| { codigo, texto })[]` | aceita as duas formas |

**Estados:** com itens, ou **nulo** quando não há limite — a única ausência
legítima aqui, e ela quase nunca acontece: `limitesQueValemSempre` emite pelo
menos três códigos em todo diagnóstico.

Marca `data-bloco="limites"`, e é por isso que a impressão não o corta fora da
folha (`src/styles/impressao.css`).

**Quando NÃO usar:**
- como nota de rodapé ou letra miúda. Ele vai junto do veredito, na tela e no
  papel.
- para avisar sobre lacuna de coleta — isso é `AvisoDeLacuna`. Limite é o que a
  regra não sabe; lacuna é o dia que não foi coletado.

---

## AvisoDeLacuna

| Prop | Tipo | O que faz |
|---|---|---|
| `lacunas` | `{ inicio?, fim?, motivo?, rotulo? }[]` | uma entrada por intervalo contíguo |

Título fixo: **"Dias sem coleta"**. `rotulo` permite mandar o período já escrito
por extenso; sem ele sobram as datas cruas — feias, porém visíveis, que é o que
importa aqui.

**Estados:** com lacunas, ou nulo quando não há nenhuma (não há nada a esconder).

**Quando NÃO usar:** para uma lacuna por dia. `montarHistorico` já agrupa dias
contíguos com o mesmo motivo em **uma** entrada; cinco avisos iguais viram ruído
e o cliente para de ler.

---

## Estado

Os três estados que não são a tela em si.

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `tipo` | `'carregando'` \| `'vazio'` \| `'erro'` | `'carregando'` | vira `data-tipo` e escolhe o papel ARIA |
| `titulo` | string | — | vira `h2` |
| `descricao` | string | — | uma frase |
| `children` | node | — | ação, passos ou detalhe |

**Papéis ARIA:** `carregando` e `erro` são anunciados (`status`/`alert`); `vazio`
não é, porque é conteúdo comum e anunciá-lo seria ruído.

**O vazio recebe `children` de propósito:** é ali que a tela sem conta conectada
monta os três passos até o primeiro diagnóstico. Por isso o título do vazio sai
em serifa grande — ele **é** o conteúdo da tela, não um aviso de que falta
conteúdo.

**Quando NÃO usar:**
- para erro que a tela pode prevenir. Prevenção de erro > mensagem de erro.
- para o estado de sucesso: sucesso é a própria tela.
- sem oferecer saída no `erro`. Erro sem próxima ação é beco.

---

## Aviso

Faixa de topo. Hoje ela diz duas coisas: que os dados são de demonstração
(ADR-007) e que o token expirou e a conta precisa ser reconectada.

| Prop | Tipo | Padrão | O que faz |
|---|---|---|---|
| `variante` | `'informacao'` \| `'atencao'` \| `'critico'` | `'informacao'` | `data-variante` e papel ARIA |
| `titulo` | string | — | a manchete curta |
| `children` | node | — | o texto |
| `acao` | node | — | normalmente um `Botao` |

Só o `critico` interrompe a leitura (`role="alert"`, `aria-live="assertive"`); o
resto entra na fila educada do leitor de tela. Marca `data-imprimir="nao"`: aviso
de tela não vai ao papel.

**O componente não sabe qual das duas faixas está mostrando** — regra de negócio
fica na tela.

**Quando NÃO usar:**
- para o aviso de demonstração ser opcional. Ele é **permanente e visível**
  enquanto `meta.origem === 'demonstracao'`.
- como toast. Aviso é faixa persistente; mensagem que some em três segundos não é
  este componente e não existe no kit.

---

## ListaDePassos

Os passos numerados da tela sem conta conectada
(`identidade/02-sem-conta-conectada.png`).

| Prop | Tipo | O que faz |
|---|---|---|
| `passos` | `{ titulo, descricao? }[]` | na ordem de execução |

O número é desenhado por contador de CSS, não escrito no JSX: reordenar a lista
não pode exigir renumerar à mão, e o leitor de tela já anuncia a posição do item
da lista ordenada.

**Estados:** com passos, ou nulo quando a lista está vazia.

**Quando NÃO usar:** para lista sem ordem. Se a ordem não importa, é `ul`, não
`ol` numerado.

---

## Conflito aberto com o contrato

`docs/01_ARQUITETURA/contratos.md`, seção 5, lista **12** componentes. O kit tem
**14**: `Aviso` e `ListaDePassos` não estão na tabela do contrato.

Os dois são legítimos e vêm direto da identidade — a faixa de demonstração e os
três passos do estado vazio. O que falta é a tabela do contrato acompanhar, e
`contratos.md` é mudança combinada: quem muda, atualiza no mesmo commit. Está
registrado aqui porque a documentação prevalece, e uma tabela desatualizada
prevalece sobre nada.
