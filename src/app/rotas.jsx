import { Navigate, Route, Routes } from 'react-router-dom'

import { ROTAS } from '../constants/rotas.js'
import Casca from './Casca.jsx'
import RotaProtegida from './RotaProtegida.jsx'
import Dados from './paginas/Dados.jsx'
import Privacidade from './paginas/Privacidade.jsx'

/**
 * A árvore de rotas (docs/01_ARQUITETURA/contratos.md, seção 6).
 *
 * As telas de feature chegam por `telas`, e não por import daqui. A composição
 * acontece em `main.jsx`, que é o único lugar do produto que precisa saber onde
 * cada feature mora — assim a árvore de rotas pode ser montada em teste com
 * telas de mentira, sem subir nenhuma feature de verdade, e trocar uma tela de
 * lugar não mexe no contrato de rotas.
 *
 * Três camadas, de fora para dentro: rota pública, portão de sessão
 * (`RotaProtegida`), casca da aplicação. A ordem importa — a casca desenha o
 * cabeçalho com a conta em foco, e desenhar isso antes de saber quem está
 * autenticado seria mostrar espaço de trabalho para quem não entrou.
 */

/**
 * @typedef {object} Telas
 * @property {import('react').ReactNode} entrada `/entrar`
 * @property {import('react').ReactNode} conexao `/conectar`
 * @property {import('react').ReactNode} retornoDaConexao `/conectar/retorno`
 * @property {import('react').ReactNode} contas `/contas`
 * @property {import('react').ReactNode} diagnostico `/contas/:contaId`
 * @property {import('react').ReactNode} relatorio `/contas/:contaId/relatorio`
 * @property {import('react').ReactNode} historico `/contas/:contaId/historico`
 */

/**
 * @param {{ telas: Telas }} props
 * @returns {JSX.Element}
 */
export default function Rotas({ telas }) {
  return (
    <Routes>
      {/* A raiz manda para as contas e deixa o portão decidir: quem não tem
          sessão volta de lá para a entrada, com o destino guardado. Assim a
          decisão de "logado ou não" mora em um lugar só. */}
      <Route path={ROTAS.raiz} element={<Navigate to={ROTAS.contas} replace />} />

      <Route path={ROTAS.entrar} element={telas.entrada} />
      <Route path={ROTAS.privacidade} element={<Privacidade />} />
      <Route path={ROTAS.dados} element={<Dados />} />

      <Route element={<RotaProtegida />}>
        <Route element={<Casca />}>
          <Route path={ROTAS.conectar} element={telas.conexao} />
          <Route path={ROTAS.retornoDaConexao} element={telas.retornoDaConexao} />
          <Route path={ROTAS.contas} element={telas.contas} />
          <Route path={ROTAS.conta} element={telas.diagnostico} />
          <Route path={ROTAS.relatorio} element={telas.relatorio} />
          <Route path={ROTAS.historico} element={telas.historico} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROTAS.raiz} replace />} />
    </Routes>
  )
}
