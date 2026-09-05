import { useSearchParams } from 'react-router-dom'

import { Estado, ListaDePassos } from '../../../components/shared/index.js'
import { ROTAS } from '../../../constants/rotas.js'
import { CODIGOS } from '../../../lib/index.js'
import { formatarDataCurta } from '../../../metricas/index.js'
import { ESTADOS_DO_RETORNO, MOTIVOS, useRetornoDaConexao } from '../hooks/useConexao.js'
import './RetornoDaConexao.css'
import { SEMANAS_PARA_DIAGNOSTICO } from '../../../rules/requisitos.js'

/**
 * A volta do OAuth (`/conectar/retorno`).
 *
 * Tres coisas acontecem aqui, e nenhuma delas e "mostrar o resultado":
 *
 * 1. **Recusar retorno que nao confere.** O estado guardado no inicio e
 *    comparado em `concluirConexao` e o retorno que nao bate e barrado antes de
 *    qualquer efeito. Sem isso, um terceiro monta um retorno com o `code` da
 *    conta dele e induz o cliente a clicar: a conta do atacante ficaria
 *    vinculada ao tenant da vitima (docs/05_FLUXOS/fluxo-conexao.md).
 * 2. **Tratar o cancelamento como decisao, nao como defeito.** Quem desistiu no
 *    dialogo da Meta nao merece uma tela vermelha dizendo que algo quebrou.
 * 3. **Dizer o que fazer a seguir.** Codigo de erro sozinho e um beco: cada
 *    recusa aqui vem com o proximo passo concreto.
 */

/**
 * Semanas de publicacao ate o diagnostico nomear uma causa.
 *
 * ATENCAO — mesmo conflito ja registrado em
 * `src/features/diagnostico/components/SemContaConectada.jsx`: a identidade e a
 * tela sem conta conectada prometem **8 semanas**, e o ruleset 0.3.0 exige
 * **16 semanas completas** (8 recentes contra 8 anteriores). O numero vem de
 * `src/rules/requisitos.js`, a mesma fonte que a tela vazia usa e que o ruleset
 * consome: uma promessa so, e ela acompanha o motor sozinha quando ele mudar.
 */
export const SEMANAS_ATE_O_DIAGNOSTICO = SEMANAS_PARA_DIAGNOSTICO

const DIA_EM_MS = 86400000

/**
 * Data estimada do primeiro diagnostico de causa: o dia da conexao mais as
 * semanas de publicacao que o metodo exige.
 *
 * Aritmetica em UTC e sem `Date.now()`: a data e derivada do instante em que a
 * conexao fechou, que chega por parametro. Funcao de calendario vive em
 * `src/calendario/calendario.js`, mas aquele modulo se declara "para fixtures e
 * para o motor" — tela nao e nenhum dos dois, entao a conta de somar dias mora
 * aqui, pura e testada.
 *
 * @param {string|null|undefined} conectadaEm ISO (`YYYY-MM-DD` ou completo)
 * @param {number} [semanas] semanas a somar
 * @returns {string|null} `YYYY-MM-DD`, ou `null` quando a data de origem nao serve
 */
export function estimarPrimeiroDiagnostico(conectadaEm, semanas = SEMANAS_ATE_O_DIAGNOSTICO) {
  if (typeof conectadaEm !== 'string' || conectadaEm.length < 10) return null

  const [ano, mes, dia] = conectadaEm.slice(0, 10).split('-').map(Number)
  const inicio = Date.UTC(ano, mes - 1, dia)
  if (!Number.isFinite(inicio)) return null

  return new Date(inicio + semanas * 7 * DIA_EM_MS).toISOString().slice(0, 10)
}

/**
 * O que dizer, e o que fazer, em cada recusa. A chave e o motivo do hook: um
 * codigo de servico (`CODIGOS`) ou um motivo nascido no proprio retorno da Meta.
 * @type {Readonly<Record<string, { titulo: string, passos: string[] }>>}
 */
