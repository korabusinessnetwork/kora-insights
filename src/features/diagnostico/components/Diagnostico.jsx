import { AvisoDeLacuna, Botao, Estado, Veredito } from '../../../components/shared/index.js'
import { formatarJanelaComparada } from '../../../metricas/index.js'
import useDiagnostico, { ESTADOS } from '../hooks/useDiagnostico.js'
import AcaoRecomendada from './AcaoRecomendada.jsx'
import LimitesDoDiagnostico from './LimitesDoDiagnostico.jsx'
import PainelDeEvidencia from './PainelDeEvidencia.jsx'
import SemContaConectada from './SemContaConectada.jsx'
import './Diagnostico.css'

const TITULO_CARREGANDO = 'Carregando o diagnóstico desta conta.'

const TITULO_DE_FALHA = 'Não foi possível carregar o diagnóstico.'

const ROTULO_DE_NOVA_TENTATIVA = 'Tentar de novo'

const TITULO_SEM_ACHADO = 'Ainda não há um diagnóstico para mostrar nesta conta.'

const DESCRICAO_SEM_ACHADO =
  'O registro chegou sem nenhum achado, então não há nada que possamos afirmar sobre ' +
  'esta conta.'

/**
 * Esqueleto do carregamento: as tres pecas da tela, em branco.
 *
 * Sem numero de exemplo e sem frase provisoria. Placeholder com numero plausivel
 * e a mentira mais barata que esta tela poderia contar — o cliente le antes de a
 * resposta chegar e leva o numero errado para a reuniao.
 *
 * @returns {JSX.Element}
 */
function EsqueletoDoDiagnostico() {
  return (
    <div className="tela-diagnostico" data-fase="carregando">
      <Estado tipo="carregando" titulo={TITULO_CARREGANDO} />
      <div className="tela-diagnostico__esqueleto" aria-hidden="true">
        <span className="tela-diagnostico__peca" data-peca="veredito" />
        <div className="tela-diagnostico__colunas">
          <span className="tela-diagnostico__peca" data-peca="evidencia" />
          <span className="tela-diagnostico__peca" data-peca="lateral" />
        </div>
      </div>
    </div>
  )
}

/**
 * Falha de leitura, com a saida obrigatoria: erro sem proxima acao e beco
 * (`docs/06_COMPONENTES/catalogo.md`).
 *
 * A frase vem do `codigo` do erro, traduzida em `src/lib/erros.js`. Mensagem
 * crua de banco nunca chega aqui, por decisao da camada de servicos.
 *
 * @param {object} props
 * @param {{ codigo: string, mensagem: string }|null} props.erro
 * @param {() => void} props.aoTentarDeNovo
 * @returns {JSX.Element}
 */
function FalhaAoCarregar({ erro, aoTentarDeNovo }) {
  return (
    <div className="tela-diagnostico" data-fase="erro">
      <Estado tipo="erro" titulo={TITULO_DE_FALHA} descricao={erro?.mensagem}>
        <Botao aoClicar={aoTentarDeNovo}>{ROTULO_DE_NOVA_TENTATIVA}</Botao>
      </Estado>
    </div>
  )
}

/**
 * Conta conectada, diagnostico ainda impossivel.
 *
 * Sao dois caminhos que terminam na mesma promessa: ou nao existe registro
 * nenhum (a coleta ainda nao fechou um dia), ou existe e a cobertura nao basta.
 * No segundo caso a frase que diz **quantas semanas faltam** ja vem pronta no
 * achado `indeterminado` — a tela nao conta semana, ela le a contagem.
 *
 * Cobertura insuficiente muda a tela inteira: nao ha veredito, ha a admissao de
 * que ainda nao da para saber (`docs/03_REGRAS_DE_NEGOCIO/modulo-diagnostico.md`,
 * secao 6.4). Por isso o achado entra como `Estado` vazio, e nao como `Veredito`.
 *
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} [props.descricao]
 * @param {object} [props.achado] o achado `indeterminado`, quando ele existe
 * @param {{ inicio?: string, fim?: string, motivo?: string }[]} [props.lacunas]
 * @param {{ codigo: string, texto: string }[]} [props.limites]
 * @returns {JSX.Element}
 */
