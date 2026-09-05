import './Aviso.css'

/**
 * Papel ARIA por variante. So o critico interrompe a leitura; o resto entra na
 * fila educada do leitor de tela.
 * @type {Record<string, { papel: string, vivo: string }>}
 */
const ANUNCIO = {
  informacao: { papel: 'status', vivo: 'polite' },
  atencao: { papel: 'status', vivo: 'polite' },
  critico: { papel: 'alert', vivo: 'assertive' },
}

/**
 * Faixa de aviso do topo da tela: a que diz que os dados sao de demonstracao
 * (ADR-007) e a que pede reconexao quando o token expira.
 *
 * O componente nao sabe qual das duas esta mostrando — recebe variante, texto e,
 * se houver, a acao. Regra de negocio fica na tela.
 *
 * @param {object} props
 * @param {'informacao'|'atencao'|'critico'} [props.variante]
 * @param {string} [props.titulo] a manchete curta do aviso
 * @param {import('react').ReactNode} props.children o texto do aviso
 * @param {import('react').ReactNode} [props.acao] normalmente um Botao
 * @returns {JSX.Element}
 */
export default function Aviso({ variante = 'informacao', titulo, children, acao }) {
  const anuncio = ANUNCIO[variante] ?? ANUNCIO.informacao

  return (
    <div
      className="ki-aviso"
      data-variante={variante}
      data-imprimir="nao"
      role={anuncio.papel}
      aria-live={anuncio.vivo}
    >
      <p className="ki-aviso__texto">
        {titulo ? <strong className="ki-aviso__titulo">{titulo}</strong> : null}
        <span className="ki-aviso__corpo">{children}</span>
      </p>
      {acao ? <div className="ki-aviso__acao">{acao}</div> : null}
    </div>
  )
}
