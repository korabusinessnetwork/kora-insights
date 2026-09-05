/**
 * Adaptador 1.0.0 — Graph API v23.0 → dicionário canônico (ADR-003).
 *
 * Este arquivo é a única parte do produto que conhece nome de métrica da Meta.
 * Ele fica congelado: quando a Meta mudar de novo, nasce um `v2.js` e este
 * continua aqui para reler snapshot antigo. `adapter_version` gravada em cada
 * linha existe para isso — sem ela não dá para responder se uma quebra de série
 * foi mudança da conta ou mudança de definição da Meta.
 *
 * Módulo puro: sem rede, sem DOM, sem relógio. A data da leitura vem de quem
 * coleta, no argumento `data` (contratos.md, seção 2).
 */

/** @typedef {{ metrica: string, valor: number, data: string }} LeituraCanonica */

export const VERSAO = '1.0.0'
export const API_VERSION = 'v23.0'

/**
 * Métricas de conta. `impressions` cai no mesmo código que `views` porque é a
 * grafia antiga da mesma ideia: a Meta trocou uma pela outra e um adaptador só
 * precisa atender conta migrada e conta ainda não migrada.
 */
const MAPA_DE_CONTA = Object.freeze({
  reach: 'alcance',
  views: 'visualizacoes',
  impressions: 'visualizacoes',
  total_interactions: 'interacoes',
  profile_views: 'visitas_ao_perfil',
  follower_count: 'seguidores',
  followers_count: 'seguidores',
})

/**
 * Métricas de mídia. Os pares `likes`/`like_count` e `comments`/`comments_count`
 * são a mesma contagem em duas portas: a primeira vem do endpoint de insights, a
 * segunda vem como campo do próprio nó da mídia.
 */
const MAPA_DE_MIDIA = Object.freeze({
  reach: 'alcance',
  views: 'visualizacoes',
  saved: 'salvamentos',
  shares: 'compartilhamentos',
  likes: 'curtidas',
  like_count: 'curtidas',
  comments: 'comentarios',
  comments_count: 'comentarios',
  total_interactions: 'interacoes',
})

const MAPAS = Object.freeze({ conta: MAPA_DE_CONTA, midia: MAPA_DE_MIDIA })

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Extrai o número de uma entrada de insights.
 *
 * A Graph API tem duas formas para o mesmo valor: a série `values`, uma entrada
 * por dia da janela pedida, e o `total_value` das métricas de `metric_type=total_value`.
 * Em `values` vale a última leitura, a mais recente da janela.
 *
 * O `end_time` da Meta não vira a data da leitura: ele vem no fuso do Pacífico e
 * aponta o começo do dia seguinte. Quem coleta sabe que dia está coletando e
 * passa `data`; converter fuso aqui seria adivinhar em cima de adivinhação.
 *
 * @param {object} entrada item de `payload.data`
 * @returns {unknown} valor cru, ainda sem validação
 */
function valorDaEntrada(entrada) {
  if (!entrada || typeof entrada !== 'object') return undefined
  if (Array.isArray(entrada.values) && entrada.values.length > 0) {
    return entrada.values[entrada.values.length - 1]?.value
  }
  return entrada.total_value?.value
}

/**
 * Achata as formas reais de payload numa lista de pares `[nome da Meta, valor cru]`,
 * preservando a ordem em que a Meta mandou.
 *
 * São três formas, e todas chegam de verdade:
 *   1. envelope de insights — `{ data: [{ name, period, values: [...] }] }`
 *   2. nó plano de mídia — `{ like_count, comments_count, media_product_type }`
 *   3. nó de mídia com insights aninhado, que é o que uma consulta com
 *      `fields=like_count,insights.metric(reach,saved)` devolve
 *
 * @param {object} payload resposta crua da Graph API
 * @returns {Array<[unknown, unknown]>}
 */
function paresDoPayload(payload) {
  if (!payload || typeof payload !== 'object') return []

  const pares = []
  const empilharInsights = (lista) => {
    for (const entrada of lista) pares.push([entrada?.name, valorDaEntrada(entrada)])
  }

  if (Array.isArray(payload.data)) {
    empilharInsights(payload.data)
    return pares
  }

  for (const [nome, valor] of Object.entries(payload)) {
    if (nome === 'insights' && valor && Array.isArray(valor.data)) {
      empilharInsights(valor.data)
      continue
    }
    pares.push([nome, valor])
  }
  return pares
}

/**
 * Traduz um payload da Graph API em leituras canônicas.
 *
 * Três coisas nunca acontecem aqui, e cada uma delas é uma linha de `ignoradas`:
 *   - métrica que não conhecemos vira coluna nova (contratos.md, seção 2);
 *   - valor não numérico vira zero — zero é um fato, `null` é a ausência dele,
 *     e string numérica também não passa: coerção silenciosa esconderia uma
 *     mudança de contrato da Meta;
 *   - duas métricas da Meta ocupam o mesmo código canônico. Quando `views` e
 *     `impressions` vêm juntas, a primeira preenchida vence e a segunda é
 *     ignorada com o motivo. Somar as duas dobraria a visualização; escolher a
 *     maior esconderia a migração da conta. Vencer por ordem de chegada é
 *     determinístico para um mesmo payload e deixa rastro no log de coleta.
 *
 * @param {object} payload resposta crua da Graph API
 * @param {'conta'|'midia'} escopo
 * @param {string} data ISO YYYY-MM-DD, o dia que está sendo coletado
 * @returns {{ leituras: LeituraCanonica[], ignoradas: string[] }}
 * @throws {Error} se o escopo ou a data forem inválidos — os dois vêm de código nosso
 */
export function adaptar(payload, escopo, data) {
  if (!Object.hasOwn(MAPAS, escopo)) {
    throw new Error(`Escopo inválido: ${String(escopo)}. Use 'conta' ou 'midia'.`)
  }
  if (typeof data !== 'string' || !DATA_ISO.test(data)) {
    throw new Error(`Data inválida: ${String(data)}. Use YYYY-MM-DD.`)
  }

  const mapa = MAPAS[escopo]
  const leituras = []
  const ignoradas = []
  /** Código canônico já preenchido → nome da Meta que o preencheu. */
  const donoDoCodigo = new Map()

  for (const [nome, valor] of paresDoPayload(payload)) {
    if (typeof nome !== 'string' || nome === '') {
      ignoradas.push('(entrada sem nome)')
      continue
    }
    // `Object.hasOwn` e não `mapa[nome]`: payload de terceiro não escolhe chave
    // no nosso mapa, e `constructor` existe no protótipo de qualquer objeto.
    if (!Object.hasOwn(mapa, nome)) {
      ignoradas.push(`${nome} (desconhecida no escopo ${escopo})`)
      continue
    }

    const codigo = mapa[nome]
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      ignoradas.push(`${nome} (sem valor numérico)`)
      continue
    }
    if (donoDoCodigo.has(codigo)) {
      ignoradas.push(`${nome} (${codigo} já preenchido por ${donoDoCodigo.get(codigo)})`)
      continue
    }

    donoDoCodigo.set(codigo, nome)
    leituras.push({ metrica: codigo, valor, data })
  }

  return { leituras, ignoradas }
}

export default Object.freeze({ versao: VERSAO, apiVersion: API_VERSION, adaptar })
