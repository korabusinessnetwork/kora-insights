/**
 * O motor: aplica um ruleset sobre um historico e devolve um `Diagnostico`
 * (contratos.md, secao 3).
 *
 * Ele nao sabe diagnosticar nada. Quem sabe sao as regras, que chegam por
 * parametro — e por isso o mesmo motor roda o ruleset 0.3.0 de hoje e o de
 * daqui a um ano sem reescrever diagnostico passado (ADR-005).
 *
 * Puro de ponta a ponta: sem rede, sem DOM, sem Supabase e sem relogio. O
 * instante entra por `contexto.agora`.
 */

import { obterMetrica } from '../metricas/dicionario.js'

/**
 * @typedef {object} Diagnostico
 * @property {string} id
 * @property {string} contaId
 * @property {string} geradoEm
 * @property {{ inicio: string, fim: string }} periodo
 * @property {string} rulesetVersion
 * @property {object[]} achados
 * @property {{ codigo: string, texto: string }[]} limites
 * @property {Cobertura} cobertura
 */

/**
 * @typedef {object} Cobertura
 * @property {number} semanas
 * @property {string|null} primeiroDado
 * @property {{ inicio: string, fim: string, motivo: string }[]} lacunas
 * @property {boolean} suficiente
 */

/**
 * Texto de cada limite que o produto declara. O codigo e estavel e viaja no
 * achado; a frase e pt-BR e vai para a tela — mesma separacao de `erros.js`.
 *
 * Regra nova que declare um codigo inedito precisa registra-lo aqui, senao a
 * tela mostra o aviso de limite sem texto (`src/rules/README.md`).
 *
 * @type {Record<string, string>}
 */
export const CATALOGO_DE_LIMITES = {
  // Texto do proprio dicionario: o limite e da metrica, nao do motor. Duas
  // copias do mesmo aviso divergiriam na primeira revisao de texto.
  'agregacao-de-alcance': obterMetrica('alcance').limiteDeAgregacao,
  'sem-trafego-pago':
    'Não há tráfego pago vinculado a esta conta. Tudo que este diagnóstico afirma ' +
    'vale para alcance orgânico.',
  'sem-comparacao-com-concorrente':
    'A API da Meta não entrega alcance, salvamento nem demografia de contas de ' +
    'terceiros. Não há comparação com concorrente neste diagnóstico.',
  'story-fora-da-janela':
    'Métricas de story existem por 24 horas na API. Story publicado e expirado ' +
    'entre duas coletas não entra em nenhum número desta tela.',
  'sem-causa-externa':
    'A regra não enxerga sazonalidade, feriado, campanha paga nem mudança de ' +
    'distribuição da plataforma no período.',
  'salvamento-nao-e-receita':
    'Salvamento mede atenção retida, não venda. Formato que salva mais não é, ' +
    'por si, formato que converte mais.',
  'dispersao-nao-explica-causa':
    'A dispersão mostra o quanto o resultado varia, não por que ele varia.',
  'historico-curto':
    'Com menos de 16 semanas completas o motor não compara janelas e não nomeia ' +
    'nenhuma causa.',
}

/**
 * Limites que valem para qualquer conta, tenha regra disparado ou nao. Sao
 * limites de plataforma e de escopo do produto, nao conclusoes do diagnostico.
 *
 * @param {import('./historico.js').Historico} historico
 * @returns {string[]} codigos
 */
function limitesQueValemSempre(historico) {
  const codigos = []
  // Sem tráfego pago vinculado o diagnóstico só enxerga o orgânico, e quem lê
  // precisa saber disso antes de atribuir o resultado ao conteúdo.
  if (!historico.recursos.temTrafegoPago) codigos.push('sem-trafego-pago')
  // ADR-006: comparação com concorrente é Fase 2, e mesmo lá a API não entrega
  // alcance de terceiro. Prometer comparação completa seria quebrar promessa.
  codigos.push('sem-comparacao-com-concorrente')
  codigos.push('story-fora-da-janela')
  codigos.push('agregacao-de-alcance')
  return codigos
}

/**
 * Traduz codigos de limite em `{ codigo, texto }`, sem repetir codigo.
 *
 * @param {string[]} codigos na ordem de prioridade desejada
 * @returns {{ codigo: string, texto: string }[]}
 */
