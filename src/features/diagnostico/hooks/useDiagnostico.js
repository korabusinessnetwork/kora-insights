/**
 * Estado da tela de diagnostico.
 *
 * O hook busca o diagnostico **pronto** em `src/lib` e nao faz mais nada com
 * ele: nao compara janela, nao calcula media, nao escolhe severidade e nao
 * escreve frase. Quem diagnostica e o motor, no servidor, gravando com a
 * `ruleset_version` que usou (ADR-005). Aqui so existe o caminho do envelope
 * ate os quatro estados que toda tela do produto e obrigada a ter (CLAUDE.md).
 *
 * Sem biblioteca de data fetching de proposito: uma tela, uma consulta, sem
 * cache compartilhado a invalidar (memory/restrictions.md, fase bootstrap).
 */

import { useCallback, useEffect, useState } from 'react'
import { CODIGOS, erroDeServico, obterDiagnosticoMaisRecente } from '../../../lib/index.js'

/**
 * Os estados que a tela sabe renderizar. `vazio` e separado de `erro` porque
 * conta sem diagnostico ainda nao e defeito: e a coleta que ainda nao juntou
 * historico, e mandar o cliente "tentar de novo" nesse caso seria mentira.
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
 * @typedef {object} SituacaoDoDiagnostico
 * @property {string} estado um valor de `ESTADOS`
 * @property {object|null} diagnostico o `Diagnostico` de contratos.md (secao 3)
 * @property {{ codigo: string, mensagem: string }|null} erro erro de servico ja em pt-BR
 * @property {string|null} origem `meta.origem`: 'supabase' ou 'demonstracao' (ADR-007)
 */

/**
 * Situacao antes da primeira resposta. Sem conta nao ha o que buscar, e nesse
 * caso a tela ja nasce no vazio em vez de piscar um esqueleto que nunca vira
 * conteudo.
 *
 * @param {string|null|undefined} contaId
 * @returns {SituacaoDoDiagnostico}
 */
function situacaoInicial(contaId) {
  return {
    estado: contaId ? ESTADOS.CARREGANDO : ESTADOS.SEM_CONTA,
    diagnostico: null,
    erro: null,
    origem: null,
  }
}

/**
 * Traduz o envelope da camada de servicos na situacao da tela.
 *
 * `SEM_DADO_SUFICIENTE` e o unico codigo que vira vazio: ele diz "ainda nao da
 * para saber", que e uma resposta legitima do produto (docs/03, secao 6.4).
 * Qualquer outro codigo e falha e merece a saida de tentar de novo.
 *
 * @param {import('../../../lib/envelope.js').Envelope} envelope
 * @returns {SituacaoDoDiagnostico}
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
 * Busca o diagnostico mais recente da conta e devolve a situacao da tela.
 *
 * Cancela a atualizacao apos o desmonte: trocar de conta duas vezes rapido
 * deixaria a resposta lenta da primeira sobrescrever a da segunda, e o cliente
 * leria o diagnostico de uma conta com o nome de outra na barra.
 *
 * @param {string|null|undefined} contaId
 * @returns {SituacaoDoDiagnostico & { recarregar: () => void }}
 */
export default function useDiagnostico(contaId) {
  const [tentativa, setTentativa] = useState(0)
  const [situacao, setSituacao] = useState(() => situacaoInicial(contaId))

  useEffect(() => {
    if (!contaId) {
      setSituacao(situacaoInicial(null))
      return undefined
    }

    let ativo = true
    setSituacao(situacaoInicial(contaId))

    // A camada de servicos promete envelope em vez de excecao, mas a tela nao
    // pode depender disso: um throw inesperado aqui deixaria o esqueleto para
    // sempre na tela, que e o pior dos estados — o que nunca resolve.
    ;(async () => {
      try {
        const envelope = await obterDiagnosticoMaisRecente(contaId)
        if (ativo) setSituacao(interpretarEnvelope(envelope))
      } catch {
        if (!ativo) return
        setSituacao({
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
  }, [contaId, tentativa])

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), [])

  return { ...situacao, recarregar }
}
