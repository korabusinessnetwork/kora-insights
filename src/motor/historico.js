/**
 * Monta o `Historico` de contratos.md (secao 3) a partir das linhas cruas de
 * snapshot e dos eventos de coleta.
 *
 * Este modulo e onde a honestidade de dado do produto e decidida. Ele nao
 * conserta serie: dia sem coleta nao vira zero, semana pela metade nao vira
 * semana, e falha de coleta registrada vira lacuna nomeada. Toda a diferenca
 * entre "o perfil caiu" e "faltou dado" nasce aqui.
 */

import {
  diasDaSemana,
  diferencaEmDias,
  segundaDaSemana,
  somarDias,
} from '../fixtures/calendario.js'
import { agregar, metricaExiste } from '../metricas/dicionario.js'

/**
 * @typedef {object} Midia
 * @property {string} id
 * @property {string} tipo             'carrossel' | 'imagem' | 'reel' | 'story'
 * @property {string} publicadaEm      ISO
 * @property {Record<string, number>} metricas   codigos canonicos
 */

/**
 * @typedef {object} Janela
 * @property {string} inicio           segunda-feira
 * @property {string} fim              domingo
 * @property {Record<string, number>} valores    metricas de conta, ja agregadas
 * @property {Midia[]} midias          publicadas nesta semana
 * @property {number} diasComColeta    0 a 7
 * @property {boolean} completa        7 dias coletados
 */

/**
 * @typedef {object} Historico
 * @property {string} contaId
 * @property {Janela[]} semanas   ordenadas da mais antiga para a mais recente
 * @property {{ inicio: string, fim: string, motivo: string }[]} lacunas
 * @property {string|null} primeiroDado
 * @property {{ temTrafegoPago: boolean, temConcorrentes: boolean }} recursos
 */

/**
 * Texto de lacuna por status de `coleta_eventos`. O status e codigo estavel; a
 * frase e pt-BR e vai para a tela, entao a traducao mora no motor e nao no banco.
 *
 * @type {Record<string, string>}
 */
const MOTIVOS_DE_FALHA = {
  token_expirado: 'Token expirado: a coleta do dia não aconteceu.',
  limite_de_taxa: 'Limite de chamadas da Meta atingido: coleta do dia adiada.',
  falha_de_rede: 'Falha de rede: a coleta do dia não completou.',
}

const MOTIVO_SEM_SNAPSHOT = 'Sem coleta registrada neste dia.'
const MOTIVO_FALHA_DESCONHECIDA = 'A coleta do dia falhou.'

/** @param {string} iso data ou data-hora ISO @returns {string} `YYYY-MM-DD` */
function paraDia(iso) {
  return String(iso).slice(0, 10)
}

/**
 * Agrega as leituras de conta de uma semana pelo dicionario canonico: fluxo
 * soma, estoque vale o ultimo saldo. Metrica sem leitura na semana fica
 * **ausente** do objeto — ausencia e lacuna, e zero e afirmacao
 * (contratos.md, secao 3).
 *
 * @param {object[]} linhas snapshots de conta da semana, em ordem cronologica
 * @returns {Record<string, number>}
 */
function agregarValoresDaSemana(linhas) {
  /** @type {Map<string, number[]>} */
  const leiturasPorMetrica = new Map()

  for (const linha of linhas) {
    // Codigo fora do dicionario nunca vira coluna nova: metrica que nao
    // conhecemos morre na entrada, com o nome dela (ADR-003).
    if (!metricaExiste(linha.metrica)) continue
    const atual = leiturasPorMetrica.get(linha.metrica)
    if (atual) atual.push(linha.valor)
    else leiturasPorMetrica.set(linha.metrica, [linha.valor])
  }

  /** @type {Record<string, number>} */
  const valores = {}
  for (const [metrica, leituras] of leiturasPorMetrica) {
    const valor = agregar(metrica, leituras)
    if (valor !== null) valores[metrica] = valor
  }
  return valores
}

/**
 * Reduz as linhas de snapshot de midia a uma lista de `Midia`.
 *
 * Metrica de midia e total acumulado, nao fluxo diario: a leitura que vale e a
 * mais recente. Somar as leituras diarias de uma midia contaria o mesmo
 * salvamento todos os dias ate ela sair do ar.
 *
 * @param {object[]} linhas
 * @returns {Midia[]}
 */
