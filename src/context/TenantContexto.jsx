import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { listarContasConectadas, listarTenantsDoUsuario } from '../lib/index.js'
import { aplicarIdentidadeVisual, limparIdentidadeVisual } from '../tema/identidadeVisual.js'
import { contaIdDaRota } from '../constants/rotas.js'
import { useSessao } from './SessaoContexto.jsx'

/**
 * O espaço de trabalho da sessão: o tenant, as contas conectadas e a conta em
 * foco — e a identidade visual que o tenant escolheu.
 *
 * Multi-tenant desde a linha 1 (CLAUDE.md): nenhuma marca, cor ou nome de
 * cliente aparece em código. A identidade chega do registro do tenant e vira
 * custom property por `src/tema/identidadeVisual.js`, que é o único módulo
 * autorizado a escrever cor de marca.
 */

/** @typedef {import('../lib/tenants.js').Tenant} Tenant */
/** @typedef {import('../lib/contas.js').Conta} Conta */

/**
 * @typedef {object} ValorDoTenant
 * @property {Tenant|null} tenant
 * @property {Conta[]} contas
 * @property {Conta|null} contaSelecionada conta da URL; sem URL de conta, a primeira
 * @property {boolean} carregando
 * @property {{ codigo: string, mensagem: string }|null} erro
 * @property {() => void} recarregar
 */

const TenantContexto = createContext(null)

const ESTADO_INICIAL = Object.freeze({ carregando: true, tenant: null, contas: [], erro: null })

const ESTADO_SEM_SESSAO = Object.freeze({
  carregando: false,
  tenant: null,
  contas: [],
  erro: null,
})

/**
 * Busca o tenant do usuário e as contas dele, em envelope.
 *
 * Fica fora do componente de propósito: é função assíncrona comum, sem React,
 * e o `useEffect` só decide o que fazer com o resultado.
 *
 * @returns {Promise<{ tenant: Tenant|null, contas: Conta[], erro: object|null }>}
 */
async function carregarEspacoDeTrabalho() {
  const tenants = await listarTenantsDoUsuario()
  if (tenants.error) return { tenant: null, contas: [], erro: tenants.error }

  // Plano único, um espaço de trabalho por assinatura (memory/identity.md). Se
  // um dia a mesma pessoa pertencer a dois tenants, isto vira um seletor — e o
  // lugar de decidir isso é aqui, não espalhado nas telas.
  const tenant = tenants.data?.[0] ?? null
  if (!tenant) return { tenant: null, contas: [], erro: null }

  const contas = await listarContasConectadas(tenant.id)
  if (contas.error) return { tenant, contas: [], erro: contas.error }
  return { tenant, contas: contas.data ?? [], erro: null }
}

/**
 * Provedor do espaço de trabalho.
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export function TenantProvedor({ children }) {
  const { sessao, carregando: carregandoSessao } = useSessao()
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const [tentativa, setTentativa] = useState(0)
  const { pathname } = useLocation()

  const usuarioId = sessao?.usuarioId ?? null

  useEffect(() => {
    // Sem sessão não há o que carregar, e insistir só produziria SEM_SESSAO na
    // tela pública de quem nunca entrou.
    if (carregandoSessao) return undefined
    if (!usuarioId) {
      setEstado(ESTADO_SEM_SESSAO)
      return undefined
    }

    let montado = true
    setEstado((atual) => ({ ...atual, carregando: true }))

    carregarEspacoDeTrabalho().then((resultado) => {
      if (!montado) return
      setEstado({ carregando: false, ...resultado })
    })

    return () => {
      montado = false
    }
  }, [usuarioId, carregandoSessao, tentativa])

  useEffect(() => {
    if (!estado.tenant) {
      // Logout e troca de espaço passam por aqui: cor do cliente anterior que
      // sobrevive à troca é marca de um tenant pintando a tela de outro.
      limparIdentidadeVisual()
      return undefined
    }
    return aplicarIdentidadeVisual(estado.tenant.identidade)
  }, [estado.tenant])

  const contaSelecionada = useMemo(() => {
    const idDaRota = contaIdDaRota(pathname)
    if (idDaRota) {
      // Conta pedida na URL e ausente da lista não vira "a primeira": o
      // cabeçalho anunciaria uma conta enquanto a tela mostra o erro de outra.
      return estado.contas.find((conta) => conta.id === idDaRota) ?? null
    }
    return estado.contas[0] ?? null
  }, [pathname, estado.contas])

  const recarregar = useCallback(() => setTentativa((atual) => atual + 1), [])

  /** @type {ValorDoTenant} */
  const valor = useMemo(
    () => ({
      tenant: estado.tenant,
      contas: estado.contas,
      contaSelecionada,
      carregando: estado.carregando,
      erro: estado.erro,
      recarregar,
    }),
    [estado, contaSelecionada, recarregar],
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
