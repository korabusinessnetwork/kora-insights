/**
 * Estado da tela de relatorio.
 *
 * O relatorio le o **mesmo registro** que a tela de diagnostico le: o
 * diagnostico pronto, gravado pelo motor com a `ruleset_version` que usou
 * (ADR-005). Aqui nao ha media, variacao, reordenacao de achado nem numero novo
 * — relatorio e o mesmo diagnostico em outro formato, nunca um segundo produto.
 *
 * A folha precisa de duas coisas alem do registro: de quem e a conta e quem
 * assina. As duas vem do `TenantContexto`, porque quem assina e o tenant — na
 * Fase 3 e a agencia (white-label), e nome de quem prepara escrito em codigo
 * seria marca de cliente hardcodada (CLAUDE.md).
 */

import { useCallback, useEffect, useState } from 'react'

import { CODIGOS, erroDeServico, obterDiagnosticoMaisRecente } from '../../../lib/index.js'
import { useTenant } from '../../../context/TenantContexto.jsx'

/**
 * Os estados que a tela sabe renderizar. `vazio` e separado de `erro` porque
 * conta sem diagnostico ainda nao e defeito: e a coleta que ainda nao juntou
 * historico, e nao ha folha honesta para levar a reuniao antes disso.
 * @type {Readonly<Record<string, string>>}
 */
export const ESTADOS = Object.freeze({
  SEM_CONTA: 'sem-conta',
  CARREGANDO: 'carregando',
  SUCESSO: 'sucesso',
  VAZIO: 'vazio',
  ERRO: 'erro',
})

/**
 * A folha diz de quem e o diagnostico e quem o preparou. Sem saber a conta, as
 * duas linhas do cabecalho ficariam em branco — e folha sem dono e o tipo de
 * documento que chega na reuniao errada.
 */
const MENSAGEM_DE_CONTA_DESCONHECIDA =
  'Esta conta não está no seu espaço de trabalho, então não há relatório para preparar.'

/**
 * @typedef {object} LeituraDoDiagnostico
 * @property {string} estado um valor de `ESTADOS`
 * @property {object|null} diagnostico o `Diagnostico` de contratos.md (secao 3)
 * @property {{ codigo: string, mensagem: string }|null} erro erro de servico ja em pt-BR
 * @property {string|null} origem `meta.origem`: 'supabase' ou 'demonstracao' (ADR-007)
 */

/**
 * Leitura antes da primeira resposta. Sem conta nao ha o que buscar, e nesse
 * caso a tela ja nasce no vazio em vez de piscar uma folha que nunca chega.
 *
 * @param {string|null|undefined} contaId
 * @returns {LeituraDoDiagnostico}
 */
function leituraInicial(contaId) {
  return {
    estado: contaId ? ESTADOS.CARREGANDO : ESTADOS.SEM_CONTA,
    diagnostico: null,
    erro: null,
    origem: null,
  }
}

/**
 * Traduz o envelope da camada de servicos na leitura da tela.
 *
 * `SEM_DADO_SUFICIENTE` e o unico codigo que vira vazio: ele diz "ainda nao da
 * para saber", que e resposta legitima do produto (docs/03, secao 6.4) e nao
 * merece banner vermelho. Qualquer outro codigo e falha, e falha ganha saida.
 *
 * @param {import('../../../lib/envelope.js').Envelope} envelope
 * @returns {LeituraDoDiagnostico}
 */
function interpretarEnvelope(envelope) {
  const origem = envelope?.meta?.origem ?? null

  if (envelope?.error) {
    const ainda = envelope.error.codigo === CODIGOS.SEM_DADO_SUFICIENTE
    return {
      estado: ainda ? ESTADOS.VAZIO : ESTADOS.ERRO,
      diagnostico: null,
      erro: envelope.error,
      origem,
    }
  }

  return { estado: ESTADOS.SUCESSO, diagnostico: envelope?.data ?? null, erro: null, origem }
}

/**
 * A conta da folha, procurada na lista do espaco de trabalho.
 *
 * @param {string|null} contaId
 * @param {import('../../../lib/contas.js').Conta[]} contas
 * @returns {import('../../../lib/contas.js').Conta|null}
 */