function resolverLimites(codigos) {
  const vistos = new Set()
  const limites = []
  for (const codigo of codigos) {
    if (vistos.has(codigo)) continue
    vistos.add(codigo)
    limites.push({
      codigo,
      texto: CATALOGO_DE_LIMITES[codigo] ?? 'Limite declarado pela regra, sem texto cadastrado.',
    })
  }
  return limites
}

/**
 * Periodo coberto pelo diagnostico: da primeira semana do historico ate o fim
 * da ultima semana **completa**. A semana pela metade nao entra em comparacao,
 * entao tambem nao pode aparecer no cabecalho como periodo analisado.
 *
 * @param {import('./historico.js').Historico} historico
 * @param {string} agora ISO
 * @returns {{ inicio: string, fim: string }}
 */
function periodoDoDiagnostico(historico, agora) {
  const { semanas } = historico
  if (semanas.length === 0) {
    const dia = historico.primeiroDado ?? agora.slice(0, 10)
    return { inicio: dia, fim: dia }
  }
  const completas = semanas.filter((semana) => semana.completa)
  const ultima = completas[completas.length - 1] ?? semanas[semanas.length - 1]
  return { inicio: semanas[0].inicio, fim: ultima.fim }
}

/**
 * Identificador deterministico do diagnostico.
 *
 * Deterministico de proposito, e nao um uuid: rodar o mesmo ruleset sobre o
 * mesmo periodo da mesma conta precisa devolver o mesmo registro, senao cada
 * reprocessamento vira uma linha nova e a pergunta "mudou a conta ou mudou a
 * regra?" deixa de ter resposta (ADR-005). Os componentes ficam legiveis no
 * proprio id para a auditoria nao depender de decodificador.
 *
 * @param {string} contaId
 * @param {{ inicio: string, fim: string }} periodo
 * @param {string} rulesetVersion
 * @returns {string}
 */
export function idDoDiagnostico(contaId, periodo, rulesetVersion) {
  return `diag:${contaId}:${periodo.inicio}:${periodo.fim}:${rulesetVersion}`
}

/**
 * Aplica o ruleset sobre o historico.
 *
 * @param {import('./historico.js').Historico} historico
 * @param {{ versao: string, regras: object[] }} ruleset
 * @param {{ agora: string }} contexto relogio injetado: motor puro nao le Date.now()
 * @returns {Diagnostico}
 */
export function gerarDiagnostico(historico, ruleset, contexto) {
  const agora = contexto?.agora
  if (typeof agora !== 'string') {
    throw new Error('gerarDiagnostico exige contexto.agora: o motor nao le o relogio.')
  }

  const semanasCompletas = historico.semanas.filter((semana) => semana.completa).length

  const achados = ruleset.regras
    // A regra so e consultada com historico suficiente para ela. Sem esse corte,
    // cada regra teria de reimplementar a propria checagem de tamanho.
    .filter((regra) => semanasCompletas >= (regra.minimoDeSemanas ?? 0))
    .map((regra) => regra.avaliar(historico))
    .filter((achado) => achado !== null && achado !== undefined)
    .sort((a, b) => b.peso - a.peso)

  // "Ainda nao sei" no topo silencia o resto: um veredito parcial ao lado da
  // admissao de ignorancia convida o cliente a agir com meia informacao, que e
  // exatamente o que este produto existe para nao fazer.
  const indeterminado = achados.length > 0 && achados[0].severidade === 'indeterminado'
  const finais = indeterminado ? [achados[0]] : achados

  const periodo = periodoDoDiagnostico(historico, agora)
  const codigosDeLimite = [
    ...finais.flatMap((achado) => achado.limites ?? []),
    ...limitesQueValemSempre(historico),
  ]

  return {
    id: idDoDiagnostico(historico.contaId, periodo, ruleset.versao),
    contaId: historico.contaId,
    geradoEm: agora,
    periodo,
    rulesetVersion: ruleset.versao,
    achados: finais,
    limites: resolverLimites(codigosDeLimite),
    cobertura: {
      semanas: semanasCompletas,
      primeiroDado: historico.primeiroDado,
      lacunas: historico.lacunas,
      suficiente: !indeterminado,
    },
  }
}
