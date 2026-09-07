/**
 * Desconexao de uma conta: para a coleta e devolve o token, sem apagar nada.
 *
 * Existe para separar duas coisas que a tela tratava como uma so. Ate aqui, o
 * unico caminho oferecido ao cliente era a exclusao — irreversivel — entao quem
 * so queria parar de coletar (contrato de agencia encerrado, conta em reforma,
 * cliente que saiu) precisava apagar meses de historico para conseguir isso.
 *
 * | | Desconectar | Excluir |
 * |---|---|---|
 * | Token no Vault | apagado | apagado |
 * | Coleta | para | para |
 * | Historico ja coletado | **preservado** | apagado |
 * | Linha em `ig_contas` | mantida, `status = 'desconectada'` | apagada |
 * | Comprovante | nenhum | protocolo |
 *
 * O token some do cofre nos dois casos, e isso e o ponto: desconectar sem tirar
 * o token deixaria uma autorizacao viva para uma conta que o cliente pediu para
 * soltar. Reconectar depois passa pelo dialogo da Meta de novo e escreve uma
 * `token_ref` nova, entao nada aqui e caminho sem volta — o que se perde e a
 * autorizacao, nao o historico.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  CODIGOS,
  lerCorpo,
  registrar,
  responderFalha,
  responderOk,
} from '../_compartilhado/respostas.ts'

/** UUID v4 em minusculas, o formato dos ids do produto. */
const IDENTIFICADOR =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Colunas lidas de `ig_contas`. Nenhum `select *` (CLAUDE.md). */
const CAMPOS_DA_CONTA = 'id, tenant_id, username, status, token_ref'

/**
 * Usuario autenticado da requisicao.
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
 * O usuario pertence ao tenant desta conta?
 *
 * `service_role` ignora a RLS, entao o pertencimento e conferido aqui, na mao.
 * Esquecer esta checagem transformaria a funcao num desconectador universal de
 * contas alheias.
 *
 * @param cliente cliente com service_role
 * @param userId usuario autenticado
 * @param tenantId tenant dono da conta
 * @returns true se o vinculo existe
 */
async function pertenceAoTenant(
  cliente: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const { data } = await cliente
    .from('tenant_membros')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return Boolean(data)
}

Deno.serve(async (requisicao: Request) => {
  const origem = requisicao.headers.get('Origin')
  if (requisicao.method === 'OPTIONS') return responderOk(null, origem)

  const userId = await usuarioDaRequisicao(requisicao)
  if (!userId) return responderFalha(CODIGOS.SEM_SESSAO, null, origem)

  const corpo = await lerCorpo(requisicao)
  const contaId = typeof corpo.contaId === 'string' ? corpo.contaId : ''
  if (!IDENTIFICADOR.test(contaId)) {
    return responderFalha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.', origem)
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (url.length === 0 || chave.length === 0) {
    return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  }
  const cliente = createClient(url, chave, { auth: { persistSession: false } })

  const { data: conta, error: erroDaConta } = await cliente
    .from('ig_contas')
    .select(CAMPOS_DA_CONTA)
    .eq('id', contaId)
    .maybeSingle()
  if (erroDaConta) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  if (!conta) return responderFalha(CODIGOS.NAO_ENCONTRADO, 'Não encontramos esta conta.', origem)

  if (!(await pertenceAoTenant(cliente, userId, String(conta.tenant_id)))) {
    return responderFalha(CODIGOS.SEM_PERMISSAO, null, origem)
  }

  // Ja desconectada devolve sucesso em vez de erro: quem clicou duas vezes, ou
  // recarregou a pagina depois do primeiro clique, quer o mesmo estado final.
  // Erro aqui ensinaria o cliente a duvidar de uma operacao que deu certo.
  if (conta.status === 'desconectada') {
    return responderOk({ id: contaId, status: 'desconectada', jaEstava: true }, origem)
  }

  // Status ANTES do cofre, e a ordem e a regra: a coleta so varre `ativa`, entao
  // este passo e o que de fato para a coleta. Apagar o token primeiro e falhar
  // aqui deixaria a conta na fila da madrugada seguinte sem token nenhum — ela
  // falharia com "token expirado" e a tela pediria reconexao a um cliente que
  // acabou de pedir desconexao. Mensagem errada, e do tipo que custa suporte.
  const { error: erroDoStatus } = await cliente
    .from('ig_contas')
    .update({ status: 'desconectada' })
    .eq('id', contaId)
  if (erroDoStatus) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)

  // `token_ref` e `not null` no schema e continua apontando para um segredo que
  // deixou de existir. Nao e lixo esquecido: a coleta nao varre conta
  // desconectada, e uma reconexao reescreve a referencia com o segredo novo
  // (`conectar-conta` atualiza a linha existente). Apagar o segredo e o que
  // importa — a referencia sozinha nao abre nada.
  const { error: erroDoCofre } = await cliente.rpc('apagar_token', { p_ref: conta.token_ref })
  if (erroDoCofre) {
    // A coleta ja parou, que era a promessa da tela. O token sobrevivendo no
    // cofre e problema de seguranca, e nao pode virar sucesso silencioso.
    registrar('desconexao.token_nao_apagado', { conta: contaId })
    return responderFalha(
      CODIGOS.FALHA_INESPERADA,
      'A coleta parou, mas não foi possível apagar o token. Fale com o suporte.',
      origem,
    )
  }

  // Sem username e sem tenant: o log de uma desconexao nao precisa saber de quem
  // era a conta (docs/11_SEGURANCA).
  registrar('desconexao.concluida', { conta: contaId })
  return responderOk({ id: contaId, status: 'desconectada', jaEstava: false }, origem)
})
