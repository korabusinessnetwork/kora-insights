/**
 * Ruleset 0.3.0 — o metodo da Atmosfera Viral em codigo.
 *
 * A ordem desta lista nao decide nada: o motor ordena os achados por peso. Ela
 * segue o peso so para a leitura do arquivo bater com a leitura da tela.
 */

import cadencia from './cadencia.js'
import consistencia from './consistencia.js'
import dadoInsuficiente from './dadoInsuficiente.js'
import formatoQueSalva from './formatoQueSalva.js'

export const versao = '0.3.0'

export const regras = [dadoInsuficiente, cadencia, formatoQueSalva, consistencia]

export default { versao, regras }
