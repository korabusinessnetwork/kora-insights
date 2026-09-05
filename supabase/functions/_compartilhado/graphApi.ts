/**
 * Cliente da Graph API (Instagram API with Facebook Login, ADR-002).
 *
 * Este arquivo e o unico ponto do servidor que fala com a Meta. Ele nao traduz
 * metrica: quem faz isso e o adaptador de `src/metricas/adaptadores/`, que ja
 * existe, e versionado e testado — duplicar aquele mapa aqui criaria duas
 * definicoes de "alcance" que divergiriam na primeira mudanca da Meta (ADR-003).
 * O que este modulo entrega e payload cru e erro ja classificado.
 *
 * Tres regras nao negociaveis, todas de `memory/restrictions.md`:
 *   - o token viaja no cabecalho `Authorization`, nunca na query. URL vai para
 *     log de proxy, historico e relatorio de erro;
 *   - falha da Meta vira codigo do produto (`TOKEN_EXPIRADO`, `LIMITE_DE_TAXA`),
 *     nunca excecao anonima — quem chama precisa saber se pede reconexao ou se
 *     tenta mais tarde;
 *   - 200 chamadas por hora por usuario e teto rigido, e quem estoura o
 *     orcamento para antes de a Meta comecar a recusar.
 */

import { CODIGOS, type Codigo } from './respostas.ts'

/**
 * Endereco da Graph API com a versao embutida (ex: `https://graph.facebook.com/v23.0`).
 * Vem do ambiente porque a versao caduca: no dia em que a Meta encerrar a v23,
 * quem troca e a variavel, nao um literal no meio de um arquivo (CLAUDE.md).
 */
const BASE_DA_GRAPH = Deno.env.get('META_GRAPH_URL') ?? ''

/** Teto de chamadas por hora por usuario (memory/restrictions.md). */
export const LIMITE_DE_CHAMADAS_POR_HORA = 200

/**
 * Margem do orcamento: paramos em 90% do teto. Os 10% restantes ficam para o
 * que nao passa por aqui — retentativa, chamada manual de suporte, e o proprio
 * atraso entre a contagem da Meta e a nossa.
 */
const FRACAO_UTIL_DO_ORCAMENTO = 0.9

/** Codigos de erro da Meta que significam "reconecte a conta". */
const CODIGOS_DE_TOKEN_INVALIDO = new Set([190, 102, 463, 467])

/** Codigos de erro da Meta que significam "voce chamou demais". */
const CODIGOS_DE_LIMITE = new Set([4, 17, 32, 613, 80001, 80002, 80003, 80004])

/** Erro ja classificado no vocabulario do produto. */
export class ErroDaGraph extends Error {
  codigo: Codigo
  /** Detalhe tecnico para o registro de coleta. Nunca contem token. */
  detalhe: string

  constructor(codigo: Codigo, detalhe: string) {
    super(`${codigo}: ${detalhe}`)
    this.name = 'ErroDaGraph'
    this.codigo = codigo
    this.detalhe = detalhe
  }
}

/**
 * Orcamento de chamadas de uma execucao.
 *
 * Existe porque estourar o limite da Meta nao custa so a chamada recusada:
 * custa a janela inteira da hora seguinte, e com ela a coleta de todas as
 * contas que ainda nao rodaram. Parar antes e mais barato que ser barrado.
 */
export class OrcamentoDeChamadas {
  private usadas = 0
  private readonly teto: number

  /**
   * @param teto chamadas permitidas nesta execucao
   */
  constructor(teto = Math.floor(LIMITE_DE_CHAMADAS_POR_HORA * FRACAO_UTIL_DO_ORCAMENTO)) {
    this.teto = teto
  }

  /** @returns quantas chamadas ainda cabem */
  get restantes(): number {
    return Math.max(0, this.teto - this.usadas)
  }

  /**
   * Reserva uma chamada.
   *
   * @returns true se a chamada pode ser feita
   */
  reservar(): boolean {
    if (this.usadas >= this.teto) return false
    this.usadas += 1
    return true
  }

