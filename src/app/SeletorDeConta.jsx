import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ROTAS, rotaDaConta } from '../constants/rotas.js'
import './SeletorDeConta.css'

/**
 * A conta em foco, e a porta para trocar de conta.
 *
 * É um botão com menu, e não um `<select>` nu, por dois motivos: o `<select>`
 * não cabe o par nome + arroba que identifica a conta na cabeça do cliente, e
 * ele não mostra que uma conta parou de coletar. Como cada item é um link real,
 * "abrir em nova aba" continua funcionando e a URL segue sendo a fonte de
 * verdade de qual conta está aberta.
 */

/**
 * O que dizer de uma conta que não está coletando. Vocabulário do produto, não
 * regra de cliente: o status vem do banco (`ig_contas.status`).
 * @type {Readonly<Record<string, string>>}
 */
const AVISO_DE_STATUS = Object.freeze({
  token_expirado: 'Precisa reconectar',
  pausada: 'Coleta pausada',
  desconectada: 'Desconectada',
})

/**
 * @param {object} props
 * @param {import('../lib/contas.js').Conta[]} [props.contas] contas conectadas do tenant
 * @param {import('../lib/contas.js').Conta|null} [props.selecionada] conta em foco
 * @returns {JSX.Element|null} `null` quando não há conta conectada
 */
export default function SeletorDeConta({ contas = [], selecionada = null }) {
  const [aberto, setAberto] = useState(false)
  const [focoAoAbrir, setFocoAoAbrir] = useState(0)
  const raizRef = useRef(null)
  const gatilhoRef = useRef(null)
  const menuRef = useRef(null)
  const idDoMenu = useId()
  const { pathname } = useLocation()

  const itensDoMenu = useCallback(() => {
    if (!menuRef.current) return []
    return Array.from(menuRef.current.querySelectorAll('[data-item-do-menu]'))
  }, [])

  const focarItem = useCallback(
    (indice) => {
      const itens = itensDoMenu()
      if (itens.length === 0) return
      itens[(indice + itens.length) % itens.length].focus()
    },
    [itensDoMenu],
  )

  const fechar = useCallback((devolverFoco = false) => {
    setAberto(false)
    // Sem devolver o foco, quem navega por teclado é jogado para o começo da
    // página a cada vez que desiste do menu.
    if (devolverFoco) gatilhoRef.current?.focus()
  }, [])

  useEffect(() => {
    if (aberto) focarItem(focoAoAbrir)
  }, [aberto, focoAoAbrir, focarItem])

  // Escolher uma conta troca de rota; o menu não pode sobreviver à troca.
  useEffect(() => {
    setAberto(false)
  }, [pathname])

  useEffect(() => {
    if (!aberto) return undefined

    /** @param {PointerEvent} evento */
    function aoApontarFora(evento) {
      if (raizRef.current?.contains(evento.target)) return
      setAberto(false)
    }

    document.addEventListener('pointerdown', aoApontarFora)
    return () => document.removeEventListener('pointerdown', aoApontarFora)
  }, [aberto])

  /** @param {import('react').KeyboardEvent} evento */
  function aoTeclarNoGatilho(evento) {
    if (aberto) return
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    setFocoAoAbrir(evento.key === 'ArrowDown' ? 0 : -1)
    setAberto(true)
  }

  /** @param {import('react').KeyboardEvent} evento */
  function aoTeclar(evento) {
    if (evento.key === 'Escape' && aberto) {
      evento.preventDefault()
      fechar(true)
      return
    }
    if (!aberto) return

    const itens = itensDoMenu()
    const atual = itens.indexOf(document.activeElement)

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      focarItem(atual + 1)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      focarItem(atual - 1)
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      focarItem(0)
    } else if (evento.key === 'End') {
      evento.preventDefault()
      focarItem(itens.length - 1)
    } else if (evento.key === 'Tab') {
      // Sair do menu pelo Tab fecha, mas o foco segue o caminho natural.
      fechar(false)
    }
  }

  if (contas.length === 0) return null

  return (
    <div className="ka-seletor" ref={raizRef} onKeyDown={aoTeclar}>
      <button
        type="button"
        id={`${idDoMenu}-gatilho`}
        ref={gatilhoRef}
        className="ka-seletor__gatilho"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        onClick={() => {
          setFocoAoAbrir(0)
          setAberto((atual) => !atual)
        }}
        onKeyDown={aoTeclarNoGatilho}
      >
        <span className="ka-seletor__avatar" aria-hidden="true" />
        <span className="ka-seletor__identificacao">
          <span className="ka-seletor__nome">
            {selecionada ? selecionada.nome : 'Escolher conta'}
          </span>
          {selecionada ? (
            <span className="ka-seletor__arroba">@{selecionada.username}</span>
          ) : null}
        </span>
        <span className="ka-seletor__seta" aria-hidden="true" />
        <span className="apenas-leitor">Trocar de conta</span>
      </button>

      {aberto ? (
        <div
          id={idDoMenu}
          ref={menuRef}
          className="ka-seletor__menu"
          role="menu"
          aria-label="Contas conectadas"
        >
          <p className="ka-seletor__rotulo" aria-hidden="true">
            Contas conectadas
          </p>

          {contas.map((conta) => {
            const ehSelecionada = selecionada?.id === conta.id
            const aviso = AVISO_DE_STATUS[conta.status]
            return (
              <Link
                key={conta.id}
                to={rotaDaConta(conta.id)}
                className="ka-seletor__item"
                role="menuitemradio"
                aria-checked={ehSelecionada}
                data-item-do-menu=""
                data-selecionada={ehSelecionada ? 'sim' : undefined}
                onClick={() => fechar(true)}
              >
                <span className="ka-seletor__avatar" aria-hidden="true" />
                <span className="ka-seletor__identificacao">
                  <span className="ka-seletor__nome">{conta.nome}</span>
                  <span className="ka-seletor__arroba">@{conta.username}</span>
                </span>
                {/* Conta parada some do diagnóstico sem avisar se a troca de
                    conta não disser que ela parou (ADR-004). */}
                {aviso ? (
                  <span className="ka-seletor__status" data-status={conta.status}>
                    {aviso}
                  </span>
                ) : null}
              </Link>
            )
          })}

          <Link
            to={ROTAS.conectar}
            className="ka-seletor__item"
            data-acao="conectar"
            role="menuitem"
            data-item-do-menu=""
            onClick={() => fechar(true)}
          >
            Conectar outra conta
          </Link>
        </div>
      ) : null}
    </div>
  )
}
