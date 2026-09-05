import {
  AvisoDeLacuna,
  GraficoCadencia,
  ListaDeLimites,
  Marca,
  Tabela,
  TituloDeSecao,
  Veredito,
} from '../../../components/shared/index.js'
import {
  formatarDataCurta,
  formatarJanelaComparada,
  formatarPeriodo,
  formatarValorDeMetrica,
  formatarVariacao,
} from '../../../metricas/index.js'
import './FolhaDoRelatorio.css'

/** A linha do cabecalho, sem o periodo. O periodo entra depois da virgula. */
const ASSUNTO = 'Diagnóstico de crescimento no Instagram'

const ROTULO_DE_ASSINATURA = 'Preparado por'

const TITULO_DA_ACAO = 'Ação recomendada'

/** As palavras da identidade (pagina 3), iguais as da tela de diagnostico. */
const TITULO_DOS_LIMITES = 'O que este diagnóstico não sabe'

const TITULO_DA_EVIDENCIA = 'Evidência'

/**
 * As colunas da tabela nomeiam as duas janelas que o motor comparou. O ruleset
 * vigente compara oito semanas completas com as oito anteriores em toda regra de
 * causa (`src/rules/0.3.0`, e docs/03, secao 2), e por isso os rotulos podem ser
 * escritos: eles descrevem o metodo, nao o dado desta conta.
 *
 * O contrato ainda nao carrega o tamanho da janela dentro da `Evidencia`. Quando
 * carregar, estes dois rotulos passam a vir do achado — e evidencia sem
 * comparacao (`anterior: null`) continua saindo como travessao, nunca como zero.
 */
const COLUNAS = Object.freeze([
  { chave: 'indicador', rotulo: 'Indicador' },
  { chave: 'anterior', rotulo: '8 anteriores', numerica: true },
  { chave: 'atual', rotulo: 'Últimas 8', numerica: true },
  { chave: 'variacao', rotulo: 'Variação', numerica: true },
])

const LEGENDA_DA_TABELA =
  'Indicadores que sustentam o veredito: as 8 semanas mais recentes comparadas com as ' +
  '8 anteriores.'

/** Aceita `YYYY-MM-DD` e o prefixo de um ISO completo, igual a `src/metricas`. */
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

const MS_POR_DIA = 86400000

/** Segunda a domingo: a semana do produto, como em `Janela` (contratos.md). */
const DIAS_DA_SEMANA = 7

/**
 * A segunda-feira da semana que o periodo do diagnostico encerra.
 *
 * `periodo.fim` e sempre o domingo da ultima semana **completa** — o motor
 * encerra o periodo ali de proposito, porque cabecalho de relatorio nao pode
 * anunciar um periodo que a comparacao nao usou (docs/03, secao 3). O cabecalho
 * da identidade anuncia essa semana, e nao os quatro meses de historico que o
 * diagnostico leu, entao a segunda-feira sai daqui: seis dias antes do domingo.
 *
 * @param {string} fim ISO do domingo que fecha a ultima semana completa
 * @returns {string|null} ISO da segunda-feira, ou `null` se `fim` nao e uma data
 * @example inicioDaSemanaEncerrada('2026-08-30') // '2026-08-24'
 */
export function inicioDaSemanaEncerrada(fim) {
  const casamento = DATA_ISO.exec(typeof fim === 'string' ? fim : '')
  if (!casamento) return null

  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  const dia = Number(casamento[3])
  const domingo = new Date(Date.UTC(ano, mes - 1, dia))
  // `2026-02-31` passaria por uma checagem de faixa e viraria "3 de marco" sem
  // ninguem perceber; a ida e volta pelo Date.UTC derruba a data que nao existe.
  if (domingo.getUTCMonth() !== mes - 1 || domingo.getUTCDate() !== dia) return null

  return new Date(domingo.getTime() - (DIAS_DA_SEMANA - 1) * MS_POR_DIA)
    .toISOString()
    .slice(0, 10)
}

/**
 * Uma linha da tabela por evidencia do achado, na ordem em que o motor as pos.
 *
 * Nenhum numero nasce aqui. Valor, comparacao, variacao e tom chegam prontos do
 * achado (ADR-005), e a variacao ja foi calculada sobre o valor exibido —
 * refaze-la abriria uma segunda rotina de arredondamento para divergir da
 * primeira, e a tabela deixaria de fechar com ela mesma (ADR-008).
 *
 * `formatarValorDeMetrica` recusa codigo que nao seja do dicionario canonico:
 * nome de metrica da Meta nao chega ao papel nem por descuido (ADR-003).
 *
 * @param {object[]} evidencias `Achado.evidencias`
 * @returns {{ id: string, celulas: unknown[] }[]}
 */
function linhasDaEvidencia(evidencias) {
  return evidencias.map((evidencia) => ({
    id: `${evidencia.metrica}:${evidencia.rotulo}`,
    celulas: [
      evidencia.rotulo,
      formatarValorDeMetrica(evidencia.metrica, evidencia.anterior, { casas: evidencia.casas }),
      formatarValorDeMetrica(evidencia.metrica, evidencia.valor, { casas: evidencia.casas }),
      { texto: formatarVariacao(evidencia.variacao), tom: evidencia.tom },
    ],
  }))
}

/** O que o cabecalho diz quando o registro chegou sem periodo utilizavel. */
const SEM_PERIODO = 'sem período registrado'

/**
 * A linha do cabecalho, com a semana por extenso.
 *
 * Registro sem periodo nao vira cabecalho mudo: a folha diz que nao sabe de qual
 * semana ela fala. Uma folha que anuncia so o assunto seria lida como "a semana
 * atual", e essa e a leitura errada mais cara que este documento pode induzir.
 *
 * @param {{ fim?: string }} [periodo]
 * @returns {string}
 */
