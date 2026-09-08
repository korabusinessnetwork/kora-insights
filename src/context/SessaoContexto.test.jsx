/**
 * A sessão é o que decide se uma rota protegida abre. Os dois riscos cobertos
 * aqui são de corrida: a leitura inicial chegar depois de um logout e ressuscitar
 * a sessão, e a assinatura sobreviver ao desmonte, escrevendo em componente que
 * já saiu da tela.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

import { SessaoProvedor, useSessao } from './SessaoContexto.jsx'

const servicos = vi.hoisted(() => ({
  sessaoAtual: vi.fn(),
  aoMudarSessao: vi.fn(),
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

/** Espia o valor do contexto sem depender de nenhuma tela. */
function Espiao() {
  const { sessao, carregando, autenticado } = useSessao()
  return (
    <p>
      {carregando ? 'decidindo' : 'decidido'} · {autenticado ? sessao.usuarioId : 'sem sessão'}
    </p>
  )
}

function montar() {
  return render(
    <SessaoProvedor>
      <Espiao />
    </SessaoProvedor>,
  )
}

describe('SessaoContexto', () => {
  /** @type {((envelope: object) => void)|null} */
  let anunciar = null
  const cancelar = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    anunciar = null
    servicos.aoMudarSessao.mockImplementation((cb) => {
      anunciar = cb
      return cancelar
    })
  })

  it('começa indeciso e só depois afirma que não há sessão', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(null))
    montar()

    expect(screen.getByText(/decidindo/)).toBeInTheDocument()

    expect(await screen.findByText(/decidido · sem sessão/)).toBeInTheDocument()
  })

  it('expõe a sessão lida da camada de serviços', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    montar()

    expect(await screen.findByText(/decidido · usuario-1/)).toBeInTheDocument()
  })

  it('a leitura inicial atrasada não ressuscita uma sessão já encerrada', async () => {
    let resolverLeitura = () => {}
    servicos.sessaoAtual.mockReturnValue(
      new Promise((resolver) => {
        resolverLeitura = resolver
      }),
    )
    montar()

    // O logout chega primeiro, pela assinatura; a leitura pendente só volta
    // depois, carregando a sessão velha.
    act(() => anunciar(envelope(null)))
    expect(screen.getByText(/decidido · sem sessão/)).toBeInTheDocument()

    await act(async () => {
      resolverLeitura(envelope(SESSAO))
    })

    expect(screen.getByText(/decidido · sem sessão/)).toBeInTheDocument()
  })

  it('cancela a assinatura no desmonte', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    const { unmount } = montar()
    await screen.findByText(/decidido · usuario-1/)

    unmount()

    expect(cancelar).toHaveBeenCalledTimes(1)
  })

  it('encerrar a sessão apaga a sessão mesmo onde a assinatura não fala', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    servicos.sair.mockResolvedValue(envelope({ encerrada: true }))

    /** @returns {JSX.Element} */
    function ComSaida() {
      const { encerrarSessao, autenticado } = useSessao()
      return (
        <button type="button" onClick={encerrarSessao}>
          {autenticado ? 'sair' : 'já saiu'}
        </button>
      )
    }

    render(
      <SessaoProvedor>
        <ComSaida />
      </SessaoProvedor>,
    )
    const botao = await screen.findByRole('button', { name: 'sair' })

    await act(async () => {
      botao.click()
    })

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('já saiu'))
  })
})
