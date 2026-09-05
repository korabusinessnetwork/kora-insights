import './Botao.css'

/**
 * Botao do produto. Tres variantes, nenhuma cor em prop: `data-variante` entra
 * na marcacao e o CSS decide a pele (inclusive na folha clara do relatorio,
 * onde os mesmos tokens semanticos viram outra cor).
 *
 * `carregando` desabilita de verdade em vez de so trocar o rotulo: prevenir o
 * duplo clique vale mais que avisar depois que ele aconteceu (CLAUDE.md).
 *
 * @param {object} props
 * @param {'primario'|'secundario'|'texto'} [props.variante]
 * @param {'button'|'submit'|'reset'} [props.tipo]
 * @param {(evento: import('react').MouseEvent) => void} [props.aoClicar]
 * @param {boolean} [props.carregando]
 * @param {boolean} [props.desabilitado]
 * @param {import('react').ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Botao({
  variante = 'secundario',
  tipo = 'button',
  aoClicar,
  carregando = false,
  desabilitado = false,
  children,
}) {
  return (
    <button
      className="ki-botao"
      data-variante={variante}
      data-carregando={carregando ? 'sim' : undefined}
      type={tipo}
      onClick={aoClicar}
      disabled={desabilitado || carregando}
      aria-busy={carregando || undefined}
    >
      <span className="ki-botao__rotulo">{children}</span>
      {/* Estado de espera precisa chegar a quem nao ve o botao esmaecer. */}
      {carregando ? <span className="apenas-leitor">Carregando</span> : null}
    </button>
  )
}
