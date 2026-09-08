import './ListaDePassos.css'

/**
 * Os passos numerados da tela sem conta conectada (identidade, pagina 2).
 *
 * O numero e desenhado por contador de CSS, nao escrito no JSX: reordenar a
 * lista nao pode exigir renumerar a mao, e o leitor de tela ja anuncia a posicao
 * do item da lista ordenada.
 *
 * @param {object} props
 * @param {{ titulo: string, descricao?: string }[]} props.passos na ordem de execucao
 * @returns {JSX.Element|null}
 */
export default function ListaDePassos({ passos }) {
  const itens = Array.isArray(passos) ? passos : []
  if (itens.length === 0) return null

  return (
    <ol className="ki-passos">
      {itens.map((passo, indice) => (
        <li key={passo?.titulo ?? `passo-${indice}`} className="ki-passos__item">
          <h3 className="ki-passos__titulo">{passo?.titulo}</h3>
          {passo?.descricao ? <p className="ki-passos__descricao">{passo.descricao}</p> : null}
        </li>
      ))}
    </ol>
  )
}