function AindaSemVeredito({ titulo, descricao, achado, lacunas, limites }) {
  return (
    <div className="tela-diagnostico" data-fase="sem-veredito">
      <Estado tipo="vazio" titulo={titulo} descricao={descricao} />

      <AvisoDeLacuna lacunas={lacunas} />

      {achado?.acao ? (
        <AcaoRecomendada
          acao={achado.acao}
          confirmacao={achado.confirmacao}
          ofereceTeste={false}
        />
      ) : null}

      <LimitesDoDiagnostico limites={limites} />
    </div>
  )
}

/**
 * A tela de diagnostico. E o produto.
 *
 * Ela **le** o diagnostico pronto e o distribui pelo desenho da identidade:
 * veredito na largura toda, evidencia na coluna larga, acao e limites na
 * coluna estreita. Nenhuma media, nenhuma variacao e nenhuma frase de veredito
 * nascem aqui — tudo vem do motor de regras versionado (ADR-005).
 *
 * @param {object} props
 * @param {string|null} [props.contaId] sem conta, a tela mostra o vazio da identidade
 * @returns {JSX.Element}
 */
export default function Diagnostico({ contaId }) {
  const { estado, diagnostico, erro, recarregar } = useDiagnostico(contaId)

  if (estado === ESTADOS.SEM_CONTA) return <SemContaConectada />
  if (estado === ESTADOS.CARREGANDO) return <EsqueletoDoDiagnostico />
  if (estado === ESTADOS.ERRO) return <FalhaAoCarregar erro={erro} aoTentarDeNovo={recarregar} />

  if (estado === ESTADOS.VAZIO) {
    return <AindaSemVeredito titulo={erro?.mensagem ?? TITULO_SEM_ACHADO} />
  }

  const cobertura = diagnostico?.cobertura ?? {}
  const limites = diagnostico?.limites ?? []
  // Os achados chegam ordenados por peso decrescente (contratos.md, secao 3):
  // o veredito da tela e o primeiro da lista, e ordenar de novo aqui seria a
  // tela decidindo o que o motor ja decidiu.
  const principal = diagnostico?.achados?.[0] ?? null

  if (!principal) {
    return (
      <AindaSemVeredito
        titulo={TITULO_SEM_ACHADO}
        descricao={DESCRICAO_SEM_ACHADO}
        lacunas={cobertura.lacunas}
        limites={limites}
      />
    )
  }

  if (!cobertura.suficiente) {
    return (
      <AindaSemVeredito
        titulo={principal.frase}
        descricao={principal.apoio}
        achado={principal}
        lacunas={cobertura.lacunas}
        limites={limites}
      />
    )
  }

  return (
    <div className="tela-diagnostico" data-fase="sucesso">
      <Veredito
        severidade={principal.severidade}
        rotulo={principal.rotulo}
        frase={principal.frase}
      />

      <div className="tela-diagnostico__colunas">
        <div className="tela-diagnostico__evidencia">
          {/* Lacuna vem antes da evidencia: quem le os numeros precisa saber
              que dias faltaram antes de acreditar neles (ADR-004). */}
          <AvisoDeLacuna lacunas={cobertura.lacunas} />
          <PainelDeEvidencia achado={principal} periodo={formatarJanelaComparada(principal.janela)?.longo ?? ''} />
        </div>

        <div className="tela-diagnostico__lateral">
          <AcaoRecomendada acao={principal.acao} confirmacao={principal.confirmacao} />
          <LimitesDoDiagnostico limites={limites} />
        </div>
      </div>
    </div>
  )
}
