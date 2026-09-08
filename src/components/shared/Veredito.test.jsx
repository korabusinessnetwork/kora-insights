/**
 * O veredito e o produto. O que estes testes protegem nao e o visual, e o
 * contrato de acessibilidade dele: a frase precisa ser alcancavel por titulo,
 * a severidade precisa vir escrita (e nao so colorida) e a cor precisa entrar
 * por atributo de dado — se um dia alguem trocar isso por uma classe de cor,
 * o white-label e o tema de papel quebram junto.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Veredito, { PALAVRA_DE_SEVERIDADE } from './Veredito.jsx'

const FRASE = 'Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto.'
const ROTULO = 'Frequência de publicação, causa nomeada'

function renderizar(extra = {}) {
  return render(
    <Veredito severidade="atencao" rotulo={ROTULO} frase={FRASE} {...extra} />,
  )
}

describe('Veredito', () => {
  it('publica a frase como título: quem navega por cabeçalho cai no diagnóstico', () => {
    renderizar()

    expect(screen.getByRole('heading', { name: FRASE })).toBeInTheDocument()
  })

  it('escreve a severidade por extenso — cor não é o único portador de sentido', () => {
    renderizar()

    expect(screen.getByText(PALAVRA_DE_SEVERIDADE.atencao)).toBeInTheDocument()
    expect(screen.getByText(ROTULO)).toBeInTheDocument()
  })

  it('entrega a severidade como atributo de dado, nunca como classe de cor', () => {
    const { container } = renderizar()
    const raiz = container.querySelector('.ki-veredito')

    expect(raiz).toHaveAttribute('data-severidade', 'atencao')
    expect(raiz.className).toBe('ki-veredito')
  })

  it('declara a superfície de papel: é uma folha clara dentro do app escuro', () => {
    const { container } = renderizar()

    expect(container.querySelector('.ki-veredito')).toHaveAttribute('data-superficie', 'papel')
  })

  it('não inventa apoio quando a regra não mandou nenhum', () => {
    const { container } = renderizar()

    expect(container.querySelector('.ki-veredito__apoio')).toBeNull()
  })

  it('mostra o apoio quando ele existe', () => {
    renderizar({ apoio: 'O alcance por publicação não se moveu.' })

    expect(screen.getByText('O alcance por publicação não se moveu.')).toBeInTheDocument()
  })

  it('aceita trocar o elemento raiz sem mexer no conteúdo', () => {
    const { container } = renderizar({ como: 'article' })

    expect(container.querySelector('article.ki-veredito')).not.toBeNull()
  })

  it('não quebra com severidade fora do catálogo: mostra o código cru', () => {
    render(<Veredito severidade="desconhecida" rotulo={ROTULO} frase={FRASE} />)

    expect(screen.getByText('desconhecida')).toBeInTheDocument()
  })
})
