import { describe, expect, it } from 'vitest'

import { diferencaEmDias, distribuir, segundaDaSemana, somarDias } from './calendario.js'
import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SEMANA_REFERENCIA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
  TENANT,
} from './estudioVergara.js'

/** Janela do diagnostico da identidade: as 8 semanas que terminam em 30/08/2026. */
const ULTIMAS_8 = { inicio: '2026-07-06', fim: '2026-08-30' }
const ANTERIORES_8 = { inicio: '2026-05-11', fim: '2026-07-05' }

const CASA_OLIVEIRA = CONTAS[0].id
const VERDEJAR = CONTAS[1].id
const STUDIO_NOVE = CONTAS[2].id

/**
 * @param {string} contaId
 * @param {string} metrica
 * @param {{inicio: string, fim: string}} janela
 * @returns {number}
 */
function somaDaConta(contaId, metrica, janela) {
  return SNAPSHOTS_CONTA.filter(
    (s) =>
      s.ig_conta_id === contaId &&
      s.metrica === metrica &&
      s.data >= janela.inicio &&
      s.data <= janela.fim,
  ).reduce((total, s) => total + s.valor, 0)
}

/**
 * @param {string} contaId
 * @param {{inicio: string, fim: string}} janela
 * @returns {number[]} alcance de cada midia publicada na janela
 */
function alcanceDasMidias(contaId, janela) {
  return SNAPSHOTS_MIDIA.filter(
    (s) =>
      s.ig_conta_id === contaId &&
      s.metrica === 'alcance' &&
      s.publicada_em.slice(0, 10) >= janela.inicio &&
      s.publicada_em.slice(0, 10) <= janela.fim,
  ).map((s) => s.valor)
}

