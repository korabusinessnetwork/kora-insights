import { describe, expect, it } from 'vitest'

import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../../fixtures/estudioVergara.js'
import { montarHistorico } from '../../motor/index.js'
import dadoInsuficiente from './dadoInsuficiente.js'

/** @param {number} indice @returns {object} Historico */
function historicoDaFixture(indice) {
  return montarHistorico({
    conta: CONTAS[indice],
    snapshotsConta: SNAPSHOTS_CONTA,
    snapshotsMidia: SNAPSHOTS_MIDIA,
    eventosDeColeta: EVENTOS_DE_COLETA,
    ate: AGORA,
  })
}

describe('dado-insuficiente sobre o Studio Nove', () => {
  const achado = dadoInsuficiente.avaliar(historicoDaFixture(2))

  it('e indeterminado e tem o maior peso do ruleset', () => {
    expect(achado.regra).toBe('dado-insuficiente')
    expect(achado.severidade).toBe('indeterminado')
    expect(achado.peso).toBe(100)
    expect(achado.rotulo).toBe('Histórico curto, sem veredito')
  })

  it('diz quantas semanas existem e quantas faltam, sem palpite', () => {
    expect(achado.frase).toBe(
      'Você tem 2 semanas completas de histórico. Faltam 14 para o primeiro diagnóstico ' +
        'de causa.',
    )
    expect(achado.acao).toBe(
      'Mantenha a conta conectada e a coleta diária ligada. Não há ação de conteúdo a ' +
        'recomendar com este histórico.',
    )
  })

  it('nao apresenta evidencia nem serie: nao ha o que provar', () => {
    expect(achado.evidencias).toEqual([])
    expect(achado.serie).toBeNull()
    expect(achado.limites).toEqual(['historico-curto'])
  })
})

describe('dado-insuficiente sobre o Verdejar', () => {
  it('nao dispara: a conta tem historico, apesar dos cinco dias sem coleta', () => {
    // A lacuna custa uma semana completa, nao o diagnostico. Se esta regra
    // voltar a disparar aqui, ou a fixture encolheu ou o piso do ruleset subiu —
    // e nos dois casos a demonstracao perde o desfecho "conta saudavel".
    expect(dadoInsuficiente.avaliar(historicoDaFixture(1))).toBeNull()
  })

  it('a lacuna continua contada no historico, mesmo sem impedir o diagnostico', () => {
    const verdejar = historicoDaFixture(1)
    expect(verdejar.lacunas).toEqual([
      {
        inicio: '2026-08-10',
        fim: '2026-08-14',
        motivo: 'Token expirado: a coleta do dia não aconteceu.',
      },
    ])
  })
})

describe('dado-insuficiente quando ja ha historico', () => {
  it('se cala para a Casa Oliveira, que tem as 16 semanas completas', () => {
    expect(dadoInsuficiente.avaliar(historicoDaFixture(0))).toBeNull()
  })

  it('concorda no singular quando existe uma semana so', () => {
    const historico = historicoDaFixture(2)
    historico.semanas = historico.semanas.slice(0, 1).map((semana) => ({ ...semana }))
    historico.lacunas = []
    const achado = dadoInsuficiente.avaliar(historico)
    expect(achado.frase).toBe(
      'Você tem 1 semana completa de histórico. Faltam 15 para o primeiro diagnóstico ' +
        'de causa.',
    )
  })
})
