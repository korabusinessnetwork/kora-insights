/**
 * Os cabecalhos de resposta gerados no build (`vite.config.js`).
 *
 * Sao tres funcoes puras, e as tres decidem se a CSP que vai ao ar libera a
 * chamada de login ou a bloqueia. Erro aqui nao aparece em teste de tela nem no
 * build: aparece no primeiro login em producao, com o console limpo. Por isso
 * elas nascem com teste (CLAUDE.md, Padroes de codigo).
 *
 * O arquivo NAO se chama `vite.config.test.js`, que seria o nome obvio: o
 * `exclude` padrao do Vitest descarta qualquer `vite.config.*`, entao o teste com
 * aquele nome seria lido como configuracao, ignorado, e passaria a existir sem
 * nunca rodar — verde por ausencia.
 *
 * Roda em ambiente `node`, e nao no `jsdom` padrao do projeto: importar
 * `vite.config.js` traz o esbuild junto, e o esbuild recusa o `TextEncoder` do
 * jsdom com um erro que nao tem nada a ver com o que esta sendo testado.
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { comCabecalhoNoBlocoRaiz, montarCSP, origemDoBackend } from './vite.config.js'

describe('origemDoBackend', () => {
  it('devolve null quando a variavel falta, que e o modo de demonstracao', () => {
    // ADR-007: sem backend o produto sobe com a fixture, e nao ha chamada para
    // o connect-src liberar. `/privacidade` e `/dados` continuam de pe.
    expect(origemDoBackend(undefined)).toBeNull()
    expect(origemDoBackend('')).toBeNull()
    expect(origemDoBackend('   ')).toBeNull()
  })

  it('reduz a URL a origem, porque CSP casa por origem e nao por caminho', () => {
    expect(origemDoBackend('https://abc.supabase.co/rest/v1/')).toEqual({
      http: 'https://abc.supabase.co',
      websocket: 'wss://abc.supabase.co',
    })
  })

  it('preserva a porta, que faz parte da origem', () => {
    expect(origemDoBackend('http://localhost:54321')).toEqual({
      http: 'http://localhost:54321',
      websocket: 'ws://localhost:54321',
    })
  })

  it('para o build quando a URL nao tem esquema', () => {
    // Este e o caso caro: `abc.supabase.co` gera uma CSP sintaticamente valida
    // que nao libera nada. Falhar no build e mais barato que falhar no login.
    expect(() => origemDoBackend('abc.supabase.co')).toThrow(/nao e uma URL absoluta/)
  })

  it('para o build quando o esquema nao e http nem https', () => {
    // `htps://` cai aqui, e nao no caso anterior: para o parser de URL um
    // esquema desconhecido e uma URL valida. Quem barra o erro de digitacao e
    // esta checagem, nao o `new URL`.
    expect(() => origemDoBackend('htps://abc.supabase.co')).toThrow(/so sabe liberar http/)
    expect(() => origemDoBackend('file:///tmp/x')).toThrow(/so sabe liberar http/)
  })
})

describe('montarCSP', () => {
  it('nao cita nenhum host do Google, agora que as fontes sao locais', () => {
    const politica = montarCSP(origemDoBackend('https://abc.supabase.co'))
    expect(politica).not.toMatch(/google/i)
    expect(politica).not.toMatch(/gstatic/i)
    expect(politica).toContain("font-src 'self'")
  })

  it('libera o backend em http e em websocket quando ele existe', () => {
    const politica = montarCSP(origemDoBackend('https://abc.supabase.co'))
    expect(politica).toContain(
      "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
    )
  })

  it('sem backend, connect-src fica so com a propria origem', () => {
    expect(montarCSP(null)).toContain("connect-src 'self'")
    expect(montarCSP(null)).not.toMatch(/supabase/)
  })

  it('nunca abre mao de unsafe-inline nem de unsafe-eval', () => {
    // Sem isto a CSP vira enfeite: e a ausencia dos dois que barra XSS.
    for (const politica of [montarCSP(null), montarCSP(origemDoBackend('https://a.co'))]) {
      expect(politica).not.toContain('unsafe-inline')
      expect(politica).not.toContain('unsafe-eval')
    }
  })

  it('emite a politica tambem em modo de demonstracao', () => {
    // As duas paginas que o App Review visita sao as que sobem sem backend.
    expect(montarCSP(null)).toContain("default-src 'self'")
    expect(montarCSP(null)).toContain("frame-ancestors 'none'")
  })
})

describe('comCabecalhoNoBlocoRaiz', () => {
  const arquivo = ['/*', '  X-Frame-Options: DENY', '', '/assets/*', '  Cache-Control: immutable', '']
    .join('\n')

  it('escreve no fim do bloco /*, e nao nos blocos seguintes', () => {
    const saida = comCabecalhoNoBlocoRaiz(arquivo, 'Content-Security-Policy: default-src \'self\'')
    expect(saida.split('\n')).toEqual([
      '/*',
      '  X-Frame-Options: DENY',
      "  Content-Security-Policy: default-src 'self'",
      '',
      '/assets/*',
      '  Cache-Control: immutable',
      '',
    ])
  })

  it('mantem a indentacao de dois espacos que o Pages exige', () => {
    const saida = comCabecalhoNoBlocoRaiz(arquivo, 'Content-Security-Policy: x')
    expect(saida).toContain('\n  Content-Security-Policy: x\n')
  })

  it('recusa arquivo que ja traga uma CSP, para nao valer a intersecao das duas', () => {
    const comCSP = '/*\n  Content-Security-Policy: default-src *\n'
    expect(() => comCabecalhoNoBlocoRaiz(comCSP, 'Content-Security-Policy: x')).toThrow(
      /ja declara content-security-policy/,
    )
  })

  it('recusa arquivo sem bloco /*, em vez de gravar cabecalho que nao vale para nada', () => {
    expect(() => comCabecalhoNoBlocoRaiz('/assets/*\n  Cache-Control: x\n', 'A: b')).toThrow(
      /nao tem o bloco/,
    )
  })
})
