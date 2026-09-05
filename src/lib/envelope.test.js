/**
 * O envelope e o unico formato de resposta que a tela conhece. Um campo que
 * some, ou uma origem preenchida errado, quebra todas as features de uma vez —
 * por isso a forma e testada aqui, e nao em cada consumidor.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  falha,
  falhaDeErro,
  montarMeta,
  ok,
  ORIGEM_DEMONSTRACAO,
  ORIGEM_SUPABASE,
  VERSAO_DO_ENVELOPE,
} from './envelope.js'
import { CODIGOS } from './erros.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Ambiente com backend configurado. Valores falsos, nenhum segredo real. */
function comBackendConfigurado() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-anon-de-teste')
}

describe('ok', () => {
  it('devolve data, error nulo e meta completa', () => {
    const envelope = ok({ total: 3 })

    expect(envelope.data).toEqual({ total: 3 })
    expect(envelope.error).toBeNull()
    expect(envelope.meta.versao).toBe(VERSAO_DO_ENVELOPE)
    expect(Object.keys(envelope)).toEqual(['data', 'error', 'meta'])
  })

  it('carimba um instante ISO com fuso', () => {
    const { meta } = ok(null)

    expect(meta.carimbo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Number.isNaN(Date.parse(meta.carimbo))).toBe(false)
  })

  it('aceita data nulo sem virar erro: lista vazia e resposta legitima', () => {
    const envelope = ok(null)

    expect(envelope.error).toBeNull()
    expect(envelope.data).toBeNull()
  })
})

describe('falha', () => {
  it('zera o data: erro com dado parcial convida a tela a mostrar meia verdade', () => {
    const envelope = falha(CODIGOS.SEM_PERMISSAO, 'Esta conta não é sua.')

    expect(envelope.data).toBeNull()
    expect(envelope.error.codigo).toBe('SEM_PERMISSAO')
    expect(envelope.error.mensagem).toBe('Esta conta não é sua.')
  })

  it('não cria a chave detalhe quando não há detalhe', () => {
    const envelope = falha(CODIGOS.FALHA_DE_REDE, 'Sem conexão.')

    expect('detalhe' in envelope.error).toBe(false)
  })

  it('leva o detalhe adiante quando ele foi montado', () => {
    const envelope = falha(CODIGOS.FALHA_INESPERADA, 'Algo saiu do esperado.', 'PGRST999 | teste')

    expect(envelope.error.detalhe).toBe('PGRST999 | teste')
  })

  it('preenche meta também no caminho de erro', () => {
    const { meta } = falha(CODIGOS.SEM_SESSAO, 'Entre de novo.')

    expect(meta.versao).toBe(VERSAO_DO_ENVELOPE)
    expect(meta.carimbo).toBeTruthy()
  })
})

describe('montarMeta', () => {
  it('marca demonstração quando não há backend configurado', () => {
    expect(montarMeta().origem).toBe(ORIGEM_DEMONSTRACAO)
  })

  it('marca supabase quando URL e chave existem', () => {
    comBackendConfigurado()

    expect(montarMeta().origem).toBe(ORIGEM_SUPABASE)
  })

  it('cai para demonstração quando só metade da configuração existe', () => {
    // Meia configuracao nao e backend: sem a chave, qualquer consulta voltaria
    // vazia e a tela leria isso como "cliente sem dado".
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    expect(montarMeta().origem).toBe(ORIGEM_DEMONSTRACAO)
  })

  it('respeita a origem declarada pelo módulo que respondeu', () => {
    comBackendConfigurado()

    expect(montarMeta({ origem: ORIGEM_DEMONSTRACAO }).origem).toBe(ORIGEM_DEMONSTRACAO)
  })
})

describe('falhaDeErro', () => {
  it('reempacota um erro já traduzido sem perder campo', () => {
    const envelope = falhaDeErro({
      codigo: CODIGOS.TOKEN_EXPIRADO,
      mensagem: 'Reconecte a conta.',
      detalhe: 'oauth 190',
    })

    expect(envelope.error).toEqual({
      codigo: 'TOKEN_EXPIRADO',
      mensagem: 'Reconecte a conta.',
      detalhe: 'oauth 190',
    })
    expect(envelope.data).toBeNull()
  })
})
