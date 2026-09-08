/**
 * Codigos de erro do produto e traducao do erro cru que vem do Supabase.
 *
 * Duas regras desenham este modulo:
 *
 * 1. `codigo` e estavel entre versoes e e por ele que a tela decide o que fazer.
 *    `mensagem` e pt-BR, muda quando o texto melhorar, e e o que o cliente le
 *    (contratos.md, secao 1).
 * 2. A mensagem crua do banco **nunca** chega a tela. "column ig_contas.token_ref
 *    does not exist" entrega nome de tabela, nome de coluna e formato de schema
 *    para quem estiver do outro lado. Fora de producao ela vai em `error.detalhe`,
 *    onde ajuda quem depura e ninguem mais ve.
 */

/**
 * Codigos estaveis da camada de servicos (contratos.md, secao 1).
 * @type {Readonly<Record<string, string>>}
 */
export const CODIGOS = Object.freeze({
  SEM_SESSAO: 'SEM_SESSAO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  ENTRADA_INVALIDA: 'ENTRADA_INVALIDA',
  TOKEN_EXPIRADO: 'TOKEN_EXPIRADO',
  LIMITE_DE_TAXA: 'LIMITE_DE_TAXA',
  SEM_DADO_SUFICIENTE: 'SEM_DADO_SUFICIENTE',
  FALHA_DE_REDE: 'FALHA_DE_REDE',
  FALHA_INESPERADA: 'FALHA_INESPERADA',
})

/**
 * Frase de cada codigo. Diz o que aconteceu e, quando existe, o que fazer —
 * sem jargao, sem culpar o cliente e sem nomear peca interna do sistema.
 * @type {Readonly<Record<string, string>>}
 */
export const MENSAGENS = Object.freeze({
  [CODIGOS.SEM_SESSAO]: 'Sua sessão expirou. Entre de novo para continuar.',
  [CODIGOS.SEM_PERMISSAO]: 'Esta conta não pertence ao seu espaço de trabalho.',
  [CODIGOS.NAO_ENCONTRADO]: 'Não encontramos este registro.',
  [CODIGOS.ENTRADA_INVALIDA]: 'Os dados enviados não são válidos.',
  [CODIGOS.TOKEN_EXPIRADO]:
    'A autorização do Instagram expirou. Reconecte a conta para retomar a coleta.',
  [CODIGOS.LIMITE_DE_TAXA]:
    'A Meta recusou por excesso de chamadas. Tente de novo em alguns minutos.',
  [CODIGOS.SEM_DADO_SUFICIENTE]:
    'Ainda não há histórico suficiente para diagnosticar esta conta.',
  [CODIGOS.FALHA_DE_REDE]:
    'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  [CODIGOS.FALHA_INESPERADA]: 'Algo saiu do esperado. Tente de novo em instantes.',
})

/**
 * Codigo do PostgREST ou do Postgres para codigo nosso.
 *
 * `42501` (RLS negou) so aparece em escrita: **leitura negada por RLS chega como
 * conjunto vazio, nao como erro**. Por isso a distincao entre "nao existe" e
 * "nao e seu" nao mora aqui — mora em quem consultou, que sabe se conseguiu ver
 * a conta dona do registro (ver `contas.contaEstaVisivel`).
 *
 * @type {Readonly<Record<string, string>>}
 */
const POR_CODIGO_DO_BANCO = Object.freeze({
  PGRST100: CODIGOS.ENTRADA_INVALIDA, // filtro malformado
  PGRST116: CODIGOS.NAO_ENCONTRADO, // .single() sem linha
  PGRST202: CODIGOS.FALHA_INESPERADA, // funcao ausente no schema cache
  PGRST204: CODIGOS.FALHA_INESPERADA, // coluna ausente no schema cache
  PGRST301: CODIGOS.SEM_SESSAO, // JWT ausente ou expirado
  PGRST302: CODIGOS.SEM_SESSAO,
  '22P02': CODIGOS.ENTRADA_INVALIDA, // texto invalido para o tipo (uuid torto)
  '23502': CODIGOS.ENTRADA_INVALIDA,
  '23503': CODIGOS.ENTRADA_INVALIDA,
  '23505': CODIGOS.ENTRADA_INVALIDA,
  '23514': CODIGOS.ENTRADA_INVALIDA,
  '42501': CODIGOS.SEM_PERMISSAO, // RLS negou a escrita
  '42703': CODIGOS.FALHA_INESPERADA, // coluna inexistente
  '42P01': CODIGOS.FALHA_INESPERADA, // tabela inexistente
  '57014': CODIGOS.FALHA_DE_REDE, // consulta cancelada por timeout
})

/** Status HTTP para codigo nosso, usado quando nao ha codigo de banco. */
const POR_STATUS = Object.freeze({
  400: CODIGOS.ENTRADA_INVALIDA,
  401: CODIGOS.SEM_SESSAO,
  403: CODIGOS.SEM_PERMISSAO,
  404: CODIGOS.NAO_ENCONTRADO,
  409: CODIGOS.ENTRADA_INVALIDA,
  422: CODIGOS.ENTRADA_INVALIDA,
  429: CODIGOS.LIMITE_DE_TAXA,
})

