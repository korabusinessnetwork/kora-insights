/**
 * Ruleset vigente. Quem gera diagnostico importa daqui e nunca de uma versao
 * especifica: trocar a versao vigente e mudar uma linha, e o diagnostico ja
 * gravado continua carregando a versao com que foi gerado (ADR-005).
 */

import ruleset from './0.3.0/index.js'

export const versao = ruleset.versao

export const regras = ruleset.regras

export default ruleset
