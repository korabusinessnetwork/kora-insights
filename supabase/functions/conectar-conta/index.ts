/**
 * Conclui a conexao de uma conta profissional do Instagram (ADR-002).
 *
 * O front manda o `code` do OAuth e nada mais. A troca por token de longa
 * duracao acontece aqui, com o app secret que so existe no servidor, e o token
 * vai direto para o Vault: ele nao volta na resposta, nao entra em log e nao
 * viaja em URL (memory/restrictions.md, docs/11_SEGURANCA).
 *
 * O que volta para a tela e a conta conectada, com os mesmos campos que
 * `src/lib/contas.js` le — `token_ref` fora da lista, como sempre.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  descobrirContaProfissional,
  ErroDaGraph,
  OrcamentoDeChamadas,
  trocarCodigoPorTokenLongo,
} from '../_compartilhado/graphApi.ts'
import {
  CODIGOS,
  type Codigo,
  lerCorpo,
  registrar,
  responderFalha,
  responderOk,
} from '../_compartilhado/respostas.ts'

/** Campos devolvidos para a tela. Iguais aos de `src/lib/contas.js`. */
const CAMPOS_DA_CONTA =
  'id, tenant_id, ig_user_id, username, nome, fb_page_id, status, conectada_em, ' +
  'token_expira_em, tem_trafego_pago'

/** Formato do `code` da Meta: opaco, mas nunca com espaco nem caractere de controle. */
const CODIGO_DE_OAUTH = /^[A-Za-z0-9._\-#]{20,512}$/

/**
 * Enderecos de retorno aceitos. A `redirect_uri` chega do navegador e precisa
 * ser conferida contra uma lista do ambiente: sem isso, o servidor assinaria a
 * troca de codigo apontando para o endereco que o atacante escolhesse.
 */
const REDIRECIONAMENTOS_PERMITIDOS = (Deno.env.get('KORA_REDIRECIONAMENTOS_PERMITIDOS') ?? '')
  .split(',')
  .map((endereco) => endereco.trim())
  .filter((endereco) => endereco.length > 0)

const MENSAGEM_SEM_PAGINA =
  'Não encontramos uma conta profissional do Instagram vinculada a uma Página do Facebook ' +
  'que você administra. Vincule a conta à Página e tente de novo.'

/**
 * Usuario autenticado da requisicao.
 *
 * A validacao do JWT e feita pelo proprio Supabase Auth, com a chave anon e o
 * cabecalho que o navegador mandou — nunca decodificando o token na mao.
 *
 * @param requisicao requisicao HTTP
 * @returns id do usuario, ou null se nao ha sessao valida
 */
async function usuarioDaRequisicao(requisicao: Request): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const autorizacao = requisicao.headers.get('Authorization') ?? ''
  if (url.length === 0 || anon.length === 0 || autorizacao.length === 0) return null

  const cliente = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false },
  })
  const { data, error } = await cliente.auth.getUser()
  if (error || !data?.user) return null
  return data.user.id
}

/**
 * Escolhe o tenant em que a conta sera conectada.
 *
 * @param cliente cliente com service_role
 * @param userId usuario autenticado
 * @param pedido tenant pedido pelo front, quando houver
 * @returns id do tenant, ou null se o usuario nao pode usar esse tenant
 */
async function tenantDoUsuario(
  cliente: SupabaseClient,
  userId: string,
  pedido: string | null,
): Promise<string | null> {
  const { data, error } = await cliente
    .from('tenant_membros')
    .select('tenant_id')
    .eq('user_id', userId)
  if (error || !data || data.length === 0) return null

  const tenants = data.map((linha) => String(linha.tenant_id))
  if (pedido) return tenants.includes(pedido) ? pedido : null
  // Sem tenant pedido, so da para decidir quando ha um so: escolher por conta
  // propria entre varios conectaria a conta do cliente no espaco errado.
  return tenants.length === 1 ? tenants[0] : null
}

