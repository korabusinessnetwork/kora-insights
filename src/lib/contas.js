/**
 * Contas de Instagram conectadas a um tenant.
 *
 * `token_ref` nunca aparece na lista de campos deste modulo, e nao ha campo
 * derivado dele: a referencia ao Vault e assunto exclusivo da Edge Function
 * (docs/11_SEGURANCA, "Front"). Coluna que nao e pedida nao pode ser vazada.
 */

import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS, MENSAGENS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase } from './supabase.js'
import { ehIdentificadorDeConta, ehIdentificadorDeTenant } from './validacao.js'
import { exigirSessao } from './autenticacao.js'
import * as demonstracao from './demonstracao/repositorio.js'

/**
 * Campos explicitos (CLAUDE.md: nenhum `select *`). E exatamente a lista do
 * `grant select (...) on public.ig_contas` do schema: `token_ref` esta fora, e
 * essa ausencia e a regra, nao esquecimento. Pedir uma coluna a mais aqui nao
 * vazaria o cofre — o banco recusaria a consulta inteira.
 */
const CAMPOS =
  'id, tenant_id, ig_user_id, username, nome, fb_page_id, status, conectada_em, ' +
  'token_expira_em, tem_trafego_pago'

/**
 * @typedef {object} Conta
 * @property {string} id
 * @property {string} tenantId
 * @property {string} igUserId
 * @property {string} username
 * @property {string} nome
 * @property {string|null} fbPageId Pagina do Facebook vinculada (ADR-002)
 * @property {string} status `ativa`, `pausada`, `token_expirado`, `desconectada`
 * @property {string} conectadaEm ISO
 * @property {string|null} tokenExpiraEm ISO
 * @property {boolean} temTrafegoPago
 */

/**
 * @param {object} linha linha de `ig_contas`
 * @returns {Conta}
 */
export function converterConta(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    igUserId: linha.ig_user_id,
    username: linha.username,
    // Sem nome cadastrado a tela ainda precisa chamar a conta de alguma coisa, e
    // o @ e o que o cliente reconhece.
    nome: linha.nome ?? linha.username,
    fbPageId: linha.fb_page_id ?? null,
    // A coleta so roda em `ativa` (schema.sql). A tela precisa deste campo para
    // dizer que a conta parou de coletar em vez de mostrar diagnostico velho
    // como se fosse de ontem. A coluna e `not null` no banco: o padrao aqui
    // cobre so a fixture da demonstracao, onde toda conta esta conectada.
    status: linha.status ?? 'ativa',
    conectadaEm: linha.conectada_em,
    tokenExpiraEm: linha.token_expira_em ?? null,
    temTrafegoPago: Boolean(linha.tem_trafego_pago),
  }
}

/**
 * Contas conectadas de um tenant.
 *
 * @param {string} tenantId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Conta[]`
 */
export async function listarContasConectadas(tenantId) {
  if (!ehIdentificadorDeTenant(tenantId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de espaço de trabalho inválido.')
  }

  if (estaEmModoDemonstracao()) {
    return ok(demonstracao.listarContas(tenantId).map(converterConta), {
      origem: ORIGEM_DEMONSTRACAO,
    })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente
      .from('ig_contas')
      .select(CAMPOS)
      .eq('tenant_id', tenantId)
      .order('conectada_em', { ascending: true }),
  )
  if (erro) return falhaDeErro(erro)
  return ok((data ?? []).map(converterConta))
}

/**
 * Uma conta pelo id.
 *
 * @param {string} contaId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Conta`
 */
export async function obterConta(contaId) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }

  if (estaEmModoDemonstracao()) {
    const linha = demonstracao.obterConta(contaId)
    // Na demonstracao o universo de contas e conhecido, entao da para afirmar
    // que nao existe. No Supabase nao da: a RLS esconde sem avisar.
    if (!linha) return falha(CODIGOS.NAO_ENCONTRADO, MENSAGENS[CODIGOS.NAO_ENCONTRADO])
    return ok(converterConta(linha), { origem: ORIGEM_DEMONSTRACAO })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente.from('ig_contas').select(CAMPOS).eq('id', contaId).maybeSingle(),
  )
  if (erro) return falhaDeErro(erro)
  if (!data) return falha(CODIGOS.SEM_PERMISSAO, MENSAGENS[CODIGOS.SEM_PERMISSAO])
  return ok(converterConta(data))
}

/**
 * A conta e visivel para o usuario autenticado?
 *
 * Peca interna da camada (nao esta na tabela de contratos.md, secao 4). Existe
 * para separar dois silencios que a RLS produz identicos: "esta conta nao e sua"
 * e "esta conta e sua e ainda nao tem diagnostico". Sem essa checagem, quem
 * abrisse o id de outro tenant veria a tela de vazio e concluiria que o produto
 * nunca coletou nada — e quem tem conta recem-conectada veria "sem permissao".
 *
 * A consulta pede so o id: e a menor leitura possivel que responde a pergunta.
 *
 * @param {string} contaId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `boolean`
 */
export async function contaEstaVisivel(contaId) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }

  if (estaEmModoDemonstracao()) {
    return ok(demonstracao.obterConta(contaId) !== null, { origem: ORIGEM_DEMONSTRACAO })
  }

  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente.from('ig_contas').select('id').eq('id', contaId).maybeSingle(),
  )
  if (erro) return falhaDeErro(erro)
  return ok(Boolean(data))
}

/**
 * Traduz a ausencia de um registro no codigo certo, consultando a visibilidade
 * da conta dona.
 *
 * @param {string} contaId
 * @param {{ codigo?: string, mensagem: string }} quandoExiste resposta para o
 *   caso em que a conta e visivel e o registro e que falta
 * @returns {Promise<import('./envelope.js').Envelope>} sempre um envelope de falha
 */
export async function falhaPorAusencia(contaId, quandoExiste) {
  const visivel = await contaEstaVisivel(contaId)
  if (visivel.error) return visivel
  if (visivel.data) {
    return falha(quandoExiste.codigo ?? CODIGOS.NAO_ENCONTRADO, quandoExiste.mensagem)
  }
  // Na demonstracao o universo e conhecido e a resposta honesta e "nao existe".
  // No Supabase a RLS esconde sem avisar, e "nao encontrado" mandaria o usuario
  // procurar por um registro que existe e nao e dele.
  if (estaEmModoDemonstracao()) {
    return falha(CODIGOS.NAO_ENCONTRADO, 'Não encontramos esta conta.')
  }
  return falha(CODIGOS.SEM_PERMISSAO, MENSAGENS[CODIGOS.SEM_PERMISSAO])
}