function contaEmFoco(contaId, contas) {
  if (!contaId) return null
  const lista = Array.isArray(contas) ? contas : []
  return lista.find((conta) => conta.id === contaId) ?? null
}

/**
 * Junta o espaco de trabalho e a leitura do diagnostico num estado so.
 *
 * A ordem das perguntas importa. Enquanto o espaco carrega ninguem pode afirmar
 * "nenhuma conta conectada", e afirmar isso por um instante mandaria o cliente
 * conectar uma conta que ele ja tem.
 *
 * @param {object} entrada
 * @param {boolean} entrada.carregandoEspaco
 * @param {string|null} entrada.idEmFoco
 * @param {object|null} entrada.conta
 * @param {LeituraDoDiagnostico} entrada.leitura
 * @returns {{ estado: string, erro: { codigo: string, mensagem: string }|null }}
 */
function situacaoDaTela({ carregandoEspaco, idEmFoco, conta, leitura }) {
  if (carregandoEspaco) return { estado: ESTADOS.CARREGANDO, erro: null }
  if (!idEmFoco) return { estado: ESTADOS.SEM_CONTA, erro: null }
  if (!conta) {
    return {
      estado: ESTADOS.ERRO,
      erro: erroDeServico(CODIGOS.SEM_PERMISSAO, MENSAGEM_DE_CONTA_DESCONHECIDA),
    }
  }
  return { estado: leitura.estado, erro: leitura.erro }
}

/**
 * @typedef {object} SituacaoDoRelatorio
 * @property {string} estado um valor de `ESTADOS`
 * @property {object|null} diagnostico o registro que a folha imprime
 * @property {object|null} conta a conta do cabecalho e do rodape da folha
 * @property {string|null} preparadoPor nome do tenant que assina
 * @property {{ codigo: string, mensagem: string }|null} erro
 * @property {string|null} origem
 * @property {() => void} recarregar
 */

/**
 * Busca o diagnostico mais recente da conta e devolve o que a folha precisa.
 *
 * Cancela a atualizacao apos o desmonte: trocar de conta duas vezes rapido
 * deixaria a resposta lenta da primeira sobrescrever a da segunda, e o cliente
 * imprimiria o diagnostico de uma conta com o nome de outra no cabecalho.
 *
 * @param {string|null|undefined} [contaId] sem id, vale a conta em foco na URL
 * @returns {SituacaoDoRelatorio}
 */
export default function useRelatorio(contaId) {
  const { tenant, contas, contaSelecionada, carregando: carregandoEspaco } = useTenant()
  const [tentativa, setTentativa] = useState(0)

  const idEmFoco = contaId ?? contaSelecionada?.id ?? null
  const conta = contaEmFoco(idEmFoco, contas)

  const [leitura, setLeitura] = useState(() => leituraInicial(idEmFoco))

  useEffect(() => {
    if (!idEmFoco) {
      setLeitura(leituraInicial(null))
      return undefined
    }

    let ativo = true
    setLeitura(leituraInicial(idEmFoco))

    // A camada de servicos promete envelope em vez de excecao, mas a tela nao
    // pode depender disso: um throw inesperado aqui deixaria o esqueleto para
    // sempre na tela, que e o pior dos estados — o que nunca resolve.
    ;(async () => {
      try {
        const envelope = await obterDiagnosticoMaisRecente(idEmFoco)
        if (ativo) setLeitura(interpretarEnvelope(envelope))
      } catch {
        if (!ativo) return
        setLeitura({
          estado: ESTADOS.ERRO,
          diagnostico: null,
          erro: erroDeServico(CODIGOS.FALHA_INESPERADA),
          origem: null,
        })
      }
    })()

    return () => {
      ativo = false
    }
  }, [idEmFoco, tentativa])

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), [])

  const situacao = situacaoDaTela({ carregandoEspaco, idEmFoco, conta, leitura })

  return {
    estado: situacao.estado,
    erro: situacao.erro,
    diagnostico: leitura.diagnostico,
    origem: leitura.origem,
    conta,
    // O nome de quem assina vem do registro do tenant, nunca do codigo: na Fase
    // 3 e a agencia que assina a folha do cliente dela.
    preparadoPor: tenant?.nome ?? null,
    recarregar,
  }
}
