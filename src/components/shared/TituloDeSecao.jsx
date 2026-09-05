import './TituloDeSecao.css'

/**
 * Rotulo de secao ("Evidencia") com um apoio opcional a direita, na mesma linha
 * ("Ultimas 8 semanas, comparadas as 8 anteriores").
 *
 * O apoio fica junto do titulo de proposito: e ele que diz sobre qual janela o
 * numero abaixo esta falando, e um numero sem janela nao se confere.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children o rotulo
 * @param {import('react').ReactNode} [props.apoio] contexto curto, alinhado a direita
 * @returns {JSX.Element}
 */
export default function TituloDeSecao({ children, apoio }) {
  return (
    <div className="ki-titulo-secao">
      <h2 className="ki-titulo-secao__rotulo">{children}</h2>
      {apoio ? <p className="ki-titulo-secao__apoio">{apoio}</p> : null}
    </div>
  )
}
