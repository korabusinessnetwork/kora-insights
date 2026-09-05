# Design system — tokens

> Fonte unica de verdade visual. Codigo em `src/styles/tokens.css`; este
> documento explica o porque. Derivado da identidade visual Kora Insights.
> Ultima revisao: 2026-09-05.

## A ideia

A tela e escura, densa e quieta para que **uma frase** possa gritar. Todo o
resto do sistema existe para nao competir com o veredito: cinza esverdeado,
pouca cor, nenhuma sombra decorativa, nenhum arredondamento simpatico.

A cor de acento aparece tres vezes por tela, no maximo: a barra do veredito, o
rotulo de severidade e a variacao que sustenta a causa. Onde tudo e destaque,
nada e.

## Tres camadas

```
--kora-*     primitiva   paleta crua, sem significado
--cor-*      semantica   papel na interface
local        componente  dentro do proprio .css do componente
```

Componente **nunca** usa `--kora-*` direto. Se precisou, falta uma semantica.

## Paleta

### Carvao — a base escura

| Token | Hex | Uso |
|---|---|---|
| `--kora-carvao-1000` | `#060908` | fundo fosco, atras de sobreposicao |
| `--kora-carvao-900` | `#0a0e0c` | fundo do app — amostrado da identidade |
| `--kora-carvao-800` | `#161a18` | barra do cabecalho — amostrado da identidade |
| `--kora-carvao-700` | `#262d2b` | superficie de cartao — amostrado da identidade |
| `--kora-carvao-600` | `#2f3735` | superficie elevada |
| `--kora-carvao-500` | `#3a4340` | linha, eixo de grafico |
| `--kora-carvao-400` | `#4d5754` | linha forte, decorativa |
| `--kora-carvao-300` | `#78827d` | contorno de controle e barra de grafico (3:1) |

Nao e cinza neutro: tem cast verde. E o que faz o osso parecer papel e nao
branco de escritorio.

### Osso — a tinta e o papel

| Token | Hex | Uso |
|---|---|---|
| `--kora-osso-100` | `#f6f5f1` | papel elevado |
| `--kora-osso-200` | `#f0efe9` | tinta no escuro, papel do relatorio |
| `--kora-osso-300` | `#dddbd3` | linha no papel |
| `--kora-osso-400` | `#c8c6bd` | linha forte no papel, barra no papel |
| `--kora-osso-500` | `#a7b1af` | tinta suave no escuro |
| `--kora-osso-600` | `#94a09b` | tinta fraca no escuro (piso de tinta) |
| `--kora-osso-700` | `#565249` | tinta suave no papel |
| `--kora-osso-750` | `#6a6558` | tinta fraca no papel |
| `--kora-osso-800` | `#3b3a34` | tinta principal no papel |

### Ocre — o acento

| Token | Hex | Uso |
|---|---|---|
| `--kora-ocre-300` | `#f2b341` | acento sobre carvao |
| `--kora-ocre-500` | `#94723a` | intermediario, hover em papel |
| `--kora-ocre-700` | `#794d05` | acento sobre osso, barra do veredito |

Um so acento no produto inteiro. Ele significa "olhe aqui", nunca "isto e bom".

### Sage e tijolo — leitura de estado

| Token | Hex | Uso |
|---|---|---|
| `--kora-sage-300` | `#44c69a` | estavel/positivo sobre carvao |
| `--kora-sage-700` | `#13624b` | estavel/positivo sobre osso |
| `--kora-tijolo-300` | `#e6918a` | critico sobre carvao |
| `--kora-tijolo-700` | `#8f3527` | critico sobre osso |

Sage quer dizer "nao e aqui o problema", nunca "meta batida". Tijolo e raro: a
maioria dos achados e `atencao`, e inflacionar severidade destroi a escala.

## Contraste

Alvo: AA da WCAG 2.1 — 4,5:1 para texto e 3:1 para elemento grafico e contorno
de controle.

**Esta tabela nao e escrita a mao.** A primeira versao dela afirmava 4,6:1 para
um par que media 4,27:1, e o token descrito como piso de tinta reprovava em toda
superficie de cartao. `src/styles/contraste.test.js` le a paleta do proprio
`tokens.css` e reprova a suite quando qualquer par cai abaixo do minimo; os
numeros abaixo saem de la.

| Par | Razao | Veredito |
|---|---|---|
| osso-200 sobre carvao-900 (tinta no fundo) | 16,86:1 | AAA |
| osso-500 sobre carvao-700 (tinta suave no cartao) | 6,40:1 | AA |
| osso-600 sobre carvao-600 (piso de tinta, pior superficie) | 4,52:1 | AA |
| ocre-300 sobre carvao-700 | 7,57:1 | AAA |
| sage-300 sobre carvao-700 | 6,56:1 | AA |
| tijolo-300 sobre carvao-600 | 5,11:1 | AA |
| carvao-300 sobre carvao-600 (contorno e barra do grafico) | 3,08:1 | AA grafico |
| osso-800 sobre osso-200 (tinta no papel) | 9,90:1 | AAA |
| osso-700 sobre osso-200 (tinta suave no papel) | 6,75:1 | AA |
| osso-750 sobre osso-200 (piso de tinta no papel) | 5,04:1 | AA |
| ocre-700 sobre osso-200 | 6,34:1 | AA |
| sage-700 sobre osso-200 | 6,34:1 | AA |

