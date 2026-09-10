import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { listarContasConectadas, listarTenantsDoUsuario } from '../lib/index.js'
import { aplicarIdentidadeVisual, limparIdentidadeVisual } from '../tema/identidadeVisual.js'
import { ROTAS, contaIdDaRota } from '../constants/rotas.js'
import { useSessao } from './SessaoContexto.jsx'

/**
 * O espaço de trabalho da sessão: o tenant em foco, os outros a que a pessoa
 * pertence, as contas conectadas e a conta selecionada — e a identidade visual
 * que o tenant escolheu.
 *
 * Multi-tenant desde a linha 1 (CLAUDE.md): nenhuma marca, cor ou nome de
 * cliente aparece em código. A identidade chega do registro do tenant e vira
 * custom property por `src/tema/identidadeVisual.js`, que é o único módulo
 * autorizado a escrever cor de marca.
 *
 * Quem pertence a mais de um tenant escolhe qual está aberto, e essa escolha
 * mora aqui — não numa tela. Antes o contexto pegava o primeiro da lista e o
 * resto sumia da interface sem uma linha de aviso, que é exatamente a lacuna
 * silenciosa que o princípio nº 1 proíbe.
 */

/** @typedef {import('../lib/tenants.js').Tenant} Tenant */
/** @typedef {import('../lib/contas.js').Conta} Conta */

/**
 * @typedef {object} ValorDoTenant
 * @property {Tenant|null} tenant espaço de trabalho aberto
 * @property {Tenant[]} tenants todos os espaços a que o usuário pertence
 * @property {(tenantId: string) => void} selecionarTenant abre outro espaço
 * @property {Conta[]} contas
 * @property {Conta|null} contaSelecionada conta da URL; sem URL de conta, a primeira
 * @property {boolean} carregando
 * @property {{ codigo: string, mensagem: string }|null} erro
 * @property {() => void} recarregar
 */

const TenantContexto = createContext(null)

/**
 * Onde a escolha do espaço fica guardada.
 *
 * Em `localStorage` e não na URL: o caminho carrega a conta (contratos.md,
 * seção 6), e pendurar o espaço nele mudaria o contrato de rotas inteiro por
 * causa de um seletor. Em `localStorage` e não em memória porque recarregar a
 * página é a operação mais comum do produto — e voltar para o primeiro espaço a
 * cada F5 seria o mesmo defeito de novo, só que intermitente.
 *
 * O que fica guardado é um id opaco, sempre conferido contra a lista que o
 * banco devolveu: id de outro usuário, ou de um vínculo revogado, não abre
 * nada — a RLS decide, este valor só escolhe entre o que ela já liberou.
 */
const CHAVE_DO_ESPACO = 'kora.espaco-de-trabalho'

/** @returns {string|null} */
function lerEspacoGuardado() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(CHAVE_DO_ESPACO)
  } catch {
    // Navegador com armazenamento bloqueado lança no acesso. A escolha vira
    // só-desta-sessão; nada mais do produto depende dela.
    return null
  }
}

/** @param {string} tenantId */
function guardarEspaco(tenantId) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_DO_ESPACO, tenantId)
  } catch {
    // Ver acima: não guardar é degradação, não falha.
  }
}

const ESTADO_INICIAL = Object.freeze({ carregando: true, tenants: [], erro: null })

const ESTADO_SEM_SESSAO = Object.freeze({ carregando: false, tenants: [], erro: null })

/** Contas ainda não pedidas: nenhuma leitura em voo, nenhum tenant respondido. */
const CONTAS_INICIAIS = Object.freeze({ carregando: false, tenantId: null, lista: [], erro: null })

/** @type {Conta[]} */
const SEM_CONTAS = Object.freeze([])

/**
 * Qual espaço abrir, dada a lista que o banco devolveu e a preferência guardada.
 *
 * Função pura de propósito: é a regra que decidia errado antes (pegava sempre o
 * primeiro), e regra que decide errado em silêncio precisa de teste, não de
 * inspeção. A preferência nunca manda sozinha — id fora da lista cai no
 * primeiro, porque a lista é o que a RLS liberou e a preferência é só memória
 * do navegador.
 *
 * @param {Tenant[]} tenants
 * @param {string|null} [idPreferido]
 * @returns {Tenant|null} `null` quando não há espaço nenhum
 */
export function escolherTenant(tenants, idPreferido = null) {
  if (!Array.isArray(tenants) || tenants.length === 0) return null
  if (!idPreferido) return tenants[0]
  return tenants.find((tenant) => tenant.id === idPreferido) ?? tenants[0]
}

