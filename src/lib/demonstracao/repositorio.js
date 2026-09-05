/**
 * Repositorio local do modo de demonstracao.
 *
 * Serve a fixture da agencia Estudio Vergara com a **mesma forma** que o
 * Supabase devolveria: linha em snake_case, do jeito que sai do banco. Assim o
 * conversor para camelCase de cada modulo de servico e um so, roda nos dois
 * caminhos, e nao existe regra de negocio duplicada entre demonstracao e
 * producao — a unica diferenca visivel e `meta.origem`.
 *
 * O diagnostico daqui **sai do motor real** rodando o ruleset publicado sobre a
 * serie da fixture. Nao ha veredito escrito a mao em lugar nenhum do produto
 * (ADR-005). Se o motor mudar de opiniao sobre a Casa Oliveira, a demonstracao
 * muda junto — que e exatamente o que se quer de uma tela de venda honesta.
 */

import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
  TENANT,
} from '../../fixtures/estudioVergara.js'
import { montarHistorico } from '../../motor/historico.js'
import { gerarDiagnostico } from '../../motor/motor.js'
import * as moduloDeRegras from '../../rules/index.js'

/**
 * Ruleset publicado (`{ versao, regras }`). contratos.md fixa o conteudo do
 * modulo, nao a forma de exportar; aceitar `default` e exportacao nomeada custa
 * uma linha e evita que a demonstracao quebre por causa dessa escolha.
 */
const RULESET = moduloDeRegras.default ?? moduloDeRegras

/** Usuario da demonstracao. Nao existe autenticacao sem backend. */
const SESSAO = Object.freeze({
  usuarioId: 'demonstracao',
  email: null,
  expiraEm: null,
})

/**
 * Eventos de coleta com id estavel. A fixture nasce sem `id` porque o banco
 * gera; a tela precisa de chave de lista, e chave derivada do conteudo mantem a
 * fixture deterministica.
 */
const EVENTOS = EVENTOS_DE_COLETA.map((evento) => ({
  ...evento,
  id: `${evento.ig_conta_id}:${evento.ocorrido_em}`,
}))

/** @type {Map<string, import('../../motor/historico.js').Historico>} */
const historicosPorConta = new Map()

/** @type {Map<string, object>} */
const diagnosticosPorConta = new Map()

/**
 * Sessao da demonstracao. Existe para a rota protegida abrir sem backend — a
 * tela avisa que e demonstracao por `meta.origem`, nao por aqui.
 *
 * @returns {{ usuarioId: string, email: string|null, expiraEm: string|null }}
 */
export function sessaoDeDemonstracao() {
  return SESSAO
}

/** @returns {object[]} linhas de `tenants` */
export function listarTenants() {
  return [TENANT]
}

/**
 * @param {string} tenantId
 * @returns {object|null} linha de `tenants`, ou `null` se nao existe
 */
export function obterTenant(tenantId) {
  return TENANT.id === tenantId ? TENANT : null
}

/**
 * @param {string} tenantId
 * @returns {object[]} linhas de `ig_contas` do tenant
 */
export function listarContas(tenantId) {
  return CONTAS.filter((conta) => conta.tenant_id === tenantId)
}

/**
 * @param {string} contaId
 * @returns {object|null} linha de `ig_contas`, ou `null` se nao existe
 */
export function obterConta(contaId) {
  return CONTAS.find((conta) => conta.id === contaId) ?? null
}

/**
 * @param {string} contaId
 * @returns {object[]} linhas de `coleta_eventos` da conta, da mais recente para
 *   a mais antiga
 */
export function listarEventos(contaId) {
  return EVENTOS.filter((evento) => evento.ig_conta_id === contaId).sort((a, b) =>
    b.ocorrido_em.localeCompare(a.ocorrido_em),
  )
}

/**
 * Historico canonico da conta, montado pelo mesmo `montarHistorico` que o
 * caminho do Supabase usa. Memoizado: navegar entre telas nao pode recomputar
 * 16 semanas de serie a cada clique.
 *
 * @param {string} contaId
 * @returns {import('../../motor/historico.js').Historico|null}
 */
export function obterHistorico(contaId) {
  const memoizado = historicosPorConta.get(contaId)
  if (memoizado) return memoizado

  const conta = obterConta(contaId)
  if (!conta) return null

  const historico = montarHistorico({
    conta,
    snapshotsConta: SNAPSHOTS_CONTA,
    snapshotsMidia: SNAPSHOTS_MIDIA,
    eventosDeColeta: EVENTOS,
    // O corte e o instante congelado da fixture, e nao o relogio: demonstracao
    // que muda de diagnostico conforme o dia nao serve de teste de regressao.
    ate: AGORA,
  })

  historicosPorConta.set(contaId, historico)
  return historico
}

/**
 * Diagnostico da conta, gerado pelo motor real sobre o ruleset publicado.
 * Memoizado pelo mesmo motivo do historico.
 *
 * @param {string} contaId
 * @returns {object|null} `Diagnostico` de contratos.md, ou `null` se a conta nao existe
 */
export function obterDiagnostico(contaId) {
  const memoizado = diagnosticosPorConta.get(contaId)
  if (memoizado) return memoizado

  const historico = obterHistorico(contaId)
  if (!historico) return null

  const diagnostico = gerarDiagnostico(historico, RULESET, { agora: AGORA })
  diagnosticosPorConta.set(contaId, diagnostico)
  return diagnostico
}