  /**
   * Zera o que resta quando a propria Meta avisa que a conta esta perto do teto.
   *
   * @param motivo texto para o registro de coleta
   */
  esgotar(motivo: string): void {
    this.usadas = this.teto
    this.ultimoMotivo = motivo
  }

  ultimoMotivo = ''
}

/**
 * Le o cabecalho de uso que a Meta devolve e diz se ja passamos do limiar.
 *
 * A Meta publica o consumo em `x-app-usage` / `x-business-use-case-usage` como
 * percentual. Ignorar isso e esperar o 429 significa descobrir o problema
 * depois de ja ter perdido a janela.
 *
 * @param resposta resposta HTTP da Graph API
 * @returns percentual de uso mais alto encontrado, ou 0
 */
export function usoRelatadoPelaMeta(resposta: Response): number {
  const cabecalhos = ['x-app-usage', 'x-business-use-case-usage']
  let maior = 0
  for (const nome of cabecalhos) {
    const cru = resposta.headers.get(nome)
    if (!cru) continue
    try {
      const dados = JSON.parse(cru)
      const valores = Array.isArray(dados) ? dados : Object.values(dados)
      for (const item of valores.flat()) {
        if (!item || typeof item !== 'object') continue
        for (const chave of ['call_count', 'total_cputime', 'total_time']) {
          const valor = Number((item as Record<string, unknown>)[chave] ?? 0)
          if (Number.isFinite(valor) && valor > maior) maior = valor
        }
      }
    } catch {
      // Cabecalho fora do formato esperado nao pode derrubar a coleta: o
      // orcamento local continua valendo como teto.
    }
  }
  return maior
}

/**
 * Classifica a falha que a Meta devolveu.
 *
 * @param status status HTTP
 * @param corpo corpo JSON da resposta
 * @returns erro no vocabulario do produto
 */
function classificarErro(status: number, corpo: Record<string, unknown>): ErroDaGraph {
  const erro = (corpo?.error ?? {}) as Record<string, unknown>
  const codigoDaMeta = Number(erro.code ?? 0)
  const subcodigo = Number(erro.error_subcode ?? 0)
  // A mensagem da Meta entra no detalhe, mas cortada: ela as vezes ecoa parte
  // da requisicao, e requisicao nossa carrega id de conta.
  const mensagem = String(erro.message ?? '').slice(0, 200)

  if (status === 429 || CODIGOS_DE_LIMITE.has(codigoDaMeta)) {
    return new ErroDaGraph(CODIGOS.LIMITE_DE_TAXA, `Meta recusou por limite (${codigoDaMeta}).`)
  }
  if (CODIGOS_DE_TOKEN_INVALIDO.has(codigoDaMeta) || CODIGOS_DE_TOKEN_INVALIDO.has(subcodigo)) {
    return new ErroDaGraph(CODIGOS.TOKEN_EXPIRADO, `Autorizacao invalida (${codigoDaMeta}).`)
  }
  if (status >= 500) {
    return new ErroDaGraph(CODIGOS.FALHA_DE_REDE, `Meta respondeu ${status}.`)
  }
  return new ErroDaGraph(CODIGOS.FALHA_INESPERADA, `Meta respondeu ${status}: ${mensagem}`)
}

/**
 * Faz uma chamada a Graph API.
 *
 * @param caminho caminho relativo, ex: `/17841400000000000/insights`
 * @param parametros query string, sem o token
 * @param token token de acesso da conta
 * @param orcamento orcamento de chamadas da execucao
 * @returns payload cru da Meta
 * @throws {ErroDaGraph} em qualquer falha, ja classificada
 */
