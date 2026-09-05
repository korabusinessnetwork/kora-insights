/**
 * Envelope de resposta das Edge Functions e vocabulario de erro do produto.
 *
 * Duplicacao consciente de `src/lib/envelope.js` e `src/lib/erros.js`
 * -----------------------------------------------------------------
 * Os dois modulos originais leem `import.meta.env`, que so existe no bundle do
 * Vite: importa-los aqui quebraria no Deno. O que foi copiado e o minimo — a
 * forma do envelope e a lista de codigos — e nada disso e logica de produto: sao
 * dois contratos estaveis descritos em contratos.md (secao 1). Se um codigo novo
 * nascer la, ele precisa nascer aqui no mesmo commit.
 *
 * A funcao responde no MESMO envelope do front de proposito: e assim que
 * `conexaoMeta.invocarFuncao` consegue distinguir `TOKEN_EXPIRADO` de
 * `LIMITE_DE_TAXA` — dois estados que so quem fala com a Graph API sabe nomear,
 * e que virariam `FALHA_INESPERADA` se a funcao respondesse um erro cru.
 */

/** Codigos estaveis do produto (contratos.md, secao 1). */
export const CODIGOS = {
  SEM_SESSAO: 'SEM_SESSAO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  ENTRADA_INVALIDA: 'ENTRADA_INVALIDA',
  TOKEN_EXPIRADO: 'TOKEN_EXPIRADO',
  LIMITE_DE_TAXA: 'LIMITE_DE_TAXA',
  SEM_DADO_SUFICIENTE: 'SEM_DADO_SUFICIENTE',
  FALHA_DE_REDE: 'FALHA_DE_REDE',
  FALHA_INESPERADA: 'FALHA_INESPERADA',
} as const

export type Codigo = typeof CODIGOS[keyof typeof CODIGOS]

/** Frase pt-BR de cada codigo. Mesma tabela de `src/lib/erros.js`. */
export const MENSAGENS: Record<Codigo, string> = {
  SEM_SESSAO: 'Sua sessão expirou. Entre de novo para continuar.',
  SEM_PERMISSAO: 'Esta conta não pertence ao seu espaço de trabalho.',
  NAO_ENCONTRADO: 'Não encontramos este registro.',
  ENTRADA_INVALIDA: 'Os dados enviados não são válidos.',
  TOKEN_EXPIRADO:
    'A autorização do Instagram expirou. Reconecte a conta para retomar a coleta.',
  LIMITE_DE_TAXA: 'A Meta recusou por excesso de chamadas. Tente de novo em alguns minutos.',
  SEM_DADO_SUFICIENTE: 'Ainda não há histórico suficiente para diagnosticar esta conta.',
  FALHA_DE_REDE: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  FALHA_INESPERADA: 'Algo saiu do esperado. Tente de novo em instantes.',
}

/** Status HTTP de cada codigo, para o `invoke` do front cair no ramo certo. */
const STATUS_POR_CODIGO: Record<Codigo, number> = {
  SEM_SESSAO: 401,
  SEM_PERMISSAO: 403,
  NAO_ENCONTRADO: 404,
  ENTRADA_INVALIDA: 400,
  TOKEN_EXPIRADO: 409,
  LIMITE_DE_TAXA: 429,
  SEM_DADO_SUFICIENTE: 409,
  FALHA_DE_REDE: 502,
  FALHA_INESPERADA: 500,
}

export interface ErroDeServico {
  codigo: Codigo
  mensagem: string
}

export interface Envelope<T = unknown> {
  data: T | null
  error: ErroDeServico | null
  meta: { carimbo: string; versao: '1'; origem: 'supabase' }
}

/**
 * Origem da chamada permitida no CORS. Sem valor no ambiente, nenhuma origem e
 * ecoada: `*` num endpoint que aceita JWT convida qualquer site a chamar a
 * funcao com a sessao do cliente aberta. Endereco de aplicacao nunca e literal
 * no codigo (CLAUDE.md, Seguranca).
 */
const ORIGENS_PERMITIDAS = (Deno.env.get('KORA_ORIGENS_PERMITIDAS') ?? '')
  .split(',')
  .map((origem) => origem.trim())
  .filter((origem) => origem.length > 0)

/**
 * Cabecalhos de CORS para a origem que chamou.
 *
 * @param origem valor do cabecalho `Origin` da requisicao
 * @returns cabecalhos a incluir na resposta
 */
export function cabecalhosDeCors(origem: string | null): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) {
    cabecalhos['Access-Control-Allow-Origin'] = origem
  }
  return cabecalhos
}

/**
 * Monta o `meta` do envelope.
 *
 * @returns meta com carimbo do instante da resposta
 */
function montarMeta(): Envelope['meta'] {
  return { carimbo: new Date().toISOString(), versao: '1', origem: 'supabase' }
}

/**
 * Resposta de sucesso no envelope do produto.
 *
 * @param data conteudo da resposta
 * @param origem cabecalho `Origin` da requisicao, para o CORS
 * @returns resposta HTTP 200
 */
