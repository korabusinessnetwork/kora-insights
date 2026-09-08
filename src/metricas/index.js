/**
 * Porta de entrada de `src/metricas`.
 *
 * Quem consome importa daqui: dicionário, formatação e adaptadores são um
 * módulo só do ponto de vista das outras camadas. Nenhuma delas precisa saber
 * que existe um arquivo por versão de API — essa é justamente a indireção que
 * o ADR-003 comprou.
 */

export * from './dicionario.js'
export * from './formatar.js'
export * from './adaptadores/index.js'
