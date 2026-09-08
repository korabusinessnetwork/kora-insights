import { describe, expect, it } from 'vitest'

import { diasDaSemana, somarDias } from '../../calendario/calendario.js'
import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../../fixtures/estudioVergara.js'
import { montarHistorico } from '../../motor/index.js'
import formatoQueSalva from './formatoQueSalva.js'

/**
 * Historico sintetico de oito semanas completas, cada uma com as mesmas midias.
 *
 * @param {{ tipo: string, alcance: number, salvamentos: number }[]} midiasDaSemana
 * @param {number} [semanas=8]
 * @returns {object} Historico
 */
function historicoSintetico(midiasDaSemana, semanas = 8) {
  const janelas = Array.from({ length: semanas }, (_, indice) => {
    const inicio = somarDias('2026-01-05', indice * 7)
    return {
      inicio,
      fim: diasDaSemana(inicio)[6],
      valores: {
        alcance: midiasDaSemana.reduce((total, midia) => total + midia.alcance, 0),
        publicacoes: midiasDaSemana.length,
      },
      midias: midiasDaSemana.map((midia, i) => ({
        id: `${inicio}-${i}`,
        tipo: midia.tipo,
        publicadaEm: `${inicio}T12:00:00.000Z`,
        metricas: { alcance: midia.alcance, salvamentos: midia.salvamentos },
      })),
      diasComColeta: 7,
      completa: true,
    }
  })
  return {
    contaId: 'conta-sintetica',
    semanas: janelas,
    lacunas: [],
    primeiroDado: janelas[0].inicio,
    recursos: { temTrafegoPago: false, temConcorrentes: false },
  }
}

const CARROSSEL_FORTE = [
  { tipo: 'carrossel', alcance: 2000, salvamentos: 100 },
  { tipo: 'reel', alcance: 2000, salvamentos: 60 },
  { tipo: 'imagem', alcance: 2000, salvamentos: 50 },
]

describe('formato-que-salva quando um formato se destaca', () => {
  const achado = formatoQueSalva.avaliar(historicoSintetico(CARROSSEL_FORTE))

  it('nomeia o formato com severidade ok e peso 60', () => {
    expect(achado.regra).toBe('formato-que-salva')
    expect(achado.severidade).toBe('ok')
    expect(achado.peso).toBe(60)
    expect(achado.rotulo).toBe('Formato que retém atenção')
  })

  it('monta a frase com o percentual calculado, nao escrito no codigo', () => {
    expect(achado.frase).toBe(
      'Carrossel salva 82% mais por publicação que os outros formatos desta conta.',
    )
    expect(achado.acao).toContain('Mantenha carrossel como formato principal')
  })

  it('mostra as duas medias como evidencia, com o tom decidido pela regra', () => {
    expect(achado.evidencias.map((e) => e.valor)).toEqual([100, 55])
    expect(achado.evidencias.map((e) => e.tom)).toEqual(['bom', 'neutro'])
    expect(achado.evidencias[0].metrica).toBe('salvamentos')
    expect(achado.evidencias[1].nota).toBe('16 publicações no período')
  })

  it('nao desenha serie temporal para uma comparacao entre formatos', () => {
    expect(achado.serie).toBeNull()
  })

  it('declara que salvamento nao prova receita', () => {
    expect(achado.limites).toEqual(['salvamento-nao-e-receita'])
  })
})

describe('formato-que-salva quando nao ha destaque', () => {
  it('se cala em empate tecnico entre formatos', () => {
    const empate = historicoSintetico([
      { tipo: 'carrossel', alcance: 2000, salvamentos: 60 },
      { tipo: 'reel', alcance: 2000, salvamentos: 58 },
      { tipo: 'imagem', alcance: 2000, salvamentos: 55 },
    ])
    expect(formatoQueSalva.avaliar(empate)).toBeNull()
  })

  it('se cala quando a media so sobe por causa de uma publicacao excepcional', () => {
    const janelas = historicoSintetico(CARROSSEL_FORTE)
    // Um carrossel muito fraco: a media continua alta, mas o formato deixa de
    // ser repetivel — e repetir e a acao que a regra recomendaria.
    janelas.semanas[0].midias[0].metricas.salvamentos = 5
    expect(formatoQueSalva.avaliar(janelas)).toBeNull()
  })

  it('se cala quando o tipo tem menos de tres publicacoes para ter voz', () => {
    const poucoCarrossel = historicoSintetico([
      { tipo: 'reel', alcance: 2000, salvamentos: 50 },
      { tipo: 'imagem', alcance: 2000, salvamentos: 48 },
    ])
    poucoCarrossel.semanas[0].midias.push({
      id: 'extra',
      tipo: 'carrossel',
      publicadaEm: `${poucoCarrossel.semanas[0].inicio}T12:00:00.000Z`,
      metricas: { alcance: 2000, salvamentos: 900 },
    })
    expect(formatoQueSalva.avaliar(poucoCarrossel)).toBeNull()
  })

  it('se cala sem as oito semanas completas', () => {
    expect(formatoQueSalva.avaliar(historicoSintetico(CARROSSEL_FORTE, 7))).toBeNull()
  })

  it('se cala para a Casa Oliveira, onde os tres formatos salvam quase igual', () => {
    const casaOliveira = montarHistorico({
      conta: CONTAS[0],
      snapshotsConta: SNAPSHOTS_CONTA,
      snapshotsMidia: SNAPSHOTS_MIDIA,
      eventosDeColeta: EVENTOS_DE_COLETA,
      ate: AGORA,
    })
    expect(formatoQueSalva.avaliar(casaOliveira)).toBeNull()
  })
})
