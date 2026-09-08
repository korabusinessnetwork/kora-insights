import './Estado.css'

/**
 * Papel ARIA de cada estado. Carregando e erro precisam ser anunciados sem que
 * o foco mude; vazio e conteudo comum, e anuncia-lo seria ruido.
 * @type {Record<string, { papel?: string, vivo?: string }>}
 */
const ANUNCIO = {
  carregando: { papel: 'status', vivo: 'polite' },
  erro: { papel: 'alert', vivo: 'assertive' },
  vazio: {},
}

/**
 * Os estados obrigatorios de toda tela (CLAUDE.md). O sucesso e a propria tela;
 * os outros tres passam por aqui.
 *
 * O vazio nao e um encolher de ombros: ele recebe `children` e e ali que a tela
 * sem conta conectada monta os tres passos ate o primeiro diagnostico. Por isso
 * o titulo do vazio sai em serifa grande — ele e o conteudo da tela, nao um
 * aviso de que falta conteudo.
 *
 * @param {object} props
 * @param {'carregando'|'vazio'|'erro'} [props.tipo]
 * @param {string} props.titulo
 * @param {string} [props.descricao]
 * @param {import('react').ReactNode} [props.children] acao, passos ou detalhe
 * @returns {JSX.Element}
 */
export default function Estado({ tipo = 'carregando', titulo, descricao, children }) {
  const anuncio = ANUNCIO[tipo] ?? {}

  return (
    <section
      className="ki-estado"
      data-tipo={tipo}
      role={anuncio.papel}
      aria-live={anuncio.vivo}
      aria-busy={tipo === 'carregando' || undefined}
    >
      {tipo === 'carregando' ? <span className="ki-estado__pulso" aria-hidden="true" /> : null}
      <h2 className="ki-estado__titulo">{titulo}</h2>
      {descricao ? <p className="ki-estado__descricao">{descricao}</p> : null}
      {children ? <div className="ki-estado__conteudo">{children}</div> : null}
    </section>
  )
}
