import { Link, Outlet } from 'react-router-dom'

import { Aviso, Botao } from '../components/shared/index.js'
import { estaEmModoDemonstracao } from '../lib/index.js'
import { ROTAS } from '../constants/rotas.js'
import { useSessao } from '../context/SessaoContexto.jsx'
import { useTenant } from '../context/TenantContexto.jsx'
import Cabecalho from './Cabecalho.jsx'
import './Casca.css'

/**
 * A casca das telas autenticadas: barra da identidade, avisos que valem para o
 * produto inteiro, o conteúdo da rota e o rodapé.
 *
 * A casca não sabe o que a rota vai mostrar e não lê diagnóstico. O que ela
 * garante é o que precisa valer em toda tela: um jeito de pular a navegação, o
 * aviso de demonstração, o caminho para a política de privacidade e para a
 * exclusão de dados, e a saída da conta.
 *
 * @returns {JSX.Element}
 */
export default function Casca() {
  const { encerrarSessao } = useSessao()
  const { erro, recarregar } = useTenant()
  const emDemonstracao = estaEmModoDemonstracao()

  return (
    <div className="ka-casca">
      <a className="pular-para-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>

      <Cabecalho />

      {emDemonstracao || erro ? (
        <div className="ka-casca__avisos">
          {/* Dado de exemplo apresentado como dado do cliente é a desonestidade
              que memory/identity.md proíbe: o aviso é permanente, não some com
              o tempo nem tem botão de fechar (ADR-007). */}
          {emDemonstracao ? (
            <Aviso variante="informacao" titulo="Demonstração">
              Os números destas telas vêm de uma conta de exemplo. Nenhuma conta real está
              conectada neste ambiente.
            </Aviso>
          ) : null}

          {erro ? (
            <Aviso
              variante="critico"
              titulo="Espaço de trabalho"
              acao={
                <Botao variante="secundario" aoClicar={recarregar}>
                  Tentar de novo
                </Botao>
              }
            >
              {erro.mensagem}
            </Aviso>
          ) : null}
        </div>
      ) : null}

      <main className="ka-casca__conteudo" id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="ka-casca__rodape" data-imprimir="nao">
        <nav className="ka-casca__links" aria-label="Privacidade e dados">
          <Link to={ROTAS.privacidade}>Política de privacidade</Link>
          <Link to={ROTAS.dados}>Seus dados e exclusão</Link>
        </nav>
        <Botao variante="texto" aoClicar={encerrarSessao}>
          Sair da conta
        </Botao>
      </footer>
    </div>
  )
}
