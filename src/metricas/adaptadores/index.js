/**
 * Registro de adaptadores por versão (ADR-003).
 *
 * Adaptador não é substituído, é acrescentado. Cada snapshot grava a
 * `adapter_version` usada na coleta, e reler uma série antiga com o adaptador da
 * época é o que permite responder "mudou a conta ou mudou a definição da Meta?".
 * Por isso `adaptadorPorVersao` lança em versão desconhecida: um snapshot que
 * aponta para adaptador inexistente é dado que perdeu o próprio significado, e
 * silenciar isso reinterpretaria o passado com a régua de hoje.
 */

import v1 from './v1.js'

/** @typedef {{ versao: string, apiVersion: string, adaptar: Function }} Adaptador */

/** @type {Readonly<Record<string, Adaptador>>} */
export const ADAPTADORES = Object.freeze({ [v1.versao]: v1 })

/** Versão usada por toda coleta nova. */
export const VERSAO_VIGENTE = v1.versao

/**
 * @returns {Adaptador} o adaptador que a coleta de hoje usa
 */
export function adaptadorVigente() {
  return ADAPTADORES[VERSAO_VIGENTE]
}

/**
 * @param {string} versao versão semântica gravada no snapshot
 * @returns {Adaptador}
 * @throws {Error} se não existe adaptador dessa versão
 */
export function adaptadorPorVersao(versao) {
  if (typeof versao !== 'string' || !Object.hasOwn(ADAPTADORES, versao)) {
    const conhecidas = Object.keys(ADAPTADORES).join(', ')
    throw new Error(`Adaptador inexistente: ${String(versao)}. Versões conhecidas: ${conhecidas}.`)
  }
  return ADAPTADORES[versao]
}
