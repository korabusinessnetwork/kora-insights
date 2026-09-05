/**
 * Conexao da conta profissional do Instagram (ADR-002).
 *
 * Aqui o front faz exatamente duas coisas: monta a URL do dialogo de
 * consentimento e pede a uma Edge Function que conclua o resto. A troca do
 * codigo por token acontece **no servidor** — o front nunca ve token de acesso e
 * nunca ve o app secret, que sequer existe neste bundle (docs/11_SEGURANCA).
 *
 * As permissoes pedidas sao as quatro do ADR-002 e nenhuma a mais. Permissao sem
 * tela que a justifique e causa classica de reprovacao no App Review — e pedir
 * publicacao ou moderacao de comentario a um produto de diagnostico seria pedir
 * poder que o produto nao usa.
 */

import { falha, falhaDeErro, ok } from './envelope.js'
import { CODIGOS, traduzirErroDoSupabase } from './erros.js'
import { estaEmModoDemonstracao, obterCliente } from './supabase.js'
import { ehCodigoDeOAuth, ehEstadoDeOAuth, ehIdentificadorDeConta } from './validacao.js'

/**
 * Permissoes do ADR-002. Congelada: uma permissao a mais aqui e um pedido a mais
 * no App Review, e um poder a mais sobre a conta do cliente.
 * @type {readonly string[]}
 */
export const PERMISSOES = Object.freeze([
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
])

/**
 * Edge Functions desta camada. Nome estavel: mudar um deles e mudanca combinada
 * com `supabase/functions/`.
 */
export const FUNCOES = Object.freeze({
  concluirConexao: 'conexao-meta-concluir',
  desconectarConta: 'conexao-meta-desconectar',
  excluirDados: 'dados-excluir',
})

/** Onde o estado do OAuth espera a volta do usuario. */
const CHAVE_DO_ESTADO = 'kora.conexao-meta.estado'

const MENSAGEM_SEM_CONFIGURACAO =
  'A conexão com o Instagram não está configurada neste ambiente.'

const MENSAGEM_DEMONSTRACAO =
  'Modo demonstração: nenhuma conta real é conectada, desconectada ou excluída aqui.'

/**
 * Rota de retorno do OAuth (contratos.md, secao 6). Sai da origem em execucao
 * quando o ambiente nao fixa outra: endereco de aplicacao hardcodado quebra a
 * cada ambiente novo.
 *
 * @returns {string}
 */