export async function chamarGraph(
  caminho: string,
  parametros: Record<string, string>,
  token: string,
  orcamento: OrcamentoDeChamadas,
): Promise<Record<string, unknown>> {
  if (BASE_DA_GRAPH.length === 0) {
    throw new ErroDaGraph(CODIGOS.FALHA_INESPERADA, 'META_GRAPH_URL ausente no ambiente.')
  }
  if (!orcamento.reservar()) {
    throw new ErroDaGraph(
      CODIGOS.LIMITE_DE_TAXA,
      `Orcamento de ${LIMITE_DE_CHAMADAS_POR_HORA} chamadas/hora esgotado nesta execucao.`,
    )
  }

  const url = new URL(`${BASE_DA_GRAPH}${caminho}`)
  for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor)

  let resposta: Response
  try {
    // Token no cabecalho, jamais em `url.searchParams`: URL aparece em log de
    // proxy e em relatorio de erro (memory/restrictions.md).
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
  } catch (excecao) {
    const nome = excecao instanceof Error ? excecao.name : 'erro'
    throw new ErroDaGraph(CODIGOS.FALHA_DE_REDE, `Nao foi possivel falar com a Meta (${nome}).`)
  }

  const uso = usoRelatadoPelaMeta(resposta)
  if (uso >= 90) orcamento.esgotar(`Meta relatou ${uso}% do limite consumido.`)

  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok || corpo.error) throw classificarErro(resposta.status, corpo)
  return corpo
}

/**
 * Troca o `code` do OAuth por um token de longa duracao.
 *
 * Sao duas chamadas porque a Meta exige duas: o `code` vira token de curta
 * duracao, e so o token de curta duracao pode ser trocado pelo de ~60 dias. O
 * app secret so existe deste lado — ele nao esta no bundle do front e nao pode
 * estar (docs/11_SEGURANCA).
 *
 * @param codigo `code` devolvido pelo dialogo de consentimento
 * @param redirecionamento a MESMA `redirect_uri` usada na ida
 * @returns token de longa duracao e quando ele expira
 * @throws {ErroDaGraph} se a Meta recusar a troca
 */
export async function trocarCodigoPorTokenLongo(
  codigo: string,
  redirecionamento: string,
): Promise<{ token: string; expiraEm: string | null }> {
  const appId = Deno.env.get('META_APP_ID') ?? ''
  const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
  if (BASE_DA_GRAPH.length === 0 || appId.length === 0 || appSecret.length === 0) {
    throw new ErroDaGraph(CODIGOS.FALHA_INESPERADA, 'Credenciais da Meta ausentes no ambiente.')
  }

  const curto = await pedirToken({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirecionamento,
    code: codigo,
  })

  const longo = await pedirToken({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: curto.token,
  })

  return longo
}

/**
 * Chama `/oauth/access_token`.
 *
 * @param parametros parametros da troca, incluindo o app secret
 * @returns token e validade
 * @throws {ErroDaGraph} se a Meta recusar
 */
async function pedirToken(
  parametros: Record<string, string>,
): Promise<{ token: string; expiraEm: string | null }> {
  const url = new URL(`${BASE_DA_GRAPH}/oauth/access_token`)

  let resposta: Response
  try {
    // POST com corpo `x-www-form-urlencoded`: o app secret e o `code` nao podem
    // ir na query pelo mesmo motivo do token.
    resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(parametros),
      signal: AbortSignal.timeout(20000),
    })
  } catch (excecao) {
    const nome = excecao instanceof Error ? excecao.name : 'erro'
    throw new ErroDaGraph(CODIGOS.FALHA_DE_REDE, `Nao foi possivel falar com a Meta (${nome}).`)
  }

  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok || corpo.error) throw classificarErro(resposta.status, corpo)

  const token = String(corpo.access_token ?? '')
  if (token.length === 0) {
    throw new ErroDaGraph(CODIGOS.FALHA_INESPERADA, 'Resposta da Meta veio sem token.')
  }

  const segundos = Number(corpo.expires_in ?? 0)
  const expiraEm =
    Number.isFinite(segundos) && segundos > 0
      ? new Date(Date.now() + segundos * 1000).toISOString()
      : null

  return { token, expiraEm }
}

/**
 * Encontra a conta profissional do Instagram vinculada a alguma Pagina do
 * Facebook que o usuario administra (ADR-002).
 *
 * @param token token de acesso do usuario
 * @param orcamento orcamento de chamadas
 * @returns dados da conta, ou `null` se nenhuma pagina tem conta vinculada
 * @throws {ErroDaGraph} se a Meta recusar
 */
