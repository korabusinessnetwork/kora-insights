/**
 * Dois riscos moram neste modulo, e os dois sao testados aqui:
 *
 * 1. Um codigo que muda de nome quebra a decisao da tela em silencio, porque
 *    `error.codigo` e o que ela usa para escolher o que mostrar.
 * 2. Uma mensagem crua de banco que escapa entrega nome de tabela e de coluna
 *    para quem estiver do outro lado.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CODIGOS, MENSAGENS, erroDeServico, mensagemDoErro, traduzirErroDoSupabase } from './erros.js'

/** Os nove codigos de contratos.md, secao 1. A lista e o contrato. */
const CODIGOS_DO_CONTRATO = [
  'SEM_SESSAO',
  'SEM_PERMISSAO',
  'NAO_ENCONTRADO',
  'ENTRADA_INVALIDA',
  'TOKEN_EXPIRADO',
  'LIMITE_DE_TAXA',
  'SEM_DADO_SUFICIENTE',
  'FALHA_DE_REDE',
  'FALHA_INESPERADA',
]

/** Erro cru tipico do PostgREST: a mensagem descreve o schema. */
const ERRO_COM_SCHEMA = {
  code: '42703',
  message: 'column ig_contas.token_ref does not exist',
  details: 'Perhaps you meant to reference the column "ig_contas.token_expira_em"',
  hint: null,
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CODIGOS', () => {
  it('tem exatamente os códigos de contratos.md, sem sobra nem falta', () => {
    expect(Object.keys(CODIGOS).sort()).toEqual([...CODIGOS_DO_CONTRATO].sort())
  })

  it('mapeia cada nome para ele mesmo: o valor é o que viaja no envelope', () => {
    for (const codigo of CODIGOS_DO_CONTRATO) {
      expect(CODIGOS[codigo]).toBe(codigo)
    }
  })

  it('é congelado: código estável não muda em tempo de execução', () => {
    expect(Object.isFrozen(CODIGOS)).toBe(true)
  })

  it('tem uma frase pt-BR para cada código', () => {
    for (const codigo of CODIGOS_DO_CONTRATO) {
      expect(typeof MENSAGENS[codigo]).toBe('string')
      expect(MENSAGENS[codigo].length).toBeGreaterThan(10)
    }
  })
})

describe('traduzirErroDoSupabase', () => {
  it.each([
    ['PGRST116', 'NAO_ENCONTRADO'],
    ['PGRST301', 'SEM_SESSAO'],
    ['PGRST100', 'ENTRADA_INVALIDA'],
    ['22P02', 'ENTRADA_INVALIDA'],
    ['23505', 'ENTRADA_INVALIDA'],
    ['42501', 'SEM_PERMISSAO'],
    ['42P01', 'FALHA_INESPERADA'],
    ['57014', 'FALHA_DE_REDE'],
  ])('traduz o código %s do banco para %s', (codigoDoBanco, esperado) => {
    expect(traduzirErroDoSupabase({ code: codigoDoBanco }).codigo).toBe(esperado)
  })

  it.each([
    [400, 'ENTRADA_INVALIDA'],
    [401, 'SEM_SESSAO'],
    [403, 'SEM_PERMISSAO'],
    [404, 'NAO_ENCONTRADO'],
    [429, 'LIMITE_DE_TAXA'],
  ])('traduz o status HTTP %s para %s quando não há código de banco', (status, esperado) => {
    expect(traduzirErroDoSupabase({ status }).codigo).toBe(esperado)
  })

  it('trata 5xx como falha de rede: o problema não é o que o usuário digitou', () => {
    expect(traduzirErroDoSupabase({ status: 503 }).codigo).toBe(CODIGOS.FALHA_DE_REDE)
  })

  it.each([
    [{ name: 'TypeError', message: 'Failed to fetch' }],
    [{ name: 'AbortError', message: 'The operation was aborted' }],
    [{ name: 'FunctionsFetchError', message: 'Failed to send a request' }],
  ])('reconhece falha de transporte %#', (erro) => {
    // Sem esta separacao a tela mandaria "tente de novo em instantes" para quem
    // esta sem internet, que e conselho que nao resolve nada.
    expect(traduzirErroDoSupabase(erro).codigo).toBe(CODIGOS.FALHA_DE_REDE)
  })

  it('deixa passar o código que a Edge Function já classificou', () => {
    // TOKEN_EXPIRADO e LIMITE_DE_TAXA so existem do lado que fala com a Meta.
    const erro = traduzirErroDoSupabase({
      codigo: CODIGOS.TOKEN_EXPIRADO,
      mensagem: 'Reconecte a conta do Instagram.',
    })

    expect(erro.codigo).toBe('TOKEN_EXPIRADO')
    expect(erro.mensagem).toBe('Reconecte a conta do Instagram.')
  })

  it('ignora código inventado que chegue como se fosse nosso', () => {
    expect(traduzirErroDoSupabase({ codigo: 'SUPER_ERRO' }).codigo).toBe(CODIGOS.FALHA_INESPERADA)
  })

  it('trata ausência de erro como falha inesperada, nunca como nulo', () => {
    expect(traduzirErroDoSupabase(null).codigo).toBe(CODIGOS.FALHA_INESPERADA)
    expect(traduzirErroDoSupabase(undefined).mensagem).toBe(MENSAGENS.FALHA_INESPERADA)
  })

  it('nunca coloca a mensagem crua do banco na mensagem da tela', () => {
    const erro = traduzirErroDoSupabase(ERRO_COM_SCHEMA)

    expect(erro.mensagem).toBe(MENSAGENS.FALHA_INESPERADA)
    expect(erro.mensagem).not.toContain('ig_contas')
    expect(erro.mensagem).not.toContain('token_ref')
  })
})

