import { Aviso, Botao, Cartao, TituloDeSecao } from '../../../components/shared/index.js'
import { estaEmModoDemonstracao } from '../../../lib/index.js'
import useConexao from '../hooks/useConexao.js'
import RequisitosDaConexao from './RequisitosDaConexao.jsx'
import { SEMANAS_ATE_O_DIAGNOSTICO } from './RetornoDaConexao.jsx'
import './Conectar.css'

/**
 * A tela `/conectar`: **requisitos primeiro, botao depois** (ADR-002).
 *
 * A ordem dos blocos e a decisao de produto desta tela, nao um acaso de layout.
 * A variante de API escolhida exige conta profissional vinculada a uma Pagina do
 * Facebook, e essa exigencia e a fricao real do onboarding — a causa mais
 * provavel de o cliente travar no meio da call de venda. Quem sobe o botao para
 * o topo troca uma leitura de dois minutos por uma ida ao dialogo da Meta que
 * volta vazia, sem dizer por que.
 *
 * Nada e calculado aqui: a URL do consentimento, o estado de 128 bits e a troca
 * do codigo por token sao de `src/lib/conexaoMeta.js` e da Edge Function.
 */

const TITULO = 'Antes de conectar: três coisas precisam ser verdade na conta.'

const EXPLICACAO =
  'A conexão em si é um clique. O que costuma travar é o vínculo com a Página do Facebook — ' +
  'e é melhor você descobrir isso aqui, com o celular na mão, do que dentro da tela da Meta.'

const ROTULO_DE_AUTORIZACAO = 'Autorizar no Facebook'

const O_QUE_ACONTECE =
  'Ao continuar, você vai para o Facebook e escolhe a Página e a conta do Instagram. ' +
  'Em seguida a gente traz você de volta para cá.'

const AVISO_DE_DEMONSTRACAO =
  'Modo demonstração: nenhuma conta real é conectada neste ambiente. Os requisitos acima são ' +
  'os mesmos de produção — o que não existe aqui é o app da Meta para autorizar.'

const O_QUE_NAO_ACONTECE_HOJE =
  `A coleta começa no mesmo dia, e a primeira leitura aparece em até 24 horas. Até juntar ` +
  `${SEMANAS_ATE_O_DIAGNOSTICO} semanas de publicação, ela vai dizer o que ainda não sabe em ` +
  `vez de nomear uma causa no escuro.`

/**
 * @param {object} props
 * @param {(url: string) => void} [props.irPara] como sair para o diálogo da Meta;
 *   injetável para exercitar a tela sem abandonar a página
 * @returns {JSX.Element}
 */
export default function Conectar({ irPara }) {
  const { erro, abrindo, iniciar } = useConexao(irPara ? { irPara } : undefined)
  const emDemonstracao = estaEmModoDemonstracao()

  return (
    <div className="conectar">
      <header className="conectar__abertura">
        <h1 className="conectar__titulo">{TITULO}</h1>
        <p className="conectar__apoio">{EXPLICACAO}</p>
      </header>

      <RequisitosDaConexao />

      {/* O aviso mora junto do botao, e nao no topo: erro longe da acao que o
          produziu obriga a pessoa a procurar o que deu errado. */}
      {erro ? (
        <Aviso variante="critico" titulo="Não deu para abrir a autorização">
          {erro.mensagem} Confira os requisitos acima e tente de novo; se continuar, fale com a
          gente antes de repetir o clique.
        </Aviso>
      ) : null}

      <div className="conectar__acao">
        <Cartao alta data-bloco="conectar-acao">
          <TituloDeSecao apoio="Você volta para esta tela em seguida">
            {ROTULO_DE_AUTORIZACAO}
          </TituloDeSecao>

          <p className="conectar__linha">{O_QUE_ACONTECE}</p>
          <p className="conectar__linha" data-papel="prazo">
            {O_QUE_NAO_ACONTECE_HOJE}
          </p>

          {emDemonstracao ? <p className="conectar__linha">{AVISO_DE_DEMONSTRACAO}</p> : null}

          <p className="conectar__botao">
            <Botao
              variante="primario"
              aoClicar={iniciar}
              carregando={abrindo}
              desabilitado={emDemonstracao}
            >
              {ROTULO_DE_AUTORIZACAO}
            </Botao>
          </p>
        </Cartao>
      </div>
    </div>
  )
}
