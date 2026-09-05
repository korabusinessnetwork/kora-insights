import { describe, expect, it } from 'vitest'

import { diasDaSemana, somarDias } from '../../fixtures/calendario.js'
import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../../fixtures/estudioVergara.js'
import { montarHistorico } from '../../motor/index.js'
import consistencia from './consistencia.js'

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

/**
 * @param {number[]} alcanceDasMidias mesmo conjunto em todas as semanas
 * @param {number} [semanas=8]
 * @returns {object} Historico
 */
function historicoSintetico(alcanceDasMidias, semanas = 8) {
  const janelas = Array.from({ length: semanas }, (_, indice) => {
    const inicio = somarDias('2026-01-05', indice * 7)
    return {
      inicio,
      fim: diasDaSemana(inicio)[6],
      valores: {
        alcance: alcanceDasMidias.reduce((total, valor) => total + valor, 0),
        publicacoes: alcanceDasMidias.length,
      },
      midias: alcanceDasMidias.map((alcance, i) => ({
        id: `${inicio}-${i}`,
        tipo: 'carrossel',
        publicadaEm: `${inicio}T12:00:00.000Z`,
        metricas: { alcance, salvamentos: Math.round(alcance / 40) },
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

describe('consistencia-de-alcance com dispersao baixa', () => {
  const achado = consistencia.avaliar(historicoDaFixture(0))

  it('le a Casa Oliveira como consistente, e nao como problema', () => {
    expect(achado.regra).toBe('consistencia-de-alcance')
    expect(achado.severidade).toBe('ok')
    expect(achado.peso).toBe(40)
    expect(achado.rotulo).toBe('Alcance consistente entre publicações')
    expect(achado.frase).toBe(
      'Suas publicações alcançam a mesma faixa: 7% de variação entre elas. O resultado vem ' +
        'do método, não de sorte de post.',
    )
  })

  it('mostra o alcance por publicacao com a dispersao na nota', () => {
    expect(achado.evidencias).toEqual([
      {
        rotulo: 'Alcance por publicação',
        metrica: 'alcance',
        valor: 2240,
        anterior: null,
        variacao: null,
        casas: 0,
        tom: 'bom',
        nota: '14 publicações, variação de 7% entre elas',
      },
    ])
  })

  it('desenha a serie das oito semanas com o alcance medio por publicacao', () => {
    expect(achado.serie.rotuloLinha).toBe('Alcance por publicação')
    expect(achado.serie.pontos.length).toBe(8)
    expect(achado.serie.pontos.at(-1)).toEqual({ rotulo: '24/08', barra: 1, linha: 2050 })
  })

  it('declara que dispersao nao explica causa', () => {
    expect(achado.limites).toEqual(['dispersao-nao-explica-causa'])
  })
})

describe('consistencia-de-alcance com dispersao alta', () => {
  const achado = consistencia.avaliar(historicoSintetico([100, 100, 5000]))

  it('vira atencao: o resultado depende de acertar o post', () => {
    expect(achado.severidade).toBe('atencao')
    expect(achado.rotulo).toBe('Alcance dependente de sorte de post')
    expect(achado.frase).toContain('depende de acertar o post')
    expect(achado.evidencias[0].tom).toBe('ruim')
  })

  it('recomenda repetir uma variavel dos posts que foram bem', () => {
    expect(achado.acao).toContain('repita um único desses elementos')
    expect(achado.confirmacao).toContain('35%')
  })
})

describe('consistencia-de-alcance quando nao ha o que medir', () => {
  it('se cala sem as oito semanas completas', () => {
    expect(consistencia.avaliar(historicoDaFixture(2))).toBeNull()
  })

  it('se cala com poucas publicacoes para descrever o perfil', () => {
    const poucoConteudo = historicoSintetico([2000])
    // Cinco publicacoes em oito semanas descrevem o punhado de posts, nao o perfil.
    for (const semana of poucoConteudo.semanas.slice(0, 3)) semana.midias = []
    expect(consistencia.avaliar(poucoConteudo)).toBeNull()
  })
})