/**
 * Provedor do espaço de trabalho.
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export function TenantProvedor({ children }) {
  const { sessao, carregando: carregandoSessao } = useSessao()
  const [espaco, setEspaco] = useState(ESTADO_INICIAL)
  const [contas, setContas] = useState(CONTAS_INICIAIS)
  const [idPreferido, setIdPreferido] = useState(lerEspacoGuardado)
  const [tentativa, setTentativa] = useState(0)
  const { pathname } = useLocation()
  const navegar = useNavigate()

  const usuarioId = sessao?.usuarioId ?? null

  useEffect(() => {
    // Sem sessão não há o que carregar, e insistir só produziria SEM_SESSAO na
    // tela pública de quem nunca entrou.
    if (carregandoSessao) return undefined
    if (!usuarioId) {
      setEspaco(ESTADO_SEM_SESSAO)
      setContas(CONTAS_INICIAIS)
      return undefined
    }

    let montado = true
    setEspaco((atual) => ({ ...atual, carregando: true }))

    listarTenantsDoUsuario().then((envelope) => {
      if (!montado) return
      if (envelope.error) {
        setEspaco({ carregando: false, tenants: [], erro: envelope.error })
        return
      }
      setEspaco({ carregando: false, tenants: envelope.data ?? [], erro: null })
    })

    return () => {
      montado = false
    }
  }, [usuarioId, carregandoSessao, tentativa])

  const tenant = useMemo(
    () => escolherTenant(espaco.tenants, idPreferido),
    [espaco.tenants, idPreferido],
  )
  const tenantId = tenant?.id ?? null

  // As contas são de um espaço só, então elas são recarregadas na troca. É a
  // segunda leitura, e não uma filtragem da primeira: pedir tudo de todos os
  // espaços de uma vez traria para o navegador contas de clientes que a tela
  // não vai mostrar.
  useEffect(() => {
    if (!tenantId) {
      setContas(CONTAS_INICIAIS)
      return undefined
    }

    let montado = true
    setContas({ carregando: true, tenantId, lista: SEM_CONTAS, erro: null })

    listarContasConectadas(tenantId).then((envelope) => {
      if (!montado) return
      if (envelope.error) {
        setContas({ carregando: false, tenantId, lista: SEM_CONTAS, erro: envelope.error })
        return
      }
      setContas({ carregando: false, tenantId, lista: envelope.data ?? SEM_CONTAS, erro: null })
    })

    return () => {
      montado = false
    }
  }, [tenantId, tentativa])

  useEffect(() => {
    if (!tenant) {
      // Logout e troca de espaço passam por aqui: cor do cliente anterior que
      // sobrevive à troca é marca de um tenant pintando a tela de outro.
      limparIdentidadeVisual()
      return undefined
    }
    return aplicarIdentidadeVisual(tenant.identidade)
  }, [tenant])

  // As contas em mãos são do espaço aberto, ou não são de ninguém. Entre a
  // resposta dos tenants e a das contas existe um render em que a lista velha
  // ainda está no estado; devolvê-la ali mostraria a conta de um cliente sob o
  // nome de outro por uma fração de segundo.
  const contasDoEspaco = contas.tenantId === tenantId ? contas.lista : SEM_CONTAS
  const carregandoContas = tenantId !== null && (contas.carregando || contas.tenantId !== tenantId)

  const contaSelecionada = useMemo(() => {
    const idDaRota = contaIdDaRota(pathname)
    if (idDaRota) {
      // Conta pedida na URL e ausente da lista não vira "a primeira": o
      // cabeçalho anunciaria uma conta enquanto a tela mostra o erro de outra.
      return contasDoEspaco.find((conta) => conta.id === idDaRota) ?? null
    }
    return contasDoEspaco[0] ?? null
  }, [pathname, contasDoEspaco])

  const recarregar = useCallback(() => setTentativa((atual) => atual + 1), [])

  const selecionarTenant = useCallback(
    /** @param {string} novoId */
    (novoId) => {
      if (typeof novoId !== 'string' || novoId === '' || novoId === tenantId) return
      setIdPreferido(novoId)
      guardarEspaco(novoId)
      // A URL nomeia uma conta, e conta pertence a um espaço só. Ficar em
      // `/contas/<id>` do espaço anterior deixaria a tela sem conta em foco
      // logo depois de uma troca que funcionou.
      navegar(ROTAS.contas)
    },
    [tenantId, navegar],
  )

  /** @type {ValorDoTenant} */
  const valor = useMemo(
    () => ({
      tenant,
      tenants: espaco.tenants,
      selecionarTenant,
      contas: contasDoEspaco,
      contaSelecionada,
      carregando: espaco.carregando || carregandoContas,
      erro: espaco.erro ?? contas.erro,
      recarregar,
    }),
    [
      tenant,
      espaco.tenants,
      espaco.carregando,
      espaco.erro,
      selecionarTenant,
      contasDoEspaco,
      carregandoContas,
      contas.erro,
      contaSelecionada,
      recarregar,
    ],
  )

  return <TenantContexto.Provider value={valor}>{children}</TenantContexto.Provider>
}

/**
 * O espaço de trabalho atual.
 * @returns {ValorDoTenant}
 */
export function useTenant() {
  const valor = useContext(TenantContexto)
  if (!valor) throw new Error('useTenant precisa estar dentro de <TenantProvedor>.')
  return valor
}

export default TenantContexto