describe('detalhe técnico', () => {
  it('guarda o texto cru fora de produção, onde ele ajuda quem depura', () => {
    vi.stubEnv('DEV', true)

    const erro = traduzirErroDoSupabase(ERRO_COM_SCHEMA)

    expect(erro.detalhe).toContain('42703')
    expect(erro.detalhe).toContain('column ig_contas.token_ref does not exist')
  })

  it('omite o detalhe em produção: é ali que o schema vazaria', () => {
    vi.stubEnv('DEV', false)

    const erro = traduzirErroDoSupabase(ERRO_COM_SCHEMA)

    expect(erro.detalhe).toBeUndefined()
    expect(JSON.stringify(erro)).not.toContain('token_ref')
  })

  it('cala também no erro que já vem classificado da Edge Function', () => {
    // O caminho do codigo pronto e o mais facil de esquecer, porque ele nao
    // passa pelo mapa de codigos do banco — e e por ele que chega a resposta da
    // funcao que fala com a Meta.
    vi.stubEnv('DEV', false)

    const erro = traduzirErroDoSupabase({
      codigo: CODIGOS.TOKEN_EXPIRADO,
      mensagem: 'Reconecte a conta do Instagram.',
      message: 'insert into "ig_contas" violates policy',
    })

    expect(erro.detalhe).toBeUndefined()
    expect(JSON.stringify(erro)).not.toContain('ig_contas')
  })

  it('corta detalhe gigante: log de 40 KB não ajuda ninguém a depurar', () => {
    vi.stubEnv('DEV', true)

    const erro = traduzirErroDoSupabase({ code: '42703', message: 'x'.repeat(5000) })

    expect(erro.detalhe.length).toBeLessThanOrEqual(400)
  })
})

describe('erroDeServico', () => {
  it('usa a frase padrão do código quando nenhuma é dada', () => {
    expect(erroDeServico(CODIGOS.SEM_SESSAO).mensagem).toBe(MENSAGENS.SEM_SESSAO)
  })

  it('cai em falha inesperada diante de código desconhecido', () => {
    expect(erroDeServico('NAO_EXISTE').codigo).toBe(CODIGOS.FALHA_INESPERADA)
  })
})

describe('mensagemDoErro', () => {
  it('devolve a frase pt-BR do erro cru, exigida por contratos.md', () => {
    expect(mensagemDoErro({ code: 'PGRST116' })).toBe(MENSAGENS.NAO_ENCONTRADO)
  })
})
