/**
 * Dicionário canônico de métricas (ADR-003).
 *
 * O nome que a Meta dá a uma métrica morre na porta de entrada: nada é gravado
 * nem exibido com o nome dela. Em junho de 2026 a Meta removeu impressões
 * únicas e alcance do Facebook de todas as versões da Graph API — quem tinha
 * `impressions` como coluna migrou schema, quem tinha `visualizacoes` trocou um
 * adaptador.
 *
 * A tabela abaixo é a da seção 2 de docs/01_ARQUITETURA/contratos.md. Módulo
 * puro: roda igual no navegador (modo demonstração) e no Deno da Edge Function.
 */

/**
 * @typedef {'conta'|'midia'} Escopo
 * @typedef {'soma'|'ultimo'|'media'} Agregacao
 */

/**
 * @typedef {object} Metrica
 * @property {string} codigo               código canônico: o único nome que entra em banco
 * @property {string} rotulo               como a métrica se apresenta na tela
 * @property {string} rotuloCurto          versão para legenda, coluna e eixo
 * @property {'contas'|'eventos'|'publicacoes'} unidade  o que o número conta
 * @property {Escopo[]} escopos            onde a métrica existe
 * @property {Agregacao} agregacao         como a métrica vira valor de semana
 * @property {string|null} descontinuadaEm dia em que a Meta parou de entregar (ISO)
 * @property {string|null} limiteDeAgregacao frase que a tela mostra ao somar por janela
 */

/**
 * Congela uma entrada, inclusive a lista de escopos.
 *
 * Regra, motor e tela leem o mesmo objeto: um `push` acidental em `escopos`
 * mudaria o comportamento dos três de uma vez, em runtime, longe do review.
 *
 * @param {Metrica} metrica
 * @returns {Metrica}
 */
function definir(metrica) {
  return Object.freeze({ ...metrica, escopos: Object.freeze([...metrica.escopos]) })
}

/**
 * Alcance é a única métrica com limite de agregação porque é a única em que a
 * soma da janela mente por natureza: a Meta só devolve alcance único dentro do
 * período pedido, e período longo ela não devolve. O motor obriga esta frase a
 * aparecer sempre que somar alcance por janela (ADR-003, "honestidade de dado").
 */
const LIMITE_DE_ALCANCE =
  'Somar o alcance de várias semanas conta mais de uma vez quem foi alcançado em ' +
  'semanas diferentes: a Meta não devolve alcance único de período longo.'

/**
 * Dicionário indexado por código canônico. Imutável: é lido por todas as camadas.
 * @type {Readonly<Record<string, Metrica>>}
 */
