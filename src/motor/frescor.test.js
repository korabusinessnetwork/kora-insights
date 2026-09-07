import { describe, expect, it } from 'vitest'

import { DIAS_ATE_ENVELHECER, frescorDoDiagnostico } from './frescor.js'

const AGORA = '2026-09-07T12:00:00.000Z'

/**
 * @param {number} dias quantos dias atras a leitura foi feita
 * @returns {{ geradoEm: string }}
 */
function feitoHa(dias) {
  return { geradoEm: new Date(new Date(AGORA).getTime() - dias * 24 * 60 * 60 * 1000).toISOString() }
}

describe('frescorDoDiagnostico', () => {
  it('diz a data da leitura, sempre — e essa e a parte que faltava na tela', () => {
    const frescor = frescorDoDiagnostico({ geradoEm: '2026-09-05T04:40:00.000Z' }, AGORA)

    expect(frescor.rotulo).toBe('Leitura de 5 de setembro de 2026')
  })

  it('leitura do dia nao rende aviso nenhum', () => {
    const frescor = frescorDoDiagnostico(feitoHa(0), AGORA)

    expect(frescor.diasDesde).toBe(0)
    expect(frescor.envelhecido).toBe(false)
    expect(frescor.aviso).toBeNull()
  })

  it('envelhece a partir do limiar, e nao nele', () => {
    // O limiar sai do agendamento: a rotina roda todo dia, entao dois dias ainda
    // cabem em atraso de execucao e folga de fuso. Tres significam rodada
    // faltando.
    expect(frescorDoDiagnostico(feitoHa(DIAS_ATE_ENVELHECER), AGORA).envelhecido).toBe(false)
    expect(frescorDoDiagnostico(feitoHa(DIAS_ATE_ENVELHECER + 1), AGORA).envelhecido).toBe(true)
  })

  it('o aviso diz quantos dias, e para no que nao sabemos', () => {
    const frescor = frescorDoDiagnostico(feitoHa(12), AGORA)

    expect(frescor.aviso).toContain('há 12 dias')
    // Nao afirma que o veredito esta errado: ele vale para a janela que comparou.
    expect(frescor.aviso).toContain('continua valendo')
    expect(frescor.aviso).toContain('não inclui o que aconteceu depois')
    // E assume o problema em vez de deixar o cliente achando que fez algo.
    expect(frescor.aviso).toContain('do nosso lado')
  })

  it('data no futuro vira zero, nunca dia negativo', () => {
    // So acontece com relogio errado de um dos lados, e "feita ha -3 dias" nao
    // quer dizer nada para quem le.
    const frescor = frescorDoDiagnostico(feitoHa(-3), AGORA)

    expect(frescor.diasDesde).toBe(0)
    expect(frescor.envelhecido).toBe(false)
  })

  it('sem data de geracao nao afirma nada', () => {
    expect(frescorDoDiagnostico(null, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({}, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({ geradoEm: '' }, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({ geradoEm: 'ontem' }, AGORA)).toBeNull()
  })
})