function urlDeRetornoPadrao() {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/conectar/retorno`
}

/**
 * Configuracao da Meta vinda do ambiente, ou `null` se faltar peca.
 *
 * Nem o id do app nem a URL do dialogo tem valor padrao no codigo: o dia em que
 * a Meta mudar a versao do dialogo, quem troca e a variavel de ambiente, nao um
 * literal escondido no meio de um modulo (CLAUDE.md, Seguranca).
 *
 * @returns {{ appId: string, dialogo: string, redirecionamento: string }|null}
 */
function configuracaoDaMeta() {
  const appId = String(import.meta.env?.VITE_META_APP_ID ?? '').trim()
  const dialogo = String(import.meta.env?.VITE_META_OAUTH_URL ?? '').trim()
  const configurado = String(import.meta.env?.VITE_META_REDIRECT_URI ?? '').trim()
  const redirecionamento = configurado || urlDeRetornoPadrao()
  if (!appId || !dialogo || !redirecionamento) return null
  return { appId, dialogo, redirecionamento }
}

/**
 * Estado do OAuth: 128 bits de aleatoriedade criptografica em hexadecimal.
 *
 * Protege contra CSRF. Sem ele, um terceiro monta um retorno de OAuth com o
 * `code` da conta **dele** e induz o cliente a clicar; o navegador do cliente
 * chega ao nosso callback autenticado, e a conta do atacante fica vinculada ao
 * tenant da vitima — que passa a ver diagnostico de um perfil que nao e o seu.
 * O estado so vale se for imprevisivel: `Math.random` nao serve, porque a
 * sequencia dele e reconstruivel a partir de saidas observadas.
 *
 * @returns {string} 32 caracteres hexadecimais
 */
export function gerarEstadoDeOAuth() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Ambiente sem gerador criptográfico: não é seguro iniciar o OAuth.')
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** @param {string} estado */
function guardarEstado(estado) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CHAVE_DO_ESTADO, estado)
  } catch {
    // Navegacao privada pode recusar escrita. A validacao na volta falha e o
    // fluxo recomeca, que e melhor do que aceitar um retorno sem conferencia.
  }
}

/** @returns {string|null} */
function lerEstadoGuardado() {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage.getItem(CHAVE_DO_ESTADO)
  } catch {
    return null
  }
}

function esquecerEstado() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CHAVE_DO_ESTADO)
  } catch {
    // Sem storage nao ha estado guardado para esquecer.
  }
}

/**
 * Le o corpo JSON de um erro de Edge Function, quando ele existe.
 *
 * A funcao responde no mesmo envelope do produto, entao e ali que vem
 * `TOKEN_EXPIRADO` ou `LIMITE_DE_TAXA` — dois estados que so quem fala com a
 * Graph API sabe distinguir, e que virariam `FALHA_INESPERADA` se ignorados.
 *
 * @param {object} error
 * @returns {Promise<object|null>}
 */
async function corpoDoErro(error) {
  try {
    const resposta = error?.context
    if (!resposta || typeof resposta.json !== 'function') return null
    const clone = typeof resposta.clone === 'function' ? resposta.clone() : resposta
    return await clone.json()
  } catch {
    return null
  }
}

/**
 * Chama uma Edge Function e devolve o resultado ja em envelope.
 *
 * @param {string} nome
 * @param {object} corpo
 * @returns {Promise<import('./envelope.js').Envelope>}
 */
async function invocarFuncao(nome, corpo) {
  const cliente = obterCliente()
  if (!cliente) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_DEMONSTRACAO)

  try {
    const { data, error } = await cliente.functions.invoke(nome, { body: corpo })
    if (error) {
      const payload = await corpoDoErro(error)
      return falhaDeErro(traduzirErroDoSupabase(payload?.error ?? error))
    }
    if (data?.error) return falhaDeErro(traduzirErroDoSupabase(data.error))
    return ok(data?.data ?? data ?? null)
  } catch (excecao) {
    return falhaDeErro(traduzirErroDoSupabase(excecao))
  }
}

/**
 * URL do dialogo de consentimento da Meta.
 *
 * Montar a URL e guardar o estado sao o mesmo passo de proposito: estado emitido
 * sem ser guardado nao tem com o que ser comparado na volta, e a protecao contra
 * CSRF vira teatro.
 *
 * @param {string} [estado] estado proprio; sem ele, um e gerado aqui
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `{ url, estado, permissoes }`
 */
export async function urlDeConsentimento(estado) {
  const configuracao = configuracaoDaMeta()
  if (!configuracao) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_SEM_CONFIGURACAO)

  try {
    const escolhido = estado ?? gerarEstadoDeOAuth()
    if (!ehEstadoDeOAuth(escolhido)) {
      return falha(CODIGOS.ENTRADA_INVALIDA, 'Estado de conexão inválido.')
    }

    const url = new URL(configuracao.dialogo)
    url.searchParams.set('client_id', configuracao.appId)
    url.searchParams.set('redirect_uri', configuracao.redirecionamento)
    url.searchParams.set('state', escolhido)
    url.searchParams.set('scope', PERMISSOES.join(','))
    url.searchParams.set('response_type', 'code')

    guardarEstado(escolhido)
    return ok({ url: url.toString(), estado: escolhido, permissoes: [...PERMISSOES] })
  } catch (excecao) {
    return falhaDeErro(traduzirErroDoSupabase(excecao))
  }
}

/**
 * Conclui a conexao com o codigo devolvido pela Meta.
 *
 * O `code` sai daqui direto para a Edge Function, que e quem tem o app secret e
 * quem grava o token no Vault. Nada de token entra no envelope de volta.
 *
 * @param {string} codigo `code` do retorno do OAuth
 * @param {string} estado `state` do retorno do OAuth
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: a conta conectada
 */
export async function concluirConexao(codigo, estado) {
  if (!ehCodigoDeOAuth(codigo)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'O retorno da Meta veio sem um código válido.')
  }
  if (!ehEstadoDeOAuth(estado)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'O retorno da Meta veio sem um estado válido.')
  }
  const guardado = lerEstadoGuardado()
  // Estado e de uso unico: consumido aqui, um retorno repetido (por historico do
  // navegador ou por link reenviado) nao conclui conexao de novo.
  esquecerEstado()
  // A conferencia vem antes de qualquer outra decisao, inclusive antes de olhar
  // o modo: retorno que nao confere e recusado em todo ambiente, sem excecao.
  if (!guardado || guardado !== estado) {
    return falha(
      CODIGOS.ENTRADA_INVALIDA,
      'Este retorno não confere com a conexão iniciada neste navegador. Comece de novo.',
    )
  }

  if (estaEmModoDemonstracao()) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_DEMONSTRACAO)

  const configuracao = configuracaoDaMeta()
  if (!configuracao) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_SEM_CONFIGURACAO)

  // A Meta exige o mesmo `redirect_uri` da ida na troca do codigo por token, e
  // quem faz a troca e o servidor: por isso ele viaja no corpo.
  return invocarFuncao(FUNCOES.concluirConexao, {
    codigo,
    redirecionamento: configuracao.redirecionamento,
  })
}

/**
 * Desconecta a conta: apaga o token do Vault e interrompe a coleta
 * (docs/11_SEGURANCA, LGPD). O historico ja coletado nao e apagado aqui — para
 * isso existe `solicitarExclusaoDeDados`.
 *
 * @param {string} contaId
 * @returns {Promise<import('./envelope.js').Envelope>}
 */
export async function desconectarConta(contaId) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }
  if (estaEmModoDemonstracao()) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_DEMONSTRACAO)
  return invocarFuncao(FUNCOES.desconectarConta, { contaId })
}

/**
 * Pede a exclusao dos dados coletados de uma conta.
 *
 * Existe porque o App Review exige fluxo de exclusao documentado e acessivel, e
 * porque a LGPD exige o mesmo por conta propria (docs/11_SEGURANCA). A exclusao
 * roda no servidor e devolve um protocolo: sem comprovante, o cliente nao tem
 * como demonstrar que pediu.
 *
 * @param {string} contaId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `{ protocolo, solicitadoEm }`
 */
export async function solicitarExclusaoDeDados(contaId) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }
  if (estaEmModoDemonstracao()) return falha(CODIGOS.FALHA_INESPERADA, MENSAGEM_DEMONSTRACAO)
  return invocarFuncao(FUNCOES.excluirDados, { contaId })
}
