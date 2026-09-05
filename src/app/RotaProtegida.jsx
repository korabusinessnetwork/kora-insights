import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Estado } from '../components/shared/index.js'
import { rotaDeEntrada } from '../constants/rotas.js'
import { useSessao } from '../context/SessaoContexto.jsx'

/**
 * O portão das rotas protegidas (contratos.md, seção 6).
 *
 * A sessão é conferida **antes** de renderizar (CLAUDE.md, Segurança) e há três
 * respostas possíveis, nunca duas: enquanto a resposta não existe, a tela diz
 * que está conferindo. Mandar para a entrada nesse intervalo faria a tela de
 * login piscar para quem já está logado, e mostrar o conteúdo faria rota
 * protegida aparecer sem autenticação — o segundo é falha de segurança, o
 * primeiro é falha de intuitividade, e nenhum dos dois é aceitável.
 *
 * @param {{ children?: import('react').ReactNode }} props sem `children`,
 *   protege as rotas filhas por `<Outlet />`
 * @returns {JSX.Element}
 */
export default function RotaProtegida({ children }) {
  const { carregando, sessao } = useSessao()
  const localizacao = useLocation()

  if (carregando) {
    return (
      <Estado
        tipo="carregando"
        titulo="Conferindo sua sessão"
        descricao="Só um instante — não abrimos nada sem saber quem é você."
      />
    )
  }

  if (!sessao) {
    const destino = `${localizacao.pathname}${localizacao.search}`
    return <Navigate to={rotaDeEntrada(destino)} replace />
  }

  return children ?? <Outlet />
}
