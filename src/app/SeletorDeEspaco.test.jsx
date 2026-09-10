/**
 * O seletor existe por causa de um defeito de silêncio: quem pertence a dois
 * espaços via um e não ficava sabendo do outro. O que os testes aqui protegem é
 * justamente isso — que o segundo espaço esteja na tela, alcançável, e que a
 * troca diga qual foi escolhido.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import SeletorDeEspaco from './SeletorDeEspaco.jsx'

/** @param {string} id @param {string} nome */
function espaco(id, nome) {
  return { id, nome, plano: 'unico', status: 'ativo', criadoEm: null, identidade: null }
}

const VERGARA = espaco('tenant-1', 'Estúdio Vergara')
const CASA_NOVE = espaco('tenant-2', 'Casa Nove')

/** @param {object} props */
function montar(props) {
  return {
    usuario: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <SeletorDeEspaco {...props} />
      </MemoryRouter>,
    ),
  }
}

describe('SeletorDeEspaco', () => {
  it('sem espaço nenhum, não ocupa lugar no cabeçalho', () => {
    const { container } = montar({ espacos: [], selecionado: null })

    expect(container).toBeEmptyDOMElement()
  })

  it('com um espaço só, diz o nome sem oferecer troca que não existe', () => {
    montar({ espacos: [VERGARA], selecionado: VERGARA })

    expect(screen.getByText('Estúdio Vergara')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('com dois espaços, o segundo está a um clique — e não sumiu', async () => {
    const { usuario } = montar({ espacos: [VERGARA, CASA_NOVE], selecionado: VERGARA })

    const gatilho = screen.getByRole('button', { name: /Estúdio Vergara/ })
    await usuario.click(gatilho)

    const itens = screen.getAllByRole('menuitemradio')
    expect(itens.map((item) => item.textContent)).toEqual(['Estúdio Vergara', 'Casa Nove'])
  })

  it('o menu marca qual espaço está aberto', async () => {
    const { usuario } = montar({ espacos: [VERGARA, CASA_NOVE], selecionado: CASA_NOVE })

    await usuario.click(screen.getByRole('button', { name: /Casa Nove/ }))

    expect(screen.getByRole('menuitemradio', { name: 'Casa Nove' })).toBeChecked()
    expect(screen.getByRole('menuitemradio', { name: 'Estúdio Vergara' })).not.toBeChecked()
  })

  it('escolher outro espaço avisa quem manda no contexto, pelo id', async () => {
    const aoEscolher = vi.fn()
    const { usuario } = montar({ espacos: [VERGARA, CASA_NOVE], selecionado: VERGARA, aoEscolher })

    await usuario.click(screen.getByRole('button', { name: /Estúdio Vergara/ }))
    await usuario.click(screen.getByRole('menuitemradio', { name: 'Casa Nove' }))

    expect(aoEscolher).toHaveBeenCalledWith('tenant-2')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('o gatilho diz do que se trata, para quem não vê o cabeçalho', () => {
    montar({ espacos: [VERGARA, CASA_NOVE], selecionado: VERGARA })

    expect(
      screen.getByRole('button', { name: 'Espaço de trabalho: Estúdio Vergara Trocar de espaço de trabalho' }),
    ).toBeInTheDocument()
  })
})
