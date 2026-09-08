import './GraficoCadencia.css'

/* Espaco de coordenadas fixo: o SVG escala por CSS, entao a geometria pode ser
   escrita uma vez em numeros redondos e nunca depender do tamanho da tela. */
const LARGURA = 720
/* A altura cresceu de 210 para 216 e a base subiu de 196 para 186: a faixa
   abaixo do eixo passou a receber a semana de cada coluna, e a de cima o valor
   da barra. Antes disso o desenho tinha oito colunas sem nome e sem numero —
   quem olhasse nao sabia que semana era qual nem quanto cada uma valia, e essas
   duas leituras existiam SO na tabela de leitor de tela. Quem enxerga recebia
   menos dado que quem nao enxerga, o que e um jeito estranho de acessibilidade. */
const ALTURA = 216
const TOPO = 20
const BASE = 186
const MARGEM_X = 8

/** Distancia do valor ao topo da barra, e da semana ao eixo. */
const RESPIRO_DO_ROTULO = 7

/** Altura do tracinho que marca a semana sem coleta. */
const MARCA_DE_LACUNA = 12

/** A barra mais alta ocupa 78% da area — sobra ar para a linha cruzar por cima. */
const TETO_DA_BARRA = 0.78

/** O menor ponto da linha para a 28% da area: rente ao eixo a linha some. */
const PISO_DA_LINHA = 0.28

const ALTURA_DA_AREA = BASE - TOPO

/** O que a celula diz quando a semana nao tem leitura. Lacuna nao vira zero. */
const SEM_COLETA = 'sem coleta'

/**
 * Quebra a serie nos pontos sem leitura, devolvendo um segmento por trecho
 * continuo.
 *
 * E o coracao da honestidade deste grafico: ligar dois pontos por cima de uma
 * semana sem coleta desenharia uma tendencia que ninguem mediu (ADR-004). A
 * linha para, e volta quando o dado volta.
 *
 * @param {{ linha: number|null }[]} pontos
 * @returns {{ indice: number, valor: number }[][]} segmentos continuos, em ordem
 */
export function segmentosDaLinha(pontos) {
  const segmentos = []
  let atual = []

  pontos.forEach((ponto, indice) => {
    const valor = ponto?.linha
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      atual.push({ indice, valor })
      return
    }
    if (atual.length > 0) segmentos.push(atual)
    atual = []
  })

  if (atual.length > 0) segmentos.push(atual)
  return segmentos
}

/**
 * Piso da faixa desenhada da linha, como fracao do valor medio da serie.
 *
 * Meio da media: uma serie que oscila menos que isso e desenhada quase reta, em
 * vez de esticada ate as bordas do grafico.
 */
const AMPLITUDE_MINIMA_DA_LINHA = 0.5

/**
 * Maior valor finito de uma serie, ou 0 se nao houver nenhum.
 * @param {(number|null|undefined)[]} valores
 * @returns {number}
 */
function maiorValor(valores) {
  const finitos = valores.filter((valor) => typeof valor === 'number' && Number.isFinite(valor))
  return finitos.length > 0 ? Math.max(...finitos) : 0
}

/**
 * Menor valor finito de uma serie, ou 0 se nao houver nenhum.
 * @param {(number|null|undefined)[]} valores
 * @returns {number}
 */
function menorValor(valores) {
  const finitos = valores.filter((valor) => typeof valor === 'number' && Number.isFinite(valor))
  return finitos.length > 0 ? Math.min(...finitos) : 0
}

const FORMATO_DO_VALOR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/**
 * O numero que vai em cima da barra.
 *
 * Devolve nulo — e nao '0' nem '—' — quando nao houve coleta, porque quem
 * decide como desenhar a ausencia e o SVG, e nao o formatador. Zero devolve
 * '0', e essa e a distincao que este grafico precisava passar a fazer: semana
 * sem coleta e semana sem publicacao desenhavam as duas a mesma coisa (nada).
 *
 * @param {number|null|undefined} valor
 * @returns {string|null} nulo quando nao ha leitura
 */
export function rotuloDoValor(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  return FORMATO_DO_VALOR.format(valor)
}

