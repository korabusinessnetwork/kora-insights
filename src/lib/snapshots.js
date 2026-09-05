/**
 * Serie semanal canonica de uma conta.
 *
 * A agregacao de dia em semana **nao e reimplementada aqui**: os dois caminhos
 * (Supabase e demonstracao) passam pelo mesmo `montarHistorico` do motor, que e
 * quem sabe que seguidores e estoque e alcance e fluxo, e que semana pela metade
 * nao vira semana (contratos.md, secao 3). Duplicar isso seria abrir espaco para
 * a tela de serie e a tela de diagnostico discordarem sobre o mesmo mes.
 */

import { segundaDaSemana, somarDias } from '../calendario/calendario.js'
import { montarHistorico } from '../motor/historico.js'
import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase } from './supabase.js'
import { ehDataIso, ehIdentificadorDeConta, ehInteiroEntre } from './validacao.js'
import { exigirSessao } from './autenticacao.js'
import { falhaPorAusencia } from './contas.js'
import * as demonstracao from './demonstracao/repositorio.js'

/** Campos explicitos de `snapshots_conta` (CLAUDE.md: nenhum `select *`). */
const CAMPOS_DE_SNAPSHOT = 'ig_conta_id, data, metrica, valor'

/** Campos explicitos de `coleta_eventos` usados para nomear lacuna. */
const CAMPOS_DE_EVENTO = 'ig_conta_id, ocorrido_em, status'

const SEMANAS_PADRAO = 16
const SEMANAS_MAXIMO = 104

/**
 * @typedef {object} SemanaDaSerie
 * @property {string} inicio segunda-feira
 * @property {string} fim domingo
 * @property {Record<string, number>} valores metricas canonicas ja agregadas
 * @property {number} diasComColeta 0 a 7
 * @property {boolean} completa 7 dias coletados
 */

/**
 * @typedef {object} SerieSemanal
 * @property {string} contaId
 * @property {{ inicio: string|null, fim: string|null }} janela periodo devolvido
 * @property {SemanaDaSerie[]} semanas da mais antiga para a mais recente
 * @property {{ inicio: string, fim: string, motivo: string }[]} lacunas dentro da janela
 */

/** @returns {string} dia de hoje em UTC, `YYYY-MM-DD` */
function hoje() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {Record<string, number>} valores
 * @param {string[]|null} metricas codigos canonicos pedidos, ou `null` para todos
 * @returns {Record<string, number>}
 */
function filtrarMetricas(valores, metricas) {
  if (!metricas) return valores
  const escolhidas = new Set(metricas)
  return Object.fromEntries(Object.entries(valores).filter(([codigo]) => escolhidas.has(codigo)))
}

/**
 * Recorta o historico na janela pedida e devolve a serie que a tela consome.
 *
 * A serie nao carrega `primeiroDado`: ela e uma janela, e o primeiro dado da
 * conta e outra pergunta — quem precisa dela le `cobertura` do diagnostico. Um
 * "primeiro dado" que na verdade e "primeiro dia da janela" seria numero certo
 * respondendo a pergunta errada.
 *
 * As lacunas sao recortadas junto: lacuna de fora da janela na tela da janela
 * assusta sem informar.
 *
 * @param {import('../motor/historico.js').Historico} historico
 * @param {{ semanas: number, metricas: string[]|null }} opcoes
 * @returns {SerieSemanal}
 */
function converterSerie(historico, { semanas, metricas }) {
  const janelas = historico.semanas.slice(-semanas)
  const inicio = janelas[0]?.inicio ?? null
  const fim = janelas[janelas.length - 1]?.fim ?? null

  return {
    contaId: historico.contaId,
    janela: { inicio, fim },
    semanas: janelas.map((semana) => ({
      inicio: semana.inicio,
      fim: semana.fim,
      valores: filtrarMetricas(semana.valores, metricas),
      diasComColeta: semana.diasComColeta,
      completa: semana.completa,
    })),
    lacunas: historico.lacunas.filter(
      (lacuna) => !inicio || (lacuna.fim >= inicio && lacuna.inicio <= fim),
    ),
  }
}

/**
 * Serie semanal de uma conta.
 *
 * @param {string} contaId
 * @param {{ semanas?: number, ate?: string, metricas?: string[] }} [opcoes]
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `SerieSemanal`
 */
export async function listarSerieSemanal(contaId, opcoes = {}) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }

  const { semanas = SEMANAS_PADRAO, ate, metricas } = opcoes
  if (!ehInteiroEntre(semanas, 1, SEMANAS_MAXIMO)) {
    return falha(
      CODIGOS.ENTRADA_INVALIDA,
      `O número de semanas precisa ser um inteiro entre 1 e ${SEMANAS_MAXIMO}.`,
    )
  }
  if (ate !== undefined && !ehDataIso(ate)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'A data final precisa estar no formato AAAA-MM-DD.')
  }
  if (metricas !== undefined && !Array.isArray(metricas)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'As métricas precisam vir em uma lista de códigos.')
  }

  const escolhidas = metricas ?? null

  if (estaEmModoDemonstracao()) {
    const historico = demonstracao.obterHistorico(contaId)
    if (!historico) {
      return falhaPorAusencia(contaId, { mensagem: 'Esta conta ainda não tem série coletada.' })
    }
    return ok(converterSerie(historico, { semanas, metricas: escolhidas }), {
      origem: ORIGEM_DEMONSTRACAO,
    })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const corte = ate ?? hoje()
  const primeiraSegunda = somarDias(segundaDaSemana(corte), -(semanas - 1) * 7)

  // A consulta nao filtra por metrica de proposito, mesmo quando a tela pediu
  // poucas: `diasComColeta` e `completa` saem das linhas que existem, e filtrar
  // no banco faria um dia coletado parecer nao coletado — inventando lacuna.
  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente
      .from('snapshots_conta')
      .select(CAMPOS_DE_SNAPSHOT)
      .eq('ig_conta_id', contaId)
      .gte('data', primeiraSegunda)
      .lte('data', corte)
      .order('data', { ascending: true }),
  )
  if (erro) return falhaDeErro(erro)

  const linhas = data ?? []
  if (linhas.length === 0) {
    return falhaPorAusencia(contaId, {
      codigo: CODIGOS.SEM_DADO_SUFICIENTE,
      mensagem: 'Ainda não há coleta registrada para esta conta no período pedido.',
    })
  }

  const eventos = await executarNoSupabase((cliente) =>
    cliente
      .from('coleta_eventos')
      .select(CAMPOS_DE_EVENTO)
      .eq('ig_conta_id', contaId)
      .gte('ocorrido_em', primeiraSegunda)
      .order('ocorrido_em', { ascending: true }),
  )
  if (eventos.erro) return falhaDeErro(eventos.erro)

  const historico = montarHistorico({
    conta: { id: contaId },
    snapshotsConta: linhas,
    snapshotsMidia: [],
    eventosDeColeta: eventos.data ?? [],
    ate: corte,
  })
  return ok(converterSerie(historico, { semanas, metricas: escolhidas }))
}
