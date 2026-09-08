/**
 * O indicador carrega os numeros que a identidade trava como regressao
 * (ADR-007: 1,8 contra 3,0). Ele nao formata e nao calcula — recebe o valor ja
 * exibivel e o tom ja decidido pela regra (ADR-008). Os testes cobram
 * exatamente essa passividade.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Indicador from './Indicador.jsx'

describe('Indicador', () => {
  it('mostra rótulo, valor e nota como vieram', () => {
    render(<Indicador rotulo="Publicações por semana" valor="1,8" nota="40% abaixo, era 3,0" tom="ruim" />)

    expect(screen.getByText('Publicações por semana')).toBeInTheDocument()
    expect(screen.getByText('1,8')).toBeInTheDocument()
    expect(screen.getByText('40% abaixo, era 3,0')).toBeInTheDocument()
  })

  it('liga rótulo e valor numa lista de descrição: o número nunca fica órfão', () => {
    const { container } = render(<Indicador rotulo="Contas alcançadas" valor="26.900" />)

    expect(container.querySelector('dl.ki-indicador > dt')).toHaveTextContent('Contas alcançadas')
    expect(container.querySelector('dl.ki-indicador > dd')).toHaveTextContent('26.900')
  })

  it('entrega o tom como atributo de dado, nunca como classe de cor', () => {
    const { container } = render(<Indicador rotulo="Alcance por publicação" valor="2.240" nota="Estável, era 2.290" tom="neutro" />)
    const raiz = container.querySelector('.ki-indicador')

    expect(raiz).toHaveAttribute('data-tom', 'neutro')
    expect(raiz.className).toBe('ki-indicador')
  })

  it('assume tom neutro quando a regra não opinou', () => {
    const { container } = render(<Indicador rotulo="Seguidores" valor="4.120" />)

    expect(container.querySelector('.ki-indicador')).toHaveAttribute('data-tom', 'neutro')
  })

  it('omite a nota em vez de mostrar um espaço vazio', () => {
    const { container } = render(<Indicador rotulo="Seguidores" valor="4.120" />)

    expect(container.querySelector('.ki-indicador__nota')).toBeNull()
  })
})
