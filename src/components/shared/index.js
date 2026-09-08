/**
 * Kit visual compartilhado (docs/01_ARQUITETURA/contratos.md, secao 5).
 *
 * Nenhum componente daqui conhece servico, rota ou regra de negocio: recebe
 * props e renderiza. O estado visual entra por atributo de dado
 * (`data-severidade`, `data-tom`, `data-variante`) e quem escolhe a cor e o CSS,
 * sobre os tokens semanticos de src/styles/tokens.css.
 */

export { default as Marca, NOME_PADRAO, SUFIXO_PADRAO } from './Marca.jsx'
export { default as Botao } from './Botao.jsx'
export { default as Cartao } from './Cartao.jsx'
export { default as TituloDeSecao } from './TituloDeSecao.jsx'
export { default as SeloDeSeveridade } from './SeloDeSeveridade.jsx'
export { default as Veredito, PALAVRA_DE_SEVERIDADE } from './Veredito.jsx'
export { default as Indicador } from './Indicador.jsx'
export { default as GraficoCadencia, segmentosDaLinha } from './GraficoCadencia.jsx'
export { default as Tabela } from './Tabela.jsx'
export { default as ListaDeLimites } from './ListaDeLimites.jsx'
export { default as AvisoDeLacuna } from './AvisoDeLacuna.jsx'
export { default as Estado } from './Estado.jsx'
export { default as Aviso } from './Aviso.jsx'
export { default as ListaDePassos } from './ListaDePassos.jsx'
