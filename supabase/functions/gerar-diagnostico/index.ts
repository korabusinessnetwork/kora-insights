/**
 * Motor de regras no servidor (ADR-005).
 *
 * Roda depois da coleta, le o historico canonico da conta, aplica o ruleset
 * vigente e grava uma linha em `diagnosticos` com a `ruleset_version` que usou.
 * A tela nunca calcula nada: ela le esta linha pronta.
 *
 * O ruleset e o motor vem de `src/rules/` e `src/motor/` em vez de serem
 * copiados para ca, e isso e deliberado. Sao modulos puros — sem rede, sem DOM,
 * sem relogio, sem `import.meta.env` — e `docs/01_ARQUITETURA/overview.md` diz,
 * com todas as letras, que eles existem para "rodar iguais no navegador (modo
 * demonstracao) e no Deno da Edge Function". Uma segunda copia do metodo em
 * TypeScript faria `ruleset_version` mentir: duas implementacoes da versao
 * 0.3.0 divergiriam na primeira correcao, e a pergunta que o ADR-005 existe
 * para responder — "mudou a conta ou mudou a regra?" — ficaria sem resposta.
 * Ver a nota "Import de src/" no README.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { gerarDiagnostico, montarHistorico } from '../../../src/motor/index.js'
import ruleset from '../../../src/rules/index.js'
import {
  CODIGOS,
  ehChamadaDeServico,
  lerCorpo,
  registrar,
  responderFalha,
  responderOk,
} from '../_compartilhado/respostas.ts'

/** Colunas explicitas de cada tabela lida. Nenhum `select *` (CLAUDE.md). */
const CAMPOS_DA_CONTA = 'id, tenant_id, tem_trafego_pago, status'
const CAMPOS_DE_SNAPSHOT_CONTA = 'ig_conta_id, data, metrica, valor'
const CAMPOS_DE_SNAPSHOT_MIDIA = 'ig_conta_id, ig_media_id, data, tipo, publicada_em, metrica, valor'
const CAMPOS_DE_EVENTO = 'ig_conta_id, ocorrido_em, status'

/**
 * Janela de historico lida por conta.
 *
 * A regra mais exigente do ruleset 0.3.0 pede 16 semanas completas. Lemos 24
 * para que a comparacao entre a janela recente e a anterior tenha as duas
 * inteiras, e paramos ai: ler a serie inteira de uma conta antiga custaria
 * memoria sem mudar nenhum veredito.
 */
const SEMANAS_DE_HISTORICO = 24

/** Linhas por pagina na leitura de snapshots. */
const TAMANHO_DA_PAGINA = 1000

interface Conta {
  id: string
  tenant_id: string
  tem_trafego_pago: boolean
  status: string
}

/**
 * Le uma tabela inteira em paginas.
 *
 * O PostgREST corta a resposta em 1000 linhas por padrao, em silencio. Uma
 * serie truncada nao quebra nada: ela produz um diagnostico plausivel e errado,
 * com semanas antigas faltando e uma "queda" que e so o corte da consulta. Por
 * isso a paginacao e explicita.
 *
 * @param cliente cliente com service_role
 * @param tabela nome da tabela
 * @param campos lista explicita de colunas
 * @param contaId conta dona das linhas
 * @param desde data minima, `YYYY-MM-DD`
 * @param coluna coluna de data usada no filtro e na ordenacao
 * @returns todas as linhas da janela
 * @throws {Error} se o banco recusar a leitura
 */
async function lerPaginado(
  cliente: SupabaseClient,
  tabela: string,
  campos: string,
  contaId: string,
  desde: string,
  coluna: string,
): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = []
  for (let pagina = 0; ; pagina += 1) {
    const inicio = pagina * TAMANHO_DA_PAGINA
    const { data, error } = await cliente
      .from(tabela)
      .select(campos)
      .eq('ig_conta_id', contaId)
      .gte(coluna, desde)
      .order(coluna, { ascending: true })
      .range(inicio, inicio + TAMANHO_DA_PAGINA - 1)
    if (error) throw new Error(`${tabela}: ${error.code ?? 'erro'}`)

    const lote = (data ?? []) as Record<string, unknown>[]
    linhas.push(...lote)
    if (lote.length < TAMANHO_DA_PAGINA) return linhas
  }
}

/**
 * Gera e grava o diagnostico de uma conta.
 *
 * @param cliente cliente com service_role
 * @param conta conta a diagnosticar
 * @param agora instante injetado no motor, ISO
 * @returns id do diagnostico gravado
 * @throws {Error} se a leitura ou a gravacao falhar
 */
