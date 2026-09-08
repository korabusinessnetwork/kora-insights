import './Botao.css'

/**
 * Botao do produto. Tres variantes, nenhuma cor em prop: `data-variante` entra
 * na marcacao e o CSS decide a pele (inclusive na folha clara do relatorio,
 * onde os mesmos tokens semanticos viram outra cor).
 *
 * `carregando` desabilita de verdade em vez de so trocar o rotulo: prevenir o
 * duplo clique vale mais que avisar depois que ele aconteceu (CLAUDE.md).
 *
 * `como` cobre a chamada para acao que **navega** — "Reconectar", "Ver o
 * relatorio". Navegacao e link, nao botao: quem usa teclado espera Enter, quem
 * usa leitor de tela espera ouvir "link", e abrir em outra aba precisa
 * funcionar. Quem chama passa o componente de rota (`Link`), e por isso o kit
 * continua sem importar router — ele nao pode conhecer rota
 * (memory/patterns.md).
 *
 * @param {object} props
 * @param {'primario'|'secundario'|'texto'} [props.variante]
 * @param {'button'|'submit'|'reset'} [props.tipo]
 * @param {(evento: import('react').MouseEvent) => void} [props.aoClicar]
 * @param {boolean} [props.carregando]
 * @param {boolean} [props.desabilitado]
 * @param {import('react').ElementType} [props.como] componente de navegacao
 * @param {string} [props.para] destino, quando `como` esta presente
 * @param {import('react').ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Botao({
  variante = 'secundario',
  tipo = 'button',
  aoClicar,
  carregando = false,
  desabilitado = false,
  como: Componente,
  para,
  children,
}) {
  const pele = {
    className: 'ki-botao',
    'data-variante': variante,
    'data-carregando': carregando ? 'sim' : undefined,
  }

  if (Componente) {
    return (
      <Componente {...pele} to={para} onClick={aoClicar}>
        <span className="ki-botao__rotulo">{children}</span>
      </Componente>
    )
  }

  return (
    <button
      {...pele}
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
