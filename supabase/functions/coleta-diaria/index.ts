/**
 * Coleta diaria (ADR-004): o snapshot que vira o historico do cliente.
 *
 * O que a Graph API nao devolve depois e o passado de antes da conexao. Se um
 * dia nao for coletado hoje, ele nao existe amanha — e por isso esta funcao trata
 * falha como dado, nao como excecao:
 *
 *   TODA falha vira linha em `coleta_eventos`, inclusive limite de taxa e token
 *   expirado. Falha silenciosa e proibida.
 *
 * A razao e de produto, nao de operacao: `montarHistorico` transforma cada
 * evento diferente de `ok` em lacuna nomeada na tela, e e assim que o cliente
 * descobre que a queda do grafico foi o token dele vencendo, e nao o conteudo
 * dele piorando (ADR-004, e "honestidade de dado" em memory/identity.md).
 *
 * Nota de fronteira: o adaptador vem de `src/metricas/adaptadores/` em vez de
 * ser copiado para ca. Ele e o unico lugar do produto que conhece nome de
 * metrica da Meta (ADR-003) e ja e versionado e testado — duas copias dariam
 * dois significados para "alcance". Ver a nota "Import de src/" no README.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { adaptadorVigente } from '../../../src/metricas/adaptadores/index.js'
import {
  buscarInsightsDaConta,
  buscarMidias,
  ErroDaGraph,
  OrcamentoDeChamadas,
  renovarTokenLongo,
  tipoCanonicoDaMidia,
} from '../_compartilhado/graphApi.ts'
import { precisaRenovar } from '../../../src/token/validade.js'
import {
  CODIGOS,
  type Codigo,
  ehChamadaDeServico,
  lerCorpo,
  registrar,
  responderFalha,
  responderOk,
} from '../_compartilhado/respostas.ts'

/** Colunas de `ig_contas` que a coleta usa. Nenhum `select *` (CLAUDE.md). */
const CAMPOS_DA_CONTA = 'id, tenant_id, ig_user_id, token_ref, status, token_expira_em'

/**
 * Quantos dias para tras a busca de midias olha.
 *
 * Sete dias, e nao um: metrica de midia e total acumulado e continua se movendo
 * depois da publicacao. Reler a ultima semana mantem o numero da semana corrente
 * vivo ate ela fechar; a chave unica `(ig_media_id, data, metrica)` garante que
 * reler nao duplica linha.
 */
const DIAS_DE_MIDIA = 7

/** Status de `coleta_eventos` para cada codigo de erro do produto. */
const STATUS_DE_EVENTO: Record<string, string> = {
  [CODIGOS.TOKEN_EXPIRADO]: 'token_expirado',
  [CODIGOS.LIMITE_DE_TAXA]: 'limite_de_taxa',
  [CODIGOS.FALHA_DE_REDE]: 'falha_de_rede',
}

interface Conta {
  id: string
  tenant_id: string
  ig_user_id: string
  token_ref: string
  status: string
  token_expira_em: string | null
}

interface LinhaDeConta {
  ig_conta_id: string
  data: string
  metrica: string
  valor: number
  api_version: string
  adapter_version: string
}

interface LinhaDeMidia extends LinhaDeConta {
  ig_media_id: string
  tipo: string
  publicada_em: string | null
}

/**
 * Dia anterior no fuso de Sao Paulo.
 *
 * O corte e o dia fechado, nunca o de hoje: coletar o dia em curso gravaria
 * meia jornada como se fosse um dia inteiro, e `montarHistorico` compararia uma
 * segunda-feira pela metade com semanas completas — uma queda que nao aconteceu.
 *
 * @param agora instante da execucao
 * @returns dia no formato `YYYY-MM-DD`
 */
export function diaFechadoAnterior(agora: Date): string {
  // America/Sao_Paulo e UTC-3 fixo desde o fim do horario de verao em 2019.
  const emSaoPaulo = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  emSaoPaulo.setUTCDate(emSaoPaulo.getUTCDate() - 1)
  return emSaoPaulo.toISOString().slice(0, 10)
}

/**
 * Soma dias a uma data ISO.
 *
 * @param dia data `YYYY-MM-DD`
 * @param quantidade dias a somar (negativo anda para tras)
 * @returns data `YYYY-MM-DD`
 */
