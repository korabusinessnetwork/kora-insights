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
import { ROTAS, rotaDaConta } from '../constants/rotas.js'
import { useTenant } from '../context/TenantContexto.jsx'
import { Entrar } from '../features/autenticacao/index.js'
import { Conectar, RetornoDaConexao } from '../features/conexao/index.js'
import { Diagnostico } from '../features/diagnostico/index.js'
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
  return <Diagnostico contaId={contaId} />
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
function ContasDaRota() {
  const { contaSelecionada, carregando } = useTenant()
  if (carregando) return <Estado tipo="carregando" titulo="Buscando suas contas conectadas" />
  if (contaSelecionada) return <Navigate to={rotaDaConta(contaSelecionada.id)} replace />
  return <Diagnostico />
}

/**
 * Rota que existe no contrato e ainda não tem tela construída.
 *
 * Enquanto a feature não chega, a rota diz isso em voz alta. Tela em branco
 * seria a lacuna silenciosa que o produto proíbe — e some do radar de quem
 * for ligar a feature depois.
 *
 * @param {string} rota caminho da rota, como está em `ROTAS`
 * @returns {JSX.Element}
 */
function telaAusente(rota) {
  return (
    <Estado
      tipo="erro"
      titulo="Esta tela ainda não foi construída"
      descricao={`A rota ${rota} está no contrato, mas nenhuma feature foi ligada a ela ainda.`}
    />
  )
}

/**
 * Rotas do contrato que ainda nao tem tela. Lista explicita para o teste de
 * composicao saber o que cobrar — e para a divida ficar visivel, nao implicita.
 *
 * @type {string[]}
 */
export const ROTAS_SEM_TELA = ['historico']

/** @type {import('./rotas.jsx').Telas} */
export const TELAS = {
  entrada: <Entrar />,
  conexao: <Conectar />,
  retornoDaConexao: <RetornoDaConexao />,
  contas: <ContasDaRota />,
  diagnostico: <DiagnosticoDaRota />,
  relatorio: <RelatorioDaRota />,
  historico: telaAusente(ROTAS.historico),
}

export default TELAS
