import { describe, expect, it } from 'vitest'

import { DIAS_ATE_ENVELHECER, frescorDoDiagnostico } from './frescor.js'

const AGORA = '2026-09-07T12:00:00.000Z'

const ATIVA = { status: 'ativa' }
const DESCONECTADA = { status: 'desconectada' }

/**
 * @param {number} dias quantos dias atras a leitura foi feita
 * @returns {{ geradoEm: string }}
 */
function feitoHa(dias) {
  return { geradoEm: new Date(new Date(AGORA).getTime() - dias * 24 * 60 * 60 * 1000).toISOString() }
}

describe('frescorDoDiagnostico', () => {
  it('diz a data da geracao, sempre — e essa e a parte que faltava na tela', () => {
    const frescor = frescorDoDiagnostico({ geradoEm: '2026-09-05T04:40:00.000Z' }, ATIVA, AGORA)

    // A mesma palavra da folha do relatorio. A tela ja anuncia o periodo dos
    // DADOS ("8 semanas ate 30 de agosto"); um segundo rotulo de data ao lado
    // dele precisa dizer sozinho que fala de outra coisa.
    expect(frescor.rotulo).toBe('Gerado em 5 de setembro de 2026')
  })

  it('leitura do dia nao rende aviso nenhum', () => {
    const frescor = frescorDoDiagnostico(feitoHa(0), ATIVA, AGORA)

    expect(frescor.diasDesde).toBe(0)
    expect(frescor.envelhecido).toBe(false)
    expect(frescor.estado).toBe('recente')
    expect(frescor.aviso).toBeNull()
  })

  it('envelhece a partir do limiar, e nao nele', () => {
    // O limiar sai do agendamento: a rotina roda todo dia, entao dois dias ainda
    // cabem em atraso de execucao e folga de fuso. Tres significam rodada
    // faltando.
    expect(frescorDoDiagnostico(feitoHa(DIAS_ATE_ENVELHECER), ATIVA, AGORA).envelhecido).toBe(false)
    expect(frescorDoDiagnostico(feitoHa(DIAS_ATE_ENVELHECER + 1), ATIVA, AGORA).envelhecido).toBe(true)
  })

  it('o aviso diz quantos dias, e para no que nao sabemos', () => {
    const frescor = frescorDoDiagnostico(feitoHa(12), ATIVA, AGORA)

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
    const frescor = frescorDoDiagnostico(feitoHa(-3), ATIVA, AGORA)

    expect(frescor.diasDesde).toBe(0)
    expect(frescor.envelhecido).toBe(false)
  })

  it('conta desconectada nao vira alarme, e nunca culpa a nossa rotina', () => {
    // `gerar-diagnostico` nao varre conta desconectada, e faz bem: refazer
    // reescreveria o mesmo veredito com data de hoje, ou trocaria o ultimo
    // veredito valido por "ainda nao da para saber" quando a janela rolasse.
    // Quem parou foi o cliente, e a frase precisa dizer isso.
    const frescor = frescorDoDiagnostico(feitoHa(40), DESCONECTADA, AGORA)

    expect(frescor.estado).toBe('congelado')
    expect(frescor.envelhecido).toBe(false)
    expect(frescor.aviso).toContain('desconectada')
    expect(frescor.aviso).toContain('Reconecte')
    expect(frescor.aviso).not.toContain('do nosso lado')
  })

  it('conta desconectada recem-desconectada tambem se declara congelada', () => {
    // Nao ha limiar aqui: o congelamento nao depende de tempo, depende do estado.
    const frescor = frescorDoDiagnostico(feitoHa(0), DESCONECTADA, AGORA)

    expect(frescor.estado).toBe('congelado')
    expect(frescor.aviso).toContain('congelado')
  })

  it('sem conta conhecida, cai no comportamento de conta ativa', () => {
    // A conta pode nao ter chegado ainda ao contexto. Assumir "desconectada"
    // por ausencia diria ao cliente que ele desligou algo que esta ligado.
    expect(frescorDoDiagnostico(feitoHa(12), null, AGORA).estado).toBe('envelhecido')
  })

  it('sem data de geracao nao afirma nada', () => {
    expect(frescorDoDiagnostico(null, ATIVA, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({}, ATIVA, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({ geradoEm: '' }, ATIVA, AGORA)).toBeNull()
    expect(frescorDoDiagnostico({ geradoEm: 'ontem' }, ATIVA, AGORA)).toBeNull()
  })
})
