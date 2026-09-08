import { Botao, Estado } from '../../../components/shared/index.js'
import useRelatorio, { ESTADOS } from '../hooks/useRelatorio.js'
import BarraDeAcoes from './BarraDeAcoes.jsx'
import FolhaDoRelatorio from './FolhaDoRelatorio.jsx'
import './Relatorio.css'

const TITULO_CARREGANDO = 'Preparando o relatório desta conta.'

const TITULO_DE_FALHA = 'Não foi possível abrir o relatório.'

const ROTULO_DE_NOVA_TENTATIVA = 'Tentar de novo'

const TITULO_SEM_CONTA = 'Nenhuma conta conectada, então não existe relatório para preparar.'

const DESCRICAO_SEM_CONTA =
  'Conecte uma conta profissional do Instagram. O relatório é o diagnóstico dela em folha, e ' +
  'ele nasce depois da primeira coleta completa.'

const TITULO_SEM_DIAGNOSTICO = 'Ainda não há diagnóstico para pôr em folha.'

const DESCRICAO_SEM_DIAGNOSTICO =
  'O relatório é o mesmo diagnóstico da tela desta conta, em papel. Enquanto o motor não ' +
  'gravar um, não há folha para levar à reunião.'

/**
 * Esqueleto do carregamento: a forma da folha, em branco.
 *
 * Sem numero de exemplo e sem frase provisoria. Placeholder com numero plausivel
 * e a mentira mais barata que esta tela poderia contar — e aqui ela seria pior
 * que na tela de diagnostico, porque o cliente imprime o que ve.
 *
 * @returns {JSX.Element}
 */
function EsqueletoDaFolha() {
  return (
    <div className="tela-relatorio" data-fase="carregando">
      <Estado tipo="carregando" titulo={TITULO_CARREGANDO} />
      <div className="tela-relatorio__esqueleto" aria-hidden="true">
        <span className="tela-relatorio__peca" data-peca="cabecalho" />
        <div className="tela-relatorio__colunas">
          <span className="tela-relatorio__peca" data-peca="leitura" />
          <span className="tela-relatorio__peca" data-peca="prova" />
        </div>
      </div>
    </div>
  )
}

/**
 * Falha de leitura, com a saida obrigatoria: erro sem proxima acao e beco
 * (`docs/06_COMPONENTES/catalogo.md`).
 *
 * A frase vem do `codigo` do erro, traduzida em `src/lib/erros.js`. Mensagem
 * crua de banco nunca chega aqui, por decisao da camada de servicos.
 *
 * @param {object} props
 * @param {{ codigo: string, mensagem: string }|null} props.erro
 * @param {() => void} props.aoTentarDeNovo
 * @returns {JSX.Element}
 */
function FalhaAoCarregar({ erro, aoTentarDeNovo }) {
  return (
    <div className="tela-relatorio" data-fase="erro">
      <Estado tipo="erro" titulo={TITULO_DE_FALHA} descricao={erro?.mensagem}>
        <Botao aoClicar={aoTentarDeNovo}>{ROTULO_DE_NOVA_TENTATIVA}</Botao>
      </Estado>
    </div>
  )
}

/**
 * Nao ha folha, e isso nao e defeito.
 *
 * Duas situacoes chegam aqui: nenhuma conta conectada, e conta conectada sem
 * diagnostico gravado ainda. Nas duas, imprimir uma folha vazia seria pior que
 * nao imprimir nada — a tela diz por que ela nao existe e nao oferece um botao
 * que produziria papel em branco.
 *
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} [props.descricao]
 * @returns {JSX.Element}
 */
function SemFolha({ titulo, descricao }) {
  return (
    <div className="tela-relatorio" data-fase="sem-folha">
      <Estado tipo="vazio" titulo={titulo} descricao={descricao} />
    </div>
  )
}

/**
 * A tela do relatorio: o mesmo diagnostico, em folha, pronto para a reuniao.
 *
 * Ela **le** o mesmo registro que a tela de diagnostico le e nao recalcula nada:
 * nao reordena achado por criterio proprio, nao refaz variacao e nao acrescenta
 * numero que a tela nao mostrou. Relatorio e o mesmo diagnostico em outro
 * formato, nunca um segundo produto (overview.md, o caminho do dado, passo 6).
 *
 * @param {object} props
 * @param {string|null} [props.contaId] sem id, vale a conta em foco na URL
 * @returns {JSX.Element}
 */
export default function Relatorio({ contaId }) {
  const { estado, diagnostico, conta, preparadoPor, origem, erro, recarregar } =
    useRelatorio(contaId)

  if (estado === ESTADOS.SEM_CONTA) {
    return <SemFolha titulo={TITULO_SEM_CONTA} descricao={DESCRICAO_SEM_CONTA} />
  }
  if (estado === ESTADOS.CARREGANDO) return <EsqueletoDaFolha />
  if (estado === ESTADOS.ERRO) return <FalhaAoCarregar erro={erro} aoTentarDeNovo={recarregar} />
  if (estado === ESTADOS.VAZIO) {
    return (
      <SemFolha
        titulo={erro?.mensagem ?? TITULO_SEM_DIAGNOSTICO}
        descricao={DESCRICAO_SEM_DIAGNOSTICO}
      />
    )
  }

  // Registro sem achado nenhum: o motor gravou e nao afirmou nada. Nao ha
  // veredito para encabecar a folha, e uma folha sem veredito seria um relatorio
  // que nao diz nada — o cliente sai da reuniao com papel e sem resposta.
  if (!diagnostico?.achados?.length) {
    return <SemFolha titulo={TITULO_SEM_DIAGNOSTICO} descricao={DESCRICAO_SEM_DIAGNOSTICO} />
  }

  return (
    <div className="tela-relatorio" data-fase="sucesso">
      <BarraDeAcoes />
      <FolhaDoRelatorio
        diagnostico={diagnostico}
        conta={conta}
        preparadoPor={preparadoPor}
        origem={origem}
      />
    </div>
  )
}
