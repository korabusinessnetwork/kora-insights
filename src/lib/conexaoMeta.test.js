/**
 * O que este arquivo protege e o pedido de permissao e a protecao contra CSRF.
 *
 * Permissao a mais na URL e permissao a mais no App Review, e poder a mais sobre
 * a conta do cliente — por isso o `scope` e comparado caractere a caractere, e
 * nao por "contem". Estado que nao confere e retorno recusado: sem isso, um
 * terceiro induz o cliente a concluir um OAuth com o `code` da conta dele.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  concluirConexao,
  desconectarConta,
  gerarEstadoDeOAuth,
  PERMISSOES,
  solicitarExclusaoDeDados,
  urlDeConsentimento,
} from './conexaoMeta.js'
import { CODIGOS } from './erros.js'

/** As quatro permissoes do ADR-002, na ordem em que o scope as declara. */
const PERMISSOES_DO_ADR = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
]

/** Permissoes que o produto nao pede: nao ha tela que as justifique (ADR-002). */
const PERMISSOES_PROIBIDAS = [
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'business_management',
  'ads_read',
]

const DIALOGO = 'https://www.facebook.test/v23.0/dialog/oauth'
const RETORNO = 'https://app.kora.test/conectar/retorno'

const CODIGO_DA_META = 'AQBv-2iL_9xK.abcDEF12345'

/** Ambiente do app da Meta. Valores de teste; o app secret não existe no front. */
function comMetaConfigurada() {
  vi.stubEnv('VITE_META_APP_ID', '1234567890')
  vi.stubEnv('VITE_META_OAUTH_URL', DIALOGO)
  vi.stubEnv('VITE_META_REDIRECT_URI', RETORNO)
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  sessionStorage.clear()
})

describe('PERMISSOES', () => {
  it('é exatamente a lista do ADR-002', () => {
    expect([...PERMISSOES]).toEqual(PERMISSOES_DO_ADR)
  })

  it('é congelada: permissão não entra por descuido em tempo de execução', () => {
    expect(Object.isFrozen(PERMISSOES)).toBe(true)
  })
})

