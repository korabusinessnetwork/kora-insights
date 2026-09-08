/**
 * O que estes testes protegem e a fricao do onboarding.
 *
 * Quatro garantias, e as quatro vem de decisao registrada:
 *
 * 1. Os requisitos e o "o que nao fazemos" aparecem **antes** de qualquer botao
 *    de autorizar (ADR-002: explicar antes do clique).
 * 2. O `scope` leva exatamente as quatro permissoes do ADR-002.
 * 3. Retorno com estado divergente e recusado, com o proximo passo na tela.
 * 4. Cancelamento nao e erro: sem alerta, sem vermelho, sem culpa.
 *
 * `src/lib` roda de verdade; so as respostas que nao ha como produzir de
 * verdade — uma conexao concluida, um limite de taxa — sao dubladas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { CODIGOS, concluirConexao, falha, ok } from '../../../lib/index.js'
import { formatarDataCurta } from '../../../metricas/index.js'
import Conectar from './Conectar.jsx'
import { SEMANAS_PARA_DIAGNOSTICO } from '../../../rules/requisitos.js'
import RetornoDaConexao, {
  SEMANAS_ATE_O_DIAGNOSTICO,
  estimarPrimeiroDiagnostico,
} from './RetornoDaConexao.jsx'
import { SessaoProvedor } from '../../../context/SessaoContexto.jsx'
import { TenantProvedor } from '../../../context/TenantContexto.jsx'

vi.mock('../../../lib/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    // Espias que, por padrao, sao a propria funcao: a camada real continua no ar.
    urlDeConsentimento: vi.fn(original.urlDeConsentimento),
    concluirConexao: vi.fn(original.concluirConexao),
  }
})

const DIALOGO = 'https://www.facebook.test/v23.0/dialog/oauth'
const RETORNO = 'https://app.kora.test/conectar/retorno'

/** Permissoes do ADR-002, na ordem em que o `scope` as declara. */
const PERMISSOES_DO_ADR = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
]

const CODIGO_DA_META = 'AQBv-2iL_9xK.abcDEF12345'
const ESTADO_DA_META = '0123456789abcdef0123456789abcdef'

const NAO_PUBLICAMOS =
  'Não publicamos e não agendamos nada. Nenhuma permissão que pedimos permite postar.'

/** Ambiente completo: Supabase configurado e app da Meta declarado. */
function comAmbienteDeProducao() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://projeto.supabase.test')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-anon-de-teste')
  vi.stubEnv('VITE_META_APP_ID', '1234567890')
  vi.stubEnv('VITE_META_OAUTH_URL', DIALOGO)
  vi.stubEnv('VITE_META_REDIRECT_URI', RETORNO)
}

/**
 * @param {string} consulta querystring do retorno, sem o `?`
 * @returns {import('@testing-library/react').RenderResult}
 */
function montarRetorno(consulta) {
  // Com os provedores, como no app: `/conectar/retorno` e rota protegida e
  // roda dentro deles. O retorno precisa saber em qual espaco de trabalho a
  // conta entra — montar a tela fora do provedor testaria uma configuracao que
  // nao existe em lugar nenhum.
  return render(
    <MemoryRouter initialEntries={[`/conectar/retorno${consulta ? `?${consulta}` : ''}`]}>
      <SessaoProvedor>
        <TenantProvedor>
          <RetornoDaConexao />
        </TenantProvedor>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  sessionStorage.clear()
})

