/**
 * Diagnosticos gerados pelo motor de regras.
 *
 * Este modulo **le e converte**. Ele nao gera veredito, nao compara janela e nao
 * decide severidade: quem faz isso e o motor, no servidor, gravando em
 * `diagnosticos` com a `ruleset_version` que usou (ADR-005). E a unica forma de
 * responder, meses depois, "o diagnostico mudou porque a conta mudou ou porque
 * a regra mudou?".
 *
 * O banco guarda snake_case nas colunas e jsonb nos objetos; a tela consome
 * camelCase. A conversao vale para as **colunas**: dentro do jsonb ja esta o
 * objeto do motor, gravado como ele saiu, e reescrever aquilo aqui seria a
 * camada de servico opinando sobre o conteudo do diagnostico.
 */

import { falha, falhaDeErro, ok, ORIGEM_DEMONSTRACAO } from './envelope.js'
import { CODIGOS } from './erros.js'
import { estaEmModoDemonstracao, executarNoSupabase } from './supabase.js'
import { ehDataIso, ehIdentificadorDeConta, ehInteiroEntre, ehIso8601 } from './validacao.js'
import { exigirSessao } from './autenticacao.js'
import { falhaPorAusencia } from './contas.js'
import * as demonstracao from './demonstracao/repositorio.js'

/**
 * Campos explicitos (CLAUDE.md: nenhum `select *`).
 *
 * `limites` e `cobertura` nao sao opcionais na lista: sem elas a tela exibiria
 * veredito sem os limites que o sustentam, e sem saber separar "esta tudo bem"
 * de "ainda nao da para saber" (contratos.md, secao 3).
 */
const CAMPOS =
  'id, ig_conta_id, gerado_em, periodo_inicio, periodo_fim, ruleset_version, achados, ' +
  'limites, cobertura'

/** Teto de itens por pagina de historico de diagnosticos. */
const LIMITE_MAXIMO = 100

const MENSAGEM_SEM_DIAGNOSTICO =
  'Esta conta ainda não tem diagnóstico. O primeiro sai depois da primeira coleta completa.'

/**
 * Cobertura do diagnostico, com o cuidado de nao inventar suficiencia.
 *
 * Cobertura ausente vira `suficiente: false`: afirmar o contrario faria a tela
 * mostrar veredito como se houvesse historico para sustenta-lo.
 *
 * @param {object|null|undefined} cobertura valor cru da coluna jsonb
 * @returns {{ semanas: number, primeiroDado: string|null, lacunas: object[], suficiente: boolean }}
 */
function converterCobertura(cobertura) {
  return {
    semanas: Number(cobertura?.semanas ?? 0),
    primeiroDado: cobertura?.primeiroDado ?? null,
    lacunas: Array.isArray(cobertura?.lacunas) ? cobertura.lacunas : [],
    suficiente: cobertura?.suficiente === true,
  }
}

/**
 * Linha de `diagnosticos` para o `Diagnostico` de contratos.md (secao 3).
 *
 * @param {object} linha
 * @returns {object} Diagnostico
 */
export function converterDiagnostico(linha) {
  return {
    id: linha.id,
    contaId: linha.ig_conta_id,
    geradoEm: linha.gerado_em,
    periodo: { inicio: linha.periodo_inicio, fim: linha.periodo_fim },
    rulesetVersion: linha.ruleset_version,
    achados: Array.isArray(linha.achados) ? linha.achados : [],
    limites: Array.isArray(linha.limites) ? linha.limites : [],
    cobertura: converterCobertura(linha.cobertura),
  }
}

/**
 * Valida as opcoes de listagem antes de virar consulta.
 *
 * @param {{ limite?: number, desde?: string, ate?: string }} opcoes
 * @returns {string|null} mensagem de erro, ou `null` se esta tudo certo
 */
function conferirOpcoes({ limite, desde, ate }) {
  if (limite !== undefined && !ehInteiroEntre(limite, 1, LIMITE_MAXIMO)) {
    return `O limite precisa ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.`
  }
  if (desde !== undefined && !ehDataIso(desde) && !ehIso8601(desde)) {
    return 'A data inicial precisa estar no formato AAAA-MM-DD.'
  }
  if (ate !== undefined && !ehDataIso(ate) && !ehIso8601(ate)) {
    return 'A data final precisa estar no formato AAAA-MM-DD.'
  }
  return null
}