async function diagnosticarConta(
  cliente: SupabaseClient,
  conta: Conta,
  agora: string,
): Promise<string> {
  const desde = new Date(agora)
  desde.setUTCDate(desde.getUTCDate() - SEMANAS_DE_HISTORICO * 7)
  const corte = desde.toISOString().slice(0, 10)

  const [snapshotsConta, snapshotsMidia, eventosDeColeta] = await Promise.all([
    lerPaginado(cliente, 'snapshots_conta', CAMPOS_DE_SNAPSHOT_CONTA, conta.id, corte, 'data'),
    lerPaginado(cliente, 'snapshots_midia', CAMPOS_DE_SNAPSHOT_MIDIA, conta.id, corte, 'data'),
    lerPaginado(cliente, 'coleta_eventos', CAMPOS_DE_EVENTO, conta.id, corte, 'ocorrido_em'),
  ])

  const historico = montarHistorico({
    conta: { id: conta.id, tem_trafego_pago: conta.tem_trafego_pago },
    snapshotsConta,
    snapshotsMidia,
    eventosDeColeta,
    ate: agora.slice(0, 10),
  })

  const diagnostico = gerarDiagnostico(historico, ruleset, { agora })

  // `id` e deterministico (`diag:<conta>:<inicio>:<fim>:<versao>`), entao rodar
  // duas vezes no mesmo dia cai na mesma linha em vez de acumular registros
  // identicos. Ruleset novo muda o id e nasce uma linha nova: diagnostico
  // passado nunca e reescrito (ADR-005).
  const { error } = await cliente.from('diagnosticos').upsert(
    {
      id: diagnostico.id,
      ig_conta_id: diagnostico.contaId,
      gerado_em: diagnostico.geradoEm,
      periodo_inicio: diagnostico.periodo.inicio,
      periodo_fim: diagnostico.periodo.fim,
      ruleset_version: diagnostico.rulesetVersion,
      achados: diagnostico.achados,
      limites: diagnostico.limites,
      cobertura: diagnostico.cobertura,
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`diagnosticos: ${error.code ?? 'erro'}`)

  return diagnostico.id
}

Deno.serve(async (requisicao: Request) => {
  const origem = requisicao.headers.get('Origin')
  if (requisicao.method === 'OPTIONS') return responderOk(null, origem)

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
  const contaPedida = typeof corpo.contaId === 'string' ? corpo.contaId : null

  let consulta = cliente.from('ig_contas').select(CAMPOS_DA_CONTA)
  // Conta com token vencido continua sendo diagnosticada: o historico dela nao
  // some porque a coleta parou, e a lacuna precisa aparecer na tela em vez de a
  // tela ficar vazia (ADR-004).
  consulta = contaPedida
    ? consulta.eq('id', contaPedida)
    : consulta.in('status', ['ativa', 'pausada', 'token_expirado'])

  const { data: contas, error: erroDasContas } = await consulta
  if (erroDasContas) return responderFalha(CODIGOS.FALHA_INESPERADA, null, origem)

  const alvos = (contas ?? []) as Conta[]
  if (contaPedida && alvos.length === 0) {
    return responderFalha(CODIGOS.NAO_ENCONTRADO, 'Conta não encontrada.', origem)
  }

  const agora = new Date().toISOString()
  let gerados = 0
  let comFalha = 0

  for (const conta of alvos) {
    try {
      const id = await diagnosticarConta(cliente, conta, agora)
      gerados += 1
      registrar('diagnostico.gerado', { diagnostico: id, ruleset: ruleset.versao })
    } catch (erro) {
      comFalha += 1
      // A falha NAO vira linha em `coleta_eventos`: `montarHistorico` traduz
      // todo evento diferente de `ok` em lacuna de coleta, e a coleta do dia
      // pode ter ido bem. Marcar aqui pintaria na tela um buraco de dado que
      // nao existe — e lacuna inventada e tao desonesta quanto lacuna escondida.
      registrar('diagnostico.falhou', {
        conta: conta.id,
        causa: erro instanceof Error ? erro.message : 'desconhecida',
      })
    }
  }

  registrar('diagnostico.concluido', { contas: alvos.length, gerados, comFalha })
  return responderOk({ contas: alvos.length, gerados, comFalha, ruleset: ruleset.versao }, origem)
})
