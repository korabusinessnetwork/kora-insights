/**
 * Contraste WCAG sobre os tokens declarados em `tokens.css`.
 *
 * Existe porque a tabela de contraste do `docs/02_DESIGN_SYSTEM/TOKENS.md` foi
 * escrita a mao e nao fechava com a aritmetica: o token declarado como piso de
 * tinta media 4,27:1 e o documento afirmava 4,6:1. Numero de acessibilidade
 * conferido a olho envelhece na primeira troca de paleta.
 *
 * Aqui a paleta e lida do proprio CSS — nao ha uma segunda copia dos hex para
 * sair de sincronia — e `contraste.test.js` reprova a suite quando um par cai
 * abaixo do minimo.
 */

/** @typedef {{ r: number, g: number, b: number }} Cor */

/**
 * @param {string} hex `#rgb` ou `#rrggbb`
 * @returns {Cor}
 */
export function lerHex(hex) {
  const limpo = hex.trim().replace('#', '')
  const cheio =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo
  return {
    r: parseInt(cheio.slice(0, 2), 16),
    g: parseInt(cheio.slice(2, 4), 16),
    b: parseInt(cheio.slice(4, 6), 16),
  }
}

/**
 * Luminancia relativa (WCAG 2.1, 1.4.3).
 * @param {Cor} cor
 * @returns {number}
 */
export function luminancia({ r, g, b }) {
  const canal = (valor) => {
    const s = valor / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/**
 * Razao de contraste entre duas cores hex, arredondada a duas casas.
 * @param {string} frente
 * @param {string} fundo
 * @returns {number}
 */
export function contraste(frente, fundo) {
  const a = luminancia(lerHex(frente))
  const b = luminancia(lerHex(fundo))
  const [claro, escuro] = a > b ? [a, b] : [b, a]
  return Math.round(((claro + 0.05) / (escuro + 0.05)) * 100) / 100
}

/**
 * Extrai as primitivas `--kora-*` de uma folha de tokens.
 *
 * Le so as primitivas de proposito: as semanticas sao `var(--tenant-*, ...)` e
 * resolve-las exigiria um motor de CSS. O contrato do design system e que
 * componente nunca usa primitiva direto, entao mapear semantica → primitiva e
 * uma tabela curta e explicita (ver `contraste.test.js`).
 *
 * @param {string} css conteudo de tokens.css
 * @returns {Record<string, string>} nome do token sem `--` para hex
 */
export function lerPrimitivas(css) {
  /** @type {Record<string, string>} */
  const primitivas = {}
  for (const [, nome, valor] of css.matchAll(/--(kora-[a-z0-9-]+):\s*(#[0-9a-f]{3,8});/gi)) {
    primitivas[nome] = valor
  }
  return primitivas
}