export const RESPOSTA_POR_MOTIVO = Object.freeze({
  [MOTIVOS.PERMISSAO_NEGADA]: {
    titulo: 'A autorização voltou sem as permissões necessárias.',
    passos: [
      'Refaça a autorização mantendo as quatro permissões marcadas. Sem elas a Meta não ' +
        'entrega métrica nenhuma, e o diagnóstico não teria o que ler.',
      'Se você preferir não conceder alguma delas, fale com a gente antes: é melhor não ' +
        'conectar do que conectar sem poder ler.',
    ],
  },
  [MOTIVOS.RECUSA_DA_META]: {
    titulo: 'A Meta interrompeu a autorização.',
    passos: [
      'Comece de novo pela tela de conectar.',
      'Se o Facebook estiver pedindo verificação da sua conta ou da Página, resolva isso por ' +
        'lá primeiro: a autorização não passa enquanto essa pendência existir.',
    ],
  },
  [CODIGOS.ENTRADA_INVALIDA]: {
    titulo: 'A conexão não foi concluída, e nada foi gravado.',
    passos: [
      'Se você começou a conexão em outra aba, em outro navegador ou em janela anônima, ' +
        'refaça tudo no mesmo lugar: este retorno só vale para a conexão iniciada aqui.',
      'Confira os três requisitos: conta Profissional, vinculada a uma Página do Facebook, ' +
        'com você como administrador dela.',
      'Comece de novo pela tela de conectar. Como nada foi gravado, não há o que desfazer.',
    ],
  },
  [CODIGOS.SEM_PERMISSAO]: {
    titulo: 'Esta conta não pode ser conectada a este espaço de trabalho.',
    passos: [
      'Se a conta já está conectada em outro espaço de trabalho, ela precisa sair de lá ' +
        'primeiro. Não movemos histórico de um espaço para outro por conta própria.',
      'Confira se você entrou com o e-mail do espaço de trabalho certo.',
      'Fale com a gente: este caso se resolve junto, não por tentativa.',
    ],
  },
  [CODIGOS.SEM_SESSAO]: {
    titulo: 'Sua sessão expirou no meio do caminho.',
    passos: [
      'Entre de novo com seu e-mail e refaça a conexão: a autorização precisa cair na sua ' +
        'sessão, e não em nenhuma outra.',
    ],
  },
  [CODIGOS.TOKEN_EXPIRADO]: {
    titulo: 'A autorização da Meta não vale mais.',
    passos: [
      'Comece a conexão de novo. Uma autorização nova substitui a anterior e a coleta ' +
        'recomeça do ponto em que parou.',
      'Trocar a senha do Facebook ou remover o acesso do app nas configurações da Meta ' +
        'derruba a autorização: se foi isso, refazer resolve.',
    ],
  },
  [CODIGOS.LIMITE_DE_TAXA]: {
    titulo: 'A Meta recusou por excesso de chamadas.',
    passos: [
      'Espere alguns minutos e tente de novo. Não é problema da sua conta e nada se perdeu.',
      'Evite repetir o clique: cada tentativa conta para o mesmo limite.',
    ],
  },
  [CODIGOS.FALHA_DE_REDE]: {
    titulo: 'Não conseguimos falar com o servidor.',
    passos: [
      'Confira sua conexão e tente de novo.',
      'A conta só está conectada quando esta tela disser que está. Nada ficou pela metade.',
    ],
  },
  [CODIGOS.FALHA_INESPERADA]: {
    titulo: 'Algo saiu do esperado ao concluir a conexão.',
    passos: [
      'Tente de novo em alguns instantes.',
      'Se repetir, fale com a gente antes da terceira tentativa: nada foi gravado, e a gente ' +
        'prefere olhar o que houve.',
    ],
  },
})

const RESPOSTA_PADRAO = RESPOSTA_POR_MOTIVO[CODIGOS.FALHA_INESPERADA]

/**
 * Os passos entre a autorizacao e o primeiro diagnostico de causa.
 *
 * @param {string|null} dataEstimada `YYYY-MM-DD`
 * @returns {{ titulo: string, descricao: string }[]}
 */
function passosAteODiagnostico(dataEstimada) {
  const quando = dataEstimada ? formatarDataCurta(dataEstimada) : null

  return [
    {
      titulo: 'Hoje: guardamos o primeiro retrato da conta',
      descricao:
        'O histórico passa a ser seu e exportável. O que o Instagram apagar daqui para frente, ' +
        'a gente já terá guardado.',
    },
    {
      titulo: 'Em até 24 horas: a primeira leitura aparece',
      descricao:
        'Ela ainda não nomeia causa. Vai dizer, com todas as letras, quanto histórico falta — ' +
        'é o que o produto faz em vez de chutar.',
    },
    {
      titulo: quando
        ? `A partir de ${quando}: o diagnóstico nomeia a causa`
        : `Depois de ${SEMANAS_ATE_O_DIAGNOSTICO} semanas de publicação: o diagnóstico ` +
          'nomeia a causa',
      descricao:
        `São ${SEMANAS_ATE_O_DIAGNOSTICO} semanas de publicação para comparar janelas e apontar ` +
        'o que está travando o crescimento. A data é estimativa: semana sem publicação atrasa ' +
        'a conta.',
    },
  ]
}