export function responderOk<T>(data: T, origem: string | null): Response {
  const corpo: Envelope<T> = { data, error: null, meta: montarMeta() }
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cabecalhosDeCors(origem) },
  })
}

/**
 * Resposta de falha no envelope do produto.
 *
 * A `mensagem` e sempre uma frase nossa em pt-BR. Mensagem crua da Meta ou do
 * Postgres nao passa por aqui: ela entrega nome de tabela, id interno e formato
 * de schema para quem estiver do outro lado (`src/lib/erros.js`).
 *
 * @param codigo codigo estavel do produto
 * @param mensagem frase pt-BR; sem ela, a do proprio codigo
 * @param origem cabecalho `Origin` da requisicao, para o CORS
 * @returns resposta HTTP com o status do codigo
 */
export function responderFalha(
  codigo: Codigo,
  mensagem: string | null,
  origem: string | null,
): Response {
  const corpo: Envelope<null> = {
    data: null,
    error: { codigo, mensagem: mensagem ?? MENSAGENS[codigo] },
    meta: montarMeta(),
  }
  return new Response(JSON.stringify(corpo), {
    status: STATUS_POR_CODIGO[codigo],
    headers: { 'Content-Type': 'application/json', ...cabecalhosDeCors(origem) },
  })
}

/**
 * Le o corpo JSON da requisicao sem deixar um corpo torto derrubar a funcao.
 *
 * @param requisicao requisicao HTTP
 * @returns objeto do corpo, ou `{}` quando nao ha corpo JSON valido
 */
export async function lerCorpo(requisicao: Request): Promise<Record<string, unknown>> {
  try {
    const corpo = await requisicao.json()
    return corpo && typeof corpo === 'object' ? corpo as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Nomes de campo cujo valor nunca sai em log, seja qual for o conteudo. */
const CHAVES_SENSIVEIS =
  /^(access_token|refresh_token|client_secret|app_secret|apikey|api_key|authorization|token|token_ref|senha|password|secret)$/i

/**
 * Formatos que denunciam um segredo mesmo dentro de um texto livre: token de
 * usuario da Meta e JWT. Servem para o caso em que o segredo chega concatenado
 * numa mensagem de erro, onde nao ha chave para inspecionar.
 */
const PADROES_SENSIVEIS = [
  /\bEA[A-Za-z0-9]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
]

/**
 * Troca por `[oculto]` o valor de toda chave sensivel, em qualquer profundidade.
 *
 * Mascarar **antes** de serializar, e nao depois: a versao anterior rodava a
 * expressao sobre a saida do `JSON.stringify`, onde o nome do campo vem entre
 * aspas (`"token":"..."`), e o padrao exigia `token` seguido de `:` — a aspa no
 * meio fazia o unico padrao generico de segredo nunca casar. Um
 * `client_secret` passava inteiro para o painel de logs.
 *
 * @param valor qualquer valor serializavel
 * @returns copia com os campos sensiveis ocultos
 */
export function mascarar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(mascarar)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, conteudo]) => [
        chave,
        CHAVES_SENSIVEIS.test(chave) ? '[oculto]' : mascarar(conteudo),
      ]),
    )
  }
  return valor
}

/**
 * Log de operacao com o que for sensivel mascarado.
 *
 * A mascara e a ultima linha de defesa, nao a primeira: a regra continua sendo
 * nao passar token para ca (docs/11_SEGURANCA, "Edge Functions"). Ela existe
 * porque um dia alguem vai logar o payload inteiro por engano, e nesse dia o
 * token nao pode acabar no painel de logs.
 *
 * @param evento nome curto do que aconteceu
 * @param dados campos adicionais, ja sem dado pessoal
 */
export function registrar(evento: string, dados: Record<string, unknown> = {}): void {
  let linha = JSON.stringify({ evento, ...(mascarar(dados) as Record<string, unknown>) })
  for (const padrao of PADROES_SENSIVEIS) linha = linha.replace(padrao, '[oculto]')
  console.log(linha)
}

/**
 * A requisicao veio com a chave de servico?
 *
 * Vale para as funcoes que o cron dispara: elas nao tem usuario, e sem esta
 * checagem qualquer um na internet dispararia a coleta de todas as contas.
 * A comparacao percorre os dois valores inteiros para nao vazar o tamanho do
 * prefixo correto pelo tempo de resposta.
 *
 * @param requisicao requisicao HTTP
 * @returns true se o `Authorization` traz a chave de servico
 */
export function ehChamadaDeServico(requisicao: Request): boolean {
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cabecalho = requisicao.headers.get('Authorization') ?? ''
  const enviada = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : ''
  if (chave.length === 0 || enviada.length !== chave.length) return false

  let diferenca = 0
  for (let i = 0; i < chave.length; i += 1) {
    diferenca |= chave.charCodeAt(i) ^ enviada.charCodeAt(i)
  }
  return diferenca === 0
}
