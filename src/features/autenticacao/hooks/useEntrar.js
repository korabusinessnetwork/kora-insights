/**
 * Estado da tela de entrada: pedir o link de acesso por e-mail.
 *
 * Duas decisoes governam este arquivo, e as duas sao de seguranca:
 *
 * 1. **O e-mail e validado aqui, antes de virar chamada.** Endereco torto nao
 *    merece uma ida ao servidor para voltar como erro; e o produto nao pode
 *    gastar cota de envio com o que ja se sabe invalido (CLAUDE.md: prevencao
 *    de erro > mensagem de erro).
 * 2. **A tela nunca responde "este e-mail existe".** Quem pergunta isso com um
 *    formulario aberto na internet esta montando a lista de clientes de quem
 *    responde. Por isso a confirmacao e a mesma para endereco cadastrado e para
 *    endereco desconhecido, e os codigos que entregariam a base viram
 *    confirmacao em vez de erro.
 *
 * A sessao em si mora em `SessaoContexto`; aqui so existe o pedido do link.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { CODIGOS, ehEmail, entrarComEmail, erroDeServico } from '../../../lib/index.js'

/**
 * Os estados que a tela sabe renderizar. `enviado` e separado de `repouso`
 * porque a confirmacao substitui o formulario: deixar o campo preenchido ao
 * lado da confirmacao convida ao segundo pedido, que invalida o primeiro link.
 * @type {Readonly<Record<string, string>>}
 */
export const ESTADOS = Object.freeze({
  REPOUSO: 'repouso',
  ENVIANDO: 'enviando',
  ENVIADO: 'enviado',
  ERRO: 'erro',
})

const MENSAGEM_DE_EMAIL_INVALIDO =
  'Este endereço não parece um e-mail. Confira antes de pedir o link.'

/**
 * Codigos que, exibidos, responderiam "este e-mail esta cadastrado?".
 * Viram confirmacao neutra: a pessoa segue para a caixa de entrada e quem
 * estivesse adivinhando enderecos nao aprende nada.
 * @type {readonly string[]}
 */
const CODIGOS_QUE_ENTREGAM_A_BASE = Object.freeze([CODIGOS.NAO_ENCONTRADO, CODIGOS.SEM_PERMISSAO])

/**
 * Le a falha do link magico que o Supabase devolve no **fragmento** do endereco
 * (`#error=...`), e nao na query — por isso `useSearchParams` nao a enxerga.
 *
 * A frase e nossa, nunca a `error_description` da URL: aquele texto e escrito
 * por quem monta o link e ecoa-lo na tela seria deixar um estranho redigir a
 * mensagem que o cliente le.
 *
 * @param {string} fragmento normalmente `window.location.hash`
 * @returns {string|null} o que aconteceu, em pt-BR, ou `null` se nao ha falha
 */
export function falhaDoLinkNoFragmento(fragmento) {
  if (typeof fragmento !== 'string' || !fragmento.includes('error')) return null

  const parametros = new URLSearchParams(fragmento.replace(/^#/, ''))
  if (!parametros.get('error')) return null

  const codigo = String(parametros.get('error_code') ?? '')
  if (codigo.includes('expired')) {
    return 'Este link expirou ou já tinha sido usado. Peça outro abaixo: leva alguns segundos.'
  }
  return 'Não foi possível entrar com esse link. Peça outro abaixo.'
}

/** @returns {string} o fragmento do endereco atual, ou vazio fora do navegador */
function fragmentoAtual() {
  if (typeof window === 'undefined') return ''
  return window.location.hash ?? ''
}

/**
 * @typedef {object} SituacaoDaEntrada
 * @property {string} email o que esta digitado
 * @property {(valor: string) => void} definirEmail
 * @property {string} estado um valor de `ESTADOS`
 * @property {{ codigo: string, mensagem: string }|null} erro erro ja em pt-BR
 * @property {string|null} avisoDoLink falha do link que trouxe a pessoa ate aqui
 * @property {boolean} enviando
 * @property {boolean} enviado
 * @property {() => Promise<void>} enviarLink
 * @property {() => void} corrigirEndereco volta ao formulario com o e-mail intacto
 */

/**
 * Pedido do link de acesso, com os quatro estados da tela.
 *
 * @returns {SituacaoDaEntrada}
 */
export default function useEntrar() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState(ESTADOS.REPOUSO)
  const [erro, setErro] = useState(null)
  const [avisoDoLink, setAvisoDoLink] = useState(() => falhaDoLinkNoFragmento(fragmentoAtual()))
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const definirEmail = useCallback((valor) => {
    setEmail(valor)
    // Erro que sobrevive a correcao acusa o que a pessoa acabou de arrumar.
    setErro(null)
    setEstado((atual) => (atual === ESTADOS.ERRO ? ESTADOS.REPOUSO : atual))
  }, [])

  const enviarLink = useCallback(async () => {
    const limpo = email.trim()
    if (!ehEmail(limpo)) {
      setErro(erroDeServico(CODIGOS.ENTRADA_INVALIDA, MENSAGEM_DE_EMAIL_INVALIDO))
      setEstado(ESTADOS.ERRO)
      return
    }

    setErro(null)
    setAvisoDoLink(null)
    setEstado(ESTADOS.ENVIANDO)

    // A camada de servicos promete envelope em vez de excecao, mas a tela nao
    // pode depender disso: um throw aqui deixaria o botao girando para sempre.
    try {
      const envelope = await entrarComEmail(limpo)
      if (!montado.current) return

      if (envelope?.error && !CODIGOS_QUE_ENTREGAM_A_BASE.includes(envelope.error.codigo)) {
        setErro(envelope.error)
        setEstado(ESTADOS.ERRO)
        return
      }
      setEstado(ESTADOS.ENVIADO)
    } catch {
      if (!montado.current) return
      setErro(erroDeServico(CODIGOS.FALHA_INESPERADA))
      setEstado(ESTADOS.ERRO)
    }
  }, [email])

  const corrigirEndereco = useCallback(() => {
    setEstado(ESTADOS.REPOUSO)
    setErro(null)
  }, [])

  return {
    email,
    definirEmail,
    estado,
    erro,
    avisoDoLink,
    enviando: estado === ESTADOS.ENVIANDO,
    enviado: estado === ESTADOS.ENVIADO,
    enviarLink,
    corrigirEndereco,
  }
}
