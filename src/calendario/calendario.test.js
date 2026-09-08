import { describe, expect, it } from 'vitest'

import { diasDaSemana, diferencaEmDias, distribuir, segundaDaSemana, somarDias } from './calendario.js'

/**
 * Este modulo define a fronteira de semana do produto inteiro: o motor recorta
 * janelas por ela, a camada de servicos consulta por ela e a demonstracao a usa
 * para gerar serie. Um erro de um dia aqui move todas as janelas de comparacao
 * ao mesmo tempo, e o sintoma aparece como "o numero da tela nao bate com o do
 * banco" — longe da causa.
 */

describe('segundaDaSemana', () => {
  it('devolve a segunda ISO da semana que contem a data', () => {
    expect(segundaDaSemana('2026-08-24')).toBe('2026-08-24')
    expect(segundaDaSemana('2026-08-27')).toBe('2026-08-24')
    expect(segundaDaSemana('2026-08-30')).toBe('2026-08-24')
  })

  it('trata domingo como fim da semana, e nao como comeco', () => {
    // O caso que quase todo calendario erra: em ISO, domingo fecha a semana.
    // Tratado como inicio, ele jogaria a semana inteira uma casa para frente.
    expect(new Date('2026-08-30T00:00:00Z').getUTCDay()).toBe(0)
    expect(segundaDaSemana('2026-08-30')).toBe('2026-08-24')
    expect(segundaDaSemana('2026-08-31')).toBe('2026-08-31')
  })

  it('atravessa virada de mes e de ano', () => {
    expect(segundaDaSemana('2026-03-01')).toBe('2026-02-23')
    expect(segundaDaSemana('2027-01-01')).toBe('2026-12-28')
  })
})

describe('somarDias', () => {
  it('anda para frente e para tras', () => {
    expect(somarDias('2026-08-30', 1)).toBe('2026-08-31')
    expect(somarDias('2026-08-30', -1)).toBe('2026-08-29')
    expect(somarDias('2026-08-30', 0)).toBe('2026-08-30')
  })

  it('atravessa mes, ano e fevereiro sem inventar dia', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(somarDias('2026-02-28', 1)).toBe('2026-03-01')
    // 2028 e bissexto: 29 de fevereiro existe.
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('nao escorrega no horario de verao, porque trabalha em UTC', () => {
    // Datas locais somariam 23 ou 25 horas na virada e devolveriam o dia errado.
    for (const dia of ['2026-02-14', '2026-10-17', '2026-11-07']) {
      expect(diferencaEmDias(dia, somarDias(dia, 7))).toBe(7)
    }
  })
})

describe('diferencaEmDias', () => {
  it('conta a janela de 8 semanas do diagnostico', () => {
    expect(diferencaEmDias('2026-07-06', '2026-08-30')).toBe(55)
  })

  it('e negativa quando o fim vem antes do inicio', () => {
    expect(diferencaEmDias('2026-08-30', '2026-07-06')).toBe(-55)
    expect(diferencaEmDias('2026-08-30', '2026-08-30')).toBe(0)
  })
})

describe('diasDaSemana', () => {
  it('devolve os sete dias, da segunda ao domingo', () => {
    expect(diasDaSemana('2026-08-24')).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })
})

describe('distribuir', () => {
  it('nao perde nem inventa unidade: a soma das partes e o total', () => {
    // E o que mantem o numero da tela igual ao numero do banco. Arredondar cada
    // dia por conta propria perderia unidades no caminho.
    for (const total of [26900, 41200, 3, 1, 0]) {
      expect(distribuir(total, 7).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })

  it('poe o resto nos primeiros dias, de forma deterministica', () => {
    expect(distribuir(3, 7)).toEqual([1, 1, 1, 0, 0, 0, 0])
    expect(distribuir(10, 4)).toEqual([3, 3, 2, 2])
  })

  it('aceita uma parte so', () => {
    expect(distribuir(42, 1)).toEqual([42])
  })
})
