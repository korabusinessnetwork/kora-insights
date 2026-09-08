/**
 * Porta unica da feature de relatorio.
 *
 * A composicao de rotas importa daqui, nunca de um arquivo interno: mover um
 * bloco entre componentes nao pode quebrar a rota `/contas/:contaId/relatorio`
 * (contratos.md, secao 6).
 */

export { default as Relatorio } from './components/Relatorio.jsx'
export {
  default as FolhaDoRelatorio,
  inicioDaSemanaEncerrada,
} from './components/FolhaDoRelatorio.jsx'
export { default as BarraDeAcoes } from './components/BarraDeAcoes.jsx'
export { default as useRelatorio, ESTADOS } from './hooks/useRelatorio.js'
