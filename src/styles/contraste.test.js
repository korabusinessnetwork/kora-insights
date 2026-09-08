import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { contraste, lerHex, lerPrimitivas, lerSemanticas, luminancia } from './contraste.js'

// Le o CSS de verdade: uma segunda copia dos hex aqui sairia de sincronia na
// primeira troca de paleta, que e exatamente o que aconteceu com a tabela do
// TOKENS.md escrita a mao.
const TOKENS_CSS = join(dirname(fileURLToPath(import.meta.url)), 'tokens.css')
const CSS = readFileSync(TOKENS_CSS, 'utf8')
const PRIMITIVAS = lerPrimitivas(CSS)

/** @param {string} nome @returns {string} hex */
function token(nome) {
  const valor = PRIMITIVAS[nome]
  if (!valor) throw new Error(`token --${nome} nao existe em tokens.css`)
  return valor
}

/** Minimos da WCAG 2.1 AA que o produto adotou (docs/02_DESIGN_SYSTEM/TOKENS.md). */
const TEXTO = 4.5
const GRAFICO = 3

/**
 * Superficies do tema escuro. Toda tinta precisa passar em TODAS: o mesmo token
 * semantico pinta texto dentro de cartao, de cartao elevado e direto no fundo,
 * e quem escreve componente nao devia ter de saber em qual dos tres esta.
 */
const SUPERFICIES_ESCURAS = {
  fundo: 'kora-carvao-900',
  barra: 'kora-carvao-800',
  cartao: 'kora-carvao-700',
  'cartao elevado': 'kora-carvao-600',
}

const TINTAS_ESCURAS = {
  tinta: 'kora-osso-200',
  'tinta suave': 'kora-osso-500',
  'tinta fraca': 'kora-osso-600',
  acento: 'kora-ocre-300',
  positivo: 'kora-sage-300',
  critico: 'kora-tijolo-300',
}

describe('aritmetica de contraste', () => {
  it('branco sobre preto e 21:1, e preto sobre preto e 1:1', () => {
    expect(contraste('#ffffff', '#000000')).toBe(21)
    expect(contraste('#000000', '#000000')).toBe(1)
  })

  it('aceita hex de tres digitos', () => {
    expect(lerHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(luminancia(lerHex('#fff'))).toBeCloseTo(1, 5)
  })
})

describe('tema escuro: toda tinta passa em toda superficie', () => {
  for (const [nomeDaTinta, tinta] of Object.entries(TINTAS_ESCURAS)) {
    for (const [nomeDaSuperficie, superficie] of Object.entries(SUPERFICIES_ESCURAS)) {
      it(`${nomeDaTinta} sobre ${nomeDaSuperficie}`, () => {
        expect(contraste(token(tinta), token(superficie))).toBeGreaterThanOrEqual(TEXTO)
      })
    }
  }
})

describe('elemento grafico e contorno de controle passam em 3:1', () => {
  // A borda do campo de e-mail e as barras do grafico nao sao decoracao: uma e
  // a unica pista de onde digitar na porta do produto, a outra e a prova visual
  // da frase do veredito.
  for (const [nomeDaSuperficie, superficie] of Object.entries(SUPERFICIES_ESCURAS)) {
    it(`contorno sobre ${nomeDaSuperficie}`, () => {
      expect(contraste(token('kora-carvao-300'), token(superficie))).toBeGreaterThanOrEqual(GRAFICO)
    })
  }
})

describe('superficie de papel', () => {
  const papel = token('kora-osso-200')

  it('a tinta principal passa com folga', () => {
    expect(contraste(token('kora-osso-800'), papel)).toBeGreaterThanOrEqual(TEXTO)
  })

  it('tinta suave e tinta fraca passam, e nesta ordem de forca', () => {
    const suave = contraste(token('kora-osso-700'), papel)
    const fraca = contraste(token('kora-osso-750'), papel)
    expect(fraca).toBeGreaterThanOrEqual(TEXTO)
    // Tinta "fraca" mais forte que a suave inverteria a hierarquia de leitura.
    expect(suave).toBeGreaterThan(fraca)
  })

  it('acento, positivo e critico passam sobre papel', () => {
    for (const nome of ['kora-ocre-700', 'kora-sage-700', 'kora-tijolo-700']) {
      expect(contraste(token(nome), papel)).toBeGreaterThanOrEqual(TEXTO)
    }
  })
})

/*
 * O grafico e cobrado a partir do CSS, e nao de uma lista escrita aqui.
 *
 * A lista a mao ja falhou uma vez: `--cor-grafico-eixo` nunca entrou nela, e o
 * eixo ficou a 1,38:1 no escuro e 1,49:1 no papel — presente no DOM, invisivel
 * na tela, com a suite verde. Lendo as semanticas do proprio `tokens.css`, um
 * token de grafico novo entra coberto no dia em que nasce, sem depender de
 * alguem lembrar de vir ate aqui.
 */
describe('todo elemento de grafico e visivel na superficie onde e desenhado', () => {
  const SUPERFICIES = {
    escuro: { cartao: 'kora-carvao-700', 'cartao elevado': 'kora-carvao-600' },
    papel: { folha: 'kora-osso-200', 'folha elevada': 'kora-osso-100' },
  }

  for (const tema of /** @type {const} */ (['escuro', 'papel'])) {
    const semanticas = lerSemanticas(CSS, tema)
    const doGrafico = Object.keys(semanticas).filter((nome) => nome.startsWith('cor-grafico-'))

    it(`o tema ${tema} declara os elementos de grafico`, () => {
      // Zero token encontrado passaria o laco abaixo por vacuidade, que e como
      // um teste deste formato deixa de cobrar sem nunca ficar vermelho.
      expect(doGrafico.length).toBeGreaterThanOrEqual(3)
    })

    for (const nome of doGrafico) {
      for (const [ondeNome, onde] of Object.entries(SUPERFICIES[tema])) {
        it(`${tema}: --${nome} sobre ${ondeNome}`, () => {
          expect(contraste(token(semanticas[nome]), token(onde))).toBeGreaterThanOrEqual(GRAFICO)
        })
      }
    }
  }
})
