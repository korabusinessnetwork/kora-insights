/**
 * O contexto do tenant faz três coisas que erram em silêncio quando erram: ele
 * decide qual espaço de trabalho está aberto, qual conta está em foco, e ele
 * pinta a tela com a identidade do cliente. Espaço que some da lista, conta
 * errada no cabeçalho e cor de um cliente sobrevivendo à troca para outro são
 * vazamentos entre tenants, não detalhes de estilo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { SessaoProvedor } from './SessaoContexto.jsx'
import { TenantProvedor, escolherTenant, useTenant } from './TenantContexto.jsx'

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
    localStorage.clear()
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

const OUTRO_TENANT = {
  id: 'tenant-2',
  nome: 'Casa Nove',
  plano: 'unico',
  status: 'ativo',
  criadoEm: '2026-06-20T13:00:00.000Z',
  identidade: { acento: '#abcdef' },
}

const CONTAS_DO_OUTRO = [
  { id: 'conta-c', nome: 'Padaria Real', username: 'padariareal', status: 'ativa' },
]

/** Contas por espaço: filtrar a lista de um tenant no teste esconderia o defeito
 *  de pedir as contas do espaço errado. */
const CONTAS_POR_TENANT = { 'tenant-1': CONTAS, 'tenant-2': CONTAS_DO_OUTRO }

function EspiaoDeEspacos() {
  const { tenant, tenants, contas, selecionarTenant, carregando } = useTenant()
  const { pathname } = useLocation()
  return (
    <div>
      <p>aberto: {carregando ? 'carregando' : (tenant?.nome ?? 'nenhum')}</p>
      <p>espaços: {tenants.map((espaco) => espaco.nome).join(', ') || 'nenhum'}</p>
      <p>contas: {contas.map((conta) => conta.nome).join(', ') || 'nenhuma'}</p>
      <p>caminho: {pathname}</p>
      {tenants.map((espaco) => (
        <button key={espaco.id} type="button" onClick={() => selecionarTenant(espaco.id)}>
          abrir {espaco.nome}
        </button>
      ))}
    </div>
  )
}

/** @param {string} [caminho] */
function montarEspacos(caminho = '/contas') {
  return {
    usuario: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={[caminho]}>
        <SessaoProvedor>
          <TenantProvedor>
            <EspiaoDeEspacos />
          </TenantProvedor>
        </SessaoProvedor>
      </MemoryRouter>,
    ),
  }
}

describe('escolherTenant', () => {
  it('sem espaço nenhum, não inventa um', () => {
    expect(escolherTenant([], 'tenant-1')).toBeNull()
    expect(escolherTenant(null)).toBeNull()
    expect(escolherTenant(undefined, 'tenant-1')).toBeNull()
  })

  it('sem preferência guardada, abre o primeiro', () => {
    expect(escolherTenant([TENANT, OUTRO_TENANT])).toBe(TENANT)
    expect(escolherTenant([TENANT, OUTRO_TENANT], null)).toBe(TENANT)
    expect(escolherTenant([TENANT, OUTRO_TENANT], '')).toBe(TENANT)
  })

  it('com preferência guardada, abre o espaço escolhido', () => {
    expect(escolherTenant([TENANT, OUTRO_TENANT], 'tenant-2')).toBe(OUTRO_TENANT)
  })

  it('preferência fora da lista cai no primeiro, e não em tela vazia', () => {
    // Vínculo revogado e id de outro navegador chegam assim. A lista é o que a
    // RLS liberou; a preferência é só memória, e memória não abre porta.
    expect(escolherTenant([TENANT, OUTRO_TENANT], 'tenant-de-outro')).toBe(TENANT)
  })
})