describe('Conectar — requisitos primeiro, botão depois', () => {
  it('mostra os requisitos e o que não fazemos antes de qualquer botão de autorizar', () => {
    comAmbienteDeProducao()
    render(<Conectar />)

    const requisito = screen.getByRole('heading', {
      name: 'A conta precisa ser Profissional — Empresa ou Criador de conteúdo',
    })
    const naoFazemos = screen.getByText(NAO_PUBLICAMOS)
    const botoes = screen.getAllByRole('button')
    const depois = (elemento) =>
      Boolean(elemento.compareDocumentPosition(botoes[0]) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(botoes).toHaveLength(1)
    expect(depois(requisito)).toBe(true)
    expect(depois(naoFazemos)).toBe(true)
  })

  it('dá a cada requisito uma checagem que a pessoa faz no próprio celular', () => {
    comAmbienteDeProducao()
    render(<Conectar />)

    expect(screen.getAllByText('Como conferir:')).toHaveLength(3)
    expect(screen.getByText(/Editar perfil → Página/)).toBeInTheDocument()
    expect(screen.getByText(/Configurações → Acesso à Página/)).toBeInTheDocument()
  })

  it('pede as quatro permissões do ADR-002, e nenhuma a mais', () => {
    comAmbienteDeProducao()
    render(<Conectar />)

    for (const permissao of PERMISSOES_DO_ADR) {
      expect(screen.getByText(permissao)).toBeInTheDocument()
    }
    expect(screen.queryByText('instagram_content_publish')).toBeNull()
    expect(screen.queryByText('instagram_manage_comments')).toBeNull()
  })

  it('declara o que a conexão não entrega, em vez de deixar a lacuna implícita', () => {
    comAmbienteDeProducao()
    render(<Conectar />)

    expect(screen.getByText('O que a conexão não nos dá')).toBeInTheDocument()
    expect(screen.getByText(/O histórico anterior à conexão/)).toBeInTheDocument()
    expect(screen.getByText(/Quem são as pessoas alcançadas/)).toBeInTheDocument()
  })

  it('leva ao diálogo da Meta com o scope exato e um estado imprevisível', async () => {
    comAmbienteDeProducao()
    const usuario = userEvent.setup()
    const irPara = vi.fn()
    render(<Conectar irPara={irPara} />)

    await usuario.click(screen.getByRole('button', { name: 'Autorizar no Facebook' }))

    expect(irPara).toHaveBeenCalledTimes(1)
    const url = new URL(irPara.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(DIALOGO)
    expect(url.searchParams.get('scope')).toBe(PERMISSOES_DO_ADR.join(','))
    expect(url.searchParams.get('redirect_uri')).toBe(RETORNO)
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('não oferece o botão como se funcionasse em modo demonstração', () => {
    render(<Conectar />)

    expect(screen.getByRole('button', { name: 'Autorizar no Facebook' })).toBeDisabled()
    expect(
      screen.getByText(/Modo demonstração: nenhuma conta real é conectada/),
    ).toBeInTheDocument()
  })

  it('explica a falha quando o ambiente não tem o app da Meta configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://projeto.supabase.test')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-anon-de-teste')
    const usuario = userEvent.setup()
    const irPara = vi.fn()
    render(<Conectar irPara={irPara} />)

    await usuario.click(screen.getByRole('button', { name: 'Autorizar no Facebook' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A conexão com o Instagram não está configurada neste ambiente.',
    )
    expect(irPara).not.toHaveBeenCalled()
  })
})

describe('RetornoDaConexao — a volta do OAuth', () => {
  it('recusa o retorno cujo estado não confere com o desta sessão', async () => {
    comAmbienteDeProducao()
    montarRetorno(`code=${CODIGO_DA_META}&state=${ESTADO_DA_META}`)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('A conexão não foi concluída, e nada foi gravado.')
    expect(alerta).toHaveTextContent(/Este retorno não confere com a conexão iniciada/)
    expect(screen.getByText('O que fazer agora')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para os requisitos' })).toHaveAttribute(
      'href',
      '/conectar',
    )
  })

  it('não trata o cancelamento como erro, e não chama o serviço', async () => {
    comAmbienteDeProducao()
    montarRetorno(
      'error=access_denied&error_reason=user_denied&error_description=Permissions+error',
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Você cancelou a autorização. Nada foi conectado.',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(concluirConexao).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: 'Ver os requisitos e tentar de novo' }),
    ).toBeInTheDocument()
  })

  it('separa permissão negada de cancelamento e diz o que fazer', async () => {
    comAmbienteDeProducao()
    montarRetorno('error=access_denied&error_reason=permissions_error')

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('A autorização voltou sem as permissões necessárias.')
    expect(alerta).toHaveTextContent(/mantendo as quatro permissões marcadas/)
    expect(concluirConexao).not.toHaveBeenCalled()
  })

  it('não finge retorno quando ninguém veio da Meta', async () => {
    comAmbienteDeProducao()
    montarRetorno('')

    expect(
      await screen.findByRole('heading', { name: 'Esta tela é a volta da autorização.' }),
    ).toBeInTheDocument()
    expect(concluirConexao).not.toHaveBeenCalled()
  })

  it('traduz o limite de taxa em espera, e não em culpa do cliente', async () => {
    comAmbienteDeProducao()
    concluirConexao.mockResolvedValueOnce(
      falha(CODIGOS.LIMITE_DE_TAXA, 'A Meta recusou por excesso de chamadas.'),
    )
    montarRetorno(`code=${CODIGO_DA_META}&state=${ESTADO_DA_META}`)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('A Meta recusou por excesso de chamadas.')
    expect(alerta).toHaveTextContent(/Espere alguns minutos e tente de novo/)
  })

  it('confirma a conexão dizendo que o diagnóstico não sai hoje, com a data estimada', async () => {
    comAmbienteDeProducao()
    concluirConexao.mockResolvedValueOnce(
      ok({ id: 'conta-casa-oliveira', username: 'casa.oliveira', status: 'ativa' }),
    )
    montarRetorno(`code=${CODIGO_DA_META}&state=${ESTADO_DA_META}`)

    expect(await screen.findByRole('heading', { name: 'Conta conectada.' })).toBeInTheDocument()
    expect(screen.getByText(/Passamos a acompanhar @casa\.oliveira/)).toBeInTheDocument()
    expect(screen.getByText(/O primeiro diagnóstico não sai hoje/)).toBeInTheDocument()

    const estimada = formatarDataCurta(estimarPrimeiroDiagnostico(new Date().toISOString()))
    expect(
      screen.getByRole('heading', {
        name: `A partir de ${estimada}: o diagnóstico nomeia a causa`,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver minhas contas' })).toHaveAttribute(
      'href',
      '/contas',
    )
  })
})

describe('estimarPrimeiroDiagnostico', () => {
  it('soma à data da conexão o histórico que o ruleset exige, não um número solto', () => {
    // 16 semanas: o mesmo piso de src/rules/requisitos.js que a tela promete.
    // Se o ruleset mudar de janela, este teste muda junto — e é isso que se
    // quer, porque a promessa da tela deixa de poder divergir do motor.
    expect(SEMANAS_ATE_O_DIAGNOSTICO).toBe(SEMANAS_PARA_DIAGNOSTICO)
    expect(estimarPrimeiroDiagnostico('2026-09-05T09:12:00.000Z')).toBe('2026-12-26')
    expect(estimarPrimeiroDiagnostico('2026-09-05')).toBe('2026-12-26')
  })

  it('atravessa a virada do ano sem inventar dia', () => {
    expect(estimarPrimeiroDiagnostico('2026-12-31', 1)).toBe('2027-01-07')
  })

  it('devolve nulo quando não há data de conexão para contar a partir de', () => {
    expect(estimarPrimeiroDiagnostico(null)).toBeNull()
    expect(estimarPrimeiroDiagnostico('ontem')).toBeNull()
  })
})
