/**
 * O botao e a superficie onde erro de usuario nasce. Por isso `carregando`
 * desabilita de verdade em vez de so trocar o rotulo: prevencao de erro vale
 * mais que mensagem de erro (CLAUDE.md).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Botao from './Botao.jsx'

describe('Botao', () => {
  it('tem papel e nome acessível vindos do próprio rótulo', () => {
    render(<Botao>Exportar relatório</Botao>)

    expect(screen.getByRole('button', { name: 'Exportar relatório' })).toBeInTheDocument()
  })

  it('nasce como button, e não como submit por acidente', () => {
    render(<Botao>Histórico</Botao>)

    expect(screen.getByRole('button', { name: 'Histórico' })).toHaveAttribute('type', 'button')
  })

  it('chama a ação no clique', async () => {
    const aoClicar = vi.fn()
    render(<Botao aoClicar={aoClicar}>Marcar teste de 4 semanas</Botao>)

    await userEvent.click(screen.getByRole('button'))

    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('carregando: bloqueia o clique e diz que está ocupado', async () => {
    const aoClicar = vi.fn()
    render(
      <Botao aoClicar={aoClicar} carregando>
        Conectar uma conta do Instagram
      </Botao>,
    )
    const botao = screen.getByRole('button', { name: /Conectar uma conta do Instagram/ })

    await userEvent.click(botao)

    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(botao).toHaveAccessibleName(/Carregando/)
    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('desabilitado não dispara ação', async () => {
    const aoClicar = vi.fn()
    render(
      <Botao aoClicar={aoClicar} desabilitado>
        Exportar relatório
      </Botao>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('entrega a variante como atributo de dado, nunca como classe de cor', () => {
    render(<Botao variante="primario">Exportar relatório</Botao>)
    const botao = screen.getByRole('button')

    expect(botao).toHaveAttribute('data-variante', 'primario')
    expect(botao.className).toBe('ki-botao')
  })

  it('assume a variante secundária quando ninguém escolheu', () => {
    render(<Botao>Histórico</Botao>)

    expect(screen.getByRole('button')).toHaveAttribute('data-variante', 'secundario')
  })
})
