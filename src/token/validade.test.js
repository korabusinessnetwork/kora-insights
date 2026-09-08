import { describe, expect, it } from 'vitest'

import {
  avisosDeReconexao,
  diasAteVencer,
  DIAS_PARA_AVISAR,
  DIAS_PARA_RENOVAR,
  precisaRenovar,
} from './validade.js'

const AGORA = '2026-09-07T12:00:00.000Z'

/**
 * @param {number} dias
 * @returns {string} vencimento a tantos dias de AGORA
 */
function daquiA(dias) {
  return new Date(new Date(AGORA).getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @param {object} [campos]
 * @returns {object} conta conectada
 */
function conta(campos = {}) {
  return {
    id: 'conta-1',
    nome: 'Casa Oliveira',
    username: 'casaoliveira',
    status: 'ativa',
    tokenExpiraEm: daquiA(40),
    ...campos,
  }
}

describe('diasAteVencer', () => {
  it('conta dias inteiros que faltam', () => {
    expect(diasAteVencer(daquiA(30), AGORA)).toBe(30)
    expect(diasAteVencer(daquiA(1), AGORA)).toBe(1)
  })

  it('devolve negativo quando o prazo ja passou', () => {
    expect(diasAteVencer(daquiA(-3), AGORA)).toBe(-3)
  })

  it('arredonda para baixo: meio dia restante ainda nao e um dia', () => {
    expect(diasAteVencer(daquiA(0.5), AGORA)).toBe(0)
  })

  it('sem vencimento conhecido devolve null, nunca zero', () => {
    // Zero significaria "vence hoje" e dispararia renovacao e aviso.
    expect(diasAteVencer(null, AGORA)).toBeNull()
    expect(diasAteVencer(undefined, AGORA)).toBeNull()
    expect(diasAteVencer('', AGORA)).toBeNull()
    expect(diasAteVencer('nao e data', AGORA)).toBeNull()
  })
})

describe('precisaRenovar', () => {
  it('renova a partir do limiar, e nao antes', () => {
    expect(precisaRenovar(conta({ tokenExpiraEm: daquiA(DIAS_PARA_RENOVAR + 1) }), AGORA)).toBe(
      false,
    )
    expect(precisaRenovar(conta({ tokenExpiraEm: daquiA(DIAS_PARA_RENOVAR) }), AGORA)).toBe(true)
    expect(precisaRenovar(conta({ tokenExpiraEm: daquiA(2) }), AGORA)).toBe(true)
  })

  it('token sem vencimento nao e renovado', () => {
    // A Graph API omite `expires_in` no token que nao expira. Renovar todo dia
    // o que nao vence gastaria uma chamada por conta por dia, para nada.
    expect(precisaRenovar(conta({ tokenExpiraEm: null }), AGORA)).toBe(false)
  })

  it('conta ausente ou sem campo nao quebra a coleta das outras', () => {
    expect(precisaRenovar(null, AGORA)).toBe(false)
    expect(precisaRenovar({}, AGORA)).toBe(false)
  })
})

describe('avisosDeReconexao', () => {
  it('conta com prazo confortavel nao rende aviso', () => {
    expect(avisosDeReconexao([conta()], AGORA)).toEqual([])
  })

  it('so avisa dentro do limiar da tela, que e menor que o da renovacao', () => {
    // Se o aviso aparecesse junto com a renovacao, o cliente veria alarme em
    // toda conta a cada 45 dias — e o aviso deixaria de significar algo.
    expect(DIAS_PARA_AVISAR).toBeLessThan(DIAS_PARA_RENOVAR)
    expect(avisosDeReconexao([conta({ tokenExpiraEm: daquiA(DIAS_PARA_AVISAR + 1) })], AGORA)).toEqual(
      [],
    )
    expect(avisosDeReconexao([conta({ tokenExpiraEm: daquiA(DIAS_PARA_AVISAR) })], AGORA)).toHaveLength(
      1,
    )
  })

  it('vencendo: diz o prazo e o que se perde', () => {
    const [aviso] = avisosDeReconexao([conta({ tokenExpiraEm: daquiA(5) })], AGORA)
    expect(aviso.estado).toBe('vencendo')
    expect(aviso.diasRestantes).toBe(5)
    expect(aviso.titulo).toBe('Conexão expirando')
    expect(aviso.texto).toContain('@casaoliveira')
    expect(aviso.texto).toContain('vence em 5 dias')
    expect(aviso.texto).toContain('não volta')
  })

  it('prazo curto e dito como se fala', () => {
    const emUmDia = avisosDeReconexao([conta({ tokenExpiraEm: daquiA(1) })], AGORA)
    expect(emUmDia[0].texto).toContain('vence amanhã')

    const hoje = avisosDeReconexao([conta({ tokenExpiraEm: daquiA(0.5) })], AGORA)
    expect(hoje[0].texto).toContain('vence hoje')
    // Ainda nao venceu: o aviso e de prazo, nao de coleta parada.
    expect(hoje[0].estado).toBe('vencendo')
  })

  it('status token_expirado rende o aviso de coleta parada', () => {
    const [aviso] = avisosDeReconexao(
      [conta({ status: 'token_expirado', tokenExpiraEm: daquiA(-2) })],
      AGORA,
    )
    expect(aviso.estado).toBe('vencido')
    expect(aviso.titulo).toBe('Coleta parada')
    expect(aviso.texto).toContain('parou')
  })

  it('vencimento no passado ja avisa, mesmo antes de a coleta falhar', () => {
    // Entre o vencimento e a primeira coleta que falha existe uma janela em que
    // o relogio ja sabe e o banco ainda diz `ativa`. A tela nao espera por ela.
    const [aviso] = avisosDeReconexao([conta({ status: 'ativa', tokenExpiraEm: daquiA(-1) })], AGORA)
    expect(aviso.estado).toBe('vencido')
  })

  it('conta desconectada nao avisa; pausada avisa', () => {
    const desconectada = conta({ id: 'c1', status: 'desconectada', tokenExpiraEm: daquiA(3) })
    const pausada = conta({ id: 'c2', status: 'pausada', tokenExpiraEm: daquiA(3) })
    const avisos = avisosDeReconexao([desconectada, pausada], AGORA)
    expect(avisos.map((a) => a.contaId)).toEqual(['c2'])
  })

  it('token sem vencimento e conta saudavel nao aparecem', () => {
    expect(avisosDeReconexao([conta({ tokenExpiraEm: null })], AGORA)).toEqual([])
  })

  it('ordena por urgencia: vencido primeiro, depois o prazo mais curto', () => {
    const contas = [
      conta({ id: 'em-6', tokenExpiraEm: daquiA(6) }),
      conta({ id: 'vencida', status: 'token_expirado', tokenExpiraEm: daquiA(-9) }),
      conta({ id: 'em-2', tokenExpiraEm: daquiA(2) }),
    ]
    expect(avisosDeReconexao(contas, AGORA).map((a) => a.contaId)).toEqual([
      'vencida',
      'em-2',
      'em-6',
    ])
  })

  it('lista vazia ou ausente devolve lista vazia', () => {
    expect(avisosDeReconexao([], AGORA)).toEqual([])
    expect(avisosDeReconexao(undefined, AGORA)).toEqual([])
  })
})
