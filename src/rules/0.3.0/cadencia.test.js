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
import cadencia from './cadencia.js'

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
 * Historico sintetico de semanas completas. Existe para exercitar a logica da
 * regra em cenarios que a fixture nao cobre, sem tocar a fixture.
 *
 * @param {number[][]} blocos alcance de cada midia, semana a semana
 * @returns {object} Historico
 */
function historicoSintetico(blocos) {
  const semanas = blocos.map((alcances, indice) => {
    const inicio = somarDias('2026-01-05', indice * 7)
    return {
      inicio,
      fim: diasDaSemana(inicio)[6],
      valores: {
        alcance: alcances.reduce((total, valor) => total + valor, 0),
        publicacoes: alcances.length,
      },
      midias: alcances.map((alcance, i) => ({
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
    semanas,
    lacunas: [],
    primeiroDado: semanas[0].inicio,
    recursos: { temTrafegoPago: false, temConcorrentes: false },
  }
}

/** @param {number[]} alcances @param {number} vezes @returns {number[][]} */
function repetir(alcances, vezes) {
  return Array.from({ length: vezes }, () => [...alcances])
}

describe('cadencia-em-queda sobre a Casa Oliveira — regressao da identidade', () => {
  const achado = cadencia.avaliar(historicoDaFixture(0))

  it('dispara com a severidade e o rotulo da identidade', () => {
    expect(achado).not.toBeNull()
    expect(achado.regra).toBe('cadencia-em-queda')
    expect(achado.versaoRegra).toBe('0.3.0')
    expect(achado.peso).toBe(90)
    expect(achado.severidade).toBe('atencao')
    expect(achado.rotulo).toBe('Frequência de publicação, causa nomeada')
  })

  it('produz a frase do produto, palavra por palavra', () => {
    expect(achado.frase).toBe(
      'Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto.',
    )
  })

  it('produz a acao com a mediana da janela anterior, nao um numero escrito no codigo', () => {
    expect(achado.acao).toBe(
      'Volte para 3 publicações por semana durante 4 semanas, sem trocar formato nem horário.',
    )
  })

  it('produz a confirmacao com a faixa de alcance da janela anterior', () => {
    expect(achado.confirmacao).toBe(
      'Se o alcance voltar para a faixa de 40 mil sem nenhuma outra mudança, a causa está ' +
        'confirmada. Se não voltar, o próximo suspeito é formato, e o teste seguinte muda ' +
        'uma variável só.',
    )
  })

  it('produz as tres evidencias, nesta ordem e com estes numeros', () => {
    expect(achado.evidencias).toEqual([
      {
        rotulo: 'Publicações por semana',
        metrica: 'publicacoes',
        valor: 1.8,
        anterior: 3,
        variacao: -0.4,
        casas: 1,
        tom: 'ruim',
        nota: '40% abaixo, era 3,0',
      },
      {
        rotulo: 'Contas alcançadas',
        metrica: 'alcance',
        valor: 26900,
        anterior: 41200,
        variacao: -0.3471,
        casas: 0,
        tom: 'ruim',
        nota: '35% abaixo, era 41.200',
      },
      {
        rotulo: 'Alcance por publicação',
        metrica: 'alcance',
        valor: 2240,
        anterior: 2290,
        variacao: -0.0218,
        casas: 0,
        tom: 'neutro',
        nota: 'Estável, era 2.290',
      },
    ])
  })

  it('monta a serie com oito pontos, um por semana das ultimas oito', () => {
    expect(achado.serie.rotuloBarra).toBe('Publicações')
    expect(achado.serie.rotuloLinha).toBe('Contas alcançadas')
    expect(achado.serie.pontos.length).toBe(8)
    expect(achado.serie.pontos.map((p) => p.barra)).toEqual([3, 2, 2, 2, 2, 1, 1, 1])
    expect(achado.serie.pontos.map((p) => p.linha)).toEqual([
      5200, 4400, 4100, 3900, 3500, 2200, 1900, 1700,
    ])
    expect(achado.serie.pontos.at(-1).rotulo).toBe('24/08')
  })

  it('declara o limite de agregacao de alcance e a cegueira a causa externa', () => {
    expect(achado.limites).toEqual(['agregacao-de-alcance', 'sem-causa-externa'])
  })
})

describe('cadencia-em-queda quando nao ha o que nomear', () => {
  it('nao dispara para o Verdejar: os cinco dias sem coleta derrubaram a 16a semana', () => {
    const verdejar = historicoDaFixture(1)
    expect(verdejar.semanas.filter((s) => s.completa).length).toBe(15)
    expect(cadencia.avaliar(verdejar)).toBeNull()
  })

  it('nao dispara para o Studio Nove, que nao tem as 16 semanas', () => {
    expect(cadencia.avaliar(historicoDaFixture(2))).toBeNull()
  })

  it('nao dispara com cadencia estavel, mesmo tendo as 16 semanas completas', () => {
    const estavel = historicoSintetico(repetir([2000, 1900, 1800, 1700], 16))
    expect(estavel.semanas.filter((s) => s.completa).length).toBe(16)
    expect(cadencia.avaliar(estavel)).toBeNull()
  })

  it('se cala quando falta a contagem de publicacoes na semana', () => {
    const semContagem = historicoSintetico(repetir([2000, 1900, 1800], 16))
    delete semContagem.semanas[0].valores.publicacoes
    expect(cadencia.avaliar(semContagem)).toBeNull()
  })
})

describe('cadencia-em-queda quando a queda vem acompanhada', () => {
  it('sobe a severidade e muda a frase quando o alcance por publicacao tambem cai', () => {
    const acompanhado = historicoSintetico([
      ...repetir([2000, 2000, 2000], 8),
      ...repetir([1000], 8),
    ])
    const achado = cadencia.avaliar(acompanhado)
    expect(achado.severidade).toBe('critico')
    expect(achado.rotulo).toBe('Frequência e alcance por publicação em queda')
    expect(achado.frase).toBe(
      'Sua frequência caiu 67% e o alcance por publicação caiu 50%. Não é só volume: ' +
        'o que você publica também está alcançando menos.',
    )
    expect(achado.evidencias[2].tom).toBe('ruim')
  })

  it('mantem a frase da identidade quando so a frequencia cai', () => {
    const soCadencia = historicoSintetico([
      ...repetir([2000, 2000, 2000], 8),
      ...repetir([2000], 8),
    ])
    const achado = cadencia.avaliar(soCadencia)
    expect(achado.severidade).toBe('atencao')
    expect(achado.frase).toBe(
      'Seu alcance não caiu. Sua frequência caiu 67% e o alcance seguiu junto.',
    )
    expect(achado.evidencias[2].tom).toBe('neutro')
  })
})
