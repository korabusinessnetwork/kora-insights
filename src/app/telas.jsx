/**
 * A composicao do produto: qual feature responde por cada rota do contrato.
 *
 * Mora fora de `main.jsx` para poder ser montada em teste sem subir o app. E
 * isso importa: feature construida, testada e nao ligada aqui simplesmente nao
 * existe — nem para o usuario nem no bundle de producao. Foi o que aconteceu
 * com autenticacao, conexao e relatorio, tres features prontas que subiam como
 * "esta tela ainda nao foi construida" porque ninguem validou a juncao.
 */

import { Navigate, useParams } from 'react-router-dom'

import { Estado } from '../components/shared/index.js'
import { rotaDaConta } from '../constants/rotas.js'
import { useTenant } from '../context/TenantContexto.jsx'
import { Entrar } from '../features/autenticacao/index.js'
import { Conectar, RetornoDaConexao } from '../features/conexao/index.js'
import { Diagnostico } from '../features/diagnostico/index.js'
import { Historico } from '../features/historico/index.js'
import { Relatorio } from '../features/relatorio/index.js'

/**
 * Costura entre a rota e a feature: o id da conta vive na URL, e a tela de
 * diagnóstico o recebe por prop. Com isso a feature continua sem conhecer rota,
 * e o contrato de rotas continua sem conhecer feature.
 *
 * @returns {JSX.Element}
 */
function DiagnosticoDaRota() {
  const { contaId } = useParams()
  const { contas } = useTenant()
  // A conta vem daqui, e nao de dentro da feature: a tela precisa do estado
  // dela para nao culpar a nossa rotina por um diagnostico que parou porque o
  // cliente desconectou a conta. Feature nao le contexto de aplicacao.
  return <Diagnostico contaId={contaId} conta={contas?.find((c) => c.id === contaId) ?? null} />
}

/**
 * O relatorio da conta que esta na URL. Mesma costura do diagnostico, e de
 * proposito: as duas telas leem o MESMO registro de diagnostico, e a rota e a
 * unica coisa que as diferencia.
 *
 * @returns {JSX.Element}
 */
function RelatorioDaRota() {
  const { contaId } = useParams()
  return <Relatorio contaId={contaId} />
}

/**
 * `/contas`: vazio, ou vai para a primeira conta (contratos.md, seção 6).
 *
 * Sem conta conectada, `Diagnostico` já renderiza o estado vazio com os passos
 * até o primeiro diagnóstico — o mesmo componente, e não uma segunda tela de
 * vazio para manter em sincronia.
 *
 * @returns {JSX.Element}
 */
/**
 * O historico de diagnosticos da conta que esta na URL.
 *
 * @returns {JSX.Element}
 */
function HistoricoDaRota() {
  const { contaId } = useParams()
  return <Historico contaId={contaId} />
}

function ContasDaRota() {
  const { contaSelecionada, carregando } = useTenant()
  if (carregando) return <Estado tipo="carregando" titulo="Buscando suas contas conectadas" />
  if (contaSelecionada) return <Navigate to={rotaDaConta(contaSelecionada.id)} replace />
  return <Diagnostico />
}

/**
 * Qual feature responde por cada rota do contrato (contratos.md, secao 6).
 * `telas.test.jsx` cobra que nenhuma entrada aqui fique vazia.
 *
 * @type {import('./rotas.jsx').Telas}
 */
export const TELAS = {
  entrada: <Entrar />,
  conexao: <Conectar />,
  retornoDaConexao: <RetornoDaConexao />,
  contas: <ContasDaRota />,
  diagnostico: <DiagnosticoDaRota />,
  relatorio: <RelatorioDaRota />,
  historico: <HistoricoDaRota />,
}

export default TELAS
