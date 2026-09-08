import { describe, expect, it } from 'vitest'

import { partirComDestaques } from './destaques.js'

/** Junta os pedaços de volta: nenhum caminho pode perder ou inventar texto. */
const remontar = (pedacos) => pedacos.map((p) => p.texto).join('')

const FRASE = 'Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto.'

describe('partirComDestaques', () => {
  it('realça o trecho que a regra marcou, e só ele', () => {
    const pedacos = partirComDestaques(FRASE, ['40%'])

    expect(pedacos.filter((p) => p.realce).map((p) => p.texto)).toEqual(['40%'])
    expect(remontar(pedacos)).toBe(FRASE)
  })

  it('devolve a frase inteira sem realce quando a regra não marcou nada', () => {
    expect(partirComDestaques(FRASE, [])).toEqual([{ texto: FRASE, realce: false }])
    expect(partirComDestaques(FRASE, undefined)).toEqual([{ texto: FRASE, realce: false }])
  })

  it('realça todas as ocorrências do mesmo trecho', () => {
    const pedacos = partirComDestaques('caiu 40% e depois caiu 40% de novo', ['40%'])

    expect(pedacos.filter((p) => p.realce)).toHaveLength(2)
    expect(remontar(pedacos)).toBe('caiu 40% e depois caiu 40% de novo')
  })

  it('prefere o trecho mais longo, para não deixar o "%" órfão fora do realce', () => {
    const pedacos = partirComDestaques('caiu 40% no período', ['40', '40%'])

    expect(pedacos.filter((p) => p.realce).map((p) => p.texto)).toEqual(['40%'])
  })

  it('trata o destaque como texto literal, nunca como expressão regular', () => {
    // Num RegExp montado com o texto, '(' abriria grupo e '.' casaria qualquer
    // caractere: a frase inteira sairia errada, ou a expressão nem compilaria.
    const texto = 'a faixa (40 mil) continua valendo'
    const pedacos = partirComDestaques(texto, ['(40 mil)'])

    expect(pedacos.filter((p) => p.realce).map((p) => p.texto)).toEqual(['(40 mil)'])
    expect(remontar(pedacos)).toBe(texto)
  })

  it('ignora destaque que não aparece na frase, sem alterar o texto', () => {
    const pedacos = partirComDestaques(FRASE, ['99%'])

    expect(pedacos.every((p) => !p.realce)).toBe(true)
    expect(remontar(pedacos)).toBe(FRASE)
  })

  it('nunca perde nem inventa caractere', () => {
    for (const marcas of [['40%'], ['alcance'], ['Seu', 'junto.'], ['não caiu']]) {
      expect(remontar(partirComDestaques(FRASE, marcas))).toBe(FRASE)
    }
  })

  it('devolve lista vazia para texto vazio', () => {
    expect(partirComDestaques('', ['40%'])).toEqual([])
    expect(partirComDestaques(undefined, ['40%'])).toEqual([])
  })
})
