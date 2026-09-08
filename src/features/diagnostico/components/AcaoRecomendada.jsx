import { Cartao, TituloDeSecao } from '../../../components/shared/index.js'
import './AcaoRecomendada.css'

/** Rotulo da secao. Fixo: e o papel do bloco, nao conteudo do diagnostico. */
const TITULO = 'Ação recomendada'

/**
 * O que fazer na proxima semana, e como saber depois se a causa estava certa.
 *
 * As duas frases vem prontas do achado (`acao` e `confirmacao`): a tela nao
 * sugere, nao prioriza e nao reescreve — o metodo mora no ruleset versionado
 * (ADR-005).
 *
 * Havia aqui um botao "Marcar teste de 4 semanas", desabilitado, com um
 * paragrafo embaixo explicando que a marcacao chegaria numa proxima versao. Saiu
 * inteiro, por dois motivos.
 *
 * O primeiro e de produto: tela que nao muda uma decisao do cliente nao entra no
 * produto (CLAUDE.md, principio n1). O botao nao mudava nenhuma — ele pedia
 * desculpa e mandava anotar a data em outro lugar. A `confirmacao` logo acima ja
 * diz o que observar e quando, que era a unica coisa util ali.
 *
 * O segundo e de arquitetura: "4 semanas" era uma constante da REGRA escrita a
 * mao dentro de um componente. No dia em que o ruleset mudasse o prazo, o botao
 * continuaria anunciando o prazo velho, sem nenhum teste reprovando.
 *
 * Marcar e acompanhar o teste continua no backlog como funcionalidade de
 * verdade, com registro no banco — nao como controle desabilitado.
 *
 * @param {object} props
 * @param {string} props.acao a acao imperativa e concreta, vinda do achado
 * @param {string} [props.confirmacao] como confirmar a causa depois do teste
 * @returns {JSX.Element}
 */
export default function AcaoRecomendada({ acao, confirmacao }) {
  return (
    <Cartao alta data-bloco="acao">
      <TituloDeSecao>{TITULO}</TituloDeSecao>
      <p className="acao-recomendada__frase">{acao}</p>
      {confirmacao ? <p className="acao-recomendada__confirmacao">{confirmacao}</p> : null}
    </Cartao>
  )
}
