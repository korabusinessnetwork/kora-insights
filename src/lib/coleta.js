/**
 * Eventos de coleta: o registro de cada vez que o job diario rodou, e de cada
 * vez que ele falhou.
 *
 * Existe por causa do ADR-004: falha de coleta gera registro visivel e a tela
 * sinaliza a lacuna. Serie com buraco nao invisibiliza o buraco — e a unica
 * forma de o cliente saber que a queda no grafico foi do token dele, e nao do
 * conteudo dele.
 */

import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase } from './supabase.js'
import { ehDataIso, ehIdentificadorDeConta, ehInteiroEntre, ehIso8601 } from './validacao.js'
import { exigirSessao } from './autenticacao.js'
import { falhaPorAusencia } from './contas.js'
import * as demonstracao from './demonstracao/repositorio.js'

/** Campos explicitos (CLAUDE.md: nenhum `select *`). */
const CAMPOS = 'id, ig_conta_id, ocorrido_em, status, detalhe'

const LIMITE_PADRAO = 50
const LIMITE_MAXIMO = 200

/**
 * @typedef {object} EventoDeColeta
 * @property {string} id
 * @property {string} contaId
 * @property {string} ocorridoEm ISO
 * @property {string} status `ok`, `token_expirado`, `limite_de_taxa`, ...
 * @property {string|null} detalhe frase escrita pela Edge Function
 */

/**
 * @param {object} linha linha de `coleta_eventos`
 * @returns {EventoDeColeta}
 */
export function converterEvento(linha) {
  return {
    id: String(linha.id),
    contaId: linha.ig_conta_id,
    ocorridoEm: linha.ocorrido_em,
    status: linha.status,
    // `detalhe` e texto que a nossa Edge Function escreveu para ser lido, e nao
    // mensagem crua de banco: por isso este e o unico campo de texto livre que a
    // camada deixa chegar a tela.
    detalhe: linha.detalhe ?? null,
  }
}

/**
 * Eventos de coleta de uma conta, do mais recente para o mais antigo.
 *
 * @param {string} contaId
 * @param {{ limite?: number, desde?: string, ate?: string, apenasFalhas?: boolean }} [opcoes]
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `EventoDeColeta[]`
 */
export async function listarEventosDeColeta(contaId, opcoes = {}) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }

  const { limite = LIMITE_PADRAO, desde, ate, apenasFalhas = false } = opcoes
  if (!ehInteiroEntre(limite, 1, LIMITE_MAXIMO)) {
    return falha(
      CODIGOS.ENTRADA_INVALIDA,
      `O limite precisa ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.`,
    )
  }
  if (desde !== undefined && !ehDataIso(desde) && !ehIso8601(desde)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'A data inicial precisa estar no formato AAAA-MM-DD.')
  }
  if (ate !== undefined && !ehDataIso(ate) && !ehIso8601(ate)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'A data final precisa estar no formato AAAA-MM-DD.')
  }

  const semFiltro = !desde && !ate && !apenasFalhas

  if (estaEmModoDemonstracao()) {
    const conta = demonstracao.obterConta(contaId)
    if (!conta) {
      return falhaPorAusencia(contaId, { mensagem: 'Esta conta não tem registro de coleta.' })
    }
    // O filtro roda aqui, ao lado da consulta que ele espelha, e nao dentro do
    // repositorio: assim as duas versoes da mesma regra ficam a vista uma da
    // outra e nao divergem em silencio.
    const eventos = demonstracao
      .listarEventos(contaId)
      .filter((evento) => !apenasFalhas || evento.status !== 'ok')
      .filter((evento) => !desde || evento.ocorrido_em >= desde)
      .filter((evento) => !ate || evento.ocorrido_em.slice(0, 10) <= ate)
      .slice(0, limite)
    return ok(eventos.map(converterEvento), { origem: ORIGEM_DEMONSTRACAO })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) => {
    let consulta = cliente.from('coleta_eventos').select(CAMPOS).eq('ig_conta_id', contaId)
    if (apenasFalhas) consulta = consulta.neq('status', 'ok')
    if (desde) consulta = consulta.gte('ocorrido_em', desde)
    if (ate) consulta = consulta.lte('ocorrido_em', ate)
    return consulta.order('ocorrido_em', { ascending: false }).limit(limite)
  })
  if (erro) return falhaDeErro(erro)

  const linhas = data ?? []
  // Sem nenhum filtro, lista vazia significa que a conta nunca foi coletada —
  // ou que ela nao e do usuario e a RLS a escondeu. As duas merecem resposta
  // diferente na tela.
  if (linhas.length === 0 && semFiltro) {
    return falhaPorAusencia(contaId, {
      codigo: CODIGOS.SEM_DADO_SUFICIENTE,
      mensagem: 'Esta conta ainda não tem coleta registrada.',
    })
  }
  return ok(linhas.map(converterEvento))
}
