/**
 * A pagina onde o cliente exerce dois direitos que nao se desfazem do mesmo
 * jeito: parar a coleta, e apagar o historico.
 *
 * O risco aqui nao e a tela quebrar, e ela executar a acao errada. Uma
 * confirmacao que valha para as duas saidas faz a pessoa clicar em "Confirmar"
 * sem saber qual das duas — e uma delas apaga meses de historico sem volta.
 * Por isso a confirmacao carrega a acao junto do id, e o teste cobra isso.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const desconectarConta = vi.fn()
const solicitarExclusaoDeDados = vi.fn()
const recarregar = vi.fn()

vi.mock('../../lib/index.js', () => ({
  desconectarConta: (...args) => desconectarConta(...args),
  solicitarExclusaoDeDados: (...args) => solicitarExclusaoDeDados(...args),
}))

vi.mock('../../context/SessaoContexto.jsx', () => ({
  useSessao: () => sessao,
}))

vi.mock('../../context/TenantContexto.jsx', () => ({
  useTenant: () => tenant,
}))

let sessao
let tenant

const CASA_OLIVEIRA = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Casa Oliveira',
  username: 'casaoliveira',
  status: 'ativa',
}

/** @param {object[]} [contas] */
async function montar(contas = [CASA_OLIVEIRA]) {
  tenant = { contas, carregando: false, erro: null, recarregar }
  const { default: Dados } = await import('./Dados.jsx')
  return render(
    <MemoryRouter>
      <Dados />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessao = { autenticado: true, carregando: false }
  tenant = { contas: [], carregando: false, erro: null, recarregar }
})

describe('Dados: as instruções públicas', () => {
  it('explica a diferença entre desconectar e excluir antes de oferecer as duas', async () => {
    sessao = { autenticado: false, carregando: false }
    await montar([])

    expect(screen.getByRole('heading', { name: 'Parar a coleta sem apagar nada' })).toBeInTheDocument()
    expect(screen.getByText(/reconectar mais tarde recomeça de onde parou/i)).toBeInTheDocument()
  })

  it('sem sessão, o texto é público mas nenhum botão de ação aparece', async () => {
    sessao = { autenticado: false, carregando: false }
    await montar([])

    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pedir exclusão dos dados' }),
    ).not.toBeInTheDocument()
  })
})

describe('Dados: desconectar', () => {
  it('oferece a saída reversível junto da definitiva', async () => {
    await montar()

    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir exclusão dos dados' })).toBeInTheDocument()
  })

  it('a confirmação diz que o histórico fica — é o que separa das duas ações', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))

    // Escopado na confirmação: a mesma frase aparece no texto explicativo acima,
    // e o que está sob prova é o que a pessoa lê no instante do clique.
    const confirmacao = within(screen.getByRole('group'))
    expect(confirmacao.getByText(/histórico já coletado continua aqui/i)).toBeInTheDocument()
    expect(confirmacao.queryByText(/não tem volta/i)).not.toBeInTheDocument()
  })

  it('confirmar desconecta a conta e nunca chama a exclusão', async () => {
    desconectarConta.mockResolvedValue({
      data: { id: CASA_OLIVEIRA.id, status: 'desconectada' },
      error: null,
    })
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desconexão' }))

    expect(desconectarConta).toHaveBeenCalledWith(CASA_OLIVEIRA.id)
    expect(solicitarExclusaoDeDados).not.toHaveBeenCalled()
    const aviso = await screen.findByText('Conta desconectada')
    expect(within(aviso.closest('.ki-aviso')).getByText(/@casaoliveira/)).toBeInTheDocument()
    // A lista veio do contexto e acabou de ficar velha: sem recarregar, a conta
    // desconectada continuaria oferecendo o botao de desconectar.
    expect(recarregar).toHaveBeenCalled()
  })

  it('abrir uma confirmação não abre a outra', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))

    expect(screen.getByRole('button', { name: 'Confirmar desconexão' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar exclusão' })).not.toBeInTheDocument()
  })

  it('cancelar volta para as duas saídas, sem ter chamado nada', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Pedir exclusão dos dados' })).toBeInTheDocument()
    expect(desconectarConta).not.toHaveBeenCalled()
  })

  it('conta já desconectada não oferece desconectar de novo, e diz por quê', async () => {
    await montar([{ ...CASA_OLIVEIRA, status: 'desconectada' }])

    expect(screen.getByText('Já desconectada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument()
    // A exclusão continua disponível: parar de coletar não apagou nada.
    expect(screen.getByRole('button', { name: 'Pedir exclusão dos dados' })).toBeInTheDocument()
  })

  it('falha do serviço aparece na tela, com a mensagem do envelope', async () => {
    desconectarConta.mockResolvedValue({
      data: null,
      error: { codigo: 'FALHA_INESPERADA', mensagem: 'A coleta parou, mas o token continua.' },
    })
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desconexão' }))

    expect(await screen.findByText('A coleta parou, mas o token continua.')).toBeInTheDocument()
    expect(screen.queryByText('Conta desconectada')).not.toBeInTheDocument()
    // Nada mudou no servidor: recarregar aqui so piscaria a lista a toa.
    expect(recarregar).not.toHaveBeenCalled()
  })
})

describe('Dados: excluir', () => {
  it('a confirmação da exclusão avisa que não tem volta', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Pedir exclusão dos dados' }))

    const confirmacao = within(screen.getByRole('group'))
    expect(confirmacao.getByText(/não tem volta/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar desconexão' })).not.toBeInTheDocument()
  })

  it('confirmar apaga e devolve o protocolo, que é o comprovante do pedido', async () => {
    solicitarExclusaoDeDados.mockResolvedValue({
      data: { protocolo: 'KORA-20260907-ABCD1234', solicitadoEm: '2026-09-07T12:00:00.000Z' },
      error: null,
    })
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Pedir exclusão dos dados' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(solicitarExclusaoDeDados).toHaveBeenCalledWith(CASA_OLIVEIRA.id)
    expect(desconectarConta).not.toHaveBeenCalled()
    expect(await screen.findByText('KORA-20260907-ABCD1234')).toBeInTheDocument()
    expect(recarregar).toHaveBeenCalled()
  })
})