Deno.serve(async (requisicao: Request) => {
  const origem = requisicao.headers.get('Origin')
  if (requisicao.method === 'OPTIONS') return responderOk(null, origem)

  const userId = await usuarioDaRequisicao(requisicao)
  if (!userId) return responderFalha(CODIGOS.SEM_SESSAO, null, origem)

  const corpo = await lerCorpo(requisicao)
  const codigo = typeof corpo.codigo === 'string' ? corpo.codigo : ''
  const redirecionamento = typeof corpo.redirecionamento === 'string' ? corpo.redirecionamento : ''
  const tenantPedido = typeof corpo.tenantId === 'string' ? corpo.tenantId : null

  if (!CODIGO_DE_OAUTH.test(codigo)) {
    return responderFalha(CODIGOS.ENTRADA_INVALIDA, 'O retorno da Meta veio sem um código válido.', origem)
  }
  if (!REDIRECIONAMENTOS_PERMITIDOS.includes(redirecionamento)) {
    return responderFalha(
      CODIGOS.ENTRADA_INVALIDA,
      'Este endereço de retorno não está autorizado neste ambiente.',
      origem,
    )
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (url.length === 0 || chave.length === 0) {
    return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  }
  const cliente = createClient(url, chave, { auth: { persistSession: false } })

  const tenantId = await tenantDoUsuario(cliente, userId, tenantPedido)
  if (!tenantId) {
    return responderFalha(
      CODIGOS.SEM_PERMISSAO,
      'Escolha o espaço de trabalho em que a conta será conectada.',
      origem,
    )
  }

  try {
    const orcamento = new OrcamentoDeChamadas()
    const { token, expiraEm } = await trocarCodigoPorTokenLongo(codigo, redirecionamento)
    const perfil = await descobrirContaProfissional(token, orcamento)
    if (!perfil) return responderFalha(CODIGOS.ENTRADA_INVALIDA, MENSAGEM_SEM_PAGINA, origem)

    // A mesma conta do Instagram nao pode ser sequestrada por outro tenant: sem
    // esta checagem, um `upsert` por `ig_user_id` moveria a conta (e o historico
    // inteiro dela) para quem conectasse por ultimo.
    const { data: existente } = await cliente
      .from('ig_contas')
      .select('id, tenant_id, token_ref')
      .eq('ig_user_id', perfil.igUserId)
      .maybeSingle()
    if (existente && String(existente.tenant_id) !== tenantId) {
      return responderFalha(
        CODIGOS.SEM_PERMISSAO,
        'Esta conta do Instagram já está conectada em outro espaço de trabalho.',
        origem,
      )
    }

    // O token vai para o cofre antes de a linha existir: linha apontando para
    // referencia vazia produziria uma conta "conectada" que nunca coleta.
    const { data: referencia, error: erroDoCofre } = await cliente.rpc('guardar_token', {
      p_nome: `ig_conta_${perfil.igUserId}`,
      p_token: token,
    })
    if (erroDoCofre || !referencia) {
      return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
    }

    const linha = {
      tenant_id: tenantId,
      ig_user_id: perfil.igUserId,
      username: perfil.username,
      nome: perfil.nome,
      fb_page_id: perfil.fbPageId,
      token_ref: String(referencia),
      token_expira_em: expiraEm,
      status: 'ativa',
    }

    const { data: conta, error: erroDaConta } = existente
      ? await cliente
          .from('ig_contas')
          .update(linha)
          .eq('id', existente.id)
          .select(CAMPOS_DA_CONTA)
          .single()
      : await cliente.from('ig_contas').insert(linha).select(CAMPOS_DA_CONTA).single()

    if (erroDaConta || !conta) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)

    // Log sem token, sem `code` e sem referencia do cofre: so o que serve para
    // responder "a conexao funcionou?" no suporte.
    registrar('conexao.concluida', { tenant: tenantId, conta: conta.id, reconexao: Boolean(existente) })
    return responderOk(conta, origem)
  } catch (erro) {
    if (erro instanceof ErroDaGraph) {
      const codigoDoErro: Codigo = erro.codigo
      registrar('conexao.recusada', { tenant: tenantId, codigo: codigoDoErro })
      return responderFalha(codigoDoErro, null, origem)
    }
    registrar('conexao.falhou', { tenant: tenantId })
    return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  }
})
