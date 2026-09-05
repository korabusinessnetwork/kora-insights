/**
 * O contexto do tenant faz duas coisas que erram em silêncio quando erram: ele
 * decide qual conta está em foco, e ele pinta a tela com a identidade do
 * cliente. Conta errada no cabeçalho e cor de um cliente sobrevivendo à troca
 * para outro são vazamentos de marca entre tenants, não detalhes de estilo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { SessaoProvedor } from './SessaoContexto.jsx'
import { TenantProvedor, useTenant } from './TenantContexto.jsx'

const servicos = vi.hoisted(() => ({
  sessaoAtual: vi.fn(),
  aoMudarSessao: vi.fn(),
  sair: vi.fn(),
  listarTenantsDoUsuario: vi.fn(),
  listarContasConectadas: vi.fn(),
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

const TENANT = {
  id: 'tenant-1',
  nome: 'Estúdio Vergara',
  plano: 'unico',
  status: 'ativo',
  criadoEm: '2026-05-04T13:00:00.000Z',
  identidade: { acento: '#123456' },
}

const CONTAS = [
  { id: 'conta-a', nome: 'Casa Oliveira', username: 'casa.oliveira', status: 'ativa' },
  { id: 'conta-b', nome: 'Verdejar Plantas', username: 'verdejarplantas', status: 'ativa' },
]

function Espiao() {
  const { tenant, contas, contaSelecionada, carregando } = useTenant()
  if (carregando) return <p>carregando</p>
  return (
    <p>
      {tenant?.nome ?? 'sem tenant'} · {contas.length} contas ·{' '}
      {contaSelecionada?.nome ?? 'nenhuma em foco'}
    </p>
  )
}

/** @param {string} [caminho] */
function montar(caminho = '/contas') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <SessaoProvedor>
        <TenantProvedor>
          <Espiao />
        </TenantProvedor>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

/** @returns {string} valor aplicado na raiz, sem espaço em volta */
function acentoDaRaiz() {
  return document.documentElement.style.getPropertyValue('--tenant-acento').trim()
}

describe('TenantContexto', () => {
  /** @type {((envelope: object) => void)|null} */
  let anunciarSessao = null

  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.removeAttribute('style')
    anunciarSessao = null
    servicos.aoMudarSessao.mockImplementation((cb) => {
      anunciarSessao = cb
      return () => {}
    })
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    servicos.listarTenantsDoUsuario.mockResolvedValue(envelope([TENANT]))
    servicos.listarContasConectadas.mockResolvedValue(envelope(CONTAS))
  })

  it('sem conta na URL, a primeira conta fica em foco', async () => {
    montar('/contas')

    expect(await screen.findByText(/Estúdio Vergara · 2 contas · Casa Oliveira/)).toBeInTheDocument()
  })

  it('a conta em foco vem da URL', async () => {
    montar('/contas/conta-b/relatorio')

    expect(await screen.findByText(/Verdejar Plantas/)).toBeInTheDocument()
  })

  it('conta desconhecida na URL não vira a primeira da lista', async () => {
    montar('/contas/conta-de-outro-tenant')

    expect(await screen.findByText(/nenhuma em foco/)).toBeInTheDocument()
  })

  it('aplica a identidade visual do tenant na raiz do documento', async () => {
    montar()
    await screen.findByText(/Estúdio Vergara/)

    expect(acentoDaRaiz()).toBe('#123456')
  })

  it('desfaz a identidade visual quando a sessão acaba', async () => {
    montar()
    await screen.findByText(/Estúdio Vergara/)
    expect(acentoDaRaiz()).toBe('#123456')

    await act(async () => {
      anunciarSessao(envelope(null))
    })

    expect(acentoDaRaiz()).toBe('')
    expect(screen.getByText(/sem tenant/)).toBeInTheDocument()
  })

  it('sem sessão, não procura espaço de trabalho nenhum', async () => {
    servicos.sessaoAtual.mockResolvedValue(envelope(null))
    montar()

    expect(await screen.findByText(/sem tenant/)).toBeInTheDocument()
    expect(servicos.listarTenantsDoUsuario).not.toHaveBeenCalled()
  })
})
