import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Aviso, Botao, Estado, Marca } from '../../components/shared/index.js'
import { solicitarExclusaoDeDados } from '../../lib/index.js'
import { formatarDataCurta } from '../../metricas/index.js'
import { ROTAS } from '../../constants/rotas.js'
import { useSessao } from '../../context/SessaoContexto.jsx'
import { useTenant } from '../../context/TenantContexto.jsx'
import './paginas.css'

/**
 * Seus dados e exclusão — rota pública (contratos.md, seção 6).
 *
 * O App Review exige um caminho público e visível para pedir exclusão de dados,
 * e a LGPD exige o mesmo (docs/11_SEGURANCA/app-review.md, seção 5). As
 * instruções são públicas; o botão que dispara a exclusão só aparece para quem
 * está autenticado, porque apagar o histórico de uma conta é irreversível e não
 * pode depender de alguém digitar um identificador.
 */

/** Data da última revisão deste texto. */
const ATUALIZADA_EM = '2026-09-05'

/**
 * O que a exclusão apaga, na ordem em que a rotina apaga
 * (docs/03_REGRAS_DE_NEGOCIO/conformidade.md, seção 3.2).
 * @type {readonly string[]}
 */
const ITENS_APAGADOS = Object.freeze([
  'Todas as leituras diárias da conta e das publicações.',
  'Todos os diagnósticos gerados a partir delas.',
  'Todo o registro de coleta da conta.',
  'O token de acesso guardado no cofre.',
  'O cadastro da conta conectada.',
])

/**
 * @returns {JSX.Element}
 */
