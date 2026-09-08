/**
 * Dois riscos moram neste grafico, e os dois estao testados aqui:
 *
 * 1. Virar imagem muda. SVG sem equivalente textual e um bloco de tela que
 *    simplesmente nao existe para quem usa leitor.
 * 2. Interpolar em cima de lacuna. Ligar dois pontos por cima de uma semana sem
 *    coleta desenha uma tendencia que ninguem mediu (ADR-004).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import GraficoCadencia, { segmentosDaLinha } from './GraficoCadencia.jsx'

const DESCRICAO =
  'As duas curvas descem juntas na semana em que a frequência cai, e o alcance por publicação não se move.'

const PONTOS = [
  { rotulo: 'Semana de 6 a 12 de julho', barra: 3, linha: 41200 },
  { rotulo: 'Semana de 13 a 19 de julho', barra: 3, linha: 40100 },
  { rotulo: 'Semana de 20 a 26 de julho', barra: 2, linha: 33500 },
  { rotulo: 'Semana de 27 de julho a 2 de agosto', barra: 1, linha: 26900 },
]

function renderizar(pontos = PONTOS) {
  return render(
    <GraficoCadencia
      pontos={pontos}
      rotuloBarra="Publicações na semana"
      rotuloLinha="Contas alcançadas"
      descricao={DESCRICAO}
    />,
  )
}

describe('segmentosDaLinha', () => {
  it('devolve um único trecho quando não há lacuna', () => {
    const segmentos = segmentosDaLinha([{ linha: 1 }, { linha: 2 }, { linha: 3 }])

    expect(segmentos).toHaveLength(1)
    expect(segmentos[0].map((ponto) => ponto.valor)).toEqual([1, 2, 3])
  })

  it('quebra o traço no ponto nulo, guardando o índice original de cada leitura', () => {
    const segmentos = segmentosDaLinha([{ linha: 1 }, { linha: null }, { linha: 3 }])

    expect(segmentos).toHaveLength(2)
    expect(segmentos[1][0]).toEqual({ indice: 2, valor: 3 })
  })

  it('ignora lacuna na ponta em vez de abrir trecho vazio', () => {
    expect(segmentosDaLinha([{ linha: null }, { linha: 5 }, { linha: null }])).toEqual([
      [{ indice: 1, valor: 5 }],
    ])
  })

  it('não trata ausência como zero', () => {
    expect(segmentosDaLinha([{ linha: undefined }, { linha: 0 }])).toEqual([
      [{ indice: 1, valor: 0 }],
    ])
  })
})

describe('GraficoCadencia', () => {
  it('se apresenta como imagem com a história escrita no nome acessível', () => {
    renderizar()

    expect(screen.getByRole('img', { name: DESCRICAO })).toBeInTheDocument()
  })

  it('publica a tabela equivalente, uma linha por semana', () => {
    renderizar()
    const tabela = screen.getByRole('table', {
      name: 'Semana a semana: Publicações na semana e Contas alcançadas',
    })

    expect(tabela).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(PONTOS.length + 1)
    expect(screen.getByRole('rowheader', { name: 'Semana de 6 a 12 de julho' })).toBeInTheDocument()
  })

  it('escreve "sem coleta" na tabela: lacuna não vira zero', () => {
    renderizar([...PONTOS, { rotulo: 'Semana de 3 a 9 de agosto', barra: null, linha: null }])

    expect(screen.getAllByText('sem coleta')).toHaveLength(2)
  })

  it('interrompe a linha no ponto nulo em vez de interpolar por cima da lacuna', () => {
    const { container } = renderizar([
      { rotulo: 'Semana 1', barra: 3, linha: 41200 },
      { rotulo: 'Semana 2', barra: 3, linha: 40100 },
      { rotulo: 'Semana 3', barra: null, linha: null },
      { rotulo: 'Semana 4', barra: 2, linha: 33500 },
      { rotulo: 'Semana 5', barra: 1, linha: 26900 },
    ])

    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('não desenha barra para a semana sem coleta', () => {
    const { container } = renderizar([
      { rotulo: 'Semana 1', barra: 3, linha: 41200 },
      { rotulo: 'Semana 2', barra: null, linha: 40100 },
    ])

    expect(container.querySelectorAll('.ki-grafico__barras rect')).toHaveLength(1)
  })

  it('marca a leitura isolada com um ponto: sozinha ela não tem traço', () => {
    const { container } = renderizar([
      { rotulo: 'Semana 1', barra: 1, linha: null },
      { rotulo: 'Semana 2', barra: 1, linha: 30000 },
      { rotulo: 'Semana 3', barra: 1, linha: null },
    ])

    expect(container.querySelectorAll('polyline')).toHaveLength(0)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('mantém as barras ancoradas no eixo: volume com base cortada engana', () => {
    const { container } = renderizar()
    const barras = [...container.querySelectorAll('.ki-grafico__barras rect')]
    const base = barras.map((barra) => Number(barra.getAttribute('y')) + Number(barra.getAttribute('height')))

    expect(new Set(base.map((valor) => valor.toFixed(2))).size).toBe(1)
  })

  it('repete a descrição em texto visível, e não só no atributo', () => {
    renderizar()

    expect(screen.getByText(DESCRICAO, { selector: 'figcaption' })).toBeInTheDocument()
  })
})
