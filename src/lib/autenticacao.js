/**
 * Sessao do usuario do Kora Insights.
 *
 * Nao confunda com a autorizacao da Meta: aqui e o login de quem usa o produto
 * (link magico por e-mail, sem senha para vazar). O token do Instagram nunca
 * passa por esta camada — ele vive no Vault e so a Edge Function o le
 * (docs/11_SEGURANCA).
 */

import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS, MENSAGENS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase, obterCliente } from './supabase.js'
import { ehEmail } from './validacao.js'
import { sessaoDeDemonstracao } from './demonstracao/repositorio.js'

/**
 * @typedef {object} Sessao
 * @property {string} usuarioId
 * @property {string|null} email
 * @property {string|null} expiraEm ISO
 */

/**
 * Converte a sessao do Supabase para a forma que a tela consome.
 *
 * A conversao existe para que nenhum campo a mais escape: o objeto do Supabase
 * carrega `access_token` e `refresh_token`, e o que sai daqui nao pode carregar.
 *
 * @param {object|null|undefined} sessao
 * @returns {Sessao|null}
 */
function converterSessao(sessao) {
  if (!sessao?.user) return null
  return {
    usuarioId: sessao.user.id,
    email: sessao.user.email ?? null,
    expiraEm: sessao.expires_at ? new Date(sessao.expires_at * 1000).toISOString() : null,
  }
}

/**
 * URL para onde o link do e-mail devolve o usuario. Sai da origem em execucao, e
 * nao de configuracao: endereco de aplicacao hardcodado quebra em cada ambiente
 * novo, e a rota `/entrar` e do contrato de rotas (contratos.md, secao 6).
 *
 * @returns {string|undefined}
 */
function urlDeRetornoDoLogin() {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}/entrar`
}

/**
 * Sessao atual, ou `data: null` quando nao ha ninguem autenticado.
 *
 * Ausencia de sessao nao e erro: e o estado normal de quem acabou de abrir a
 * tela de entrada. `SEM_SESSAO` fica para quem exigia sessao (`exigirSessao`).
 *
 * @returns {Promise<import('./envelope.js').Envelope>}
 */
export async function sessaoAtual() {
  if (estaEmModoDemonstracao()) {
    return ok(sessaoDeDemonstracao(), { origem: ORIGEM_DEMONSTRACAO })
  }

  const { data, erro } = await executarNoSupabase((cliente) => cliente.auth.getSession())
  if (erro) return falhaDeErro(erro)
  return ok(converterSessao(data?.session))
}

/**
 * Exige sessao antes de tocar o banco. Sem isso, uma leitura sem sessao voltaria
 * como conjunto vazio (a RLS nao devolve erro em leitura) e a tela mostraria
 * "nenhuma conta conectada" para quem so precisava entrar de novo.
 *
 * @returns {Promise<import('./envelope.js').Envelope>} envelope com a sessao
 */
export async function exigirSessao() {
  const envelope = await sessaoAtual()
  if (envelope.error) return envelope
  if (!envelope.data) return falha(CODIGOS.SEM_SESSAO, MENSAGENS[CODIGOS.SEM_SESSAO])
  return envelope
}

/**
 * Envia o link de acesso por e-mail (OTP, sem senha).
 *
 * @param {string} email
 * @returns {Promise<import('./envelope.js').Envelope>} `data.enviado` em sucesso
 */
export async function entrarComEmail(email) {
  if (!ehEmail(email)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Informe um e-mail válido para receber o link.')
  }
  if (estaEmModoDemonstracao()) {
    return falha(
      CODIGOS.FALHA_INESPERADA,
      'Modo demonstração: não há envio de link de acesso neste ambiente.',
    )
  }

  const limpo = email.trim().toLowerCase()
  const { erro } = await executarNoSupabase((cliente) =>
    cliente.auth.signInWithOtp({
      email: limpo,
      options: { emailRedirectTo: urlDeRetornoDoLogin() },
    }),
  )
  if (erro) return falhaDeErro(erro)
  // O e-mail nao volta no envelope: ele ja e do usuario e repeti-lo em resposta
  // so aumenta a chance de acabar em log de terceiro.
  return ok({ enviado: true })
}

/**
 * Encerra a sessao local.
 * @returns {Promise<import('./envelope.js').Envelope>}
 */
export async function sair() {
  if (estaEmModoDemonstracao()) {
    return ok({ encerrada: true }, { origem: ORIGEM_DEMONSTRACAO })
  }

  const { erro } = await executarNoSupabase(async (cliente) => {
    const { error } = await cliente.auth.signOut()
    return { data: null, error }
  })
  if (erro) return falhaDeErro(erro)
  return ok({ encerrada: true })
}

/**
 * Observa mudanca de sessao (login em outra aba, expiracao, logout).
 *
 * Unica funcao da camada que **nao** devolve `Promise<Envelope>`: assinatura nao
 * e resposta, e o que quem observa precisa de volta e o cancelamento, para o
 * `useEffect` desmontar limpo. O envelope continua existindo — ele chega no
 * callback, a cada mudanca.
 *
 * @param {(envelope: import('./envelope.js').Envelope) => void} cb
 * @returns {() => void} cancela a observacao
 */
export function aoMudarSessao(cb) {
  if (estaEmModoDemonstracao()) {
    cb(ok(sessaoDeDemonstracao(), { origem: ORIGEM_DEMONSTRACAO }))
    return () => {}
  }

  const cliente = obterCliente()
  if (!cliente) return () => {}

  const { data } = cliente.auth.onAuthStateChange((_evento, sessao) => {
    cb(ok(converterSessao(sessao)))
  })
  return () => data?.subscription?.unsubscribe()
}