describe('TenantContexto — usuário em mais de um espaço', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    servicos.aoMudarSessao.mockImplementation(() => () => {})
    servicos.sessaoAtual.mockResolvedValue(envelope(SESSAO))
    servicos.listarTenantsDoUsuario.mockResolvedValue(envelope([TENANT, OUTRO_TENANT]))
    servicos.listarContasConectadas.mockImplementation(async (tenantId) =>
      envelope(CONTAS_POR_TENANT[tenantId] ?? []),
    )
  })

  it('os dois espaços chegam à interface — o segundo não some mais', async () => {
    montarEspacos()

    expect(await screen.findByText('espaços: Estúdio Vergara, Casa Nove')).toBeInTheDocument()
    expect(screen.getByText('aberto: Estúdio Vergara')).toBeInTheDocument()
  })

  it('trocar de espaço troca as contas junto', async () => {
    const { usuario } = montarEspacos()
    await screen.findByText('contas: Casa Oliveira, Verdejar Plantas')

    await usuario.click(screen.getByRole('button', { name: 'abrir Casa Nove' }))

    expect(await screen.findByText('aberto: Casa Nove')).toBeInTheDocument()
    expect(screen.getByText('contas: Padaria Real')).toBeInTheDocument()
    expect(servicos.listarContasConectadas).toHaveBeenCalledWith('tenant-2')
  })

  it('a troca volta para /contas: a conta da URL era do espaço anterior', async () => {
    const { usuario } = montarEspacos('/contas/conta-b/relatorio')
    await screen.findByText('aberto: Estúdio Vergara')

    await usuario.click(screen.getByRole('button', { name: 'abrir Casa Nove' }))

    expect(await screen.findByText('caminho: /contas')).toBeInTheDocument()
  })

  it('abrir o espaço que já está aberto não mexe na rota', async () => {
    const { usuario } = montarEspacos('/contas/conta-b/relatorio')
    await screen.findByText('aberto: Estúdio Vergara')

    await usuario.click(screen.getByRole('button', { name: 'abrir Estúdio Vergara' }))

    expect(screen.getByText('caminho: /contas/conta-b/relatorio')).toBeInTheDocument()
  })

  it('a identidade visual do novo espaço substitui a do anterior', async () => {
    const { usuario } = montarEspacos()
    await screen.findByText('aberto: Estúdio Vergara')
    expect(acentoDaRaiz()).toBe('#123456')

    await usuario.click(screen.getByRole('button', { name: 'abrir Casa Nove' }))

    expect(await screen.findByText('aberto: Casa Nove')).toBeInTheDocument()
    expect(acentoDaRaiz()).toBe('#abcdef')
  })

  it('enquanto as contas do novo espaço não chegam, nenhuma conta do anterior fica na tela', async () => {
    let liberarContas = () => {}
    servicos.listarContasConectadas.mockImplementation(async (tenantId) => {
      if (tenantId === 'tenant-1') return envelope(CONTAS)
      await new Promise((resolve) => {
        liberarContas = resolve
      })
      return envelope(CONTAS_DO_OUTRO)
    })

    const { usuario } = montarEspacos()
    await screen.findByText('contas: Casa Oliveira, Verdejar Plantas')

    await usuario.click(screen.getByRole('button', { name: 'abrir Casa Nove' }))

    // Conta de um cliente sob o nome de outro, mesmo por um quadro, é vazamento
    // de marca: o estado honesto aqui é "carregando", não a lista velha.
    expect(screen.getByText('aberto: carregando')).toBeInTheDocument()
    expect(screen.getByText('contas: nenhuma')).toBeInTheDocument()

    await act(async () => {
      liberarContas()
    })
    expect(await screen.findByText('contas: Padaria Real')).toBeInTheDocument()
  })

  it('a escolha sobrevive ao recarregar a página', async () => {
    const { usuario, unmount } = montarEspacos()
    await screen.findByText('aberto: Estúdio Vergara')

    await usuario.click(screen.getByRole('button', { name: 'abrir Casa Nove' }))
    await screen.findByText('aberto: Casa Nove')
    unmount()

    montarEspacos()

    expect(await screen.findByText('aberto: Casa Nove')).toBeInTheDocument()
  })

  it('espaço guardado que não é mais do usuário abre o primeiro, sem beco', async () => {
    localStorage.setItem('kora.espaco-de-trabalho', 'tenant-de-outro-usuario')
    montarEspacos()

    expect(await screen.findByText('aberto: Estúdio Vergara')).toBeInTheDocument()
    expect(servicos.listarContasConectadas).toHaveBeenCalledWith('tenant-1')
  })
})
