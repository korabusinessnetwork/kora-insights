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
  it('nao dispara para o Verdejar, que tem historico de sobra e cadencia firme', () => {
    // A conta tem as semanas necessarias: o silencio da regra aqui e o silencio
    // certo, e nao falta de dado. Publicar 4 vezes por semana o tempo todo nao
    // e uma causa a nomear.
    const verdejar = historicoDaFixture(1)
    expect(verdejar.semanas.filter((s) => s.completa).length).toBeGreaterThanOrEqual(16)
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

/**
 * Historico com controle separado de alcance de CONTA e alcance por MIDIA.
 *
 * `historicoSintetico` deriva o alcance da conta da soma das midias, o que
 * torna impossivel montar os casos em que os dois divergem — e e justamente na
 * divergencia entre eles que a regra decide o que dizer.
 *
 * @param {{pubs: number, alcance?: number, porPost: number}[]} planos
 * @returns {object} Historico
 */
function historicoDivergente(planos) {
  return {
    contaId: 'conta-sintetica',
    primeiroDado: '2026-01-05',
    lacunas: [],
    recursos: { temTrafegoPago: false, temConcorrentes: false },
    semanas: planos.map((plano, indice) => {
      const inicio = somarDias('2026-01-05', indice * 7)
      const valores = { publicacoes: plano.pubs }
      // Ausencia proposital: a semana esta completa em dias e mesmo assim sem a
      // metrica, que e como a chamada de insights da Meta falha de verdade.
      if (plano.alcance !== undefined) valores.alcance = plano.alcance
      return {
        inicio,
        fim: diasDaSemana(inicio)[6],
        valores,
        diasComColeta: 7,
        completa: true,
        midias: Array.from({ length: plano.pubs }, (_, i) => ({
          id: `${inicio}-${i}`,
          tipo: 'carrossel',
          publicadaEm: `${somarDias(inicio, i)}T12:00:00.000Z`,
          metricas: { alcance: plano.porPost },
        })),
      }
    }),
  }
}

const OITO_ANTERIORES = Array(8).fill({ pubs: 3, alcance: 6000, porPost: 2000 })

describe('cadencia so nomeia causa quando o alcance total caiu de verdade', () => {
  it('publicar menos e alcancar o mesmo nao e problema, e a regra nao manda desfazer', () => {
    // O caso que reprovava a regra: cadencia -33%, alcance por publicacao +50%,
    // alcance total identico. A versao anterior mandava "volte para 3 por semana"
    // e chamava de causa nomeada uma melhora de eficiencia.
    const achado = cadencia.avaliar(
      historicoDivergente([...OITO_ANTERIORES, ...Array(8).fill({ pubs: 2, alcance: 6000, porPost: 3000 })]),
    )
    expect(achado.severidade).toBe('ok')
    expect(achado.frase).toContain('o alcance total não caiu')
    expect(achado.acao).not.toContain('Volte para')
    expect(achado.peso).toBeLessThan(90)
  })

  it('o tom de cada evidencia sai da propria variacao que a linha mostra', () => {
    const achado = cadencia.avaliar(
      historicoDivergente([...OITO_ANTERIORES, ...Array(8).fill({ pubs: 2, alcance: 6000, porPost: 3000 })]),
    )
    const [publicacoes, alcance, porPublicacao] = achado.evidencias
    expect(publicacoes.tom).toBe('neutro')
    expect(alcance.tom).toBe('neutro')
    // Uma alta de 50% pintada de vermelho contradiria o numero ao lado dela.
    expect(porPublicacao.tom).toBe('bom')
  })

  it('cadencia e alcance por publicacao caindo juntos sobem a severidade', () => {
    const achado = cadencia.avaliar(
      historicoDivergente([...OITO_ANTERIORES, ...Array(8).fill({ pubs: 2, alcance: 3000, porPost: 1500 })]),
    )
    expect(achado.severidade).toBe('critico')
    expect(achado.frase).toContain('Não é só volume')
  })
})

describe('cadencia se cala em vez de imprimir numero que nao tem', () => {
  it('sem alcance no escopo conta a regra devolve null, nunca "caiu null%"', () => {
    const achado = cadencia.avaliar(
      historicoDivergente([
        ...Array(8).fill({ pubs: 3, porPost: 2000 }),
        ...Array(8).fill({ pubs: 1, porPost: 2000 }),
      ]),
    )
    expect(achado).toBeNull()
  })

  it('semana completa sem a metrica invalida a soma da janela, e nao vira queda', () => {
    // Alcance real identico nas duas janelas; duas semanas recentes voltaram sem
    // a metrica. Somar as seis que sobraram imprimiria "25% abaixo".
    const achado = cadencia.avaliar(
      historicoDivergente([
        ...Array(8).fill({ pubs: 3, alcance: 5000, porPost: 2000 }),
        ...Array(6).fill({ pubs: 2, alcance: 5000, porPost: 2000 }),
        ...Array(2).fill({ pubs: 2, porPost: 2000 }),
      ]),
    )
    expect(achado).toBeNull()
  })
})

describe('a faixa de confirmacao acompanha a ordem de grandeza da conta', () => {
  it('conta pequena nao recebe meta de zero', () => {
    const achado = cadencia.avaliar(
      historicoDivergente([
        ...Array(8).fill({ pubs: 3, alcance: 500, porPost: 160 }),
        ...Array(8).fill({ pubs: 1, alcance: 170, porPost: 160 }),
      ]),
    )
    expect(achado.confirmacao).not.toContain('faixa de 0')
    expect(achado.confirmacao).toContain('faixa de 4 mil')
  })
})

describe('a regra declara a janela que ela comparou', () => {
  it('devolve o intervalo de cada bloco, e nao o periodo do historico inteiro', () => {
    const achado = cadencia.avaliar(historicoDaFixture(0))
    expect(achado.janela.semanas).toBe(8)
    expect(achado.janela.recentes).toEqual({
      inicio: '2026-07-06',
      fim: '2026-08-30',
      semanas: 8,
      contiguo: true,
    })
    expect(achado.janela.anteriores.inicio).toBe('2026-05-11')
    expect(achado.janela.anteriores.fim).toBe('2026-07-05')
  })
})
