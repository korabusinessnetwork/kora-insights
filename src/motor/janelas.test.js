import { describe, expect, it } from 'vitest'

import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../fixtures/estudioVergara.js'
import { montarHistorico } from './historico.js'
import {
  compararJanelas,
  mediaPorPublicacao,
  ultimasJanelasCompletas,
  valorDaJanela,
  valoresPorPublicacao,
} from './janelas.js'

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

const casaOliveira = historicoDaFixture(0)
const verdejar = historicoDaFixture(1)

describe('ultimasJanelasCompletas', () => {
  it('descarta a semana corrente, que esta pela metade', () => {
    const oito = ultimasJanelasCompletas(casaOliveira, 8)
    expect(oito.length).toBe(8)
    expect(oito.map((j) => j.inicio).at(-1)).toBe('2026-08-24')
    expect(oito.every((j) => j.completa)).toBe(true)
  })

  it('pula a semana com falha de coleta sem deixar buraco na comparacao', () => {
    const oito = ultimasJanelasCompletas(verdejar, 8)
    // 2026-08-10 e a semana dos cinco dias sem coleta: fora da comparacao.
    expect(oito.map((j) => j.inicio)).toEqual([
      '2026-06-29',
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
      '2026-08-03',
      '2026-08-17',
      '2026-08-24',
    ])
  })

  it('devolve em ordem cronologica e nunca mais do que existe', () => {
    const todas = ultimasJanelasCompletas(casaOliveira, 99)
    expect(todas.length).toBe(16)
    expect(todas[0].inicio < todas.at(-1).inicio).toBe(true)
    expect(ultimasJanelasCompletas(casaOliveira, 0)).toEqual([])
  })
})

describe('valorDaJanela e compararJanelas', () => {
  const completas = ultimasJanelasCompletas(casaOliveira, 16)
  const anteriores = completas.slice(0, 8)
  const recentes = completas.slice(8)

  it('soma fluxo e pega o ultimo saldo do estoque', () => {
    expect(valorDaJanela(recentes, 'alcance')).toBe(26900)
    expect(valorDaJanela(anteriores, 'alcance')).toBe(41200)
    expect(valorDaJanela(recentes, 'seguidores')).toBe(6176)
    expect(valorDaJanela(recentes, 'metrica_que_nao_existe')).toBeNull()
  })

  it('compara metrica a metrica de conta', () => {
    const comparacao = compararJanelas(recentes, anteriores)
    expect(comparacao.alcance).toEqual({ atual: 26900, anterior: 41200, variacao: -0.3471 })
    expect(comparacao.publicacoes).toEqual({ atual: 14, anterior: 24, variacao: -0.4167 })
    expect(Object.keys(comparacao)).toContain('visitas_ao_perfil')
  })
})

describe('mediaPorPublicacao', () => {
  const completas = ultimasJanelasCompletas(casaOliveira, 16)

  it('divide pelas midias, nao pelas semanas', () => {
    const recentes = mediaPorPublicacao(completas.slice(8), 'alcance')
    const anteriores = mediaPorPublicacao(completas.slice(0, 8), 'alcance')
    expect(recentes.publicacoes).toBe(14)
    expect(anteriores.publicacoes).toBe(24)
    expect(recentes.valor).toBe(2240)
    expect(anteriores.valor).toBe(2290)
  })

  it('marca o limite de agregacao das metricas de fluxo somadas por janela', () => {
    expect(mediaPorPublicacao(completas, 'alcance').limiteDeAgregacao).toBe('agregacao-de-alcance')
    expect(mediaPorPublicacao(completas, 'salvamentos').limiteDeAgregacao).toBeNull()
  })

  it('devolve valor nulo quando nao ha midia com a metrica', () => {
    const vazio = mediaPorPublicacao([], 'alcance')
    expect(vazio.valor).toBeNull()
    expect(vazio.publicacoes).toBe(0)
  })
})

describe('valoresPorPublicacao', () => {
  it('devolve uma entrada por midia, para medir dispersao', () => {
    const recentes = ultimasJanelasCompletas(casaOliveira, 16).slice(8)
    const alcances = valoresPorPublicacao(recentes, 'alcance')
    expect(alcances.length).toBe(14)
    expect(alcances.reduce((total, valor) => total + valor, 0)).toBe(31360)
  })
})
