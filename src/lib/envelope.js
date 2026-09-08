/**
 * O envelope de resposta da camada de servicos (contratos.md, secao 1).
 *
 * Toda funcao de `src/lib/` devolve `{ data, error, meta }` — inclusive em
 * sucesso. Formato unico significa que a tela escreve um caminho de erro so, e
 * que nenhuma resposta chega sem dizer de onde veio.
 *
 * `meta.origem` e o unico ponto em que a tela percebe estar em demonstracao. Ele
 * nao e passado a mao em cada retorno: sai de `estaEmModoDemonstracao()`, porque
 * rotulo de origem preenchido a mao e rotulo que um dia mente.
 */

import { estaEmModoDemonstracao } from './supabase.js'

/** Versao do formato do envelope. Muda junto com contratos.md, nunca sozinha. */
export const VERSAO_DO_ENVELOPE = '1'

export const ORIGEM_SUPABASE = 'supabase'
export const ORIGEM_DEMONSTRACAO = 'demonstracao'

/**
 * @typedef {{ carimbo: string, versao: '1', origem: 'supabase'|'demonstracao' }} MetaEnvelope
 * @typedef {{ codigo: string, mensagem: string, detalhe?: string }} ErroDeServico
 * @typedef {{ data: unknown, error: ErroDeServico|null, meta: MetaEnvelope }} Envelope
 */

/**
 * Completa a meta do envelope. `carimbo` e o instante da resposta, nao do dado:
 * quando a tela mostrar "atualizado ha 3 minutos", quem responde essa pergunta
 * e o `geradoEm` do diagnostico, nao este campo.
 *
 * @param {Partial<MetaEnvelope>} [parcial]
 * @returns {MetaEnvelope}
 */
export function montarMeta(parcial = {}) {
  return {
    carimbo: parcial.carimbo ?? new Date().toISOString(),
    versao: VERSAO_DO_ENVELOPE,
    origem: parcial.origem ?? (estaEmModoDemonstracao() ? ORIGEM_DEMONSTRACAO : ORIGEM_SUPABASE),
  }
}

/**
 * Envelope de sucesso.
 *
 * @param {unknown} data
 * @param {Partial<MetaEnvelope>} [meta]
 * @returns {Envelope}
 */
export function ok(data, meta) {
  return { data, error: null, meta: montarMeta(meta) }
}

/**
 * Envelope de falha. `data` e sempre `null`: resposta com erro e dado parcial ao
 * mesmo tempo convida a tela a renderizar meia verdade.
 *
 * @param {string} codigo um valor de `CODIGOS` (erros.js)
 * @param {string} mensagem frase pt-BR que vai para a tela
 * @param {string} [detalhe] texto tecnico; so preenchido fora de producao
 * @returns {Envelope}
 */
export function falha(codigo, mensagem, detalhe) {
  const error = { codigo, mensagem }
  if (detalhe) error.detalhe = detalhe
  return { data: null, error, meta: montarMeta() }
}

/**
 * Reempacota um erro ja traduzido (`erros.js`) como envelope de falha.
 *
 * @param {ErroDeServico} erro
 * @returns {Envelope}
 */
export function falhaDeErro(erro) {
  return falha(erro.codigo, erro.mensagem, erro.detalhe)
}
