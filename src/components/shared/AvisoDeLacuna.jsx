import { formatarDataCurta, formatarPeriodo } from '../../metricas/index.js'

import './AvisoDeLacuna.css'

/** Titulo fixo do bloco: o que ele anuncia nao muda de tela para tela. */
const TITULO = 'Dias sem coleta'

/**
 * Descreve o periodo de uma lacuna em portugues.
 *
 * O bloco vai para a tela E para o relatorio impresso que o cliente leva para a
 * reuniao. "2026-08-10 a 2026-08-14" no meio de um texto que escreve todas as
 * outras datas por extenso parece defeito, e o cliente desconta credibilidade do
 * numero ao lado — logo neste bloco, que existe justamente para ser acreditado.
 *
 * @param {{ inicio?: string, fim?: string, rotulo?: string }} lacuna
 * @returns {string}
 */
function periodoDaLacuna(lacuna) {
  if (lacuna?.rotulo) return lacuna.rotulo
  if (lacuna?.inicio && lacuna?.fim && lacuna.inicio !== lacuna.fim) {
    return formatarPeriodo(lacuna.inicio, lacuna.fim)
  }
  const unica = lacuna?.inicio ?? lacuna?.fim
  return unica ? formatarDataCurta(unica) : ''
}

/**
 * Buraco na serie, dito com todas as letras (ADR-004: serie com buraco nao
 * invisibiliza o buraco).
 *
 * Sem lacuna o bloco nao aparece — e a unica ausencia legitima aqui, porque
 * nao ha nada a esconder.
 *
 * @param {object} props
 * @param {{ inicio?: string, fim?: string, motivo?: string, rotulo?: string }[]} props.lacunas
 * @returns {JSX.Element|null}
 */
export default function AvisoDeLacuna({ lacunas }) {
  const itens = Array.isArray(lacunas) ? lacunas : []
  if (itens.length === 0) return null

  return (
    <aside className="ki-lacuna" data-bloco="lacuna">
      <h3 className="ki-lacuna__titulo">{TITULO}</h3>
      <ul className="ki-lacuna__lista">
        {itens.map((lacuna, indice) => (
          <li key={`lacuna-${indice}`} className="ki-lacuna__item">
            <span className="ki-lacuna__periodo">{periodoDaLacuna(lacuna)}</span>
            {lacuna?.motivo ? <span className="ki-lacuna__motivo">{lacuna.motivo}</span> : null}
          </li>
        ))}
      </ul>
    </aside>
  )
}
