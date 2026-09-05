/**
 * Exclusao de dados de uma conta conectada.
 *
 * Exigida duas vezes: pela LGPD, como direito do titular, e pelo App Review da
 * Meta, que reprova app sem fluxo de exclusao documentado e acessivel
 * (memory/restrictions.md, docs/11_SEGURANCA).
 *
 * Apaga tudo o que a conta gerou — snapshots de conta e de midia, diagnosticos,
 * eventos de coleta, o token no Vault e a propria linha de `ig_contas` — e
 * devolve um protocolo. Sem comprovante o cliente nao tem como demonstrar que
 * pediu, e nos nao temos como demonstrar que cumprimos.
 *
 * O comprovante e gravado ANTES de a exclusao comecar. Se a funcao morrer no
 * meio, sobra o registro de que o pedido existiu — a ordem inversa deixaria um
 * apagamento parcial sem nenhum rastro de por que aconteceu.
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

/** Tabelas apagadas em ordem, da folha para a raiz. */
const TABELAS_DEPENDENTES = [
  'snapshots_midia',
  'snapshots_conta',
  'diagnosticos',
  'coleta_eventos',
] as const

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
 * Protocolo legivel do pedido.
 *
 * Legivel de proposito: o cliente vai ditar isso por telefone ou colar num
 * e-mail de suporte, e um uuid cru convida a erro de transcricao.
 *
 * @param agora instante do pedido
 * @returns protocolo no formato `KORA-AAAAMMDD-XXXXXXXX`
 */
export function gerarProtocolo(agora: Date): string {
  const dia = agora.toISOString().slice(0, 10).replaceAll('-', '')
  const sufixo = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  return `KORA-${dia}-${sufixo}`
}

/**
 * Apaga as linhas dependentes da conta e devolve quantas sairam de cada tabela.
 *
 * A FK ja tem `on delete cascade`, entao apagar `ig_contas` bastaria para o dado
 * sumir. Apagamos explicitamente mesmo assim por duas razoes: o comprovante
 * precisa dizer QUANTO foi apagado, e um `on delete` que mude no futuro nao pode
 * transformar exclusao de dado pessoal em orfao silencioso.
 *
 * @param cliente cliente com service_role
 * @param contaId conta a limpar
 * @returns contagem por tabela
 */
async function apagarDependentes(
  cliente: SupabaseClient,
  contaId: string,
): Promise<Record<string, number>> {
  const contagem: Record<string, number> = {}
  for (const tabela of TABELAS_DEPENDENTES) {
    const { data, error } = await cliente
      .from(tabela)
      .delete()
      .eq('ig_conta_id', contaId)
      .select('id')
    if (error) throw new Error(`${tabela}: ${error.code ?? 'erro'}`)
    contagem[tabela] = (data ?? []).length
  }
  return contagem
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

  // `service_role` ignora a RLS, entao o pertencimento e conferido aqui, na mao.
  // Esquecer esta checagem transformaria a funcao num apagador universal de
  // contas alheias.
  const { data: conta, error: erroDaConta } = await cliente
    .from('ig_contas')
    .select('id, tenant_id, token_ref')
    .eq('id', contaId)
    .maybeSingle()
  if (erroDaConta) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  if (!conta) return responderFalha(CODIGOS.NAO_ENCONTRADO, 'Não encontramos esta conta.', origem)

  const { data: vinculo } = await cliente
    .from('tenant_membros')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', conta.tenant_id)
    .maybeSingle()
  if (!vinculo) return responderFalha(CODIGOS.SEM_PERMISSAO, null, origem)

  const solicitadoEm = new Date()
  const protocolo = gerarProtocolo(solicitadoEm)

  const { error: erroDoProtocolo } = await cliente.from('exclusoes_de_dados').insert({
    protocolo,
    tenant_id: conta.tenant_id,
    ig_conta_id: contaId,
    solicitado_por: userId,
    solicitado_em: solicitadoEm.toISOString(),
  })
  if (erroDoProtocolo) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)

  try {
    const apagados = await apagarDependentes(cliente, contaId)

    // O token sai do cofre antes da linha: com a linha apagada, `token_ref` se
    // perde e o segredo ficaria no Vault sem ninguem para reclama-lo.
    const { error: erroDoCofre } = await cliente.rpc('apagar_token', { p_ref: conta.token_ref })
    if (erroDoCofre) throw new Error('vault')

    const { error: erroDaLinha } = await cliente.from('ig_contas').delete().eq('id', contaId)
    if (erroDaLinha) throw new Error(`ig_contas: ${erroDaLinha.code ?? 'erro'}`)

    const concluidoEm = new Date().toISOString()
    await cliente
      .from('exclusoes_de_dados')
      .update({ concluido_em: concluidoEm, itens_apagados: { ...apagados, ig_contas: 1, token: 1 } })
      .eq('protocolo', protocolo)

    // Sem id de conta, sem username e sem tenant: o log de uma exclusao nao pode
    // virar a copia que sobrou do que foi apagado.
    registrar('exclusao.concluida', { protocolo })
    return responderOk(
      { protocolo, solicitadoEm: solicitadoEm.toISOString(), concluidoEm, itensApagados: apagados },
      origem,
    )
  } catch (erro) {
    registrar('exclusao.falhou', {
      protocolo,
      causa: erro instanceof Error ? erro.message : 'desconhecida',
    })
    // O protocolo fica gravado sem `concluido_em`: e assim que uma exclusao
    // incompleta aparece para quem for auditar, em vez de sumir.
    return responderFalha(
      CODIGOS.FALHA_INESPERADA,
      `A exclusão não foi concluída. Guarde o protocolo ${protocolo} e fale com o suporte.`,
      origem,
    )
  }
})