export const METRICAS = Object.freeze({
  alcance: definir({
    codigo: 'alcance',
    rotulo: 'Contas alcançadas',
    rotuloCurto: 'Alcance',
    unidade: 'contas',
    escopos: ['conta', 'midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: LIMITE_DE_ALCANCE,
  }),
  visualizacoes: definir({
    codigo: 'visualizacoes',
    rotulo: 'Visualizações',
    rotuloCurto: 'Visualizações',
    unidade: 'eventos',
    escopos: ['conta', 'midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  interacoes: definir({
    codigo: 'interacoes',
    rotulo: 'Interações',
    rotuloCurto: 'Interações',
    unidade: 'eventos',
    escopos: ['conta', 'midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  curtidas: definir({
    codigo: 'curtidas',
    rotulo: 'Curtidas',
    rotuloCurto: 'Curtidas',
    unidade: 'eventos',
    escopos: ['midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  comentarios: definir({
    codigo: 'comentarios',
    rotulo: 'Comentários',
    rotuloCurto: 'Comentários',
    unidade: 'eventos',
    escopos: ['midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  salvamentos: definir({
    codigo: 'salvamentos',
    rotulo: 'Salvamentos',
    rotuloCurto: 'Salvamentos',
    unidade: 'eventos',
    escopos: ['midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  compartilhamentos: definir({
    codigo: 'compartilhamentos',
    rotulo: 'Compartilhamentos',
    rotuloCurto: 'Compartilhamentos',
    unidade: 'eventos',
    escopos: ['midia'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  seguidores: definir({
    codigo: 'seguidores',
    rotulo: 'Seguidores',
    rotuloCurto: 'Seguidores',
    unidade: 'contas',
    escopos: ['conta'],
    // Estoque, não fluxo: a semana vale o último saldo. Somar sete dias de
    // seguidores daria sete vezes a conta (contratos.md, seção 2).
    agregacao: 'ultimo',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  visitas_ao_perfil: definir({
    codigo: 'visitas_ao_perfil',
    rotulo: 'Visitas ao perfil',
    rotuloCurto: 'Visitas',
    unidade: 'eventos',
    escopos: ['conta'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
  publicacoes: definir({
    codigo: 'publicacoes',
    rotulo: 'Publicações',
    rotuloCurto: 'Publicações',
    unidade: 'publicacoes',
    // Derivada da contagem de mídias publicadas no dia: não vem da Meta e por
    // isso nenhum adaptador a produz.
    escopos: ['conta'],
    agregacao: 'soma',
    descontinuadaEm: null,
    limiteDeAgregacao: null,
  }),
})

/**
 * Códigos que existem no escopo dado, na ordem do dicionário.
 * @param {Escopo} escopo
 * @returns {readonly string[]}
 */
function codigosDoEscopo(escopo) {
  return Object.freeze(
    Object.values(METRICAS)
      .filter((metrica) => metrica.escopos.includes(escopo))
      .map((metrica) => metrica.codigo),
  )
}

/** @type {readonly string[]} */
export const METRICAS_DE_CONTA = codigosDoEscopo('conta')

/** @type {readonly string[]} */
export const METRICAS_DE_MIDIA = codigosDoEscopo('midia')

/**
 * @param {string} codigo
 * @returns {boolean} true se o código pertence ao dicionário canônico
 */
export function metricaExiste(codigo) {
  return typeof codigo === 'string' && Object.hasOwn(METRICAS, codigo)
}

/**
 * Devolve a definição de uma métrica.
 *
 * Lança em código desconhecido de propósito: código inválido nunca vem do
 * usuário, vem de código nosso — tipicamente um nome da Meta vazando para
 * dentro (`reach`) ou um erro de digitação numa regra. Devolver `undefined`
 * deixaria isso virar `undefined` na tela em vez de quebrar no teste.
 *
 * @param {string} codigo código canônico
 * @returns {Metrica}
 * @throws {Error} se o código não existe no dicionário
 */
export function obterMetrica(codigo) {
  if (!metricaExiste(codigo)) {
    throw new Error(
      `Métrica desconhecida: ${String(codigo)}. Use um código de src/metricas/dicionario.js.`,
    )
  }
  return METRICAS[codigo]
}

/**
 * Agrega leituras de uma métrica respeitando a natureza dela.
 *
 * Valor não numérico é descartado em vez de virar zero, e janela sem nenhuma
 * leitura válida devolve `null`: ausência é lacuna, não zero — o motor precisa
 * distinguir "não coletamos" de "deu zero" (contratos.md, seção 3).
 *
 * @param {string} codigo código canônico
 * @param {number[]} valores leituras em ordem cronológica (importa para 'ultimo')
 * @returns {number|null} valor agregado, ou null quando não há leitura válida
 * @throws {Error} se o código não existe no dicionário
 */
export function agregar(codigo, valores) {
  const { agregacao } = obterMetrica(codigo)
  const lista = Array.isArray(valores) ? valores : []
  const validos = lista.filter((valor) => typeof valor === 'number' && Number.isFinite(valor))

  if (validos.length === 0) return null
  if (agregacao === 'ultimo') return validos[validos.length - 1]

  const total = validos.reduce((soma, valor) => soma + valor, 0)
  return agregacao === 'media' ? total / validos.length : total
}
