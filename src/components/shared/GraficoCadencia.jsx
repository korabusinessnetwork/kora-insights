import './GraficoCadencia.css'

/* Espaco de coordenadas fixo: o SVG escala por CSS, entao a geometria pode ser
   escrita uma vez em numeros redondos e nunca depender do tamanho da tela. */
const LARGURA = 720
const ALTURA = 210
const TOPO = 8
const BASE = 196
const MARGEM_X = 8

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

/**
 * Grafico de cadencia: barras discretas para o volume, linha fina para o alcance.
 *
 * SVG proprio, sem biblioteca — o desenho e simples e uma dependencia a mais
 * custaria peso de pagina e uma superficie de atualizacao sem contrapartida
 * (memory/restrictions.md, fase bootstrap).
 *
 * Nao ha tooltip nem grade: o numero exato mora nos indicadores e na tabela do
 * relatorio. Aqui interessa a forma das duas series juntas, que e o que a frase
 * do veredito afirma.
 *
 * As barras partem do zero, porque comparar volume com base cortada engana. A
 * linha nao tem eixo numerico e ocupa uma faixa propria: ela mostra o desenho da
 * tendencia, e o valor dela e dito por escrito na descricao e nos indicadores.
 *
 * @param {object} props
 * @param {{ rotulo: string, barra: number|null, linha: number|null }[]} props.pontos
 * @param {string} props.rotuloBarra ex: 'Publicações na semana'
 * @param {string} props.rotuloLinha ex: 'Contas alcançadas'
 * @param {string} props.descricao a historia do grafico em uma frase, para ler e ouvir
 * @returns {JSX.Element}
 */
export default function GraficoCadencia({ pontos, rotuloBarra, rotuloLinha, descricao }) {
  const serie = Array.isArray(pontos) ? pontos : []
  const fatia = serie.length > 0 ? (LARGURA - 2 * MARGEM_X) / serie.length : 0
  const larguraDaBarra = Math.min(fatia * 0.34, 34)
  const tetoDaBarra = maiorValor(serie.map((ponto) => ponto?.barra))
  const tetoDaLinha = maiorValor(serie.map((ponto) => ponto?.linha))
  const pisoDaLinha = menorValor(serie.map((ponto) => ponto?.linha))
  const amplitude = tetoDaLinha - pisoDaLinha

  /** Centro horizontal da semana de indice `indice`. */
  const centroDe = (indice) => MARGEM_X + fatia * (indice + 0.5)

  /** Altura, em unidades do viewBox, da barra de valor `valor`. */
  const alturaDe = (valor) =>
    tetoDaBarra > 0 ? (valor / tetoDaBarra) * ALTURA_DA_AREA * TETO_DA_BARRA : 0

  /** Y da linha para `valor`, dentro da faixa reservada a ela. */
  const alturaDaLinha = (valor) => {
    const posicao = amplitude > 0 ? (valor - pisoDaLinha) / amplitude : 0.5
    return BASE - (PISO_DA_LINHA + posicao * (1 - PISO_DA_LINHA)) * ALTURA_DA_AREA
  }

  const segmentos = segmentosDaLinha(serie)

  return (
    <figure className="ki-grafico" data-bloco="grafico">
      <p className="ki-grafico__legenda">
        <span className="ki-grafico__chave">
          <span className="ki-grafico__amostra" data-forma="barra" aria-hidden="true" />
          {rotuloBarra}
        </span>
        <span className="ki-grafico__chave">
          <span className="ki-grafico__amostra" data-forma="linha" aria-hidden="true" />
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
          <g className="ki-grafico__barras">
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

      {/* Equivalente textual: leitor de tela nao le SVG, le tabela. */}
      <table className="apenas-leitor">
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

      <figcaption className="ki-grafico__nota">{descricao}</figcaption>
    </figure>
  )
}
