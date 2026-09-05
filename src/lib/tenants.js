/**
 * Tenants do usuario autenticado.
 *
 * Tenant e a agencia ou a marca assinante. Todo acesso do produto deriva daqui:
 * a RLS resolve o isolamento pelo vinculo em `tenant_membros`, e nao por filtro
 * escrito no front — filtro de front esquecido e vazamento entre clientes.
 */

import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS, MENSAGENS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase } from './supabase.js'
import { ehIdentificadorDeTenant } from './validacao.js'
import { exigirSessao } from './autenticacao.js'
import * as demonstracao from './demonstracao/repositorio.js'

/**
 * Campos explicitos (CLAUDE.md: nenhum `select *`).
 *
 * `identidade` guarda os tokens de marca do white-label (src/tema). A coluna
 * ainda nao existe em `supabase/schema.sql` — ver nota de conflito no README
 * desta pasta.
 */
const CAMPOS = 'id, nome, plan, status, criado_em, identidade'

/**
 * @typedef {object} Tenant
 * @property {string} id
 * @property {string} nome
 * @property {string} plano
 * @property {string} status
 * @property {string} criadoEm ISO
 * @property {Record<string, string>|null} identidade tokens de marca do tenant
 */

/**
 * Linha do banco para o objeto que a tela consome. O banco guarda snake_case (e
 * `plan`, em ingles, herdado do vocabulario de billing); a tela consome
 * camelCase e nome de dominio em portugues.
 *
 * @param {object} linha
 * @returns {Tenant}
 */
export function converterTenant(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    plano: linha.plan,
    status: linha.status,
    criadoEm: linha.criado_em,
    identidade: linha.identidade ?? null,
  }
}

/**
 * Tenants a que o usuario autenticado pertence.
 *
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Tenant[]`
 */
export async function listarTenantsDoUsuario() {
  if (estaEmModoDemonstracao()) {
    return ok(demonstracao.listarTenants().map(converterTenant), { origem: ORIGEM_DEMONSTRACAO })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  // A consulta parte de `tenant_membros` de proposito: e o vinculo que a RLS
  // enxerga, entao a lista nasce ja restrita ao usuario, sem filtro nosso.
  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente.from('tenant_membros').select(`papel, tenant:tenants!inner(${CAMPOS})`),
  )
  if (erro) return falhaDeErro(erro)

  const tenants = (data ?? [])
    .map((linha) => linha.tenant)
    .filter(Boolean)
    .map(converterTenant)
  return ok(tenants)
}

/**
 * Um tenant pelo id.
 *
 * @param {string} tenantId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Tenant`
 */
export async function obterTenant(tenantId) {
  if (!ehIdentificadorDeTenant(tenantId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de espaço de trabalho inválido.')
  }

  if (estaEmModoDemonstracao()) {
    const linha = demonstracao.obterTenant(tenantId)
    if (!linha) return falha(CODIGOS.NAO_ENCONTRADO, MENSAGENS[CODIGOS.NAO_ENCONTRADO])
    return ok(converterTenant(linha), { origem: ORIGEM_DEMONSTRACAO })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente.from('tenants').select(CAMPOS).eq('id', tenantId).maybeSingle(),
  )
  if (erro) return falhaDeErro(erro)
  // Leitura negada por RLS volta vazia, nunca como erro. Id de tenant e uuid
  // opaco: ninguem acerta um por acaso, entao ausencia aqui significa "existe e
  // nao e seu" com muito mais frequencia do que "nao existe" — e dizer
  // NAO_ENCONTRADO mandaria o usuario procurar um registro que ele nao pode ver.
  if (!data) return falha(CODIGOS.SEM_PERMISSAO, MENSAGENS[CODIGOS.SEM_PERMISSAO])
  return ok(converterTenant(data))
}