describe('gerarEstadoDeOAuth', () => {
  it('produz 128 bits em hexadecimal', () => {
    expect(gerarEstadoDeOAuth()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('não repete: estado previsível não protege contra nada', () => {
    const emitidos = new Set(Array.from({ length: 50 }, () => gerarEstadoDeOAuth()))

    expect(emitidos.size).toBe(50)
  })
})

describe('urlDeConsentimento', () => {
  beforeEach(() => {
    comMetaConfigurada()
  })

  it('pede as quatro permissões do ADR-002 e nenhuma a mais', async () => {
    const { data } = await urlDeConsentimento()
    const scope = new URL(data.url).searchParams.get('scope')

    expect(scope).toBe(PERMISSOES_DO_ADR.join(','))
    expect(scope.split(',')).toHaveLength(4)
    expect(data.permissoes).toEqual(PERMISSOES_DO_ADR)
  })

  it.each(PERMISSOES_PROIBIDAS)('não pede %s', async (permissao) => {
    const { data } = await urlDeConsentimento()

    expect(data.url).not.toContain(permissao)
  })

  it('monta o diálogo com app id, retorno, estado e response_type', async () => {
    const { data, error } = await urlDeConsentimento()
    const url = new URL(data.url)

    expect(error).toBeNull()
    expect(`${url.origin}${url.pathname}`).toBe(DIALOGO)
    expect(url.searchParams.get('client_id')).toBe('1234567890')
    expect(url.searchParams.get('redirect_uri')).toBe(RETORNO)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('não leva nenhum parâmetro além dos cinco previstos', async () => {
    const { data } = await urlDeConsentimento()
    const parametros = [...new URL(data.url).searchParams.keys()].sort()

    // A troca do codigo por token e do servidor: segredo nenhum atravessa a URL.
    expect(parametros).toEqual(['client_id', 'redirect_uri', 'response_type', 'scope', 'state'])
    expect(data.url.toLowerCase()).not.toContain('secret')
  })

  it('guarda o estado para conferir na volta', async () => {
    const { data } = await urlDeConsentimento()

    expect(sessionStorage.getItem('kora.conexao-meta.estado')).toBe(data.estado)
  })

  it('aceita estado escolhido por quem chamou', async () => {
    const meu = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

    const { data } = await urlDeConsentimento(meu)

    expect(data.estado).toBe(meu)
    expect(new URL(data.url).searchParams.get('state')).toBe(meu)
  })

  it('recusa estado fora do formato em vez de emitir URL fraca', async () => {
    const { data, error } = await urlDeConsentimento('estado-curto')

    expect(data).toBeNull()
    expect(error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
  })

  it('usa a origem em execução quando o ambiente não fixa o retorno', async () => {
    vi.stubEnv('VITE_META_REDIRECT_URI', '')

    const { data } = await urlDeConsentimento()

    expect(new URL(data.url).searchParams.get('redirect_uri')).toBe(
      `${window.location.origin}/conectar/retorno`,
    )
  })

  it('falha sem app id em vez de montar URL que a Meta recusaria', async () => {
    vi.stubEnv('VITE_META_APP_ID', '')

    const { data, error } = await urlDeConsentimento()

    expect(data).toBeNull()
    expect(error.codigo).toBe(CODIGOS.FALHA_INESPERADA)
    expect(error.mensagem).toContain('não está configurada')
  })

  it('falha sem a URL do diálogo: endereço da Meta não é literal no código', async () => {
    vi.stubEnv('VITE_META_OAUTH_URL', '')

    const { error } = await urlDeConsentimento()

    expect(error.codigo).toBe(CODIGOS.FALHA_INESPERADA)
  })
})

describe('concluirConexao', () => {
  beforeEach(() => {
    comMetaConfigurada()
  })

  it('recusa retorno cujo estado não confere com o desta aba', async () => {
    await urlDeConsentimento()

    const { data, error } = await concluirConexao(CODIGO_DA_META, 'f'.repeat(32))

    expect(data).toBeNull()
    expect(error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
    expect(error.mensagem).toContain('Comece de novo')
  })

  it('recusa retorno sem nenhuma conexão iniciada neste navegador', async () => {
    const { error } = await concluirConexao(CODIGO_DA_META, 'a'.repeat(32))

    expect(error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
  })

  it('consome o estado: retorno repetido não conclui conexão de novo', async () => {
    const { data } = await urlDeConsentimento()

    await concluirConexao(CODIGO_DA_META, data.estado)
    const segunda = await concluirConexao(CODIGO_DA_META, data.estado)

    expect(sessionStorage.getItem('kora.conexao-meta.estado')).toBeNull()
    expect(segunda.error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
  })

  it('recusa código fora de formato antes de olhar o estado', async () => {
    await urlDeConsentimento()

    const { error } = await concluirConexao('não é código', 'a'.repeat(32))

    expect(error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
    // O estado sobrevive: retorno malformado nao gasta a conexao em andamento.
    expect(sessionStorage.getItem('kora.conexao-meta.estado')).not.toBeNull()
  })

  it('não conclui conexão real no modo demonstração, mesmo com estado válido', async () => {
    const { data } = await urlDeConsentimento()

    const resposta = await concluirConexao(CODIGO_DA_META, data.estado)

    expect(resposta.data).toBeNull()
    expect(resposta.error.mensagem).toContain('demonstração')
  })
})

describe('desconectarConta e solicitarExclusaoDeDados', () => {
  it.each([
    ['desconectarConta', desconectarConta],
    ['solicitarExclusaoDeDados', solicitarExclusaoDeDados],
  ])('%s recusa identificador inválido antes de chamar o servidor', async (_nome, funcao) => {
    const { data, error } = await funcao('conta,tenant_id.eq.outro')

    expect(data).toBeNull()
    expect(error.codigo).toBe(CODIGOS.ENTRADA_INVALIDA)
  })

  it.each([
    ['desconectarConta', desconectarConta],
    ['solicitarExclusaoDeDados', solicitarExclusaoDeDados],
  ])('%s avisa que a demonstração não mexe em conta real', async (_nome, funcao) => {
    const { error } = await funcao('conta-casa-oliveira')

    expect(error.mensagem).toContain('demonstração')
  })
})
