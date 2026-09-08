/**
 * Dois riscos moram neste grafico, e os dois estao testados aqui:
 *
 * 1. Virar imagem muda. SVG sem equivalente textual e um bloco de tela que
 *    simplesmente nao existe para quem usa leitor.
 * 2. Interpolar em cima de lacuna. Ligar dois pontos por cima de uma semana sem
 *    coleta desenha uma tendencia que ninguem mediu (ADR-004).
 * 3. Desenhar lacuna igual a zero. "A conta nao publicou" e "nao sabemos o que
 *    houve" sao afirmacoes opostas, e as duas saiam como coluna de altura
 *    nenhuma — a lacuna sumia da tela sem nenhum teste reclamar.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import GraficoCadencia, { rotuloDoValor, segmentosDaLinha } from './GraficoCadencia.jsx'

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

describe('rotuloDoValor', () => {
  it('formata em pt-BR', () => {
    expect(rotuloDoValor(3)).toBe('3')
    expect(rotuloDoValor(1.75)).toBe('1,8')
    expect(rotuloDoValor(41200)).toBe('41.200')
  })

  it('distingue zero de ausência: zero é um valor, ausência não é', () => {
    expect(rotuloDoValor(0)).toBe('0')
    expect(rotuloDoValor(null)).toBeNull()
    expect(rotuloDoValor(undefined)).toBeNull()
    expect(rotuloDoValor(Number.NaN)).toBeNull()
  })
})

describe('o desenho diz que semana é qual, e quanto cada coluna vale', () => {
  it('escreve a semana embaixo de cada coluna', () => {
    const { container } = renderizar()
    const semanas = [...container.querySelectorAll('.ki-grafico__semanas text')]

    expect(semanas.map((no) => no.textContent)).toEqual(PONTOS.map((ponto) => ponto.rotulo))
  })

  it('escreve o valor em cima de cada coluna', () => {
    const { container } = renderizar()
    const valores = [...container.querySelectorAll('.ki-grafico__valores text')]

    expect(valores.map((no) => no.textContent)).toEqual(['3', '3', '2', '1'])
  })

  // O desenho e a tabela dizem a mesma coisa duas vezes; so a tabela e lida.
  it('não faz o leitor de tela ouvir os rótulos duas vezes', () => {
    const { container } = renderizar()

    expect(container.querySelector('.ki-grafico__valores')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.ki-grafico__semanas')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('semana sem coleta não é desenhada como semana de valor zero', () => {
  const COM_LACUNA = [
    { rotulo: '06/07', barra: 3, linha: 41200 },
    { rotulo: '13/07', barra: null, linha: null },
    { rotulo: '20/07', barra: 0, linha: 12000 },
  ]

  it('marca a semana sem coleta no eixo, e só ela', () => {
    const { container } = renderizar(COM_LACUNA)

    // Uma marca: a do meio. A de valor zero NAO ganha marca, porque zero foi
    // medido — foi a semana em que a conta nao publicou, e isso e um dado.
    expect(container.querySelectorAll('.ki-grafico__lacunas line')).toHaveLength(1)
  })

  it('escreve 0 na semana de valor zero, e nada na semana sem coleta', () => {
    const { container } = renderizar(COM_LACUNA)
    const valores = [...container.querySelectorAll('.ki-grafico__valores text')]

    expect(valores.map((no) => no.textContent)).toEqual(['3', '0'])
  })

  it('e recua o rótulo da semana que não tem leitura', () => {
    const { container } = renderizar(COM_LACUNA)
    const recuados = container.querySelectorAll('.ki-grafico__semanas text[data-lacuna="sim"]')

    expect(recuados).toHaveLength(1)
    expect(recuados[0].textContent).toBe('13/07')
  })

  it('continua sem desenhar coluna para nenhuma das duas', () => {
    const { container } = renderizar(COM_LACUNA)

    // Coluna de altura zero e coluna ausente sao o mesmo pixel; quem separa as
    // duas leituras e a marca no eixo e o rotulo, testados acima.
    expect(container.querySelectorAll('.ki-grafico__barras rect')).toHaveLength(1)
  })
})
