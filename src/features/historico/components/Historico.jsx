import { Link } from 'react-router-dom'

import {
  Botao,
  Cartao,
  Estado,
  PALAVRA_DE_SEVERIDADE,
  SeloDeSeveridade,
  TituloDeSecao,
} from '../../../components/shared/index.js'
import { rotaDaConta } from '../../../constants/rotas.js'
import { formatarDataCurta, formatarJanelaComparada } from '../../../metricas/index.js'
import useHistorico, { ESTADOS } from '../hooks/useHistorico.js'

import './Historico.css'

const TITULO = 'Diagnósticos anteriores'

const EXPLICACAO =
  'Cada linha é o veredito que o motor deu naquela data, com a versão de regra ' +
  'que o gerou. Diagnóstico antigo nunca é reescrito quando a regra muda: é ' +
  'assim que dá para responder se o que mudou foi a conta ou foi o método.'

const SEM_CONTA = 'Escolha uma conta para ver os diagnósticos dela.'
const VAZIO = 'Ainda não há diagnóstico gerado para esta conta.'
const VAZIO_APOIO =
  'O primeiro sai quando houver histórico suficiente para comparar janelas. ' +
  'Até lá, a coleta diária segue guardando.'

/**
 * Uma linha do histórico: quando, com que regra, e o que foi dito.
 *
 * @param {object} props
 * @param {object} props.diagnostico `Diagnostico` de contratos.md
 * @param {boolean} props.atual é o diagnóstico que a tela da conta mostra hoje
 * @returns {JSX.Element}
 */
function LinhaDoHistorico({ diagnostico, atual }) {
  const achado = diagnostico.achados?.[0] ?? null
  const severidade = achado?.severidade ?? 'indeterminado'
  const janela = formatarJanelaComparada(achado?.janela)

  return (
    <li className="historico__linha" data-atual={atual ? 'sim' : 'nao'} data-bloco="diagnostico">
      <div className="historico__quando">
        <p className="historico__data">{formatarDataCurta(diagnostico.geradoEm)}</p>
        {atual ? <p className="historico__marca-atual">Diagnóstico em vigor</p> : null}
      </div>

      <div className="historico__conteudo">
        <p className="historico__cabeca">
          <SeloDeSeveridade severidade={severidade}>
            {PALAVRA_DE_SEVERIDADE[severidade] ?? severidade}
          </SeloDeSeveridade>
          {achado?.rotulo ? <span className="historico__rotulo">{achado.rotulo}</span> : null}
        </p>
        <p className="historico__frase">{achado?.frase ?? 'Sem achado neste diagnóstico.'}</p>
        <p className="historico__rodape">
          {janela ? <span>{janela.curto}</span> : null}
          {/* A versao do ruleset e o que torna a serie auditavel, entao ela e
              dado de primeira classe aqui, nao letra miuda escondida. */}
          <span className="historico__ruleset">regra v{diagnostico.rulesetVersion}</span>
        </p>
      </div>
    </li>
  )
}

/**
 * A linha do tempo do diagnóstico de uma conta.
 *
 * Existe por causa do ADR-005: o motor grava a versão de regra em cada
 * diagnóstico justamente para que se possa perguntar, meses depois, se o
 * veredito mudou porque a conta mudou ou porque a regra mudou. Sem uma tela que
 * ponha os registros lado a lado, essa promessa fica só no banco.
 *
 * A tela lê e ordena nada: a lista chega pronta do serviço.
 *
 * @param {object} props
 * @param {string|null} [props.contaId] sem id, vale a conta em foco na URL
 * @returns {JSX.Element}
 */
export default function Historico({ contaId }) {
  const { estado, diagnosticos, conta, erro, recarregar } = useHistorico(contaId)

  if (estado === ESTADOS.CARREGANDO) {
    return <Estado tipo="carregando" titulo="Buscando os diagnósticos anteriores" />
  }
  if (estado === ESTADOS.SEM_CONTA) {
    return <Estado tipo="vazio" titulo={SEM_CONTA} />
  }
  if (estado === ESTADOS.ERRO) {
    return (
      <Estado tipo="erro" titulo="Não foi possível ler o histórico" descricao={erro?.mensagem}>
        <Botao aoClicar={recarregar}>Tentar de novo</Botao>
      </Estado>
    )
  }
  if (estado === ESTADOS.VAZIO) {
    return <Estado tipo="vazio" titulo={VAZIO} descricao={VAZIO_APOIO} />
  }

  return (
    <div className="tela-historico" data-fase="sucesso">
      <header className="tela-historico__topo">
        <TituloDeSecao apoio={conta ? `@${conta.username}` : undefined}>{TITULO}</TituloDeSecao>
        <p className="tela-historico__explicacao">{EXPLICACAO}</p>
        {conta ? (
          <Link className="tela-historico__voltar" to={rotaDaConta(conta.id)}>
            Voltar ao diagnóstico em vigor
          </Link>
        ) : null}
      </header>

      <Cartao como="section" aria-label={TITULO}>
        <ol className="historico__lista">
          {diagnosticos.map((diagnostico, posicao) => (
            <LinhaDoHistorico
              key={diagnostico.id}
              diagnostico={diagnostico}
              atual={posicao === 0}
            />
          ))}
        </ol>
      </Cartao>
    </div>
  )
}