function somarDias(dia: string, quantidade: number): string {
  const data = new Date(`${dia}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + quantidade)
  return data.toISOString().slice(0, 10)
}

/**
 * Registra um evento de coleta.
 *
 * Nunca lanca: se ate o registro da falha falhar, o que sobra e o log — e a
 * coleta das outras contas precisa continuar.
 *
 * @param cliente cliente com service_role
 * @param contaId conta afetada, ou null para evento do job
 * @param status status do vocabulario de `coleta_eventos`
 * @param detalhe frase escrita para ser lida na tela
 */
async function registrarEvento(
  cliente: SupabaseClient,
  contaId: string | null,
  status: string,
  detalhe: string,
): Promise<void> {
  const { error } = await cliente
    .from('coleta_eventos')
    .insert({ ig_conta_id: contaId, status, detalhe: detalhe.slice(0, 500) })
  if (error) registrar('coleta.evento_nao_registrado', { status, causa: error.code })
}

/**
 * Grava as leituras de conta e de midia do dia.
 *
 * @param cliente cliente com service_role
 * @param linhasConta leituras de escopo conta
 * @param linhasMidia leituras de escopo midia
 * @throws {Error} se o banco recusar a gravacao
 */
async function gravarSnapshots(
  cliente: SupabaseClient,
  linhasConta: LinhaDeConta[],
  linhasMidia: LinhaDeMidia[],
): Promise<void> {
  if (linhasConta.length > 0) {
    const { error } = await cliente
      .from('snapshots_conta')
      .upsert(linhasConta, { onConflict: 'ig_conta_id,data,metrica' })
    if (error) throw new Error(`snapshots_conta: ${error.code ?? 'erro'}`)
  }
  if (linhasMidia.length > 0) {
    const { error } = await cliente
      .from('snapshots_midia')
      .upsert(linhasMidia, { onConflict: 'ig_media_id,data,metrica' })
    if (error) throw new Error(`snapshots_midia: ${error.code ?? 'erro'}`)
  }
}

/**
 * Troca o token da conta por um novo quando o vencimento se aproxima.
 *
 * O token de longa duracao da Meta vive ~60 dias. Sem esta troca, toda conta
 * conectada morre no dia 60 e o cliente so descobre pela coleta falhando —
 * num produto que exige 16 semanas completas para nomear uma causa, isso apaga
 * meses de caminho andado. O prazo de decisao mora em `src/token/validade.js`,
 * lido tambem pela tela que pede reconexao.
 *
 * **Nunca lanca.** Falha de renovacao nao e falha de coleta: o token de hoje
 * continua valido (por isso a renovacao acontece com dias de folga), e derrubar
 * a coleta do dia por causa dela transformaria um problema futuro em lacuna
 * imediata. Pelo mesmo motivo a falha nao vira linha em `coleta_eventos`: aquela
 * tabela alimenta `montarHistorico`, e um evento ali desenharia lacuna na tela
 * num dia que tem dado.
 *
 * @param cliente cliente com service_role
 * @param conta conta ativa, com `token_expira_em`
 * @param token token atual, ja lido do cofre
 * @param agora instante da execucao
 * @returns o token a usar nesta coleta: o novo, ou o atual se a troca falhou
 */
async function renovarSeNecessario(
  cliente: SupabaseClient,
  conta: Conta,
  token: string,
  agora: Date,
): Promise<string> {
  if (!precisaRenovar({ tokenExpiraEm: conta.token_expira_em }, agora)) return token

  try {
    const renovado = await renovarTokenLongo(token)

    // Cofre antes da linha, como na conexao: o nome do segredo e deterministico,
    // entao `guardar_token` atualiza o segredo existente e devolve a MESMA
    // referencia. Se a escrita da linha falhar depois desta, o cofre fica com o
    // token novo e a linha com o prazo velho — e amanha a renovacao roda de novo
    // a partir do token novo, que e o certo. O contrario perderia o token.
    const { data: referencia, error: erroDoCofre } = await cliente.rpc('guardar_token', {
      p_nome: `ig_conta_${conta.ig_user_id}`,
      p_token: renovado.token,
    })
    if (erroDoCofre || !referencia) throw new Error('cofre')

    const { error } = await cliente
      .from('ig_contas')
      .update({ token_ref: String(referencia), token_expira_em: renovado.expiraEm })
      .eq('id', conta.id)
    if (error) throw new Error(`ig_contas: ${error.code ?? 'erro'}`)

    // Log sem token e sem referencia do cofre: so o que responde "a renovacao
    // esta funcionando?" no suporte (docs/11_SEGURANCA).
    registrar('coleta.token_renovado', { conta: conta.id, expira_em: renovado.expiraEm })
    return renovado.token
  } catch (erro) {
    const causa = erro instanceof ErroDaGraph ? erro.codigo : 'falha'
    registrar('coleta.token_nao_renovado', {
      conta: conta.id,
      causa,
      expira_em: conta.token_expira_em,
    })
    return token
  }
}

/**
 * Coleta uma conta e devolve o resumo do que gravou.
 *
 * @param cliente cliente com service_role
 * @param conta conta ativa
 * @param dia dia coletado, `YYYY-MM-DD`
 * @param orcamento orcamento de chamadas desta conta
 * @param agora instante da execucao, para decidir a renovacao do token
 * @returns contagens do que entrou no banco
 * @throws {ErroDaGraph} quando a Meta recusa; quem chama transforma em evento
 */
async function coletarConta(
  cliente: SupabaseClient,
  conta: Conta,
  dia: string,
  orcamento: OrcamentoDeChamadas,
  agora: Date,
): Promise<{ leiturasDeConta: number; midias: number; ignoradas: string[] }> {
  const { data: doCofre, error: erroDoToken } = await cliente.rpc('ler_token', {
    p_ref: conta.token_ref,
  })
  if (erroDoToken || typeof doCofre !== 'string' || doCofre.length === 0) {
    // Referencia sem segredo no cofre significa conexao quebrada, e o cliente
    // precisa reconectar — mesma acao de token vencido.
    throw new ErroDaGraph(CODIGOS.TOKEN_EXPIRADO, 'Token ausente no cofre para esta conta.')
  }

  const token = await renovarSeNecessario(cliente, conta, doCofre, agora)

  const adaptador = adaptadorVigente()
  const versoes = { api_version: adaptador.apiVersion, adapter_version: adaptador.versao }
  const ignoradas: string[] = []

  const payloadDaConta = await buscarInsightsDaConta(conta.ig_user_id, dia, token, orcamento)
  const daConta = adaptador.adaptar(payloadDaConta, 'conta', dia)
  ignoradas.push(...daConta.ignoradas)

  const linhasConta: LinhaDeConta[] = daConta.leituras.map((leitura) => ({
    ig_conta_id: conta.id,
    data: leitura.data,
    metrica: leitura.metrica,
    valor: leitura.valor,
    ...versoes,
  }))

  const midias = await buscarMidias(conta.ig_user_id, somarDias(dia, -DIAS_DE_MIDIA), token, orcamento)
  const linhasMidia: LinhaDeMidia[] = []
  let publicadasNoDia = 0

  for (const midia of midias) {
    const publicadaEm = typeof midia.timestamp === 'string' ? midia.timestamp : null
    if (publicadaEm && publicadaEm.slice(0, 10) === dia) publicadasNoDia += 1

    const daMidia = adaptador.adaptar(midia, 'midia', dia)
    ignoradas.push(...daMidia.ignoradas)
    for (const leitura of daMidia.leituras) {
      linhasMidia.push({
        ig_conta_id: conta.id,
        ig_media_id: String(midia.id ?? ''),
        data: leitura.data,
        tipo: tipoCanonicoDaMidia(midia),
        publicada_em: publicadaEm,
        metrica: leitura.metrica,
        valor: leitura.valor,
        ...versoes,
      })
    }
  }

  // `publicacoes` e derivada da contagem de midias do dia: nao vem da Meta e por
  // isso nenhum adaptador a produz (src/metricas/dicionario.js). Ela e gravada
  // mesmo valendo zero, porque aqui zero e um fato observado — "nao publicou" —
  // e nao a ausencia de coleta que o motor le como lacuna.
  linhasConta.push({
    ig_conta_id: conta.id,
    data: dia,
    metrica: 'publicacoes',
    valor: publicadasNoDia,
    ...versoes,
  })

  await gravarSnapshots(cliente, linhasConta, linhasMidia)
  return { leiturasDeConta: linhasConta.length, midias: linhasMidia.length, ignoradas }
}

/**
 * Traduz o erro da Graph API em status de `coleta_eventos` e, quando o caso,
 * marca a conta para o cliente ver o pedido de reconexao.
 *
 * @param cliente cliente com service_role
 * @param conta conta afetada
 * @param erro erro capturado
 */
async function registrarFalhaDaConta(
  cliente: SupabaseClient,
  conta: Conta,
  erro: unknown,
): Promise<void> {
  const daGraph = erro instanceof ErroDaGraph ? erro : null
  const codigo: Codigo = daGraph?.codigo ?? CODIGOS.FALHA_INESPERADA
  const status = STATUS_DE_EVENTO[codigo] ?? 'falha_inesperada'
  const detalhe = daGraph?.detalhe ?? (erro instanceof Error ? erro.message : 'Falha desconhecida.')

  await registrarEvento(cliente, conta.id, status, detalhe)

  // Conta com token vencido nao pode continuar sendo tentada todo dia: cada
  // tentativa gasta orcamento das contas que ainda funcionam, e a tela ja tem o
  // que dizer ao cliente.
  if (codigo === CODIGOS.TOKEN_EXPIRADO && conta.status !== 'token_expirado') {
    const { error } = await cliente
      .from('ig_contas')
      .update({ status: 'token_expirado' })
      .eq('id', conta.id)
    if (error) registrar('coleta.status_nao_atualizado', { conta: conta.id, causa: error.code })
  }
}

Deno.serve(async (requisicao: Request) => {
  const origem = requisicao.headers.get('Origin')
  if (requisicao.method === 'OPTIONS') return responderOk(null, origem)

  // Sem usuario nesta funcao: quem chama e o cron. Sem esta checagem, qualquer
  // um na internet dispararia a coleta de todas as contas do produto.
  if (!ehChamadaDeServico(requisicao)) {
    return responderFalha(CODIGOS.SEM_PERMISSAO, 'Esta função só aceita chamada de serviço.', origem)
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (url.length === 0 || chave.length === 0) {
    return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  }
  const cliente = createClient(url, chave, { auth: { persistSession: false } })

  const corpo = await lerCorpo(requisicao)
  // Um instante para a execucao inteira: o dia coletado e a decisao de renovar
  // token precisam concordar mesmo que a varredura atravesse a meia-noite.
  const agora = new Date()
  const dia = typeof corpo.dia === 'string' ? corpo.dia : diaFechadoAnterior(agora)

  const { data: contas, error: erroDasContas } = await cliente
    .from('ig_contas')
    .select(CAMPOS_DA_CONTA)
    .eq('status', 'ativa')
    .order('conectada_em', { ascending: true })

  if (erroDasContas) {
    await registrarEvento(cliente, null, 'falha_inesperada', 'Não foi possível listar as contas ativas.')
    return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)
  }

  const ativas = (contas ?? []) as Conta[]
  let coletadas = 0
  let comFalha = 0
  let barradoPorLimite = false

  for (const conta of ativas) {
    // Uma conta ja barrada por limite significa que a janela da hora acabou para
    // esta execucao. As contas restantes NAO sao ignoradas em silencio: cada uma
    // ganha o proprio evento, senao a lacuna do dia apareceria sem motivo na tela
    // delas (ADR-004).
    if (barradoPorLimite) {
      await registrarEvento(
        cliente,
        conta.id,
        'limite_de_taxa',
        'Limite de chamadas da Meta atingido antes da vez desta conta.',
      )
      comFalha += 1
      continue
    }

    // Um orcamento por conta: o teto de 200 chamadas por hora da Meta e por
    // usuario, entao gastar o de uma conta nao pode consumir o das outras
    // (memory/restrictions.md).
    const orcamento = new OrcamentoDeChamadas()

    try {
      const resumo = await coletarConta(cliente, conta, dia, orcamento, agora)
      coletadas += 1
      const nota = resumo.ignoradas.length > 0
        ? ` Métricas ignoradas: ${resumo.ignoradas.slice(0, 5).join('; ')}.`
        : ''
      await registrarEvento(
        cliente,
        conta.id,
        'ok',
        `Coleta de ${dia}: ${resumo.leiturasDeConta} leituras da conta e ${resumo.midias} de mídia.${nota}`,
      )
    } catch (erro) {
      comFalha += 1
      if (erro instanceof ErroDaGraph && erro.codigo === CODIGOS.LIMITE_DE_TAXA) {
        barradoPorLimite = true
      }
      await registrarFalhaDaConta(cliente, conta, erro)
    }
  }

  // Log sem id de conta e sem payload: o que interessa ao operador e o formato
  // do dia, e o detalhe de cada conta ja esta em `coleta_eventos`.
  registrar('coleta.concluida', { dia, contas: ativas.length, coletadas, comFalha })
  return responderOk({ dia, contas: ativas.length, coletadas, comFalha }, origem)
})
