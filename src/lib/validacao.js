/**
 * Validadores puros usados **antes** de tocar o banco.
 *
 * Entrada invalida vira `ENTRADA_INVALIDA` aqui, na borda, e nao vira consulta.
 * Nao e so higiene: um id torto que chega ao Postgres volta como `22P02` com
 * texto que descreve o tipo da coluna, e a diferenca entre "id invalido" e "id
 * que nao existe" some no meio do caminho.
 *
 * Modulo puro: sem rede, sem DOM, sem relogio.
 */

/** Uuid em qualquer versao. Rejeitar versao seria rejeitar id valido do banco. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Identificador da fixture de demonstracao (`conta-casa-oliveira`).
 * Minusculas, digitos e hifen simples entre blocos — o suficiente para que
 * nenhum separador de filtro do PostgREST (virgula, parenteses, ponto) passe.
 */
const IDENTIFICADOR_LEGIVEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Local part sem espaco e sem separador; dominio com ao menos um ponto. */
const EMAIL =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Data e hora com fuso explicito. Instante sem fuso e instante ambiguo. */
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/

/** Estado do OAuth gerado por `conexaoMeta.gerarEstadoDeOAuth`: 32 hex. */
const ESTADO_DE_OAUTH = /^[0-9a-f]{32}$/

/** Codigo de autorizacao da Meta: alfanumerico com separadores seguros de URL. */
const CODIGO_DE_OAUTH = /^[A-Za-z0-9._~-]{8,2048}$/

/** @param {unknown} valor @returns {boolean} */
export function ehTextoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

/** @param {unknown} valor @returns {boolean} */
export function ehUuid(valor) {
  return typeof valor === 'string' && UUID.test(valor)
}

/**
 * Identificador aceito pela camada: uuid do Supabase **ou** identificador
 * legivel da fixture.
 *
 * As duas formas convivem de proposito. O modo de demonstracao usa
 * `conta-casa-oliveira` porque id legivel e o que faz a fixture ser conferivel a
 * olho; exigir uuid aqui quebraria a demonstracao inteira, e aceitar qualquer
 * texto deixaria passar filtro do PostgREST disfarcado de id.
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
export function ehIdentificador(valor) {
  if (typeof valor !== 'string') return false
  if (valor.length < 3 || valor.length > 64) return false
  return UUID.test(valor) || IDENTIFICADOR_LEGIVEL.test(valor)
}

/** @param {unknown} valor @returns {boolean} */
export function ehIdentificadorDeConta(valor) {
  return ehIdentificador(valor)
}

/** @param {unknown} valor @returns {boolean} */
export function ehIdentificadorDeTenant(valor) {
  return ehIdentificador(valor)
}

/**
 * E-mail plausivel. Nao existe regex que decida se um endereco recebe mensagem;
 * o que existe e a barreira contra erro de digitacao e contra texto que nao e
 * e-mail. A confirmacao real e o link que o usuario recebe.
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
export function ehEmail(valor) {
  if (typeof valor !== 'string') return false
  const limpo = valor.trim()
  if (limpo.length < 6 || limpo.length > 254) return false
  const [local] = limpo.split('@')
  if (!local || local.length > 64) return false
  return EMAIL.test(limpo)
}

/**
 * Data existe mesmo no calendario. `2026-02-30` casa com a expressao regular e
 * nao e dia nenhum: sem esta checagem viraria filtro silencioso e serie vazia.
 *
 * @param {unknown} valor `YYYY-MM-DD`
 * @returns {boolean}
 */
export function ehDataIso(valor) {
  if (typeof valor !== 'string') return false
  const partes = DATA_ISO.exec(valor)
  if (!partes) return false
  const [, ano, mes, dia] = partes.map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  )
}

/**
 * Instante ISO 8601 com fuso explicito (`Z` ou deslocamento).
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
export function ehIso8601(valor) {
  if (typeof valor !== 'string') return false
  const partes = ISO_8601.exec(valor)
  if (!partes) return false
  if (!ehDataIso(valor.slice(0, 10))) return false
  const hora = Number(partes[4])
  const minuto = Number(partes[5])
  const segundo = Number(partes[6] ?? 0)
  return hora <= 23 && minuto <= 59 && segundo <= 59
}

/**
 * Inteiro dentro de um intervalo fechado. Usado em `opcoes.limite`: limite sem
 * teto vira consulta que traz a tabela inteira.
 *
 * @param {unknown} valor
 * @param {number} minimo
 * @param {number} maximo
 * @returns {boolean}
 */
export function ehInteiroEntre(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

/** @param {unknown} valor @returns {boolean} */
export function ehEstadoDeOAuth(valor) {
  return typeof valor === 'string' && ESTADO_DE_OAUTH.test(valor)
}

/** @param {unknown} valor @returns {boolean} */
export function ehCodigoDeOAuth(valor) {
  return typeof valor === 'string' && CODIGO_DE_OAUTH.test(valor)
}
