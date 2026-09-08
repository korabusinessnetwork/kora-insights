/**
 * O portão só tem uma função, e ela tem três estados — não dois. O bug que
 * estes testes existem para impedir é o mais barato de escrever e o mais caro
 * de perceber: tratar "ainda não sei se há sessão" como "não há sessão", e
 * piscar a tela de login para quem estava logado o tempo inteiro.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { SessaoProvedor } from '../context/SessaoContexto.jsx'
import RotaProtegida from './RotaProtegida.jsx'

const servicos = vi.hoisted(() => ({
  sessaoAtual: vi.fn(),
  aoMudarSessao: vi.fn(() => () => {}),
  sair: vi.fn(),
}))

vi.mock('../lib/index.js', () => servicos)

/** @param {unknown} data */
function envelope(data) {
  return {
    data,
    error: null,
    meta: { carimbo: '2026-09-05T09:12:00.000Z', versao: '1', origem: 'supabase' },
  }
}

const SESSAO = { usuarioId: 'usuario-1', email: 'camila@estudiovergara.com.br', expiraEm: null }

/** Tela de entrada de mentira que mostra o destino guardado na URL. */
function EntradaFalsa() {
  const { search } = useLocation()
  return <p>entrada {search}</p>
}

/** @param {string} [caminho] */
function montar(caminho = '/contas/conta-casa-oliveira') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <SessaoProvedor>
        <Routes>
          <Route element={<RotaProtegida />}>
            <Route path="/contas/:contaId" element={<p>diagnóstico da conta</p>} />
          </Route>
          <Route path="/entrar" element={<EntradaFalsa />} />
        </Routes>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

describe('RotaProtegida', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    servicos.aoMudarSessao.mockImplementation(() => () => {})
  })

  it('enquanto a sessão não foi decidida, não mostra nem o conteúdo nem a entrada', () => {
    servicos.sessaoAtual.mockReturnValue(new Promise(() => {}))
    montar()

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('diagnóstico da conta')).not.toBeInTheDocument()
    expect(screen.queryByText(/^entrada/)).not.toBeInTheDocument()
  })

  it('sem sessão, manda para a entrada guardando o destino', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(null))
    montar()

    const entrada = await screen.findByText(/^entrada/)

    expect(entrada).toHaveTextContent('proximo=%2Fcontas%2Fconta-casa-oliveira')
    expect(screen.queryByText('diagnóstico da conta')).not.toBeInTheDocument()
  })

  it('com sessão, entrega a rota protegida sem passar pela entrada', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    montar()

    expect(await screen.findByText('diagnóstico da conta')).toBeInTheDocument()
    expect(screen.queryByText(/^entrada/)).not.toBeInTheDocument()
  })

  it('erro ao ler a sessão não abre a rota protegida', async () => {
    servicos.sessaoAtual.mockResolvedValue({
      data: null,
      error: { codigo: 'FALHA_DE_REDE', mensagem: 'Não foi possível falar com o servidor.' },
      meta: { carimbo: '2026-09-05T09:12:00.000Z', versao: '1', origem: 'supabase' },
    })
    montar()

    await screen.findByText(/^entrada/)

    expect(screen.queryByText('diagnóstico da conta')).not.toBeInTheDocument()
  })
})