function linhaDoAssunto(achado, periodo) {
  const janela = formatarJanelaComparada(achado?.janela)
  if (janela) return `${ASSUNTO}, ${janela.longo.toLowerCase()}`
  const inicio = inicioDaSemanaEncerrada(periodo?.fim)
  if (!inicio) return `${ASSUNTO}, ${SEM_PERIODO}`
  return `${ASSUNTO}, semana de ${formatarPeriodo(inicio, periodo.fim)}`
}

/**
 * A folha: o mesmo diagnostico da tela da conta, em papel de reuniao.
 *
 * Ela e clara dentro do app escuro, e nao ha uma cor propria para isso:
 * `data-superficie="papel"` troca a pele dos tokens semanticos e os mesmos
 * componentes do kit visual saem legiveis sobre osso (src/styles/tokens.css).
 *
 * `data-imprimir="folha"` e o que faz a impressao levar esta arvore, e so ela,
 * para o papel (src/styles/impressao.css).
 *
 * Uma decisao de leitura, e nao de estilo: a lacuna de coleta fica na coluna de
 * leitura, logo abaixo do veredito. Pendura-la na coluna da evidencia a faria
 * sumir justamente quando nao ha evidencia — que e quando a falta de dado mais
 * importa (ADR-004).
 *
 * @param {object} props
 * @param {object} props.diagnostico o registro lido, como veio do motor
 * @param {object} props.conta a conta do cabecalho e do rodape
 * @param {string|null} [props.preparadoPor] nome do tenant que assina a folha
 * @returns {JSX.Element}
 */
export default function FolhaDoRelatorio({ diagnostico, conta, preparadoPor, origem }) {
  // Os achados chegam ordenados por peso decrescente (contratos.md, secao 3): o
  // veredito da folha e o mesmo primeiro achado que a tela mostra, e reordenar
  // aqui seria o relatorio discordando do diagnostico que ele imprime.
  const achado = diagnostico.achados[0]
  const cobertura = diagnostico.cobertura ?? {}
  const evidencias = Array.isArray(achado.evidencias) ? achado.evidencias : []
  const serie = achado.serie ?? null
  const temProva = evidencias.length > 0 || Boolean(serie)
  // O aviso de demonstracao da casca fica FORA da arvore data-imprimir="folha",
  // e a impressao leva so essa arvore. Sem carimbo aqui dentro, o PDF sai com o
  // numero da fixture e a linha "a partir dos dados da conta @..." — uma
  // afirmacao de procedencia falsa, entregue a um terceiro. E exatamente o que
  // o ADR-007 chama de desonestidade, e ele so nao acontece porque o carimbo
  // viaja junto do papel.
  const ehDemonstracao = origem === 'demonstracao'

  return (
    <article
      className="folha"
      data-superficie="papel"
      data-imprimir="folha"
      data-prova={temProva ? 'sim' : 'nao'}
      data-demonstracao={ehDemonstracao ? 'sim' : 'nao'}
    >
      {ehDemonstracao ? (
        <p className="folha__carimbo" role="note">
          Demonstração — os números desta folha vêm de uma conta de exemplo, não
          da conta indicada abaixo.
        </p>
      ) : null}

      <header className="folha__cabecalho">
        <div className="folha__identificacao">
          <h1 className="folha__cliente">{conta.nome}</h1>
          <p className="folha__assunto">{linhaDoAssunto(achado, diagnostico.periodo)}</p>
        </div>
        <div className="folha__assinatura">
          <p className="folha__rotulo-assinatura">{ROTULO_DE_ASSINATURA}</p>
          <p className="folha__preparador">{preparadoPor}</p>
        </div>
      </header>

      <div className="folha__corpo">
        <div className="folha__leitura">
          <Veredito severidade={achado.severidade} frase={achado.frase} />

          <AvisoDeLacuna lacunas={cobertura.lacunas} />

          <section className="folha__acao" data-bloco="acao">
            <h2 className="folha__rotulo">{TITULO_DA_ACAO}</h2>
            <p className="folha__acao-frase">{achado.acao}</p>
            {achado.confirmacao ? (
              <p className="folha__acao-confirmacao">{achado.confirmacao}</p>
            ) : null}
          </section>

          <div className="folha__limites">
            <ListaDeLimites titulo={TITULO_DOS_LIMITES} limites={diagnostico.limites} />
          </div>
        </div>

        {temProva ? (
          <div className="folha__prova">
            <TituloDeSecao>{TITULO_DA_EVIDENCIA}</TituloDeSecao>

            {evidencias.length > 0 ? (
              <Tabela
                colunas={COLUNAS}
                linhas={linhasDaEvidencia(evidencias)}
                legenda={LEGENDA_DA_TABELA}
              />
            ) : null}

            {serie ? (
              <GraficoCadencia
                pontos={serie.pontos}
                rotuloBarra={serie.rotuloBarra}
                rotuloLinha={serie.rotuloLinha}
                // O paragrafo de apoio do achado e o que sustenta a frase, e e
                // ele que vira legenda e `aria-label` do desenho: escrever outra
                // frase aqui seria a folha opinando sobre o que o grafico mostra.
                descricao={achado.apoio}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="folha__rodape">
        <Marca />
        <p className="folha__origem">
          {ehDemonstracao
            ? `Demonstração, gerada em ${formatarDataCurta(diagnostico.geradoEm)} a partir de ` +
              'dados de exemplo.'
            : `Gerado em ${formatarDataCurta(diagnostico.geradoEm)}, a partir dos dados da conta ` +
              `@${conta.username}`}
        </p>
      </footer>
    </article>
  )
}
