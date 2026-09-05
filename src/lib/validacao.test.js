/**
 * Estes validadores sao a borda: o que passa aqui vira consulta, o que nao passa
 * vira `ENTRADA_INVALIDA` sem tocar o banco. Um teste frouxo aqui e um filtro do
 * PostgREST entrando disfarcado de identificador.
 */

import { describe, expect, it } from 'vitest'
import {
  ehCodigoDeOAuth,
  ehDataIso,
  ehEmail,
  ehEstadoDeOAuth,
  ehIdentificador,
  ehIdentificadorDeConta,
  ehIdentificadorDeTenant,
  ehInteiroEntre,
  ehIso8601,
  ehTextoNaoVazio,
  ehUuid,
} from './validacao.js'

const UUID_VALIDO = '9f1c2b7e-4d3a-4f61-8b0e-2c5a7d9e1f04'

describe('ehUuid', () => {
  it('aceita uuid em qualquer versão', () => {
    expect(ehUuid(UUID_VALIDO)).toBe(true)
    expect(ehUuid('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(ehUuid(UUID_VALIDO.toUpperCase())).toBe(true)
  })

  it.each([
    ['sem hífen', '9f1c2b7e4d3a4f618b0e2c5a7d9e1f04'],
    ['curto', '9f1c2b7e-4d3a-4f61-8b0e-2c5a7d9e1f0'],
    ['com letra fora do hexadecimal', '9f1c2b7e-4d3a-4f61-8b0e-2c5a7d9e1g04'],
    ['identificador legível', 'conta-casa-oliveira'],
    ['número', 42],
    ['nulo', null],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehUuid(valor)).toBe(false)
  })
})

describe('ehIdentificadorDeConta', () => {
  it('aceita uuid do banco e identificador legível da fixture', () => {
    expect(ehIdentificadorDeConta(UUID_VALIDO)).toBe(true)
    expect(ehIdentificadorDeConta('conta-casa-oliveira')).toBe(true)
    expect(ehIdentificadorDeConta('tenant-estudio-vergara')).toBe(true)
  })

  it.each([
    ['vírgula, separador de filtro do PostgREST', 'conta,tenant_id.eq.outro'],
    ['ponto, operador do PostgREST', 'conta.eq.1'],
    ['parêntese, agrupador de filtro', 'conta-oliveira(1)'],
    ['asterisco', '*'],
    ['espaço', 'conta casa'],
    ['maiúscula fora de uuid', 'Conta-Casa'],
    ['hífen duplicado', 'conta--casa'],
    ['hífen na ponta', '-conta'],
    ['curto demais', 'ab'],
    ['longo demais', 'c'.repeat(65)],
    ['vazio', ''],
    ['objeto', {}],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehIdentificadorDeConta(valor)).toBe(false)
  })

  it('vale a mesma regra para tenant e para identificador genérico', () => {
    expect(ehIdentificadorDeTenant('conta,injecao')).toBe(false)
    expect(ehIdentificador(UUID_VALIDO)).toBe(true)
  })
})

describe('ehEmail', () => {
  it('aceita endereço plausível', () => {
    expect(ehEmail('camila@estudiovergara.com.br')).toBe(true)
    expect(ehEmail('  rafa+kora@marca.co  ')).toBe(true)
  })

  it.each([
    ['sem arroba', 'camilaestudiovergara.com.br'],
    ['sem domínio', 'camila@'],
    ['domínio sem ponto', 'camila@local'],
    ['com espaço no meio', 'ca mila@marca.com'],
    ['dois arrobas', 'camila@@marca.com'],
    ['curto demais', 'a@b.c'],
    ['nulo', null],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehEmail(valor)).toBe(false)
  })

  it('recusa local part acima de 64 caracteres', () => {
    expect(ehEmail(`${'a'.repeat(65)}@marca.com`)).toBe(false)
  })
})

describe('ehDataIso', () => {
  it('aceita data que existe no calendário', () => {
    expect(ehDataIso('2026-09-05')).toBe(true)
    expect(ehDataIso('2024-02-29')).toBe(true)
  })

  it.each([
    ['dia que não existe', '2026-02-30'],
    ['29 de fevereiro fora de bissexto', '2026-02-29'],
    ['mês 13', '2026-13-01'],
    ['dia zero', '2026-01-00'],
    ['sem zero à esquerda', '2026-9-5'],
    ['com hora', '2026-09-05T00:00:00Z'],
    ['nulo', null],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehDataIso(valor)).toBe(false)
  })
})

describe('ehIso8601', () => {
  it('aceita instante com fuso explícito', () => {
    expect(ehIso8601('2026-09-05T09:12:00.000Z')).toBe(true)
    expect(ehIso8601('2026-09-05T09:12:00Z')).toBe(true)
    expect(ehIso8601('2026-09-05T06:12-03:00')).toBe(true)
  })

  it.each([
    ['sem fuso: instante ambíguo', '2026-09-05T09:12:00'],
    ['só a data', '2026-09-05'],
    ['hora 24', '2026-09-05T24:00:00Z'],
    ['minuto 60', '2026-09-05T09:60:00Z'],
    ['dia inexistente', '2026-02-30T09:12:00Z'],
    ['com espaço em vez de T', '2026-09-05 09:12:00Z'],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehIso8601(valor)).toBe(false)
  })
})

describe('ehInteiroEntre', () => {
  it('aceita inteiro dentro do intervalo fechado', () => {
    expect(ehInteiroEntre(1, 1, 100)).toBe(true)
    expect(ehInteiroEntre(100, 1, 100)).toBe(true)
  })

  it.each([
    ['acima do teto', 101],
    ['abaixo do piso', 0],
    ['fracionário', 12.5],
    ['texto numérico', '12'],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
  ])('recusa %s', (_rotulo, valor) => {
    expect(ehInteiroEntre(valor, 1, 100)).toBe(false)
  })
})

describe('ehTextoNaoVazio', () => {
  it('separa texto de espaço em branco', () => {
    expect(ehTextoNaoVazio('Casa Oliveira')).toBe(true)
    expect(ehTextoNaoVazio('   ')).toBe(false)
    expect(ehTextoNaoVazio(0)).toBe(false)
  })
})

describe('estado e código do OAuth', () => {
  it('aceita o estado no formato que gerarEstadoDeOAuth produz', () => {
    expect(ehEstadoDeOAuth('a'.repeat(32))).toBe(true)
    expect(ehEstadoDeOAuth('0123456789abcdef0123456789abcdef')).toBe(true)
  })

  it.each([
    ['curto', 'abc'],
    ['com maiúscula', 'A'.repeat(32)],
    ['com caractere fora do hexadecimal', 'z'.repeat(32)],
    ['nulo', null],
  ])('recusa estado %s', (_rotulo, valor) => {
    expect(ehEstadoDeOAuth(valor)).toBe(false)
  })

  it('aceita código de autorização da Meta e recusa texto com separador', () => {
    expect(ehCodigoDeOAuth('AQBv-2iL_9xK.abc~DEF12345')).toBe(true)
    expect(ehCodigoDeOAuth('AQBv 2iL&scope=tudo')).toBe(false)
    expect(ehCodigoDeOAuth('curto')).toBe(false)
  })
})