function montarMidias(linhas) {
  /** @typedef {{ valor: number, data: string }} LeituraDeMidia */
  /** @typedef {Map<string, LeituraDeMidia>} LeiturasDaMidia */
  /**
   * @typedef {object} MidiaEmMontagem
   * @property {string} id
   * @property {string} tipo
   * @property {string} publicadaEm
   * @property {LeiturasDaMidia} leituras
   */
  /** @type {Map<string, MidiaEmMontagem>} */
  const porMidia = new Map()

  for (const linha of linhas) {
    let midia = porMidia.get(linha.ig_media_id)
    if (!midia) {
      midia = {
        id: linha.ig_media_id,
        tipo: linha.tipo,
        publicadaEm: linha.publicada_em,
        leituras: new Map(),
      }
      porMidia.set(linha.ig_media_id, midia)
    }
    const leitura = midia.leituras.get(linha.metrica)
    if (!leitura || linha.data >= leitura.data) {
      midia.leituras.set(linha.metrica, { valor: linha.valor, data: linha.data })
    }
  }

  return [...porMidia.values()]
    .map(({ id, tipo, publicadaEm, leituras }) => ({
      id,
      tipo,
      publicadaEm,
      metricas: Object.fromEntries([...leituras].map(([metrica, l]) => [metrica, l.valor])),
    }))
    .sort((a, b) => a.publicadaEm.localeCompare(b.publicadaEm))
}

/**
 * Junta dias soltos em intervalos contiguos que compartilham o mesmo motivo.
 * Cinco dias seguidos de token expirado sao uma lacuna, nao cinco avisos —
 * cinco avisos iguais na tela viram ruido e o cliente para de ler.
 *
 * @param {Map<string, string>} motivosPorDia dia `YYYY-MM-DD` para motivo
 * @returns {{ inicio: string, fim: string, motivo: string }[]}
 */
function agruparLacunas(motivosPorDia) {
  const dias = [...motivosPorDia.keys()].sort()
  /** @type {{ inicio: string, fim: string, motivo: string }[]} */
  const intervalos = []

  for (const dia of dias) {
    const motivo = motivosPorDia.get(dia)
    const ultimoIntervalo = intervalos[intervalos.length - 1]
    const contiguo =
      ultimoIntervalo &&
      ultimoIntervalo.motivo === motivo &&
      diferencaEmDias(ultimoIntervalo.fim, dia) === 1
    if (contiguo) ultimoIntervalo.fim = dia
    else intervalos.push({ inicio: dia, fim: dia, motivo })
  }

  return intervalos
}

/**
 * Deriva as lacunas de duas fontes independentes: o dia que nao tem snapshot
 * dentro do intervalo ja coletado, e o evento de coleta que terminou diferente
 * de `ok`. Uma nao substitui a outra — a coleta pode falhar e ainda assim
 * gravar linha parcial, e pode faltar linha sem ninguem ter registrado o erro.
 *
 * @param {object} entrada
 * @param {Set<string>} entrada.diasComColeta
 * @param {string|null} entrada.primeiroDado
 * @param {string|null} entrada.ultimoDado
 * @param {object[]} entrada.eventos ja filtrados pela conta e pelo corte
 * @returns {{ inicio: string, fim: string, motivo: string }[]}
 */
function derivarLacunas({ diasComColeta, primeiroDado, ultimoDado, eventos }) {
  /** @type {Map<string, string>} */
  const motivosPorDia = new Map()

  if (primeiroDado && ultimoDado) {
    for (let dia = primeiroDado; dia <= ultimoDado; dia = somarDias(dia, 1)) {
      if (!diasComColeta.has(dia)) motivosPorDia.set(dia, MOTIVO_SEM_SNAPSHOT)
    }
  }

  // O evento nomeado ganha do silencio: "token expirado" diz ao cliente o que
  // fazer, "sem coleta" so diz que faltou.
  for (const evento of eventos) {
    if (evento.status === 'ok') continue
    const dia = paraDia(evento.ocorrido_em)
    motivosPorDia.set(dia, MOTIVOS_DE_FALHA[evento.status] ?? MOTIVO_FALHA_DESCONHECIDA)
  }

  return agruparLacunas(motivosPorDia)
}

