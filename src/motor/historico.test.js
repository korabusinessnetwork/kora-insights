import { describe, expect, it } from 'vitest'

import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../fixtures/estudioVergara.js'
import { obterMetrica } from '../metricas/dicionario.js'
import { montarHistorico } from './historico.js'

/** @param {number} indice posicao da conta em CONTAS @returns {object} Historico */
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
const studioNove = historicoDaFixture(2)

describe('montarHistorico — recorte por conta', () => {
  it('so traz linhas da conta pedida', () => {
    expect(casaOliveira.contaId).toBe('conta-casa-oliveira')
    expect(studioNove.contaId).toBe('conta-studio-nove')
    expect(studioNove.semanas.length).toBe(3)
  })

  it('primeiroDado e a menor data com snapshot', () => {
    expect(casaOliveira.primeiroDado).toBe('2026-05-11')
    expect(studioNove.primeiroDado).toBe('2026-08-17')
  })

  it('devolve historico vazio, e nao erro, para conta sem coleta', () => {
    const vazio = montarHistorico({
      conta: { id: 'conta-sem-coleta' },
      snapshotsConta: SNAPSHOTS_CONTA,
      snapshotsMidia: SNAPSHOTS_MIDIA,
      eventosDeColeta: EVENTOS_DE_COLETA,
      ate: AGORA,
    })
    expect(vazio.semanas).toEqual([])
    expect(vazio.primeiroDado).toBeNull()
  })
})

describe('montarHistorico — semanas', () => {
  it('agrupa por semana ISO, de segunda a domingo', () => {
    const primeira = casaOliveira.semanas[0]
    expect(primeira.inicio).toBe('2026-05-11')
    expect(primeira.fim).toBe('2026-05-17')
    expect(new Date(`${primeira.inicio}T00:00:00Z`).getUTCDay()).toBe(1)
  })

  it('marca a semana corrente como incompleta e nao a conta como completa', () => {
    const corrente = casaOliveira.semanas[casaOliveira.semanas.length - 1]
    expect(corrente.inicio).toBe('2026-08-31')
    expect(corrente.diasComColeta).toBe(6)
    expect(corrente.completa).toBe(false)
    expect(casaOliveira.semanas.filter((semana) => semana.completa).length).toBe(16)
  })

  it('agrega metrica de fluxo por soma e metrica de estoque pelo ultimo saldo', () => {
    expect(obterMetrica('alcance').agregacao).toBe('soma')
    expect(obterMetrica('seguidores').agregacao).toBe('ultimo')
    const semanaDeReferencia = casaOliveira.semanas.find((s) => s.inicio === '2026-08-24')
    expect(semanaDeReferencia.valores.alcance).toBe(1700)
    // Saldo do fim da semana, nunca a soma dos sete saldos diarios.
    expect(semanaDeReferencia.valores.seguidores).toBe(6176)
  })

  it('metrica sem leitura na semana fica ausente do objeto, nunca zero', () => {
    for (const semana of casaOliveira.semanas) {
      expect(semana.valores).not.toHaveProperty('curtidas')
    }
  })

  it('anexa a midia na semana em que foi publicada, com metricas canonicas', () => {
    const semana = casaOliveira.semanas.find((s) => s.inicio === '2026-08-24')
    expect(semana.midias.length).toBe(1)
    expect(semana.midias[0].tipo).toBe('carrossel')
    expect(semana.midias[0].publicadaEm.slice(0, 10)).toBe('2026-08-24')
    expect(semana.midias[0].metricas.alcance).toBe(2050)
    expect(Object.keys(semana.midias[0].metricas)).toContain('salvamentos')
  })

  it('as 8 semanas anteriores da Casa Oliveira somam 41.200 e as 8 recentes 26.900', () => {
    const completas = casaOliveira.semanas.filter((semana) => semana.completa)
    const somar = (janelas) => janelas.reduce((total, j) => total + j.valores.alcance, 0)
    expect(somar(completas.slice(0, 8))).toBe(41200)
    expect(somar(completas.slice(8))).toBe(26900)
  })
})

describe('montarHistorico — lacunas', () => {
  it('reporta os cinco dias sem coleta do Verdejar como um unico intervalo', () => {
    expect(verdejar.lacunas).toEqual([
      {
        inicio: '2026-08-10',
        fim: '2026-08-14',
        motivo: 'Token expirado: a coleta do dia não aconteceu.',
      },
    ])
  })

  it('a lacuna derruba a semana inteira da comparacao', () => {
    const semanaDaLacuna = verdejar.semanas.find((s) => s.inicio === '2026-08-10')
    expect(semanaDaLacuna.diasComColeta).toBe(2)
    expect(semanaDaLacuna.completa).toBe(false)
    // Dezenove semanas de calendario, uma perdida pela lacuna e uma ainda em
    // curso: sobram dezessete completas. A conta continua diagnosticavel, e e
    // esse o ponto — cinco dias sem coleta custam uma semana, nao o diagnostico.
    expect(verdejar.semanas.filter((s) => s.completa).length).toBe(17)
  })

  it('conta com coleta em dia e sem evento de falha nao inventa lacuna', () => {
    expect(casaOliveira.lacunas).toEqual([])
    expect(studioNove.lacunas).toEqual([])
  })

  it('deriva lacuna de dia sem snapshot mesmo sem evento registrado', () => {
    const semEvento = montarHistorico({
      conta: CONTAS[1],
      snapshotsConta: SNAPSHOTS_CONTA,
      snapshotsMidia: SNAPSHOTS_MIDIA,
      eventosDeColeta: [],
      ate: AGORA,
    })
    expect(semEvento.lacunas).toEqual([
      { inicio: '2026-08-10', fim: '2026-08-14', motivo: 'Sem coleta registrada neste dia.' },
    ])
  })
})

describe('montarHistorico — recursos e corte', () => {
  it('le os recursos da conta, sem inventar padrao otimista', () => {
    expect(casaOliveira.recursos).toEqual({ temTrafegoPago: false, temConcorrentes: false })
  })

  it('respeita o corte `ate` em vez de ler o relogio', () => {
    const ateJulho = montarHistorico({
      conta: CONTAS[0],
      snapshotsConta: SNAPSHOTS_CONTA,
      snapshotsMidia: SNAPSHOTS_MIDIA,
      eventosDeColeta: EVENTOS_DE_COLETA,
      ate: '2026-07-05',
    })
    const ultima = ateJulho.semanas[ateJulho.semanas.length - 1]
    expect(ultima.inicio).toBe('2026-06-29')
    expect(ateJulho.semanas.filter((s) => s.completa).length).toBe(8)
  })
})
