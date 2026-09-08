/**
 * Toda tela do produto renderiza carregando, vazio, erro e sucesso (CLAUDE.md).
 * O que estes testes garantem e que os tres primeiros chegam a quem nao ve a
 * tela: carregando e erro se anunciam sozinhos, e o vazio continua sendo
 * conteudo — com os passos dentro dele, e nao um encolher de ombros.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Estado from './Estado.jsx'

describe('Estado', () => {
  it('anuncia o carregamento sem roubar o foco', () => {
    render(<Estado tipo="carregando" titulo="Buscando o diagnóstico mais recente" />)
    const estado = screen.getByRole('status')

    expect(estado).toHaveAttribute('aria-live', 'polite')
    expect(estado).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('heading', { name: 'Buscando o diagnóstico mais recente' })).toBeInTheDocument()
  })

  it('interrompe a leitura quando algo quebrou', () => {
    render(
      <Estado tipo="erro" titulo="Não foi possível carregar" descricao="Falha de rede ao falar com o backend." />,
    )
    const estado = screen.getByRole('alert')

    expect(estado).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText('Falha de rede ao falar com o backend.')).toBeInTheDocument()
  })

  it('não anuncia o vazio: ele é conteúdo, não evento', () => {
    const { container } = render(<Estado tipo="vazio" titulo="Nenhuma conta conectada" />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('.ki-estado')).toHaveAttribute('data-tipo', 'vazio')
  })

  it('recebe children: é ali que a tela sem conta monta os três passos', () => {
    render(
      <Estado
        tipo="vazio"
        titulo="Nenhuma conta conectada, então não existe diagnóstico para mostrar."
        descricao="A tela fica vazia de propósito."
      >
        <button type="button">Conectar uma conta do Instagram</button>
      </Estado>,
    )

    expect(screen.getByRole('button', { name: 'Conectar uma conta do Instagram' })).toBeInTheDocument()
  })

  it('entrega o tipo como atributo de dado, nunca como classe de estado', () => {
    const { container } = render(<Estado tipo="erro" titulo="Não foi possível carregar" />)
    const raiz = container.querySelector('.ki-estado')

    expect(raiz).toHaveAttribute('data-tipo', 'erro')
    expect(raiz.className).toBe('ki-estado')
  })
})