/**
 * Grafico de cadencia: barras discretas para o volume, linha fina para o alcance.
 *
 * SVG proprio, sem biblioteca — o desenho e simples e uma dependencia a mais
 * custaria peso de pagina e uma superficie de atualizacao sem contrapartida
 * (memory/restrictions.md, fase bootstrap).
 *
 * Nao ha tooltip nem grade. Cada barra leva o proprio valor escrito em cima, que
 * e mais direto que uma grade e nao cobra do leitor a conta de interpolar altura
 * contra eixo. Aqui interessa a forma das duas series juntas, que e o que a
 * frase do veredito afirma.
 *
 * As barras partem do zero, porque comparar volume com base cortada engana — e e
 * por partirem do zero que rotula-las e honesto.
 *
 * **A linha continua sem eixo numerico, e isso e deliberado.** Ela ocupa uma
 * faixa propria com amplitude minima (ver `AMPLITUDE_MINIMA_DA_LINHA`), para que
 * serie estavel apareca estavel; qualquer numero lido dessa faixa estaria
 * errado. Ela mostra o desenho da tendencia, e o valor dela e dito por escrito
 * na descricao e nos indicadores. Um eixo Y unico para as duas series seria pior
 * que nenhum: ele daria ao leitor uma escala que so vale para metade do desenho.
 * A faixa da linha tem amplitude minima (ver `AMPLITUDE_MINIMA_DA_LINHA`), para
 * que uma serie estavel apareca estavel.
 *
 * @param {object} props
 * @param {{ rotulo: string, barra: number|null, linha: number|null }[]} props.pontos
 * @param {string} props.rotuloBarra ex: 'Publicações na semana'
 * @param {string} props.rotuloLinha ex: 'Contas alcançadas'
 * @param {'bom'|'ruim'|'neutro'} [props.tomBarra] tom que a REGRA deu as barras.
 *   A linha nao recebe tom: ver a nota em GraficoCadencia.css
 * @param {string} props.descricao a historia do grafico em uma frase, para ler e ouvir
 * @returns {JSX.Element}
 */
