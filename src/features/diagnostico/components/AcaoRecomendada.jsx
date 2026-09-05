import { Botao, Cartao, TituloDeSecao } from '../../../components/shared/index.js'
import './AcaoRecomendada.css'

/** Rotulo da secao. Fixo: e o papel do bloco, nao conteudo do diagnostico. */
const TITULO = 'Ação recomendada'

/** O botao da identidade (pagina 1). O texto e do desenho, o prazo e da regra. */
const ROTULO_DO_TESTE = 'Marcar teste de 4 semanas'

/**
 * Nao existe endpoint para registrar a intencao de testar a recomendacao. O
 * botao aparece desabilitado e diz por que, em vez de fingir que gravou algo:
 * botao que finge funcionar custa a confianca que este produto vende
 * (memory/identity.md, honestidade de dado).
 */
const TESTE_INDISPONIVEL =
  'A marcação do teste chega na próxima versão. Por enquanto, anote a data de início ' +
  'onde você acompanha esta conta.'

/**
 * O que fazer na proxima semana, e como saber depois se a causa estava certa.
 *
 * As duas frases vem prontas do achado (`acao` e `confirmacao`): a tela nao
 * sugere, nao prioriza e nao reescreve — o metodo mora no ruleset versionado
 * (ADR-005).
 *
 * @param {object} props
 * @param {string} props.acao a acao imperativa e concreta, vinda do achado
 * @param {string} [props.confirmacao] como confirmar a causa depois do teste
 * @param {boolean} [props.ofereceTeste] falso quando nao ha causa nomeada para
 *   testar — sem veredito, marcar teste de 4 semanas nao significa nada
 * @returns {JSX.Element}
 */
export default function AcaoRecomendada({ acao, confirmacao, ofereceTeste = true }) {
  return (
    <Cartao alta data-bloco="acao">
      <TituloDeSecao>{TITULO}</TituloDeSecao>
      <p className="acao-recomendada__frase">{acao}</p>
      {confirmacao ? <p className="acao-recomendada__confirmacao">{confirmacao}</p> : null}

      {ofereceTeste ? (
        <div className="acao-recomendada__teste">
          <Botao desabilitado>{ROTULO_DO_TESTE}</Botao>
          <p className="acao-recomendada__indisponivel">{TESTE_INDISPONIVEL}</p>
        </div>
      ) : null}
    </Cartao>
  )
}
