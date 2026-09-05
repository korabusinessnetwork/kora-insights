/**
 * Estado das duas telas de conexao: a ida ao dialogo da Meta e a volta dele.
 *
 * Nenhuma regra de OAuth mora aqui. Gerar o estado de 128 bits, guardar,
 * conferir na volta e trocar o codigo por token sao trabalho de
 * `src/lib/conexaoMeta.js` e da Edge Function — o front nunca ve token e nunca
 * ve o app secret (docs/11_SEGURANCA). O que este arquivo faz e transformar o
 * envelope em situacao de tela, e garantir que a volta do OAuth seja tratada
 * **uma vez so**.
 *
 * Esse "uma vez so" nao e zelo: o estado guardado e de uso unico e e consumido
 * na primeira conferencia. Em `StrictMode`, o React monta, desmonta e remonta o
 * efeito; sem a trava, a segunda execucao acharia o armario vazio e recusaria
 * uma conexao legitima, so em desenvolvimento — o pior tipo de bug, o que so
 * aparece na maquina de quem programa.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { CODIGOS, concluirConexao, erroDeServico, urlDeConsentimento } from '../../../lib/index.js'

/**
 * Situacoes da tela que inicia a conexao.
 * @type {Readonly<Record<string, string>>}
 */
export const ESTADOS_DA_CONEXAO = Object.freeze({
  REPOUSO: 'repouso',
  ABRINDO: 'abrindo',
  ERRO: 'erro',
})

/**
 * Situacoes da volta do OAuth. `cancelada` e separada de `recusada` de
 * proposito: desistir no dialogo da Meta e uma decisao da pessoa, nao uma falha
 * do sistema, e pintar isso de vermelho ensinaria o cliente a temer um botao
 * que ele mesmo apertou.
 * @type {Readonly<Record<string, string>>}
 */
export const ESTADOS_DO_RETORNO = Object.freeze({
  SEM_RETORNO: 'sem-retorno',
  CONCLUINDO: 'concluindo',
  CONECTADA: 'conectada',
  CANCELADA: 'cancelada',
  RECUSADA: 'recusada',
})

/**
 * Motivos que a tela sabe explicar e que **nao** vem como codigo de servico:
 * eles nascem no proprio retorno da Meta, antes de qualquer chamada nossa.
 * @type {Readonly<Record<string, string>>}
 */
export const MOTIVOS = Object.freeze({
  PERMISSAO_NEGADA: 'permissao-negada',
  RECUSA_DA_META: 'recusa-da-meta',
})

/** Como a Meta anuncia que foi a propria pessoa que desistiu. */
const CANCELAMENTO = Object.freeze({ erro: 'access_denied', motivo: 'user_denied' })

/**
 * Leva o navegador ao dialogo de consentimento.
 *
 * `assign` e nao `replace`: a tela de requisitos continua no historico, e o
 * botao "voltar" do celular devolve a pessoa para ela em vez de jogar fora do
 * produto.
 *
 * @param {string} url
 */
function abrirNoNavegador(url) {
  if (typeof window !== 'undefined') window.location.assign(url)
}

/** @returns {string} instante atual em ISO */
function agoraEmIso() {
  return new Date().toISOString()
}

/**
 * Inicia a conexao: pede a URL do dialogo e leva a pessoa ate la.
 *
 * @param {object} [opcoes]
 * @param {(url: string) => void} [opcoes.irPara] como sair do app; injetavel
 *   para que a tela possa ser exercitada sem abandonar a pagina
 * @returns {{ estado: string, erro: object|null, abrindo: boolean, iniciar: () => Promise<void> }}
 */
