import {
  Cartao,
  GraficoCadencia,
  Indicador,
  TituloDeSecao,
} from '../../../components/shared/index.js'
import { formatarValorDeMetrica } from '../../../metricas/index.js'
import './PainelDeEvidencia.css'

/** Rotulo da secao. Fixo: o que este bloco e nao muda de conta para conta. */
const TITULO = 'Evidência'

/**
 * A prova do veredito: os numeros do achado e o desenho das duas series.
 *
 * Nada aqui e calculado. Valor, comparacao, tom e serie chegam prontos do
 * achado (ADR-005); a unica coisa que a tela faz com eles e formatar em pt-BR,
 * e mesmo isso passa pelo dicionario canonico — `formatarValorDeMetrica` recusa
 * um codigo que nao seja nosso, entao nome de metrica da Meta nao chega a tela
 * nem por descuido de quem escrever a proxima regra (ADR-003).
 *
 * A `nota` de cada indicador ("40% abaixo, era 3,0") vem escrita do motor de
 * proposito: a variacao e feita sobre o valor **exibido**, e refaze-la aqui
 * abriria uma segunda rotina de arredondamento para divergir da primeira
 * (ADR-008).
 *
 * @param {object} props
 * @param {object} props.achado o achado de maior peso, com evidencias e serie
 * @param {string} [props.periodo] o periodo analisado, ja escrito por extenso
 * @returns {JSX.Element}
 */
export default function PainelDeEvidencia({ achado, periodo }) {
  const evidencias = Array.isArray(achado?.evidencias) ? achado.evidencias : []
  const serie = achado?.serie ?? null

  return (
    <Cartao data-bloco="evidencia">
      <TituloDeSecao apoio={periodo}>{TITULO}</TituloDeSecao>

      {evidencias.length > 0 ? (
        <div className="painel-evidencia__indicadores">
          {evidencias.map((evidencia) => (
            <Indicador
              key={`${evidencia.metrica}:${evidencia.rotulo}`}
              rotulo={evidencia.rotulo}
              valor={formatarValorDeMetrica(evidencia.metrica, evidencia.valor, {
                casas: evidencia.casas,
              })}
              nota={evidencia.nota}
              tom={evidencia.tom}
            />
          ))}
        </div>
      ) : null}

      {serie ? (
        <div className="painel-evidencia__grafico">
          <GraficoCadencia
            pontos={serie.pontos}
            rotuloBarra={serie.rotuloBarra}
            rotuloLinha={serie.rotuloLinha}
            // O paragrafo de apoio do achado e o texto que sustenta a frase, e e
            // ele que vira legenda e `aria-label` do desenho: escrever outra
            // frase aqui seria a tela opinando sobre o que o grafico mostra.
            descricao={achado.apoio}
          />
        </div>
      ) : null}
    </Cartao>
  )
}
