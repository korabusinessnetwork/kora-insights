import { describe, expect, it } from 'vitest'

import {
  arredondar,
  coeficienteDeVariacao,
  desvioPadrao,
  media,
  mediana,
  percentualAbsoluto,
  soma,
  ultimo,
  variacao,
  variacaoExibida,
} from './estatistica.js'

describe('agregacoes', () => {
  it('soma lista vazia como zero e media vazia como ausencia', () => {
    expect(soma([])).toBe(0)
    expect(media([])).toBeNull()
    expect(ultimo([])).toBeNull()
  })

  it('soma, media e ultimo sobre valores reais', () => {
    expect(soma([5400, 5300, 5200])).toBe(15900)
    expect(media([3, 3, 3, 3, 3, 3, 3, 3])).toBe(3)
    expect(media([3, 2, 2, 2, 2, 1, 1, 1])).toBe(1.75)
    expect(ultimo([6108, 6116, 6125])).toBe(6125)
  })

  it('mediana lida com lista par e impar', () => {
    expect(mediana([3, 3, 3, 3, 3, 3, 3, 3])).toBe(3)
    expect(mediana([1, 2, 3])).toBe(2)
    expect(mediana([1, 2, 3, 4])).toBe(2.5)
    expect(mediana([])).toBeNull()
  })

  it('desvio e coeficiente de variacao descrevem dispersao relativa', () => {
    expect(desvioPadrao([2, 2, 2, 2])).toBe(0)
    expect(coeficienteDeVariacao([2, 2, 2, 2])).toBe(0)
    expect(coeficienteDeVariacao([])).toBeNull()
    // Media zero nao tem escala: a dispersao relativa nao existe.
    expect(coeficienteDeVariacao([-2, 2])).toBeNull()
    expect(coeficienteDeVariacao([100, 300])).toBeCloseTo(0.5, 10)
  })
})

describe('arredondar', () => {
  it('arredonda meio para longe do zero, nos dois sinais', () => {
    expect(arredondar(1.75, 1)).toBe(1.8)
    expect(arredondar(0.5, 0)).toBe(1)
    expect(arredondar(-0.5, 0)).toBe(-1)
    expect(arredondar(-1.75, 1)).toBe(-1.8)
  })

  it('corrige o residuo binario que faria a tela discordar da calculadora', () => {
    expect(arredondar(2.675, 2)).toBe(2.68)
    expect(arredondar(1.005, 2)).toBe(1.01)
  })

  it('devolve null para valor que nao e numero finito', () => {
    expect(arredondar(Infinity, 2)).toBeNull()
    expect(arredondar(NaN, 2)).toBeNull()
  })
})

describe('variacao', () => {
  it('devolve fracao negativa para queda', () => {
    expect(variacao(26900, 41200)).toBe(-0.3471)
    expect(variacao(3, 2)).toBe(0.5)
  })

  it('nunca devolve Infinity: base zero e ausencia de comparacao', () => {
    expect(variacao(10, 0)).toBeNull()
    expect(Number.isFinite(variacao(10, 0))).toBe(false)
  })

  it('devolve null quando o anterior nao existe', () => {
    expect(variacao(10, null)).toBeNull()
    expect(variacao(10, undefined)).toBeNull()
    expect(variacao(null, 10)).toBeNull()
  })
})

describe('variacaoExibida', () => {
  it('arredonda antes de dividir para a tabela fechar com ela mesma', () => {
    // 1,75 contra 3,00 daria 41,7%. A tela mostra 1,8 e 3,0, e quem confere na
    // reuniao obtem 40%. O numero da tela tem que fechar com a propria tela.
    expect(variacaoExibida(1.75, 3, 1)).toBe(-0.4)
    expect(variacao(1.75, 3)).toBe(-0.4167)
  })

  it('reproduz as tres variacoes da Casa Oliveira', () => {
    expect(variacaoExibida(26900, 41200, 0)).toBe(-0.3471)
    expect(variacaoExibida(2240, 2290, 0)).toBe(-0.0218)
  })

  it('herda de variacao a recusa a dividir por zero', () => {
    expect(variacaoExibida(1.75, 0.4, 0)).toBeNull()
    expect(variacaoExibida(10, null, 0)).toBeNull()
  })
})

describe('percentualAbsoluto', () => {
  it('converte fracao em percentual inteiro sem sinal', () => {
    expect(percentualAbsoluto(-0.4)).toBe(40)
    expect(percentualAbsoluto(-0.3471)).toBe(35)
    expect(percentualAbsoluto(-0.0218)).toBe(2)
    expect(percentualAbsoluto(null)).toBeNull()
  })
})
