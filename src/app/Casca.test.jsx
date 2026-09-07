/**
 * A casca decide o que precisa aparecer em TODA tela do produto — e o aviso de
 * conexao vencendo e o caso em que essa decisao tem preco.
 *
 * O token da Meta vive ~60 dias. Quando ele vence, a coleta para, e dia sem
 * coleta nao volta: cinco dias de lacuna ja custaram uma semana inteira de
 * comparacao neste projeto (memory/learnings.md, 2026-09-06). Um aviso que
 * aparece so na tela da conta afetada chega tarde para quem estava olhando
 * outra conta, e um aviso sem o caminho da reconexao e um beco.
 *
 * O teste monta a casca com as contas vindo do contexto, que e como ela roda de
 * verdade — a peca isolada ja tem teste proprio em `src/token/validade.test.js`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/index.js', () => ({
  estaEmModoDemonstracao: () => false,
  agoraDoProduto: () => new Date(AGORA),
}))

vi.mock('../context/SessaoContexto.jsx', () => ({
  useSessao: () => ({ encerrarSessao: vi.fn() }),
}))

vi.mock('../context/TenantContexto.jsx', () => ({
  useTenant: () => estadoDoTenant,
}))

// O cabecalho tem contexto e servico proprios, e teste proprio. Aqui ele so
// atrapalharia: o que esta sob prova e a faixa de avisos.
vi.mock('./Cabecalho.jsx', () => ({ default: () => <header>cabeçalho</header> }))

const AGORA = '2026-09-07T12:00:00.000Z'

/** @type {{ contas: object[], erro: object|null, recarregar: () => void }} */
let estadoDoTenant

/**
 * @param {number} dias
 * @returns {string} vencimento a tantos dias de AGORA
 */
function daquiA(dias) {
  return new Date(new Date(AGORA).getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @param {object} [campos]
 * @returns {object} conta conectada
 */
function conta(campos = {}) {
  return {
    id: 'conta-1',
    nome: 'Casa Oliveira',
    username: 'casaoliveira',
    status: 'ativa',
    tokenExpiraEm: daquiA(45),
    ...campos,
  }
}

/** @param {object[]} contas */
async function montar(contas) {
  estadoDoTenant = { contas, erro: null, recarregar: vi.fn() }
  const { default: Casca } = await import('./Casca.jsx')
  return render(
    <MemoryRouter initialEntries={['/contas/conta-1']}>
      <Casca />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  estadoDoTenant = { contas: [], erro: null, recarregar: vi.fn() }
})

describe('Casca: aviso de reconexão', () => {
  it('conta com prazo confortável não vira aviso', async () => {
    await montar([conta()])

    expect(screen.queryByText(/Reconecte/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reconectar' })).not.toBeInTheDocument()
  })

  it('conexão vencendo diz o prazo, a conta e o que se perde', async () => {
    await montar([conta({ tokenExpiraEm: daquiA(3) })])

    expect(screen.getByText('Conexão expirando')).toBeInTheDocument()
    expect(screen.getByText(/@casaoliveira/)).toHaveTextContent('vence em 3 dias')
    expect(screen.getByText(/@casaoliveira/)).toHaveTextContent('dia sem coleta não volta')
  })

  it('conexão vencida é crítica e anuncia com assertividade ao leitor de tela', async () => {
    await montar([conta({ status: 'token_expirado', tokenExpiraEm: daquiA(-4) })])

    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveAttribute('data-variante', 'critico')
    expect(aviso).toHaveTextContent('Coleta parada')
  })

  it('o aviso leva à reconexão: é link, e não botão que navega', async () => {
    await montar([conta({ tokenExpiraEm: daquiA(2) })])

    const acao = screen.getByRole('link', { name: 'Reconectar' })
    expect(acao).toHaveAttribute('href', '/conectar')
  })

  it('avisa por conta, e não uma vez só, quando duas estão em risco', async () => {
    await montar([
      conta({ id: 'c1', username: 'casaoliveira', tokenExpiraEm: daquiA(5) }),
      conta({ id: 'c2', username: 'verdejar', nome: 'Verdejar', tokenExpiraEm: daquiA(1) }),
    ])

    // A urgente primeiro: a faixa é lida de cima para baixo.
    const textos = screen.getAllByText(/A conexão de @/).map((no) => no.textContent)
    expect(textos).toHaveLength(2)
    expect(textos[0]).toContain('@verdejar')
    expect(textos[1]).toContain('@casaoliveira')
  })

  it('sem conta em risco, a faixa de avisos não ocupa espaço na tela', async () => {
    const { container } = await montar([conta()])

    expect(container.querySelector('.ka-casca__avisos')).toBeNull()
  })
})
