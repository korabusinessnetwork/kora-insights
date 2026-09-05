import { describe, expect, it } from 'vitest'

import {
  TOKENS_DE_TENANT,
  aplicarIdentidadeVisual,
  limparIdentidadeVisual,
  resolverTokensDeIdentidade,
  valorDeIdentidadeEhValido,
} from './identidadeVisual.js'

describe('valorDeIdentidadeEhValido', () => {
  it('aceita hex de 3, 4, 6 e 8 digitos', () => {
    for (const cor of ['#fff', '#fff8', '#0a0e0c', '#0A0E0CFF']) {
      expect(valorDeIdentidadeEhValido('acento', cor)).toBe(true)
    }
  })

  it('recusa cor que nao seja hex', () => {
    for (const valor of ['red', 'rgb(0,0,0)', 'var(--x)', '0a0e0c', '']) {
      expect(valorDeIdentidadeEhValido('acento', valor)).toBe(false)
    }
  })

  it('recusa valor que faria o CSS buscar recurso externo', () => {
    // O motivo de existir a validacao: identidade vem do banco e vira folha de
    // estilo. Um url() aqui seria requisicao a servidor de terceiro.
    expect(valorDeIdentidadeEhValido('acento', 'url(https://exemplo/x.png)')).toBe(false)
    expect(valorDeIdentidadeEhValido('fonteTexto', 'Inter; background: url(x)')).toBe(false)
    expect(valorDeIdentidadeEhValido('fonteTexto', 'local(evil)')).toBe(false)
  })

  it('aceita pilha de fontes com aspas e virgulas', () => {
    expect(valorDeIdentidadeEhValido('fonteDisplay', "'GT Sectra', Georgia, serif")).toBe(true)
  })

  it('recusa valor absurdamente longo', () => {
    expect(valorDeIdentidadeEhValido('fonteTexto', 'a'.repeat(200))).toBe(false)
  })

  it('recusa o que nao e string', () => {
    for (const valor of [null, undefined, 42, {}, ['#fff']]) {
      expect(valorDeIdentidadeEhValido('acento', valor)).toBe(false)
    }
  })
})

describe('resolverTokensDeIdentidade', () => {
  it('traduz chave conhecida para custom property', () => {
    expect(resolverTokensDeIdentidade({ acento: '#ff0000' })).toEqual([
      [TOKENS_DE_TENANT.acento, '#ff0000'],
    ])
  })

  it('descarta chave desconhecida em vez de aceitar propriedade arbitraria', () => {
    expect(resolverTokensDeIdentidade({ 'background: url(x)': '#fff' })).toEqual([])
    expect(resolverTokensDeIdentidade({ acentoInventado: '#fff' })).toEqual([])
  })

  it('descarta valor invalido sem derrubar os validos', () => {
    const tokens = resolverTokensDeIdentidade({ acento: '#ff0000', tinta: 'chartreuse' })
    expect(tokens).toEqual([[TOKENS_DE_TENANT.acento, '#ff0000']])
  })

  it('tolera identidade ausente', () => {
    expect(resolverTokensDeIdentidade(null)).toEqual([])
    expect(resolverTokensDeIdentidade(undefined)).toEqual([])
    expect(resolverTokensDeIdentidade('#fff')).toEqual([])
  })
})

describe('aplicarIdentidadeVisual', () => {
  it('escreve as custom properties na raiz', () => {
    const raiz = document.createElement('div')
    aplicarIdentidadeVisual({ acento: '#123456' }, raiz)
    expect(raiz.style.getPropertyValue(TOKENS_DE_TENANT.acento)).toBe('#123456')
  })

  it('devolve uma funcao que desfaz — trocar de tenant nao pode deixar cor do anterior', () => {
    const raiz = document.createElement('div')
    const desfazer = aplicarIdentidadeVisual({ acento: '#123456' }, raiz)
    desfazer()
    expect(raiz.style.getPropertyValue(TOKENS_DE_TENANT.acento)).toBe('')
  })

  it('limparIdentidadeVisual apaga tudo, inclusive o que outro tenant deixou', () => {
    const raiz = document.createElement('div')
    aplicarIdentidadeVisual({ acento: '#123456', tinta: '#abcdef' }, raiz)
    limparIdentidadeVisual(raiz)
    for (const propriedade of Object.values(TOKENS_DE_TENANT)) {
      expect(raiz.style.getPropertyValue(propriedade)).toBe('')
    }
  })
})
