import './SeloDeSeveridade.css'

/**
 * Rotulo de severidade: um quadrado solido e a palavra ("Atencao", "Estavel").
 *
 * A cor sai de `--cor-severidade`, que `tokens.css` liga ao atributo de dado —
 * nenhum `if` de JavaScript escolhe cor aqui. E a palavra nao e enfeite: cor
 * nunca e o unico portador de significado (TOKENS.md, contraste).
 *
 * @param {object} props
 * @param {'ok'|'atencao'|'critico'|'indeterminado'} props.severidade vinda do achado
 * @param {import('react').ReactNode} props.children a palavra que o cliente le
 * @returns {JSX.Element}
 */
export default function SeloDeSeveridade({ severidade, children }) {
  return (
    <span className="ki-selo" data-severidade={severidade}>
      <span className="ki-selo__marca" aria-hidden="true" />
      <span className="ki-selo__texto">{children}</span>
    </span>
  )
}
