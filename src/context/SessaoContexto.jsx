import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { aoMudarSessao, sair, sessaoAtual } from '../lib/index.js'

/**
 * A sessão de quem usa o Kora Insights, disponível para o app inteiro.
 *
 * Não confunda com a autorização da Meta: aqui é o login do produto. O token do
 * Instagram nunca passa por este contexto — ele vive no Vault e só a Edge
 * Function o lê (docs/11_SEGURANCA).
 *
 * Todo acesso ao backend continua passando por `src/lib`: o contexto guarda o
 * resultado, não fala com o Supabase (overview.md, camadas).
 */

/** @typedef {{ usuarioId: string, email: string|null, expiraEm: string|null }} Sessao */

/**
 * @typedef {object} ValorDaSessao
 * @property {Sessao|null} sessao
 * @property {boolean} carregando ainda não se sabe se há sessão
 * @property {boolean} autenticado
 * @property {{ codigo: string, mensagem: string }|null} erro
 * @property {() => Promise<import('../lib/envelope.js').Envelope>} encerrarSessao
 */

const SessaoContexto = createContext(null)

/** Ninguém decidiu nada ainda: nem sessão, nem ausência de sessão. */
const ESTADO_INICIAL = Object.freeze({ carregando: true, sessao: null, erro: null })

/**
 * Provedor da sessão. Lê a sessão atual uma vez e depois só reage ao que a
 * camada de serviços anunciar (login em outra aba, expiração, logout).
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export function SessaoProvedor({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL)

  useEffect(() => {
    let montado = true
    let assinaturaJaFalou = false

    /**
     * @param {import('../lib/envelope.js').Envelope} envelope
     * @param {boolean} [daAssinatura] veio de `aoMudarSessao`
     */
    function aplicar(envelope, daAssinatura = false) {
      if (!montado) return
      // A leitura inicial não desfaz um evento mais novo: quem sai da conta
      // logo depois de abrir a tela recebe o `null` da assinatura primeiro, e
      // a leitura pendente chegaria em seguida com a sessão velha, deixando a
      // pessoa "logada" de novo sem ter feito nada.
      if (daAssinatura) assinaturaJaFalou = true
      else if (assinaturaJaFalou) return

      if (envelope.error) {
        setEstado({ carregando: false, sessao: null, erro: envelope.error })
        return
      }
      setEstado({ carregando: false, sessao: envelope.data ?? null, erro: null })
    }

    // Assinar antes de ler: assinar depois abriria uma janela em que uma
    // mudança de sessão aconteceria sem ninguém escutando.
    const cancelarAssinatura = aoMudarSessao((envelope) => aplicar(envelope, true))
    sessaoAtual().then((envelope) => aplicar(envelope))

    return () => {
      montado = false
      cancelarAssinatura()
    }
  }, [])

  const encerrarSessao = useCallback(async () => {
    const envelope = await sair()
    if (envelope.error) {
      setEstado((atual) => ({ ...atual, erro: envelope.error }))
      return envelope
    }
    // A assinatura também anuncia a saída, e escrever aqui é o que garante o
    // encerramento onde ela não fala — o modo de demonstração, por exemplo.
    setEstado({ carregando: false, sessao: null, erro: null })
    return envelope
  }, [])

  /** @type {ValorDaSessao} */
  const valor = useMemo(
    () => ({
      sessao: estado.sessao,
      carregando: estado.carregando,
      autenticado: Boolean(estado.sessao),
      erro: estado.erro,
      encerrarSessao,
    }),
    [estado, encerrarSessao],
  )

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>
}

/**
 * A sessão atual. Lança fora do provedor: uma tela protegida que lê `undefined`
 * e conclui "sem sessão" renderizaria a entrada para quem está logado.
 *
 * @returns {ValorDaSessao}
 */
export function useSessao() {
  const valor = useContext(SessaoContexto)
  if (!valor) throw new Error('useSessao precisa estar dentro de <SessaoProvedor>.')
  return valor
}

export default SessaoContexto