describe('calendario', () => {
  it('segundaDaSemana devolve a segunda ISO, inclusive quando a data e domingo', () => {
    expect(segundaDaSemana('2026-08-30')).toBe('2026-08-24')
    expect(segundaDaSemana('2026-08-24')).toBe('2026-08-24')
    expect(segundaDaSemana('2026-09-05')).toBe('2026-08-31')
  })

  it('somarDias atravessa virada de mes e de ano', () => {
    expect(somarDias('2026-08-30', 1)).toBe('2026-08-31')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('diferencaEmDias conta a janela de 8 semanas da identidade', () => {
    expect(diferencaEmDias(ULTIMAS_8.inicio, ULTIMAS_8.fim)).toBe(55)
  })

  it('distribuir nao perde nem inventa unidade', () => {
    expect(distribuir(26900, 7).reduce((a, b) => a + b, 0)).toBe(26900)
    expect(distribuir(3, 7)).toEqual([1, 1, 1, 0, 0, 0, 0])
    expect(distribuir(0, 7).every((v) => v === 0)).toBe(true)
  })
})

describe('fixture Estudio Vergara', () => {
  it('a agencia tem tres contas, uma por desfecho de tela', () => {
    expect(TENANT.nome).toBe('Estúdio Vergara')
    expect(CONTAS).toHaveLength(3)
    expect(CONTAS.every((c) => c.tenant_id === TENANT.id)).toBe(true)
  })

  it('nao existe dado depois de AGORA — a fixture nao ve o futuro', () => {
    const hoje = AGORA.slice(0, 10)
    expect(SNAPSHOTS_CONTA.every((s) => s.data <= hoje)).toBe(true)
    expect(SNAPSHOTS_MIDIA.every((s) => s.data <= hoje)).toBe(true)
  })

  it('a semana de referencia e a ultima semana ISO completa', () => {
    expect(segundaDaSemana(SEMANA_REFERENCIA.fim)).toBe(SEMANA_REFERENCIA.inicio)
    expect(diferencaEmDias(SEMANA_REFERENCIA.inicio, SEMANA_REFERENCIA.fim)).toBe(6)
  })

  it('todo snapshot carrega a versao da API e do adaptador (ADR-003)', () => {
    const temRastro = (s) => Boolean(s.api_version) && Boolean(s.adapter_version)
    expect(SNAPSHOTS_CONTA.every(temRastro)).toBe(true)
    expect(SNAPSHOTS_MIDIA.every(temRastro)).toBe(true)
  })
})

// Estes numeros sao os da identidade visual. Se um deles mudar, ou a fixture
// quebrou ou alguem redesenhou o produto — nos dois casos, pare e olhe.
describe('Casa Oliveira reproduz os numeros da identidade', () => {
  it('publicacoes: 14 em 8 semanas contra 24 nas 8 anteriores (1,8 contra 3,0)', () => {
    const recentes = somaDaConta(CASA_OLIVEIRA, 'publicacoes', ULTIMAS_8)
    const anteriores = somaDaConta(CASA_OLIVEIRA, 'publicacoes', ANTERIORES_8)
    expect(recentes).toBe(14)
    expect(anteriores).toBe(24)
    expect(Number((recentes / 8).toFixed(1))).toBe(1.8)
    expect(Number((anteriores / 8).toFixed(1))).toBe(3.0)
  })

  it('contas alcancadas: 26.900 contra 41.200 (35% abaixo)', () => {
    const recentes = somaDaConta(CASA_OLIVEIRA, 'alcance', ULTIMAS_8)
    const anteriores = somaDaConta(CASA_OLIVEIRA, 'alcance', ANTERIORES_8)
    expect(recentes).toBe(26900)
    expect(anteriores).toBe(41200)
    expect(Math.round(((recentes - anteriores) / anteriores) * 100)).toBe(-35)
  })

  it('alcance por publicacao: 2.240 contra 2.290, ou seja, estavel', () => {
    const recentes = alcanceDasMidias(CASA_OLIVEIRA, ULTIMAS_8)
    const anteriores = alcanceDasMidias(CASA_OLIVEIRA, ANTERIORES_8)
    expect(recentes).toHaveLength(14)
    expect(anteriores).toHaveLength(24)
    const media = (v) => v.reduce((a, b) => a + b, 0) / v.length
    expect(media(recentes)).toBe(2240)
    expect(media(anteriores)).toBe(2290)
    expect(Math.abs((2240 - 2290) / 2290)).toBeLessThan(0.05)
  })

  it('o conteudo que saiu funcionou melhor: salvamento por publicacao sobe', () => {
    const salvamentos = (janela) =>
      SNAPSHOTS_MIDIA.filter(
        (s) =>
          s.ig_conta_id === CASA_OLIVEIRA &&
          s.metrica === 'salvamentos' &&
          s.publicada_em.slice(0, 10) >= janela.inicio &&
          s.publicada_em.slice(0, 10) <= janela.fim,
      ).map((s) => s.valor)
    const media = (v) => v.reduce((a, b) => a + b, 0) / v.length
    expect(media(salvamentos(ULTIMAS_8))).toBeGreaterThan(media(salvamentos(ANTERIORES_8)))
  })
})

describe('Verdejar Plantas expoe uma lacuna de coleta de verdade (ADR-004)', () => {
  const LACUNA = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']

  it('nao ha snapshot nos dias em que a coleta falhou — ausencia, nunca zero', () => {
    const dias = new Set(
      SNAPSHOTS_CONTA.filter((s) => s.ig_conta_id === VERDEJAR).map((s) => s.data),
    )
    for (const dia of LACUNA) expect(dias.has(dia)).toBe(false)
  })

  it('a falha esta registrada em eventos de coleta, com causa', () => {
    const falhas = EVENTOS_DE_COLETA.filter(
      (e) => e.ig_conta_id === VERDEJAR && e.status !== 'ok',
    )
    expect(falhas).toHaveLength(LACUNA.length)
    expect(falhas.every((f) => f.status === 'token_expirado')).toBe(true)
  })

  it('a coleta volta ao normal depois da lacuna', () => {
    const dias = new Set(
      SNAPSHOTS_CONTA.filter((s) => s.ig_conta_id === VERDEJAR).map((s) => s.data),
    )
    expect(dias.has('2026-08-15')).toBe(true)
    expect(dias.has('2026-08-09')).toBe(true)
  })
})

describe('Studio Nove nao tem historico para diagnostico', () => {
  it('nao existe dado antes da conexao', () => {
    const datas = SNAPSHOTS_CONTA.filter((s) => s.ig_conta_id === STUDIO_NOVE).map((s) => s.data)
    expect(Math.min(...datas.map((d) => d.localeCompare('2026-08-17')))).toBeGreaterThanOrEqual(0)
  })

  it('ha menos de 8 semanas completas — o motor tem que dizer que nao sabe', () => {
    const datas = SNAPSHOTS_CONTA.filter((s) => s.ig_conta_id === STUDIO_NOVE).map((s) => s.data)
    const primeira = datas.sort()[0]
    const semanas = Math.floor(diferencaEmDias(primeira, AGORA.slice(0, 10)) / 7)
    expect(semanas).toBeLessThan(8)
  })
})