export async function descobrirContaProfissional(
  token: string,
  orcamento: OrcamentoDeChamadas,
): Promise<{ igUserId: string; username: string; nome: string; fbPageId: string } | null> {
  const paginas = await chamarGraph(
    '/me/accounts',
    { fields: 'id,name,instagram_business_account{id,username,name}', limit: '50' },
    token,
    orcamento,
  )

  const lista = Array.isArray(paginas.data) ? paginas.data : []
  for (const pagina of lista as Record<string, unknown>[]) {
    const conta = pagina.instagram_business_account as Record<string, unknown> | undefined
    if (!conta?.id) continue
    return {
      igUserId: String(conta.id),
      username: String(conta.username ?? ''),
      nome: String(conta.name ?? pagina.name ?? ''),
      fbPageId: String(pagina.id ?? ''),
    }
  }
  return null
}

/**
 * Insights diarios da conta.
 *
 * @param igUserId id da conta profissional
 * @param dia dia coletado, `YYYY-MM-DD`
 * @param token token de acesso da conta
 * @param orcamento orcamento de chamadas
 * @returns payload cru, para o adaptador traduzir
 * @throws {ErroDaGraph} se a Meta recusar
 */
export async function buscarInsightsDaConta(
  igUserId: string,
  dia: string,
  token: string,
  orcamento: OrcamentoDeChamadas,
): Promise<Record<string, unknown>> {
  const inicio = Math.floor(Date.parse(`${dia}T00:00:00Z`) / 1000)
  const fim = inicio + 86400
  return await chamarGraph(
    `/${igUserId}/insights`,
    {
      metric: 'reach,views,total_interactions,profile_views,follower_count',
      period: 'day',
      since: String(inicio),
      until: String(fim),
    },
    token,
    orcamento,
  )
}

/**
 * Midias publicadas desde uma data, com as metricas que vem no proprio no.
 *
 * `fields` pede insights aninhado de proposito: uma chamada por lote de midias
 * em vez de uma por midia. Com 200 chamadas por hora para todas as contas do
 * tenant, cada ida evitada e uma conta a mais coletada no mesmo dia.
 *
 * @param igUserId id da conta profissional
 * @param desde data minima de publicacao, `YYYY-MM-DD`
 * @param token token de acesso da conta
 * @param orcamento orcamento de chamadas
 * @returns lista crua de midias
 * @throws {ErroDaGraph} se a Meta recusar
 */
export async function buscarMidias(
  igUserId: string,
  desde: string,
  token: string,
  orcamento: OrcamentoDeChamadas,
): Promise<Record<string, unknown>[]> {
  const payload = await chamarGraph(
    `/${igUserId}/media`,
    {
      fields:
        'id,media_product_type,media_type,timestamp,like_count,comments_count,' +
        'insights.metric(reach,views,saved,shares,total_interactions)',
      since: String(Math.floor(Date.parse(`${desde}T00:00:00Z`) / 1000)),
      limit: '50',
    },
    token,
    orcamento,
  )
  return Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : []
}

/**
 * Traduz o tipo de midia da Meta para o vocabulario das regras.
 *
 * O nome da Meta morre aqui, como qualquer outro (ADR-003): `src/rules` fala
 * `reel`, `carrossel`, `imagem` e `story`, e e por esses nomes que a regra de
 * formato agrupa as publicacoes.
 *
 * @param midia no cru da midia
 * @returns tipo canonico
 */
export function tipoCanonicoDaMidia(midia: Record<string, unknown>): string {
  const produto = String(midia.media_product_type ?? '').toUpperCase()
  if (produto === 'STORY') return 'story'
  if (produto === 'REELS') return 'reel'
  const tipo = String(midia.media_type ?? '').toUpperCase()
  if (tipo === 'VIDEO') return 'reel'
  if (tipo === 'CAROUSEL_ALBUM') return 'carrossel'
  return 'imagem'
}
