import './Indicador.css'

/**
 * Um numero da evidencia: rotulo pequeno, numero grande, e embaixo a nota que
 * diz de onde ele veio ("40% abaixo, era 3,0").
 *
 * O valor chega formatado de quem exibe — o kit visual nao formata numero nem
 * calcula variacao (ADR-008: a variacao e feita sobre o valor exibido, e quem
 * exibe e a tela). O `tom` e decisao da regra: cair nem sempre e ruim, entao o
 * dado entra como `data-tom` e o CSS reage.
 *
 * A lista de descricao e o proprio componente, e nao a grade que o contem: o
 * rotulo fica ligado ao numero mesmo quando a tela empilha os indicadores de
 * outro jeito.
 *
 * @param {object} props
 * @param {string} props.rotulo ex: 'Publicações por semana'
 * @param {string|number} props.valor ja formatado em pt-BR
 * @param {string} [props.nota] a comparacao, em texto
 * @param {'bom'|'ruim'|'neutro'} [props.tom]
 * @returns {JSX.Element}
 */
export default function Indicador({ rotulo, valor, nota, tom = 'neutro' }) {
  return (
    <dl className="ki-indicador" data-tom={tom}>
      <dt className="ki-indicador__rotulo">{rotulo}</dt>
      <dd className="ki-indicador__dado">
        <span className="ki-indicador__valor">{valor}</span>
        {nota ? <span className="ki-indicador__nota">{nota}</span> : null}
      </dd>
    </dl>
  )
}
