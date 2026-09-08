import './Marca.css'

/**
 * O nome do produto na barra superior. Duas palavras, uma serifa, dois pesos de
 * tinta — e a assinatura da identidade (docs/02_DESIGN_SYSTEM/identidade).
 *
 * O nome chega por prop com padrao para que a Fase 3 (white-label) troque a
 * assinatura da agencia sem tocar em componente: quem renderiza passa o nome do
 * tenant, e nada aqui muda.
 */
export const NOME_PADRAO = 'Kora'

/** Segunda palavra da assinatura, em tinta suave. */
export const SUFIXO_PADRAO = 'Insights'

/**
 * @param {object} props
 * @param {string} [props.nome] primeira palavra, em tinta cheia
 * @param {string} [props.sufixo] segunda palavra, em tinta suave; vazio some
 * @param {import('react').ElementType} [props.como] elemento raiz ('span' por padrao)
 * @returns {JSX.Element}
 */
export default function Marca({ nome = NOME_PADRAO, sufixo = SUFIXO_PADRAO, como: Como = 'span' }) {
  return (
    <Como className="ki-marca">
      <span className="ki-marca__nome">{nome}</span>
      {sufixo ? <span className="ki-marca__sufixo">{sufixo}</span> : null}
    </Como>
  )
}
