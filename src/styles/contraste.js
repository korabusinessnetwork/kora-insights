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

/**
 * Resolve as semanticas `--cor-*` de um bloco de tema para o nome da primitiva
 * que as pinta por padrao.
 *
 * Existe porque a tabela semantica → primitiva vivia escrita a mao no teste, e
 * `--cor-grafico-eixo` simplesmente nao estava nela: o eixo do grafico ficou a
 * 1,38:1 no escuro e 1,49:1 no papel, no DOM e invisivel na tela, com a suite
 * inteira verde. Tabela escrita a mao so cobra o que alguem lembrou de listar.
 *
 * Nao e um motor de CSS: le `var(--tenant-x, var(--kora-y))` e `var(--kora-y)`,
 * que sao as duas unicas formas que `tokens.css` usa. Valor literal (o preto do
 * traco no papel, por exemplo) fica de fora, porque nao ha primitiva a nomear.
 *
 * @param {string} css conteudo de tokens.css
 * @param {'escuro'|'papel'} tema qual bloco ler
 * @returns {Record<string, string>} nome da semantica sem `--` para nome da primitiva
 */
export function lerSemanticas(css, tema) {
  const abertura = tema === 'escuro' ? "[data-superficie='carvao']" : "[data-superficie='papel']"
  const inicio = css.indexOf(abertura)
  if (inicio === -1) throw new Error(`bloco de tema ${tema} nao encontrado em tokens.css`)
  const bloco = css.slice(inicio, css.indexOf('\n}', inicio))

  /** @type {Record<string, string>} */
  const semanticas = {}
  for (const [, nome, valor] of bloco.matchAll(/--(cor-[a-z0-9-]+):\s*([^;]+);/gi)) {
    // A ultima mencao e o fallback: em `var(--tenant-x, var(--kora-y))` quem
    // pinta sem tenant configurado e `--kora-y`.
    const primitivas = [...valor.matchAll(/--(kora-[a-z0-9-]+)/gi)].map((m) => m[1])
    if (primitivas.length > 0) semanticas[nome] = primitivas[primitivas.length - 1]
  }
  return semanticas
}