/** Tamanho maximo do detalhe tecnico. Log gigante nao ajuda ninguem a depurar. */
const LIMITE_DO_DETALHE = 400

/**
 * `import.meta.env.DEV` chega como booleano no Vite e pode chegar como texto
 * quando alguem sobrescreve o ambiente. Comparar com `true` nas duas formas
 * evita o pior dos mundos: `'false'` e uma string, e string e sempre truthy —
 * seria detalhe cru de banco vazando em producao por causa de uma coercao.
 *
 * @returns {boolean}
 */
function estaEmDesenvolvimento() {
  const dev = import.meta.env?.DEV
  return dev === true || dev === 'true'
}

/**
 * Monta o detalhe tecnico do erro. Devolve `undefined` em producao: e a unica
 * garantia de que estrutura de schema nao viaja para o navegador do cliente.
 *
 * @param {object} erro erro cru
 * @returns {string|undefined}
 */
function detalheTecnico(erro) {
  if (!estaEmDesenvolvimento()) return undefined
  const partes = [erro?.code, erro?.message, erro?.details, erro?.hint].filter(
    (parte) => typeof parte === 'string' && parte.length > 0,
  )
  if (partes.length === 0) return undefined
  return partes.join(' | ').slice(0, LIMITE_DO_DETALHE)
}

/**
 * Erro de servico pronto para o envelope.
 *
 * @param {string} codigo um valor de `CODIGOS`
 * @param {string} [mensagem] frase pt-BR; padrao: a mensagem do codigo
 * @param {string} [detalhe] texto tecnico, so fora de producao
 * @returns {{ codigo: string, mensagem: string, detalhe?: string }}
 */
export function erroDeServico(codigo, mensagem, detalhe) {
  const codigoValido = CODIGOS[codigo] ?? CODIGOS.FALHA_INESPERADA
  const erro = { codigo: codigoValido, mensagem: mensagem ?? MENSAGENS[codigoValido] }
  if (detalhe) erro.detalhe = detalhe
  return erro
}

/**
 * O erro parece falha de transporte? `fetch` recusado nao tem `code` de banco
 * nem status: chega como TypeError, e confundir isso com FALHA_INESPERADA faz a
 * tela mandar o cliente "tentar de novo em instantes" quando o problema e o
 * wi-fi dele.
 *
 * @param {object} erro
 * @returns {boolean}
 */
function pareceFalhaDeRede(erro) {
  const nome = String(erro?.name ?? '')
  if (nome === 'AbortError' || nome === 'TimeoutError' || nome === 'FunctionsFetchError') return true
  const mensagem = String(erro?.message ?? '').toLowerCase()
  return (
    mensagem.includes('failed to fetch') ||
    mensagem.includes('networkerror') ||
    mensagem.includes('network error') ||
    mensagem.includes('load failed') ||
    mensagem.includes('fetch failed')
  )
}

/**
 * Traduz qualquer erro que chegue do Supabase, de uma Edge Function ou do
 * proprio `fetch` para um erro de servico nosso.
 *
 * Um erro que ja traga `codigo` nosso passa direto: e o caso da Edge Function,
 * que responde no mesmo envelope e e quem sabe dizer `TOKEN_EXPIRADO` ou
 * `LIMITE_DE_TAXA` — dois estados que so existem do lado que fala com a Meta.
 *
 * @param {object|null|undefined} erro erro cru
 * @returns {{ codigo: string, mensagem: string, detalhe?: string }}
 */
export function traduzirErroDoSupabase(erro) {
  // Ausencia de erro aqui e defeito de quem chamou, e vira falha inesperada em
  // vez de `null`: um tradutor que devolve nulo produz envelope de erro vazio.
  if (!erro) return erroDeServico(CODIGOS.FALHA_INESPERADA)

  if (typeof erro.codigo === 'string' && CODIGOS[erro.codigo]) {
    const mensagem = typeof erro.mensagem === 'string' ? erro.mensagem : undefined
    return erroDeServico(erro.codigo, mensagem, detalheTecnico(erro))
  }

  if (pareceFalhaDeRede(erro)) {
    return erroDeServico(CODIGOS.FALHA_DE_REDE, undefined, detalheTecnico(erro))
  }

  const codigoDoBanco = erro.code != null ? String(erro.code) : ''
  if (POR_CODIGO_DO_BANCO[codigoDoBanco]) {
    return erroDeServico(POR_CODIGO_DO_BANCO[codigoDoBanco], undefined, detalheTecnico(erro))
  }

  const status = Number(erro.status ?? erro.statusCode ?? 0)
  if (POR_STATUS[status]) {
    return erroDeServico(POR_STATUS[status], undefined, detalheTecnico(erro))
  }
  if (status >= 500) return erroDeServico(CODIGOS.FALHA_DE_REDE, undefined, detalheTecnico(erro))

  return erroDeServico(CODIGOS.FALHA_INESPERADA, undefined, detalheTecnico(erro))
}

/**
 * Frase pt-BR de um erro cru. Nome exigido por contratos.md (secao 4); a
 * traducao completa, com codigo, esta em `traduzirErroDoSupabase`.
 *
 * @param {object} erroDoSupabase
 * @returns {string}
 */
export function mensagemDoErro(erroDoSupabase) {
  return traduzirErroDoSupabase(erroDoSupabase).mensagem
}
