import { describe, expect, it } from 'vitest'

import {
  METRICAS,
  METRICAS_DE_CONTA,
  METRICAS_DE_MIDIA,
  agregar,
  metricaExiste,
  obterMetrica,
} from './dicionario.js'
import * as metricas from './index.js'

/**
 * A tabela da seção 2 de contratos.md, transcrita à mão: o teste falha se o
 * código divergir do documento, que é quem manda.
 */
const TABELA_DO_CONTRATO = [
  ['alcance', 'Contas alcançadas', 'contas', ['conta', 'midia'], 'soma'],
  ['visualizacoes', 'Visualizações', 'eventos', ['conta', 'midia'], 'soma'],
  ['interacoes', 'Interações', 'eventos', ['conta', 'midia'], 'soma'],
  ['curtidas', 'Curtidas', 'eventos', ['midia'], 'soma'],
  ['comentarios', 'Comentários', 'eventos', ['midia'], 'soma'],
  ['salvamentos', 'Salvamentos', 'eventos', ['midia'], 'soma'],
  ['compartilhamentos', 'Compartilhamentos', 'eventos', ['midia'], 'soma'],
  ['seguidores', 'Seguidores', 'contas', ['conta'], 'ultimo'],
  ['visitas_ao_perfil', 'Visitas ao perfil', 'eventos', ['conta'], 'soma'],
  ['publicacoes', 'Publicações', 'publicacoes', ['conta'], 'soma'],
]

describe('METRICAS', () => {
  it('tem exatamente os dez códigos do contrato', () => {
    expect(Object.keys(METRICAS)).toEqual(TABELA_DO_CONTRATO.map(([codigo]) => codigo))
  })

  it.each(TABELA_DO_CONTRATO)(
    '%s bate com o contrato em rótulo, unidade, escopos e agregação',
    (codigo, rotulo, unidade, escopos, agregacao) => {
      expect(METRICAS[codigo]).toMatchObject({ codigo, rotulo, unidade, agregacao })
      expect([...METRICAS[codigo].escopos]).toEqual(escopos)
    },
  )

  it('não nasce com nenhuma métrica descontinuada', () => {
    for (const metrica of Object.values(METRICAS)) expect(metrica.descontinuadaEm).toBeNull()
  })

  it('dá rótulo curto a toda métrica', () => {
    for (const metrica of Object.values(METRICAS)) {
      expect(metrica.rotuloCurto.length).toBeGreaterThan(0)
      expect(metrica.rotuloCurto.length).toBeLessThanOrEqual(metrica.rotulo.length)
    }
  })

  it('não expõe nome da Meta como código', () => {
    for (const nomeDaMeta of ['reach', 'views', 'impressions', 'saved', 'follower_count']) {
      expect(metricaExiste(nomeDaMeta)).toBe(false)
    }
  })

  it('é imutável, inclusive na lista de escopos', () => {
    expect(Object.isFrozen(METRICAS)).toBe(true)
    expect(Object.isFrozen(METRICAS.alcance)).toBe(true)
    expect(Object.isFrozen(METRICAS.alcance.escopos)).toBe(true)
    expect(() => {
      METRICAS.alcance.escopos.push('inventado')
    }).toThrow()
  })
})

describe('limiteDeAgregacao', () => {
  it('existe só em alcance', () => {
    const comLimite = Object.values(METRICAS)
      .filter((metrica) => metrica.limiteDeAgregacao !== null)
      .map((metrica) => metrica.codigo)
    expect(comLimite).toEqual(['alcance'])
  })

  it('explica que a mesma conta é contada mais de uma vez na janela', () => {
    const frase = METRICAS.alcance.limiteDeAgregacao
    expect(frase).toMatch(/mais de uma vez/)
    expect(frase).toMatch(/alcance único de período longo/)
  })
})

describe('METRICAS_DE_CONTA e METRICAS_DE_MIDIA', () => {
  it('listam os códigos de cada escopo', () => {
    expect([...METRICAS_DE_CONTA]).toEqual([
      'alcance',
      'visualizacoes',
      'interacoes',
      'seguidores',
      'visitas_ao_perfil',
      'publicacoes',
    ])
    expect([...METRICAS_DE_MIDIA]).toEqual([
      'alcance',
      'visualizacoes',
      'interacoes',
      'curtidas',
      'comentarios',
      'salvamentos',
      'compartilhamentos',
    ])
  })

  it('não deixam métrica de um escopo aparecer no outro', () => {
    expect(METRICAS_DE_CONTA).not.toContain('curtidas')
    expect(METRICAS_DE_MIDIA).not.toContain('seguidores')
    expect(METRICAS_DE_MIDIA).not.toContain('publicacoes')
  })
})

describe('obterMetrica', () => {
  it('devolve a definição do código canônico', () => {
    expect(obterMetrica('seguidores').rotulo).toBe('Seguidores')
  })

  it('lança em código desconhecido: é defeito de programação, não dado do usuário', () => {
    expect(() => obterMetrica('reach')).toThrow(/Métrica desconhecida: reach/)
    expect(() => obterMetrica(undefined)).toThrow(/Métrica desconhecida/)
  })
})

describe('agregar', () => {
  it('soma o que é fluxo', () => {
    expect(agregar('alcance', [5200, 4400, 4100])).toBe(13700)
    expect(agregar('visitas_ao_perfil', [520, 440])).toBe(960)
  })

  it('não soma seguidores: estoque vale o último saldo da janela', () => {
    expect(agregar('seguidores', [6168, 6172, 6175, 6177])).toBe(6177)
  })

  it.each(Object.values(METRICAS).map((metrica) => [metrica.codigo, metrica.agregacao]))(
    '%s agrega [10, 20, 30] conforme a agregação declarada (%s)',
    (codigo, agregacao) => {
      // Percorrer o dicionário em vez de citar códigos deixa o teste cobrir
      // sozinho a métrica que adotar 'media' amanhã.
      const esperado = { soma: 60, ultimo: 30, media: 20 }[agregacao]
      expect(esperado).toBeDefined()
      expect(agregar(codigo, [10, 20, 30])).toBe(esperado)
    },
  )

  it('devolve null sem leitura válida: ausência é lacuna, não zero', () => {
    expect(agregar('alcance', [])).toBeNull()
    expect(agregar('alcance', undefined)).toBeNull()
    expect(agregar('seguidores', [null, 'muitos'])).toBeNull()
  })

  it('descarta valor não numérico em vez de tratá-lo como zero', () => {
    expect(agregar('alcance', [100, null, 'x', NaN, 50])).toBe(150)
    expect(agregar('seguidores', [6100, 6200, undefined])).toBe(6200)
  })

  it('lança em código desconhecido', () => {
    expect(() => agregar('impressions', [1])).toThrow(/Métrica desconhecida/)
  })
})

describe('porta de entrada do módulo', () => {
  it('reexporta dicionário, formatação e adaptadores num único ponto', () => {
    const esperados = [
      'METRICAS',
      'METRICAS_DE_CONTA',
      'METRICAS_DE_MIDIA',
      'obterMetrica',
      'metricaExiste',
      'agregar',
      'formatarNumero',
      'formatarValorDeMetrica',
      'formatarVariacao',
      'formatarPeriodo',
      'formatarDataCurta',
      'LIMIAR_DE_ESTABILIDADE',
      'SEM_VALOR',
      'ADAPTADORES',
      'VERSAO_VIGENTE',
      'adaptadorVigente',
      'adaptadorPorVersao',
    ]
    for (const nome of esperados) expect(metricas[nome]).toBeDefined()
    expect(metricas.obterMetrica).toBe(obterMetrica)
  })
})
