/**
 * Porta unica da feature de conexao.
 *
 * O shell de rotas importa daqui, nunca de um arquivo interno: mover um bloco
 * entre componentes nao pode quebrar `/conectar` nem `/conectar/retorno`
 * (contratos.md, secao 6).
 */

export { default as Conectar } from './components/Conectar.jsx'
export {
  default as RequisitosDaConexao,
  EXPLICACAO_DA_PERMISSAO,
  LIMITES_DA_CONEXAO,
  METRICAS_QUE_LEMOS,
  O_QUE_NAO_FAZEMOS,
  REQUISITOS,
} from './components/RequisitosDaConexao.jsx'
export {
  default as RetornoDaConexao,
  RESPOSTA_POR_MOTIVO,
  SEMANAS_ATE_O_DIAGNOSTICO,
  estimarPrimeiroDiagnostico,
} from './components/RetornoDaConexao.jsx'
export {
  default as useConexao,
  ESTADOS_DA_CONEXAO,
  ESTADOS_DO_RETORNO,
  MOTIVOS,
  useRetornoDaConexao,
} from './hooks/useConexao.js'