/**
 * Diagnostico mais recente de uma conta — o que a tela principal mostra.
 *
 * @param {string} contaId
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Diagnostico`
 */
export async function obterDiagnosticoMaisRecente(contaId) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }

  if (estaEmModoDemonstracao()) {
    const diagnostico = demonstracao.obterDiagnostico(contaId)
    if (!diagnostico) {
      return falhaPorAusencia(contaId, {
        codigo: CODIGOS.SEM_DADO_SUFICIENTE,
        mensagem: MENSAGEM_SEM_DIAGNOSTICO,
      })
    }
    return ok(diagnostico, { origem: ORIGEM_DEMONSTRACAO })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) =>
    cliente
      .from('diagnosticos')
      .select(CAMPOS)
      .eq('ig_conta_id', contaId)
      .order('gerado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  if (erro) return falhaDeErro(erro)

  // Conta visivel e sem diagnostico e um estado de produto, nao um erro: a
  // coleta ainda nao rodou. `SEM_DADO_SUFICIENTE` deixa a tela mostrar espera em
  // vez de banner vermelho — e `SEM_PERMISSAO`, se a conta nem for do usuario.
  if (!data) {
    return falhaPorAusencia(contaId, {
      codigo: CODIGOS.SEM_DADO_SUFICIENTE,
      mensagem: MENSAGEM_SEM_DIAGNOSTICO,
    })
  }
  return ok(converterDiagnostico(data))
}

/**
 * Diagnosticos anteriores da conta, do mais recente para o mais antigo.
 *
 * @param {string} contaId
 * @param {{ limite?: number, desde?: string, ate?: string }} [opcoes]
 * @returns {Promise<import('./envelope.js').Envelope>} `data`: `Diagnostico[]`
 */
export async function listarDiagnosticos(contaId, opcoes = {}) {
  if (!ehIdentificadorDeConta(contaId)) {
    return falha(CODIGOS.ENTRADA_INVALIDA, 'Identificador de conta inválido.')
  }
  const problema = conferirOpcoes(opcoes)
  if (problema) return falha(CODIGOS.ENTRADA_INVALIDA, problema)

  const { limite = 12, desde, ate } = opcoes

  if (estaEmModoDemonstracao()) {
    const diagnostico = demonstracao.obterDiagnostico(contaId)
    if (!diagnostico) {
      return falhaPorAusencia(contaId, {
        codigo: CODIGOS.SEM_DADO_SUFICIENTE,
        mensagem: MENSAGEM_SEM_DIAGNOSTICO,
      })
    }
    const dentroDoPeriodo =
      (!desde || diagnostico.geradoEm >= desde) && (!ate || diagnostico.geradoEm.slice(0, 10) <= ate)
    return ok(dentroDoPeriodo ? [diagnostico].slice(0, limite) : [], {
      origem: ORIGEM_DEMONSTRACAO,
    })
  }

  const sessao = await exigirSessao()
  if (sessao.error) return sessao

  const { data, erro } = await executarNoSupabase((cliente) => {
    let consulta = cliente.from('diagnosticos').select(CAMPOS).eq('ig_conta_id', contaId)
    if (desde) consulta = consulta.gte('gerado_em', desde)
    if (ate) consulta = consulta.lte('gerado_em', ate)
    return consulta.order('gerado_em', { ascending: false }).limit(limite)
  })
  if (erro) return falhaDeErro(erro)

  const linhas = data ?? []
  // Lista vazia com filtro e resposta legitima. Lista vazia **sem** filtro pode
  // ser RLS escondendo conta de outro tenant, e ai a tela precisa saber.
  if (linhas.length === 0 && !desde && !ate) {
    return falhaPorAusencia(contaId, {
      codigo: CODIGOS.SEM_DADO_SUFICIENTE,
      mensagem: MENSAGEM_SEM_DIAGNOSTICO,
    })
  }
  return ok(linhas.map(converterDiagnostico))
}
