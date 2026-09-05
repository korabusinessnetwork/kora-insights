/**
 * Regra `dado-insuficiente` — a que impede o produto de virar gerador de frase
 * bonita.
 *
 * Tem o maior peso do ruleset de proposito: quando ela dispara, o motor descarta
 * todos os outros achados e a tela diz "ainda nao sei". Um veredito parcial ao
 * lado de uma admissao de ignorancia convida o cliente a agir com meia
 * informacao, e o valor "honestidade de dado" (`memory/identity.md`) existe
 * exatamente para nao permitir isso.
 *
 * Ela nao oferece palpite. Nao ha frase provisoria, nao ha tendencia estimada,
 * nao ha "parece que". So a contagem do que existe e do que falta.
 *
 * Pura: sem rede, sem DOM, sem relogio.
 */

import { diferencaEmDias } from '../../fixtures/calendario.js'

/** Oito semanas recentes contra oito anteriores: o piso do diagnostico de causa. */
const SEMANAS_NECESSARIAS = 16

/**
 * @param {number} quantidade
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function concordar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural
}

/**
 * Total de dias cobertos pelas lacunas registradas. Serve para explicar ao
 * cliente por que o historico e mais curto do que o tempo de conexao sugere.
 *
 * @param {{ inicio: string, fim: string }[]} lacunas
 * @returns {number}
 */
function diasSemColeta(lacunas) {
  return lacunas.reduce(
    (total, lacuna) => total + diferencaEmDias(lacuna.inicio, lacuna.fim) + 1,
    0,
  )
}

export default {
  codigo: 'dado-insuficiente',
  versao: '0.3.0',
  peso: 100,
  // Zero: e a unica regra que precisa ser consultada justamente quando nao ha
  // historico. Um minimo maior a silenciaria no caso que ela existe para cobrir.
  minimoDeSemanas: 0,

  /**
   * @param {import('../../motor/historico.js').Historico} historico
   * @returns {object|null} null quando ja ha as 16 semanas completas
   */
  avaliar(historico) {
    const completas = historico.semanas.filter((semana) => semana.completa).length
    if (completas >= SEMANAS_NECESSARIAS) return null

    const faltam = SEMANAS_NECESSARIAS - completas
    const dias = diasSemColeta(historico.lacunas)
    const emColeta = historico.semanas.length - completas

    const apoioDaLacuna =
      dias > 0
        ? ` ${dias} ${concordar(dias, 'dia', 'dias')} sem coleta no período: cada dia que ` +
          'falta tira a semana inteira da comparação.'
        : ''

    return {
      regra: 'dado-insuficiente',
      versaoRegra: '0.3.0',
      severidade: 'indeterminado',
      rotulo: 'Histórico curto, sem veredito',
      frase:
        `Você tem ${completas} ${concordar(completas, 'semana completa', 'semanas completas')} ` +
        `de histórico. ${concordar(faltam, 'Falta', 'Faltam')} ${faltam} para o primeiro ` +
        'diagnóstico de causa.',
      apoio:
        `O diagnóstico de causa compara ${SEMANAS_NECESSARIAS / 2} semanas completas com as ` +
        `${SEMANAS_NECESSARIAS / 2} anteriores. Existem ${completas} ` +
        `${concordar(completas, 'semana fechada', 'semanas fechadas')} e ${emColeta} ` +
        `${concordar(emColeta, 'semana', 'semanas')} ainda em coleta ou com falha.` +
        apoioDaLacuna,
      // Sem palpite: a unica acao honesta e manter a coleta rodando.
      acao:
        'Mantenha a conta conectada e a coleta diária ligada. Não há ação de conteúdo a ' +
        'recomendar com este histórico.',
      confirmacao:
        `Quando as ${SEMANAS_NECESSARIAS} semanas completas existirem, o motor compara as ` +
        `${SEMANAS_NECESSARIAS / 2} mais recentes com as ${SEMANAS_NECESSARIAS / 2} ` +
        'anteriores e nomeia a causa. Antes disso, qualquer veredito seria chute.',
      // Evidencia vazia de proposito: nao ha o que provar, e esse e o achado.
      evidencias: [],
      serie: null,
      limites: ['historico-curto'],
      peso: 100,
    }
  },
}
