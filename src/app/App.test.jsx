/**
 * A casca inteira, rodando sobre a camada de serviços de verdade — que, sem
 * `VITE_SUPABASE_URL` no ambiente, é o modo de demonstração (ADR-007).
 *
 * Dois riscos moram aqui. O primeiro é a demonstração deixar de se anunciar:
 * dado de exemplo apresentado como dado do cliente é a desonestidade que
 * `memory/identity.md` proíbe. O segundo é a troca de conta virar armadilha de
 * mouse — o seletor precisa abrir, andar e fechar no teclado, devolvendo o foco
 * de onde ele saiu.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useParams } from 'react-router-dom'

import App from './App.jsx'

/** Tela de conta de mentira: a árvore de rotas não precisa da feature real. */
function TelaDaConta() {
  const { contaId } = useParams()
  return <p>tela da conta {contaId}</p>
}

const TELAS = {
  entrada: <p>tela de entrada</p>,
  conexao: <p>tela de conexão</p>,
  retornoDaConexao: <p>tela de retorno</p>,
  contas: <p>tela de contas</p>,
  diagnostico: <TelaDaConta />,
  relatorio: <p>tela de relatório</p>,
  historico: <p>tela de histórico</p>,
}

/** @param {string} [caminho] */
function montar(caminho = '/contas/conta-casa-oliveira') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <App telas={TELAS} />
    </MemoryRouter>,
  )
}

/** O gatilho do seletor, já com as contas do tenant carregadas. */
function acharGatilho() {
  return screen.findByRole('button', { name: /Casa Oliveira/ })
}

describe('Casca', () => {
  it('avisa, de forma permanente, que o dado é de demonstração', async () => {
    montar()

    expect(await screen.findByText(/conta de exemplo/i)).toBeInTheDocument()
    expect(screen.getByText('Demonstração')).toBeInTheDocument()
  })

  it('entrega a rota protegida com a conta da URL', async () => {
    montar()

    expect(await screen.findByText('tela da conta conta-casa-oliveira')).toBeInTheDocument()
  })

  it('mostra o período analisado do diagnóstico no cabeçalho', async () => {
    montar()

    expect(await screen.findByText(/30 de agosto de 2026/)).toBeInTheDocument()
  })

  it('leva à política de privacidade e à exclusão de dados de qualquer tela', async () => {
    montar()

    expect(await screen.findByRole('link', { name: 'Política de privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
    expect(screen.getByRole('link', { name: 'Seus dados e exclusão' })).toHaveAttribute(
      'href',
      '/dados',
    )
  })
})

describe('SeletorDeConta', () => {
  it('abre, anda e escolhe outra conta só com o teclado', async () => {
    montar()
    const gatilho = await acharGatilho()
    gatilho.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(gatilho).toHaveAttribute('aria-expanded', 'true')
    expect(document.activeElement).toHaveTextContent('Casa Oliveira')

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveTextContent('Verdejar Plantas')

    await userEvent.keyboard('{Enter}')

    expect(await screen.findByText('tela da conta conta-verdejar')).toBeInTheDocument()
    await waitFor(() => expect(gatilho).toHaveAttribute('aria-expanded', 'false'))
  })

  it('Escape fecha o menu e devolve o foco para o gatilho', async () => {
    montar()
    const gatilho = await acharGatilho()
    gatilho.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(gatilho).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(gatilho)
  })

  it('mostra todas as contas conectadas e uma saída para conectar outra', async () => {
    montar()
    const gatilho = await acharGatilho()

    await userEvent.click(gatilho)

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3)
    expect(screen.getByRole('menuitem', { name: 'Conectar outra conta' })).toHaveAttribute(
      'href',
      '/conectar',
    )
  })
})

describe('Páginas do App Review', () => {
  it('a política de privacidade abre sem sessão e declara o que ainda falta', async () => {
    montar('/privacidade')

    expect(
      await screen.findByRole('heading', { name: 'Política de privacidade', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Versão incompleta')).toBeInTheDocument()
    expect(screen.getByText(/Pendente: razão social/)).toBeInTheDocument()
  })

  it('a página de dados oferece o pedido de exclusão por conta, com confirmação', async () => {
    montar('/dados')

    const pedidos = await screen.findAllByRole('button', { name: 'Pedir exclusão dos dados' })
    expect(pedidos).toHaveLength(3)

    await userEvent.click(pedidos[0])

    // Ação irreversível não acontece no primeiro clique (CLAUDE.md: prevenção
    // de erro vale mais que mensagem de erro).
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument()
  })

  it('na demonstração, o pedido de exclusão diz por que não foi concluído', async () => {
    montar('/dados')

    const pedidos = await screen.findAllByRole('button', { name: 'Pedir exclusão dos dados' })
    await userEvent.click(pedidos[0])
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(await screen.findByText(/Modo demonstração/)).toBeInTheDocument()
  })
})