/**
 * @returns {JSX.Element}
 */
export default function RetornoDaConexao() {
  const [parametros] = useSearchParams()
  const situacao = useRetornoDaConexao({
    codigo: parametros.get('code'),
    estado: parametros.get('state'),
    erroDaMeta: parametros.get('error'),
    motivoDaMeta: parametros.get('error_reason'),
  })

  if (situacao.estado === ESTADOS_DO_RETORNO.CONCLUINDO) {
    return (
      <Estado
        tipo="carregando"
        titulo="Concluindo a conexão"
        descricao="Estamos confirmando a autorização com a Meta. Não feche esta aba."
      />
    )
  }

  if (situacao.estado === ESTADOS_DO_RETORNO.CANCELADA) {
    // Vazio, e nao erro: desistir e uma decisao legitima, e vermelho aqui
    // ensinaria o cliente a temer um botao que ele mesmo apertou.
    return (
      <Estado
        tipo="vazio"
        titulo="Você cancelou a autorização. Nada foi conectado."
        descricao="Nenhum dado seu foi lido e nenhuma conta foi vinculada. Recomece quando quiser."
      >
        <p className="retorno__acoes">
          <a className="retorno__link" href={ROTAS.conectar} data-papel="principal">
            Ver os requisitos e tentar de novo
          </a>
        </p>
      </Estado>
    )
  }

  if (situacao.estado === ESTADOS_DO_RETORNO.SEM_RETORNO) {
    return (
      <Estado
        tipo="vazio"
        titulo="Esta tela é a volta da autorização."
        descricao="Ela só tem o que mostrar depois que você autoriza no Facebook."
      >
        <p className="retorno__acoes">
          <a className="retorno__link" href={ROTAS.conectar} data-papel="principal">
            Ir para a tela de conectar
          </a>
        </p>
      </Estado>
    )
  }

  if (situacao.estado === ESTADOS_DO_RETORNO.RECUSADA) {
    const resposta = RESPOSTA_POR_MOTIVO[situacao.motivo] ?? RESPOSTA_PADRAO

    return (
      <Estado tipo="erro" titulo={resposta.titulo} descricao={situacao.erro?.mensagem}>
        <div className="retorno__saida">
          <h3 className="retorno__subtitulo">O que fazer agora</h3>
          <ol className="retorno__passos">
            {resposta.passos.map((passo) => (
              <li className="retorno__passo" key={passo}>
                {passo}
              </li>
            ))}
          </ol>
          <p className="retorno__acoes">
            <a className="retorno__link" href={ROTAS.conectar} data-papel="principal">
              Voltar para os requisitos
            </a>
          </p>
        </div>
      </Estado>
    )
  }

  const dataEstimada = estimarPrimeiroDiagnostico(situacao.conectadaEm)
  const conta = situacao.conta

  return (
    <section className="retorno" role="status">
      <h1 className="retorno__titulo">Conta conectada.</h1>
      <p className="retorno__apoio">
        {conta?.username
          ? `Passamos a acompanhar @${conta.username} a partir de agora. `
          : 'Passamos a acompanhar esta conta a partir de agora. '}
        O primeiro diagnóstico não sai hoje — e a tela vai dizer exatamente o que ainda não sabe
        até ele sair.
      </p>

      <ListaDePassos passos={passosAteODiagnostico(dataEstimada)} />

      <p className="retorno__acoes">
        {/* Âncora, e não `Link`: a lista de contas do cabeçalho foi carregada
            antes desta conexão existir, e um carregamento inteiro é o jeito
            honesto de fazer a conta nova aparecer em todo lugar de uma vez. */}
        <a className="retorno__link" href={ROTAS.contas} data-papel="principal">
          Ver minhas contas
        </a>
        <a className="retorno__link" href={ROTAS.dados}>
          Como pedir a exclusão dos seus dados
        </a>
      </p>
    </section>
  )
}