export default function useConexao({ irPara = abrirNoNavegador } = {}) {
  const [estado, setEstado] = useState(ESTADOS_DA_CONEXAO.REPOUSO)
  const [erro, setErro] = useState(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const iniciar = useCallback(async () => {
    setErro(null)
    setEstado(ESTADOS_DA_CONEXAO.ABRINDO)

    try {
      const envelope = await urlDeConsentimento()
      if (!montado.current) return

      if (envelope?.error) {
        setErro(envelope.error)
        setEstado(ESTADOS_DA_CONEXAO.ERRO)
        return
      }

      // O botao continua ocupado de proposito: a saida para a Meta ja comecou, e
      // um segundo clique geraria um segundo estado de OAuth, invalidando o
      // primeiro — a pessoa voltaria da autorizacao para uma recusa.
      irPara(envelope.data.url)
    } catch {
      if (!montado.current) return
      setErro(erroDeServico(CODIGOS.FALHA_INESPERADA))
      setEstado(ESTADOS_DA_CONEXAO.ERRO)
    }
  }, [irPara])

  return {
    estado,
    erro,
    abrindo: estado === ESTADOS_DA_CONEXAO.ABRINDO,
    iniciar,
  }
}

/**
 * Classifica o retorno **antes** de qualquer chamada: o que a propria Meta ja
 * respondeu na URL nao precisa de ida ao servidor para ser entendido.
 *
 * @param {{ codigo: string|null, estado: string|null, erroDaMeta: string|null,
 *   motivoDaMeta: string|null }} retorno
 * @returns {{ estado: string, motivo: string|null }}
 */
function classificarRetorno({ codigo, estado, erroDaMeta, motivoDaMeta }) {
  if (erroDaMeta) {
    if (erroDaMeta === CANCELAMENTO.erro && motivoDaMeta === CANCELAMENTO.motivo) {
      return { estado: ESTADOS_DO_RETORNO.CANCELADA, motivo: null }
    }
    if (erroDaMeta === CANCELAMENTO.erro) {
      return { estado: ESTADOS_DO_RETORNO.RECUSADA, motivo: MOTIVOS.PERMISSAO_NEGADA }
    }
    return { estado: ESTADOS_DO_RETORNO.RECUSADA, motivo: MOTIVOS.RECUSA_DA_META }
  }

  // Sem `code` e sem `state` ninguem veio da Meta: e alguem que digitou o
  // endereco, ou um link velho aberto de novo.
  if (!codigo && !estado) return { estado: ESTADOS_DO_RETORNO.SEM_RETORNO, motivo: null }

  return { estado: ESTADOS_DO_RETORNO.CONCLUINDO, motivo: null }
}

/**
 * @typedef {object} SituacaoDoRetorno
 * @property {string} estado um valor de `ESTADOS_DO_RETORNO`
 * @property {string|null} motivo `MOTIVOS`, ou o codigo do erro de servico
 * @property {object|null} conta a conta conectada, sem token nem referencia
 * @property {string|null} conectadaEm ISO do instante em que a conexao fechou
 * @property {{ codigo: string, mensagem: string }|null} erro erro ja em pt-BR
 */

/**
 * Conclui a conexao com o que a Meta devolveu na URL.
 *
 * @param {object} retorno
 * @param {string|null} retorno.codigo `code` do retorno
 * @param {string|null} retorno.estado `state` do retorno
 * @param {string|null} [retorno.erroDaMeta] `error`
 * @param {string|null} [retorno.motivoDaMeta] `error_reason`
 * @param {() => string} [retorno.relogio] injetavel para teste determinístico
 * @returns {SituacaoDoRetorno}
 */
export function useRetornoDaConexao({
  codigo,
  estado,
  erroDaMeta = null,
  motivoDaMeta = null,
  relogio = agoraEmIso,
}) {
  const [situacao, setSituacao] = useState(() => ({
    ...classificarRetorno({ codigo, estado, erroDaMeta, motivoDaMeta }),
    conta: null,
    conectadaEm: null,
    erro: null,
  }))
  const tratado = useRef(null)

  useEffect(() => {
    const chave = `${erroDaMeta ?? ''}|${motivoDaMeta ?? ''}|${codigo ?? ''}|${estado ?? ''}`
    // O estado do OAuth e consumido na primeira conferencia: repetir a chamada
    // recusaria um retorno legitimo (ver o cabecalho deste arquivo).
    if (tratado.current === chave) return undefined
    tratado.current = chave

    const classificacao = classificarRetorno({ codigo, estado, erroDaMeta, motivoDaMeta })
    setSituacao({ ...classificacao, conta: null, conectadaEm: null, erro: null })
    if (classificacao.estado !== ESTADOS_DO_RETORNO.CONCLUINDO) return undefined

    let ativo = true

    ;(async () => {
      try {
        const envelope = await concluirConexao(codigo ?? '', estado ?? '')
        if (!ativo) return

        if (envelope?.error) {
          setSituacao({
            estado: ESTADOS_DO_RETORNO.RECUSADA,
            motivo: envelope.error.codigo,
            conta: null,
            conectadaEm: null,
            erro: envelope.error,
          })
          return
        }

        setSituacao({
          estado: ESTADOS_DO_RETORNO.CONECTADA,
          motivo: null,
          conta: envelope?.data ?? null,
          conectadaEm: relogio(),
          erro: null,
        })
      } catch {
        if (!ativo) return
        const erro = erroDeServico(CODIGOS.FALHA_INESPERADA)
        setSituacao({
          estado: ESTADOS_DO_RETORNO.RECUSADA,
          motivo: erro.codigo,
          conta: null,
          conectadaEm: null,
          erro,
        })
      }
    })()

    return () => {
      ativo = false
    }
  }, [codigo, estado, erroDaMeta, motivoDaMeta, relogio])

  return situacao
}
