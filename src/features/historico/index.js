/**
 * Porta unica da feature de historico.
 *
 * A composicao de rotas importa daqui, nunca de um arquivo interno: mover um
 * bloco entre componentes nao pode quebrar `/contas/:contaId/historico`
 * (contratos.md, secao 6).
 */

export { default as Historico } from './components/Historico.jsx'
export { default as useHistorico, ESTADOS } from './hooks/useHistorico.js'