Tres correcoes que essa verificacao forcou, e que valem como registro:

1. **O piso de tinta subiu de `#6b7975` para `#94a09b`.** O valor antigo media
   2,69:1 sobre cartao elevado, e era a cor do motivo da lacuna de coleta e da
   explicacao de por que um botao esta desabilitado — os dois textos que o
   produto mais precisa que sejam lidos.
2. **Contorno de controle virou token proprio (`--cor-contorno`).** Antes ele
   dividia token com a linha decorativa entre cartoes, media 1,50:1, e era a
   unica pista visual da borda do campo de e-mail — a unica porta do produto.
   Linha entre cartoes pode ser discreta; borda de controle nao.
3. **No papel, a tinta fraca era mais forte que a suave** (9,9:1 contra 6,75:1).
   A escala estava invertida e o texto "fraco" saia mais escuro que o de apoio.

Onde a acessibilidade e a identidade discordaram, a acessibilidade venceu, e a
divergencia esta registrada aqui: a identidade desenha as barras do grafico e o
contorno dos botoes secundarios mais escuros do que 3:1 permite. O grafico e a
prova visual da frase do veredito; prova que nao da para enxergar nao prova nada.

Cor nunca e o unico portador de significado: severidade sempre vem acompanhada
de rotulo em texto (`Atencao`, `Estavel`), e variacao sempre traz o numero
anterior por escrito.

## Tipografia

| Token | Valor | Onde |
|---|---|---|
| `--fonte-display` | Newsreader, Spectral, Georgia, serif | veredito, acao recomendada, marca |
| `--fonte-texto` | Inter, system-ui, sans-serif | todo o resto |

A serifa carrega a fala; a grotesca carrega o dado. E a divisao editorial de um
diagnostico: a manchete e a tabela.

> **Nota de fidelidade.** A serifa da identidade e uma transicional de alto
> contraste. Newsreader e a aproximacao livre adotada; se a licenca da face
> original entrar, troca-se **um token** e o produto inteiro acompanha. Isso e
> o teste do design system: identidade nao mora em componente.

| Token | Tamanho | Uso |
|---|---|---|
| `--texto-veredito` | `clamp(1.75rem, 3.4vw, 2.75rem)` | a frase do diagnostico |
| `--texto-display` | 21px | acao recomendada, titulo de folha |
| `--texto-numero` | 30px | valor de indicador |
| `--texto-corpo` | 15px | texto corrido |
| `--texto-apoio` | 14px | apoio, celula de tabela |
| `--texto-rotulo` | 13px | rotulo de secao e de indicador |
| `--texto-micro` | 12px | nota de rodape, legenda |

Numero e sempre `font-variant-numeric: tabular-nums`: coluna de numero que
dança nao se compara.

Larguras: `--largura-veredito: 24ch` (a frase quebra em 2-3 linhas de proposito,
para ser lida em voz alta) e `--largura-leitura: 68ch` para texto corrido.

## Espacamento, forma e movimento

Escala base 4px (`--e-1` a `--e-16`). Raios de 2 a 8px — o produto e sobrio;
nada de pilula. Bordas de 1px; a barra do veredito tem 3px e e a unica excecao.

Movimento: 120ms e 200ms, `cubic-bezier(.2,0,.2,1)`. Sem entrada animada de
dado: numero que aparece com transicao mente sobre quando chegou.
`prefers-reduced-motion` desliga tudo (`base.css`).

## Estados obrigatorios

Toda tela renderiza `carregando`, `vazio`, `erro` e `sucesso` (CLAUDE.md).

O **vazio e conteudo**, nao um encolher de ombros: a tela sem conta conectada
explica os tres passos ate o primeiro diagnostico e diz, com todas as letras,
que nao ha grafico de exemplo ali de proposito.

## White-label (Fase 3, pronto desde ja)

O tenant sobrescreve **semanticas**, nunca primitivas, via
`aplicarIdentidadeVisual()` (`src/tema/identidadeVisual.js`), que so aceita hex
e pilha de fonte, por allowlist. Cor de cliente nunca entra em JSX nem em
arquivo de componente.

Superficie de papel: `[data-superficie="papel"]` troca a pele inteira dentro de
um trecho da arvore. E como o relatorio claro vive dentro do app escuro sem que
nenhum componente saiba em qual dos dois esta.

## Ligacoes

- `src/styles/tokens.css` — implementacao
- `src/styles/base.css` — reset, foco, acessibilidade
- `src/styles/impressao.css` — folha A4 do relatorio
- `docs/06_COMPONENTES/` — catalogo do kit
- `docs/13_VENDA/mockup-produto.html` — esboco anterior, mantido como registro
