import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Botão que abre um menu: o comportamento, sem nenhuma marcação.
 *
 * O cabeçalho tem dois desses — a conta em foco e o espaço de trabalho — e o
 * que os torna utilizáveis não é o desenho, é o resto: seta abre com o primeiro
 * item já focado, Escape fecha devolvendo o foco ao gatilho, clique fora fecha,
 * Tab sai sem prender ninguém. Escrito duas vezes, isso vira duas versões que
 * divergem no primeiro conserto — e a que diverge é sempre a que ninguém abriu
 * com teclado.
 *
 * Ele não desenha e não conhece rota nem regra: devolve estado e conjuntos de
 * props, e quem chama decide o que é item de menu.
 */

/**
 * Como o menu reconhece um item navegável. Fica em atributo de dado, e não em
 * classe, porque classe é do CSS — e um item continuaria sendo item depois de
 * qualquer troca de estilo.
 */
const ATRIBUTO_DE_ITEM = 'data-item-do-menu'

/** Props que todo item do menu precisa carregar para o teclado enxergá-lo. */
export const PROPS_DO_ITEM = Object.freeze({ [ATRIBUTO_DE_ITEM]: '' })

/**
 * @typedef {object} MenuSuspenso
 * @property {boolean} aberto
 * @property {(devolverFoco?: boolean) => void} fechar
 * @property {string} idDoMenu
 * @property {object} propsDaRaiz elemento que embrulha gatilho e menu
 * @property {object} propsDoGatilho o `<button>`
 * @property {object} propsDoMenu o container com `role="menu"`
 */

/**
 * @returns {MenuSuspenso}
 */
export default function useMenuSuspenso() {
  const [aberto, setAberto] = useState(false)
  const [focoAoAbrir, setFocoAoAbrir] = useState(0)
  const raizRef = useRef(null)
  const gatilhoRef = useRef(null)
  const menuRef = useRef(null)
  const idDoMenu = useId()
  const { pathname } = useLocation()

  const itensDoMenu = useCallback(() => {
    if (!menuRef.current) return []
    return Array.from(menuRef.current.querySelectorAll(`[${ATRIBUTO_DE_ITEM}]`))
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

  // Escolher no menu costuma trocar de rota; o menu não pode sobreviver à troca.
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

  return {
    aberto,
    fechar,
    idDoMenu,
    propsDaRaiz: { ref: raizRef, onKeyDown: aoTeclar },
    propsDoGatilho: {
      type: 'button',
      id: `${idDoMenu}-gatilho`,
      ref: gatilhoRef,
      'aria-haspopup': 'menu',
      'aria-expanded': aberto,
      'aria-controls': aberto ? idDoMenu : undefined,
      onClick: () => {
        setFocoAoAbrir(0)
        setAberto((atual) => !atual)
      },
      onKeyDown: aoTeclarNoGatilho,
    },
    propsDoMenu: { id: idDoMenu, ref: menuRef, role: 'menu' },
  }
}