/**
 * Monta o historico semanal canonico de uma conta.
 *
 * @param {object} entrada
 * @param {{ id: string, tem_trafego_pago?: boolean, tem_concorrentes?: boolean }} entrada.conta
 * @param {object[]} entrada.snapshotsConta linhas de `snapshots_conta` (qualquer conta)
 * @param {object[]} entrada.snapshotsMidia linhas de `snapshots_midia` (qualquer conta)
 * @param {object[]} [entrada.eventosDeColeta] linhas de `coleta_eventos`
 * @param {string} [entrada.ate] corte, `YYYY-MM-DD` ou ISO; padrao: ultimo dia coletado
 * @returns {Historico}
 */
export function montarHistorico({
  conta,
  snapshotsConta = [],
  snapshotsMidia = [],
  eventosDeColeta = [],
  ate,
}) {
  const contaId = conta.id
  // O corte entra por parametro porque o motor nao le relogio: um historico que
  // muda de tamanho conforme a hora nao pode ser testado contra serie real.
  const corte = ate ? paraDia(ate) : '9999-12-31'

  const linhasConta = snapshotsConta
    .filter((linha) => linha.ig_conta_id === contaId && linha.data <= corte)
    .sort((a, b) => a.data.localeCompare(b.data))

  const linhasMidia = snapshotsMidia.filter(
    (linha) =>
      linha.ig_conta_id === contaId &&
      linha.data <= corte &&
      paraDia(linha.publicada_em) <= corte,
  )

  const eventos = eventosDeColeta.filter(
    (evento) => evento.ig_conta_id === contaId && paraDia(evento.ocorrido_em) <= corte,
  )

  const recursos = {
    temTrafegoPago: Boolean(conta.tem_trafego_pago),
    temConcorrentes: Boolean(conta.tem_concorrentes),
  }

  const diasComColeta = new Set([
    ...linhasConta.map((linha) => linha.data),
    ...linhasMidia.map((linha) => linha.data),
  ])

  if (diasComColeta.size === 0) {
    return {
      contaId,
      semanas: [],
      lacunas: derivarLacunas({ diasComColeta, primeiroDado: null, ultimoDado: null, eventos }),
      primeiroDado: null,
      recursos,
    }
  }

  const diasOrdenados = [...diasComColeta].sort()
  const primeiroDado = diasOrdenados[0]
  const ultimoDado = diasOrdenados[diasOrdenados.length - 1]

  const contaPorSemana = agruparPorSemana(linhasConta, (linha) => linha.data)
  const midiasPorSemana = agruparPorSemana(linhasMidia, (linha) => paraDia(linha.publicada_em))

  // A serie vai da primeira segunda coletada ate a semana do corte, sem pular
  // semana vazia: semana que sumiu da lista e semana que ninguem ve faltar.
  const primeiraSegunda = segundaDaSemana(primeiroDado)
  const ultimaSegunda = segundaDaSemana(corte === '9999-12-31' ? ultimoDado : corte)
  const totalDeSemanas = diferencaEmDias(primeiraSegunda, ultimaSegunda) / 7 + 1

  const semanas = Array.from({ length: totalDeSemanas }, (_, indice) => {
    const inicio = somarDias(primeiraSegunda, indice * 7)
    const dias = diasDaSemana(inicio)
    const coletados = dias.filter((dia) => diasComColeta.has(dia))
    return {
      inicio,
      fim: dias[6],
      valores: agregarValoresDaSemana(contaPorSemana.get(inicio) ?? []),
      midias: montarMidias(midiasPorSemana.get(inicio) ?? []),
      diasComColeta: coletados.length,
      completa: coletados.length === 7,
    }
  })

  return {
    contaId,
    semanas,
    lacunas: derivarLacunas({ diasComColeta, primeiroDado, ultimoDado, eventos }),
    primeiroDado,
    recursos,
  }
}

/**
 * @param {object[]} linhas
 * @param {(linha: object) => string} dataDaLinha
 * @returns {Map<string, object[]>} segunda-feira da semana para as linhas dela
 */
function agruparPorSemana(linhas, dataDaLinha) {
  /** @type {Map<string, object[]>} */
  const porSemana = new Map()
  for (const linha of linhas) {
    const segunda = segundaDaSemana(dataDaLinha(linha))
    const atual = porSemana.get(segunda)
    if (atual) atual.push(linha)
    else porSemana.set(segunda, [linha])
  }
  return porSemana
}
