/**
 * Porta unica da feature de diagnostico.
 *
 * O shell de rotas importa daqui, nunca de um arquivo interno: mover um bloco
 * entre componentes nao pode quebrar a rota `/contas/:contaId`
 * (contratos.md, secao 6).
 */

export { default as Diagnostico } from './components/Diagnostico.jsx'
export { default as PainelDeEvidencia } from './components/PainelDeEvidencia.jsx'
export { default as AcaoRecomendada } from './components/AcaoRecomendada.jsx'
export { default as LimitesDoDiagnostico } from './components/LimitesDoDiagnostico.jsx'
export {
  default as SemContaConectada,
  PASSOS_ATE_O_DIAGNOSTICO,
  ROTA_DE_CONEXAO,
} from './components/SemContaConectada.jsx'
export { default as useDiagnostico, ESTADOS } from './hooks/useDiagnostico.js'