export default function GraficoCadencia({
  pontos,
  rotuloBarra,
  rotuloLinha,
  tomBarra,
  descricao,
}) {
  const serie = Array.isArray(pontos) ? pontos : []
  const fatia = serie.length > 0 ? (LARGURA - 2 * MARGEM_X) / serie.length : 0
  const larguraDaBarra = Math.min(fatia * 0.34, 34)
  const tetoDaBarra = maiorValor(serie.map((ponto) => ponto?.barra))
  const tetoDaLinha = maiorValor(serie.map((ponto) => ponto?.linha))
  const pisoDaLinha = menorValor(serie.map((ponto) => ponto?.linha))
  const centroDaLinha = (tetoDaLinha + pisoDaLinha) / 2
  // Serie quase plana precisa PARECER plana. Normalizar pelo proprio minimo e
  // maximo transforma 4% de oscilacao numa escalada de altura total, e o
  // grafico passa a contradizer a frase logo abaixo dele ("variacao de 4%").
  // Num produto que vende leitura correta do dado, ruido desenhado como
  // tendencia e o pior defeito possivel. Por isso a faixa desenhada nunca e
  // menor que uma fracao da propria media da serie.
  const amplitude = Math.max(
    tetoDaLinha - pisoDaLinha,
    centroDaLinha * AMPLITUDE_MINIMA_DA_LINHA,
  )

  /** Centro horizontal da semana de indice `indice`. */
  const centroDe = (indice) => MARGEM_X + fatia * (indice + 0.5)

  /** Altura, em unidades do viewBox, da barra de valor `valor`. */
  const alturaDe = (valor) =>
    tetoDaBarra > 0 ? (valor / tetoDaBarra) * ALTURA_DA_AREA * TETO_DA_BARRA : 0

  /** Y da linha para `valor`, dentro da faixa reservada a ela. */
  const alturaDaLinha = (valor) => {
    const bruta = amplitude > 0 ? 0.5 + (valor - centroDaLinha) / amplitude : 0.5
    const posicao = Math.min(1, Math.max(0, bruta))
    return BASE - (PISO_DA_LINHA + posicao * (1 - PISO_DA_LINHA)) * ALTURA_DA_AREA
  }

  const segmentos = segmentosDaLinha(serie)

  return (
    <figure className="ki-grafico" data-bloco="grafico">
      <p className="ki-grafico__legenda">
        <span className="ki-grafico__chave">
          <span
            className="ki-grafico__amostra"
            data-forma="barra"
            data-tom={tomBarra}
            aria-hidden="true"
          />
          {rotuloBarra}
        </span>
        <span className="ki-grafico__chave">
          <span
            className="ki-grafico__amostra"
            data-forma="linha"
            aria-hidden="true"
          />
          {rotuloLinha}
        </span>
      </p>

      <div className="ki-grafico__area">
        <svg
          className="ki-grafico__desenho"
          role="img"
          aria-label={descricao}
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        >
          <line
            className="ki-grafico__eixo"
            x1={MARGEM_X}
            y1={BASE}
            x2={LARGURA - MARGEM_X}
            y2={BASE}
          />
          <g className="ki-grafico__barras" data-tom={tomBarra}>
            {serie.map((ponto, indice) =>
              typeof ponto?.barra === 'number' && ponto.barra > 0 ? (
                <rect
                  key={`barra-${indice}`}
                  x={centroDe(indice) - larguraDaBarra / 2}
                  y={BASE - alturaDe(ponto.barra)}
                  width={larguraDaBarra}
                  height={alturaDe(ponto.barra)}
                  rx="1"
                />
              ) : null,
            )}
          </g>

          {/* Semana sem coleta ganha um tracinho no eixo.
              Sem ele a lacuna era desenhada exatamente como um zero — barra de
              altura nenhuma nos dois casos — e "a conta nao publicou nesta
              semana" e "nao sabemos o que houve nesta semana" viravam a mesma
              imagem. Lacuna nunca some da tela (CLAUDE.md, principio n1). */}
          <g className="ki-grafico__lacunas">
            {serie.map((ponto, indice) =>
              typeof ponto?.barra === 'number' && Number.isFinite(ponto.barra) ? null : (
                <line
                  key={`lacuna-${indice}`}
                  x1={centroDe(indice)}
                  y1={BASE}
                  x2={centroDe(indice)}
                  y2={BASE - MARCA_DE_LACUNA}
                />
              ),
            )}
          </g>

          {/* O valor de cada barra, escrito. `aria-hidden` porque a tabela
              abaixo ja diz o mesmo a quem usa leitor de tela, e repetir faria o
              desenho ser lido duas vezes. */}
          <g className="ki-grafico__valores" aria-hidden="true">
            {serie.map((ponto, indice) => {
              const rotulo = rotuloDoValor(ponto?.barra)
              if (rotulo === null) return null
              return (
                <text
                  key={`valor-${indice}`}
                  x={centroDe(indice)}
                  y={BASE - alturaDe(ponto.barra) - RESPIRO_DO_ROTULO}
                >
                  {rotulo}
                </text>
              )
            })}
          </g>

          {/* A semana de cada coluna. Mesma razao do `aria-hidden` acima. */}
          <g className="ki-grafico__semanas" aria-hidden="true">
            {serie.map((ponto, indice) => (
              <text
                key={`semana-${indice}`}
                x={centroDe(indice)}
                y={BASE + RESPIRO_DO_ROTULO}
                data-lacuna={rotuloDoValor(ponto?.barra) === null ? 'sim' : undefined}
              >
                {ponto?.rotulo ?? ''}
              </text>
            ))}
          </g>
          <g className="ki-grafico__linha">
            {segmentos.map((segmento, indice) =>
              segmento.length > 1 ? (
                <polyline
                  key={`trecho-${indice}`}
                  points={segmento
                    .map((item) => `${centroDe(item.indice)},${alturaDaLinha(item.valor)}`)
                    .join(' ')}
                />
              ) : (
                // Leitura isolada entre duas lacunas: sem o ponto ela sumiria.
                <circle
                  key={`trecho-${indice}`}
                  cx={centroDe(segmento[0].indice)}
                  cy={alturaDaLinha(segmento[0].valor)}
                  r="2.5"
                />
              ),
            )}
          </g>
        </svg>
      </div>

      {/* Equivalente textual: leitor de tela nao le SVG, le tabela.

          A classe fica no DIV, e nao na `<table>`: `width: 1px` nao encolhe uma
          tabela, porque layout de tabela ignora largura menor que o conteudo
          minimo. Com a classe direto nela, a tabela ficava com ~397px, fora de
          fluxo mas ainda somando a rolagem da pagina — o relatorio deslizava de
          lado no celular por causa de um elemento que ninguem enxerga.
          Trocar o `display` da tabela resolveria a largura e custaria a
          semantica que este bloco existe para dar. */}
      <div className="apenas-leitor">
        <table>
          <caption>{`Semana a semana: ${rotuloBarra} e ${rotuloLinha}`}</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">{rotuloBarra}</th>
              <th scope="col">{rotuloLinha}</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((ponto, indice) => (
              <tr key={`linha-${indice}`}>
                <th scope="row">{ponto?.rotulo ?? ''}</th>
                <td>{typeof ponto?.barra === 'number' ? String(ponto.barra) : SEM_COLETA}</td>
                <td>{typeof ponto?.linha === 'number' ? String(ponto.linha) : SEM_COLETA}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="ki-grafico__nota">{descricao}</figcaption>
    </figure>
  )
}