export default function Dados() {
  const { autenticado, carregando: carregandoSessao } = useSessao()
  const { contas, carregando: carregandoContas, erro: erroDoTenant } = useTenant()

  const [confirmando, setConfirmando] = useState(null)
  const [enviando, setEnviando] = useState(null)
  const [comprovante, setComprovante] = useState(null)
  const [erro, setErro] = useState(null)

  /**
   * Dispara a exclusão de uma conta e guarda o comprovante devolvido.
   *
   * @param {import('../../lib/contas.js').Conta} conta
   * @returns {Promise<void>}
   */
  async function pedirExclusao(conta) {
    setEnviando(conta.id)
    setErro(null)
    const envelope = await solicitarExclusaoDeDados(conta.id)
    setEnviando(null)
    setConfirmando(null)
    if (envelope.error) {
      setErro(envelope.error)
      return
    }
    setComprovante({ conta, ...envelope.data })
  }

  return (
    <div className="ka-pagina">
      <header className="ka-pagina__topo">
        <Link to={ROTAS.raiz} className="ka-pagina__marca">
          <Marca />
        </Link>
        <Link to={ROTAS.privacidade} className="ka-pagina__atalho">
          Política de privacidade
        </Link>
      </header>

      <main className="ka-pagina__conteudo" id="conteudo">
        <p className="ka-pagina__sobrenome">Documento público</p>
        <h1 className="ka-pagina__titulo">Seus dados e exclusão</h1>
        <p className="ka-pagina__data">
          Última atualização: {formatarDataCurta(ATUALIZADA_EM)}
        </p>

        <section className="ka-pagina__secao">
          <h2>O que guardamos</h2>
          <p>
            Guardamos o e-mail de quem acessa o produto, os identificadores da conta profissional
            conectada e as métricas agregadas que a Meta devolve para essa conta — mais os
            diagnósticos gerados a partir delas. Nenhum dado demográfico da audiência, nenhum
            identificador de seguidor. A lista completa está na{' '}
            <Link to={ROTAS.privacidade}>política de privacidade</Link>.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Por quanto tempo</h2>
          <p>
            Enquanto a conta estiver conectada, o histórico é guardado desde a primeira coleta.{' '}
            <span className="ka-pagina__pendente">
              Pendente: prazo de retenção depois do cancelamento ou da desconexão.
            </span>{' '}
            Até esse prazo ser definido e publicado, o histórico só sai daqui por pedido de
            exclusão — e o pedido apaga tudo imediatamente.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Como exportar</h2>
          <p>
            O histórico é seu e sai daqui sem amarra. Hoje a exportação é feita por pedido ao
            suporte, e não pela tela:{' '}
            <span className="ka-pagina__pendente">
              Pendente: a exportação automática ainda não foi construída.
            </span>{' '}
            Enquanto ela não existir, peça pelo mesmo canal de suporte usado na contratação e o
            arquivo é enviado com o histórico completo da conta.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Como pedir exclusão</h2>
          <p>A exclusão de uma conta apaga, de uma vez:</p>
          <ul className="ka-pagina__itens">
            {ITENS_APAGADOS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            O pedido não tem volta e não há cópia guardada em outro lugar. O que sobra é o
            comprovante: um protocolo com a data e a quantidade de itens apagados, sem nenhum
            conteúdo — é ele que prova, depois, que o pedido existiu e foi cumprido.
          </p>
        </section>

        <section className="ka-pagina__secao" aria-labelledby="pedir-exclusao">
          <h2 id="pedir-exclusao">Pedir exclusão agora</h2>

          {carregandoSessao || (autenticado && carregandoContas) ? (
            <Estado tipo="carregando" titulo="Buscando suas contas conectadas" />
          ) : null}

          {!carregandoSessao && !autenticado ? (
            <p>
              Entre na sua conta para pedir a exclusão pela tela — assim ninguém apaga o
              histórico de uma conta que não é sua. <Link to={ROTAS.entrar}>Entrar</Link>. Se
              você não tem mais acesso ao login, o pedido pode ser feito pelo canal de suporte
              usado na contratação.{' '}
              <span className="ka-pagina__pendente">
                Pendente: e-mail do encarregado pelo tratamento de dados.
              </span>
            </p>
          ) : null}

          {erroDoTenant ? (
            <Aviso variante="critico" titulo="Não deu para listar suas contas">
              {erroDoTenant.mensagem}
            </Aviso>
          ) : null}

          {autenticado && !carregandoContas && contas.length === 0 && !erroDoTenant ? (
            <Estado
              tipo="vazio"
              titulo="Nenhuma conta conectada"
              descricao="Não há dado de conta de Instagram para apagar neste espaço de trabalho."
            />
          ) : null}

          {autenticado && contas.length > 0 ? (
            <ul className="ka-pagina__contas">
              {contas.map((conta) => (
                <li key={conta.id} className="ka-pagina__conta">
                  <div className="ka-pagina__conta-identificacao">
                    <span className="ka-pagina__conta-nome">{conta.nome}</span>
                    <span className="ka-pagina__conta-arroba">@{conta.username}</span>
                  </div>

                  {confirmando === conta.id ? (
                    <div className="ka-pagina__confirmacao" role="group">
                      {/* Prevenção de erro vale mais que mensagem de erro
                          (CLAUDE.md): a confirmação é um passo, não um alerta
                          que some. */}
                      <p className="ka-pagina__confirmacao-texto">
                        Apagar todo o histórico de <strong>@{conta.username}</strong>? Isso não
                        tem volta.
                      </p>
                      <div className="ka-pagina__confirmacao-acoes">
                        <Botao
                          variante="primario"
                          carregando={enviando === conta.id}
                          aoClicar={() => pedirExclusao(conta)}
                        >
                          Confirmar exclusão
                        </Botao>
                        <Botao variante="texto" aoClicar={() => setConfirmando(null)}>
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <Botao variante="secundario" aoClicar={() => setConfirmando(conta.id)}>
                      Pedir exclusão dos dados
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {erro ? (
            <Aviso variante="critico" titulo="O pedido não foi concluído">
              {erro.mensagem}
            </Aviso>
          ) : null}

          {comprovante ? (
            <Aviso variante="informacao" titulo="Pedido registrado">
              Protocolo <strong>{comprovante.protocolo}</strong> para @
              {comprovante.conta.username}, em {formatarDataCurta(comprovante.solicitadoEm)}.
              Guarde este número: é o comprovante do pedido.
            </Aviso>
          ) : null}
        </section>
      </main>

      <footer className="ka-pagina__rodape">
        <Link to={ROTAS.raiz}>Voltar ao Kora Insights</Link>
      </footer>
    </div>
  )
}
