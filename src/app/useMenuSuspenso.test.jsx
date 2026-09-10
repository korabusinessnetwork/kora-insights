/**
 * O comportamento do menu do cabeçalho, que nunca teve teste enquanto viveu
 * duplicado dentro do seletor de conta.
 *
 * O que se prova aqui é o que quebra sem ninguém perceber: quem abre o menu com
 * o teclado precisa cair no primeiro item, e quem desiste com Escape precisa
 * voltar para o botão — se o foco vai para o começo da página, a pessoa
 * recomeça a navegação inteira a cada vez que abre o menu por engano.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import useMenuSuspenso, { PROPS_DO_ITEM } from './useMenuSuspenso.js'

const ITENS = ['Primeiro', 'Segundo', 'Terceiro']

/** O que o menu escolheu. Fora do componente porque props em componente de
 *  teste pedem `propTypes`, e este arquivo não é lugar de contrato de props. */
const aoEscolher = vi.fn()

function MenuDeTeste() {
  const { aberto, fechar, propsDaRaiz, propsDoGatilho, propsDoMenu } = useMenuSuspenso()
  return (
    <div {...propsDaRaiz}>
      <button {...propsDoGatilho}>Abrir</button>
      {aberto ? (
        <div aria-label="Opções" {...propsDoMenu}>
          {ITENS.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              onClick={() => {
                fechar(true)
                aoEscolher(item)
              }}
              {...PROPS_DO_ITEM}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function montar() {
  aoEscolher.mockClear()
  return {
    usuario: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <button type="button">fora do menu</button>
        <MenuDeTeste />
      </MemoryRouter>,
    ),
  }
}

/** @returns {HTMLElement} */
function gatilho() {
  return screen.getByRole('button', { name: 'Abrir' })
}

/** @param {string} nome @returns {HTMLElement} */
function item(nome) {
  return screen.getByRole('menuitem', { name: nome })
}

describe('useMenuSuspenso', () => {
  it('o gatilho anuncia que abre um menu, e se está aberto', async () => {
    const { usuario } = montar()

    expect(gatilho()).toHaveAttribute('aria-haspopup', 'menu')
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await usuario.click(gatilho())

    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    expect(gatilho()).toHaveAttribute('aria-controls', screen.getByRole('menu').id)
  })

  it('abre com o primeiro item já focado, sem exigir mais um Tab', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())

    expect(item('Primeiro')).toHaveFocus()
  })

  it('seta para cima no gatilho abre pelo último item', async () => {
    const { usuario } = montar()

    gatilho().focus()
    await usuario.keyboard('{ArrowUp}')

    expect(item('Terceiro')).toHaveFocus()
  })

  it('as setas andam pelos itens e dão a volta na ponta', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())
    await usuario.keyboard('{ArrowDown}')
    expect(item('Segundo')).toHaveFocus()

    await usuario.keyboard('{End}')
    expect(item('Terceiro')).toHaveFocus()

    await usuario.keyboard('{ArrowDown}')
    expect(item('Primeiro')).toHaveFocus()

    await usuario.keyboard('{ArrowUp}')
    expect(item('Terceiro')).toHaveFocus()

    await usuario.keyboard('{Home}')
    expect(item('Primeiro')).toHaveFocus()
  })

  it('Escape fecha e devolve o foco ao gatilho', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())
    await usuario.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(gatilho()).toHaveFocus()
  })

  it('escolher um item fecha o menu e devolve o foco', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())
    await usuario.click(item('Segundo'))

    expect(aoEscolher).toHaveBeenCalledWith('Segundo')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(gatilho()).toHaveFocus()
  })

  it('apontar para fora fecha o menu', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())
    await usuario.click(screen.getByRole('button', { name: 'fora do menu' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Tab fecha sem prender o foco dentro do menu', async () => {
    const { usuario } = montar()

    await usuario.click(gatilho())
    await usuario.keyboard('{Tab}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(gatilho()).not.toHaveFocus()
  })
})
