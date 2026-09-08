import './ListaDeLimites.css'

/**
 * Normaliza um limite, que chega como codigo+texto do motor ou como frase solta
 * de uma regra.
 *
 * @param {string|{ codigo?: string, texto?: string }} limite
 * @param {number} indice posicao, usada como chave quando nao ha codigo
 * @returns {{ chave: string, texto: string }}
 */
function normalizarLimite(limite, indice) {
  if (typeof limite === 'string') return { chave: `limite-${indice}`, texto: limite }
  return { chave: limite?.codigo ?? `limite-${indice}`, texto: limite?.texto ?? '' }
}

/**
 * "O que este diagnostico nao sabe": o bloco que o produto inteiro existe para
 * nao esconder (memory/identity.md, honestidade de dado).
 *
 * Ele nao e nota de rodape nem letra miuda — vai junto do veredito na tela e no
 * papel, e `data-bloco="limites"` garante que a impressao nao o corte fora
 * (src/styles/impressao.css).
 *
 * @param {object} props
 * @param {string} props.titulo ex: 'O que este diagnóstico não sabe'
 * @param {(string|{ codigo?: string, texto?: string })[]} props.limites
 * @returns {JSX.Element|null} nulo quando nao ha limite a declarar
 */
export default function ListaDeLimites({ titulo, limites }) {
  const itens = (Array.isArray(limites) ? limites : []).map(normalizarLimite).filter((i) => i.texto)
  if (itens.length === 0) return null

  return (
    <div className="ki-limites" data-bloco="limites">
      <h3 className="ki-limites__titulo">{titulo}</h3>
      <ul className="ki-limites__lista">
        {itens.map((item) => (
          <li key={item.chave} className="ki-limites__item">
            {item.texto}
          </li>
        ))}
      </ul>
    </div>
  )
}
