import { describe, expect, it } from 'vitest'

import { inicialDaConta } from './SeletorDeConta.jsx'

describe('inicial da conta', () => {
  it('usa a primeira letra do nome, em maiúscula', () => {
    expect(inicialDaConta('Casa Oliveira')).toBe('C')
    expect(inicialDaConta('estúdio vergara')).toBe('E')
  })

  it('ignora espaço na frente, que vem colado de nome digitado à mão', () => {
    expect(inicialDaConta('  Padaria Real')).toBe('P')
  })

  it('devolve vazio sem nome, em vez de quebrar o cabeçalho', () => {
    expect(inicialDaConta('')).toBe('')
    expect(inicialDaConta('   ')).toBe('')
    expect(inicialDaConta(undefined)).toBe('')
    expect(inicialDaConta(null)).toBe('')
  })

  it('não parte caractere ao meio quando o nome começa por emoji', () => {
    // `'🌿Verde'[0]` devolveria metade do par substituto e renderizaria lixo.
    expect(inicialDaConta('🌿 Verde')).toBe('🌿')
  })

  it('mantém a acentuação da letra, sem normalizar o nome do cliente', () => {
    expect(inicialDaConta('Ótica Silva')).toBe('Ó')
  })
})
