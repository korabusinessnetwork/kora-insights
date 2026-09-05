import './AvisoDeLacuna.css'

/** Titulo fixo do bloco: o que ele anuncia nao muda de tela para tela. */
const TITULO = 'Dias sem coleta'

/**
 * Descreve o periodo de uma lacuna. Quem exibe pode mandar `rotulo` ja escrito
 * por extenso; sem ele, sobram as datas cruas — feias, porem visiveis, que e o
 * que importa aqui.
 *
 * @param {{ inicio?: string, fim?: string, rotulo?: string }} lacuna
 * @returns {string}
 */
function periodoDaLacuna(lacuna) {
  if (lacuna?.rotulo) return lacuna.rotulo
  if (lacuna?.inicio && lacuna?.fim && lacuna.inicio !== lacuna.fim) {
    return `${lacuna.inicio} a ${lacuna.fim}`
  }
  return lacuna?.inicio ?? lacuna?.fim ?? ''
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
