import { describe, expect, it } from 'vitest'

import {
  LIMIAR_DE_ESTABILIDADE,
  SEM_VALOR,
  formatarDataCurta,
  formatarNumero,
  formatarPeriodo,
  formatarValorDeMetrica,
  formatarVariacao,
} from './formatar.js'

describe('formatarNumero', () => {
  it('escreve os números da identidade exatamente como a tela mostra', () => {
    // docs/02_DESIGN_SYSTEM/identidade/01-diagnostico.png — teste de regressão
    // do caso Casa Oliveira: se um destes mudar, a tela deixou de bater com a peça.
    expect(formatarNumero(1.8, 1)).toBe('1,8')
    expect(formatarNumero(3, 1)).toBe('3,0')
    expect(formatarNumero(26900)).toBe('26.900')
    expect(formatarNumero(41200)).toBe('41.200')
    expect(formatarNumero(2240)).toBe('2.240')
    expect(formatarNumero(2290)).toBe('2.290')
  })

  it('usa ponto de milhar em toda ordem de grandeza', () => {
    expect(formatarNumero(0)).toBe('0')
    expect(formatarNumero(999)).toBe('999')
    expect(formatarNumero(1000)).toBe('1.000')
    expect(formatarNumero(1234567)).toBe('1.234.567')
    expect(formatarNumero(12345678.912, 2)).toBe('12.345.678,91')
  })

  it('mantém as casas pedidas mesmo quando o valor é redondo', () => {
    expect(formatarNumero(2240, 2)).toBe('2.240,00')
    expect(formatarNumero(0, 1)).toBe('0,0')
  })

  it('arredonda para as casas exibidas', () => {
    expect(formatarNumero(1.75, 1)).toBe('1,8')
    expect(formatarNumero(2289.6)).toBe('2.290')
  })

  it('escreve o sinal de negativo, e não escreve "-0"', () => {
    expect(formatarNumero(-1234.56, 2)).toBe('-1.234,56')
    expect(formatarNumero(-0.04, 1)).toBe('0,0')
  })

  it('devolve o traço quando não há número: lacuna não vira zero', () => {
    expect(formatarNumero(null)).toBe(SEM_VALOR)
    expect(formatarNumero(undefined)).toBe(SEM_VALOR)
    expect(formatarNumero(NaN)).toBe(SEM_VALOR)
    expect(formatarNumero(Infinity)).toBe(SEM_VALOR)
    expect(formatarNumero('26900')).toBe(SEM_VALOR)
  })
})

describe('formatarValorDeMetrica', () => {
  it('formata pelo código canônico, com a precisão de quem exibe', () => {
    expect(formatarValorDeMetrica('publicacoes', 1.8, { casas: 1 })).toBe('1,8')
    expect(formatarValorDeMetrica('publicacoes', 3, { casas: 1 })).toBe('3,0')
    expect(formatarValorDeMetrica('alcance', 26900)).toBe('26.900')
    expect(formatarValorDeMetrica('seguidores', 6176)).toBe('6.176')
  })

  it('recusa nome da Meta antes de ele chegar à tela', () => {
    expect(() => formatarValorDeMetrica('reach', 26900)).toThrow(/Métrica desconhecida: reach/)
  })
})

describe('formatarVariacao', () => {
  it('escreve as três notas da identidade', () => {
    expect(formatarVariacao(1.8 / 3 - 1)).toBe('40% abaixo')
    expect(formatarVariacao(26900 / 41200 - 1)).toBe('35% abaixo')
    expect(formatarVariacao(2240 / 2290 - 1)).toBe('Estável')
  })

  it('diz "acima" quando sobe', () => {
    expect(formatarVariacao(0.35)).toBe('35% acima')
    expect(formatarVariacao(1.2)).toBe('120% acima')
  })

  it('chama de estável tudo abaixo do limiar, nos dois sentidos', () => {
    expect(LIMIAR_DE_ESTABILIDADE).toBe(0.05)
    expect(formatarVariacao(0)).toBe('Estável')
    expect(formatarVariacao(0.049)).toBe('Estável')
    expect(formatarVariacao(-0.049)).toBe('Estável')
  })

  it('volta a dar número exatamente no limiar', () => {
    expect(formatarVariacao(LIMIAR_DE_ESTABILIDADE)).toBe('5% acima')
    expect(formatarVariacao(-LIMIAR_DE_ESTABILIDADE)).toBe('5% abaixo')
  })

  it('devolve o traço quando não há variação a mostrar', () => {
    expect(formatarVariacao(null)).toBe(SEM_VALOR)
    expect(formatarVariacao(undefined)).toBe(SEM_VALOR)
    expect(formatarVariacao(NaN)).toBe(SEM_VALOR)
  })
})

describe('formatarPeriodo', () => {
  it('colapsa mês e ano repetidos', () => {
    // A semana de referência da fixture, do jeito que o cabeçalho anuncia.
    expect(formatarPeriodo('2026-08-24', '2026-08-30')).toBe('24 a 30 de agosto de 2026')
  })

  it('repete o mês quando a semana vira o mês', () => {
    expect(formatarPeriodo('2026-08-31', '2026-09-06')).toBe(
      '31 de agosto a 6 de setembro de 2026',
    )
  })

  it('repete o ano quando a semana vira o ano', () => {
    expect(formatarPeriodo('2026-12-28', '2027-01-03')).toBe(
      '28 de dezembro de 2026 a 3 de janeiro de 2027',
    )
  })

  it('aceita ISO completo e ignora a hora', () => {
    expect(formatarPeriodo('2026-08-24T00:00:00.000Z', '2026-08-30T23:59:59.000Z')).toBe(
      '24 a 30 de agosto de 2026',
    )
  })

  it('devolve o traço se alguma ponta não for data', () => {
    expect(formatarPeriodo('2026-08-24', null)).toBe(SEM_VALOR)
    expect(formatarPeriodo('ontem', '2026-08-30')).toBe(SEM_VALOR)
  })
})

describe('formatarDataCurta', () => {
  it('escreve a data por extenso, sem zero à esquerda', () => {
    expect(formatarDataCurta('2026-09-05')).toBe('5 de setembro de 2026')
    expect(formatarDataCurta('2026-03-01')).toBe('1 de março de 2026')
    expect(formatarDataCurta('2026-12-31')).toBe('31 de dezembro de 2026')
  })

  it('lê o dia do ISO sem deixar fuso mover a data', () => {
    // `new Date('2026-01-01')` em fuso negativo volta 31 de dezembro; a leitura
    // aqui é textual e em UTC justamente para o relatório não trocar de dia.
    expect(formatarDataCurta('2026-01-01T00:00:00.000Z')).toBe('1 de janeiro de 2026')
  })

  it('recusa data que não existe no calendário', () => {
    expect(formatarDataCurta('2026-02-31')).toBe(SEM_VALOR)
    expect(formatarDataCurta('2026-13-01')).toBe(SEM_VALOR)
    expect(formatarDataCurta('05/09/2026')).toBe(SEM_VALOR)
    expect(formatarDataCurta(undefined)).toBe(SEM_VALOR)
  })
})
