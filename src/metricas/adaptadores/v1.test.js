import { describe, expect, it } from 'vitest'

import { METRICAS, METRICAS_DE_CONTA, METRICAS_DE_MIDIA } from '../dicionario.js'
import { ADAPTADORES, VERSAO_VIGENTE, adaptadorPorVersao, adaptadorVigente } from './index.js'
import v1, { adaptar } from './v1.js'

const DIA = '2026-08-30'

/**
 * Monta o envelope de insights da Graph API a partir de pares nome/valor.
 * @param {Array<[string, unknown]>} pares
 * @returns {{ data: object[] }}
 */
function envelope(pares) {
  return {
    data: pares.map(([name, value]) => ({
      name,
      period: 'day',
      values: [{ value, end_time: '2026-08-31T07:00:00+0000' }],
    })),
  }
}

/** @param {{ leituras: object[] }} resultado */
function porMetrica(resultado) {
  return Object.fromEntries(resultado.leituras.map(({ metrica, valor }) => [metrica, valor]))
}

describe('identidade do adaptador', () => {
  it('declara versão e versão de API, e é imutável', () => {
    expect(v1).toMatchObject({ versao: '1.0.0', apiVersion: 'v23.0' })
    expect(typeof v1.adaptar).toBe('function')
    expect(Object.isFrozen(v1)).toBe(true)
  })
})

describe('adaptar — escopo de conta', () => {
  it('traduz todo o mapeamento de conta', () => {
    const resultado = adaptar(
      envelope([
        ['reach', 26900],
        ['views', 43000],
        ['total_interactions', 410],
        ['profile_views', 170],
        ['follower_count', 6176],
      ]),
      'conta',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({
      alcance: 26900,
      visualizacoes: 43000,
      interacoes: 410,
      visitas_ao_perfil: 170,
      seguidores: 6176,
    })
    expect(resultado.ignoradas).toEqual([])
  })

  it('aceita impressions como grafia antiga de visualizações', () => {
    const resultado = adaptar(envelope([['impressions', 43000]]), 'conta', DIA)
    expect(porMetrica(resultado)).toEqual({ visualizacoes: 43000 })
  })

  it('aceita followers_count além de follower_count', () => {
    const resultado = adaptar(envelope([['followers_count', 6176]]), 'conta', DIA)
    expect(porMetrica(resultado)).toEqual({ seguidores: 6176 })
  })

  it('lê o total_value das métricas novas da Graph API', () => {
    const payload = {
      data: [{ name: 'total_interactions', period: 'day', total_value: { value: 410 } }],
    }
    expect(porMetrica(adaptar(payload, 'conta', DIA))).toEqual({ interacoes: 410 })
  })

  it('usa a última leitura da série, que é a mais recente da janela', () => {
    const payload = {
      data: [
        {
          name: 'reach',
          period: 'day',
          values: [
            { value: 5100, end_time: '2026-08-29T07:00:00+0000' },
            { value: 5300, end_time: '2026-08-30T07:00:00+0000' },
          ],
        },
      ],
    }
    expect(porMetrica(adaptar(payload, 'conta', DIA))).toEqual({ alcance: 5300 })
  })

  it('carimba toda leitura com a data que a coleta informou, não com o end_time', () => {
    const resultado = adaptar(envelope([['reach', 1], ['views', 2]]), 'conta', DIA)
    for (const leitura of resultado.leituras) expect(leitura.data).toBe(DIA)
  })

  it('não inventa publicações: métrica derivada não tem adaptador', () => {
    const resultado = adaptar(envelope([['media_count', 3]]), 'conta', DIA)
    expect(resultado.leituras).toEqual([])
    expect(resultado.ignoradas).toEqual(['media_count (desconhecida no escopo conta)'])
  })
})

describe('adaptar — escopo de mídia', () => {
  it('traduz todo o mapeamento de mídia vindo do envelope de insights', () => {
    const resultado = adaptar(
      envelope([
        ['reach', 2240],
        ['views', 3400],
        ['saved', 63],
        ['shares', 25],
        ['likes', 139],
        ['comments', 13],
        ['total_interactions', 240],
      ]),
      'midia',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({
      alcance: 2240,
      visualizacoes: 3400,
      salvamentos: 63,
      compartilhamentos: 25,
      curtidas: 139,
      comentarios: 13,
      interacoes: 240,
    })
    expect(resultado.ignoradas).toEqual([])
  })

  it('traduz o objeto plano de campos do nó da mídia', () => {
    const resultado = adaptar(
      { id: '17900000000000001', like_count: 139, comments_count: 13, media_product_type: 'REELS' },
      'midia',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({ curtidas: 139, comentarios: 13 })
    expect(resultado.ignoradas).toEqual([
      'id (desconhecida no escopo midia)',
      'media_product_type (desconhecida no escopo midia)',
    ])
  })

  it('lê insights aninhado no nó da mídia', () => {
    const resultado = adaptar(
      {
        like_count: 139,
        insights: {
          data: [
            { name: 'reach', period: 'lifetime', values: [{ value: 2240 }] },
            { name: 'saved', period: 'lifetime', values: [{ value: 63 }] },
          ],
        },
      },
      'midia',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({ curtidas: 139, alcance: 2240, salvamentos: 63 })
    expect(resultado.ignoradas).toEqual([])
  })

  it('não aceita métrica que só existe no escopo de conta', () => {
    const resultado = adaptar(envelope([['profile_views', 170]]), 'midia', DIA)
    expect(resultado.leituras).toEqual([])
    expect(resultado.ignoradas).toEqual(['profile_views (desconhecida no escopo midia)'])
  })
})

describe('adaptar — o que não vira leitura', () => {
  it('manda métrica desconhecida para ignoradas em vez de criar coluna nova', () => {
    const payload = {
      data: [
        { name: 'reach', period: 'day', values: [{ value: 5300 }] },
        { name: 'audience_city', period: 'lifetime', values: [{ value: { 'São Paulo': 12 } }] },
        { name: 'threads_likes', period: 'day', values: [{ value: 9 }] },
      ],
    }
    const resultado = adaptar(payload, 'conta', DIA)

    expect(porMetrica(resultado)).toEqual({ alcance: 5300 })
    expect(resultado.ignoradas).toEqual([
      'audience_city (desconhecida no escopo conta)',
      'threads_likes (desconhecida no escopo conta)',
    ])
  })

  it('recusa valor não numérico: dado inválido não pode virar zero silencioso', () => {
    const payload = {
      data: [
        { name: 'reach', period: 'day', values: [{ value: null }] },
        { name: 'views', period: 'day', values: [{ value: '43000' }] },
        { name: 'profile_views', period: 'day', values: [] },
        { name: 'total_interactions', period: 'day' },
      ],
    }
    const resultado = adaptar(payload, 'conta', DIA)

    expect(resultado.leituras).toEqual([])
    expect(resultado.ignoradas).toEqual([
      'reach (sem valor numérico)',
      'views (sem valor numérico)',
      'profile_views (sem valor numérico)',
      'total_interactions (sem valor numérico)',
    ])
  })

  it('dá o código a quem preencheu primeiro e registra o motivo da segunda', () => {
    const resultado = adaptar(
      envelope([
        ['views', 43000],
        ['impressions', 51000],
      ]),
      'conta',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({ visualizacoes: 43000 })
    expect(resultado.ignoradas).toEqual(['impressions (visualizacoes já preenchido por views)'])
  })

  it('resolve a duplicata pela ordem de chegada, não pelo nome', () => {
    const resultado = adaptar(
      envelope([
        ['impressions', 51000],
        ['views', 43000],
      ]),
      'conta',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({ visualizacoes: 51000 })
    expect(resultado.ignoradas).toEqual(['views (visualizacoes já preenchido por impressions)'])
  })

  it('trata follower_count e followers_count como a mesma duplicata', () => {
    const resultado = adaptar(
      envelope([
        ['follower_count', 6176],
        ['followers_count', 6176],
      ]),
      'conta',
      DIA,
    )

    expect(porMetrica(resultado)).toEqual({ seguidores: 6176 })
    expect(resultado.ignoradas).toEqual([
      'followers_count (seguidores já preenchido por follower_count)',
    ])
  })

  it('não deixa chave de protótipo virar código canônico', () => {
    const resultado = adaptar({ constructor: 1, toString: 2 }, 'midia', DIA)
    expect(resultado.leituras).toEqual([])
    expect(resultado.ignoradas).toHaveLength(2)
  })

  it('devolve resultado vazio para payload vazio, nulo ou sem forma conhecida', () => {
    for (const payload of [null, undefined, {}, { data: [] }, 'texto']) {
      expect(adaptar(payload, 'conta', DIA)).toEqual({ leituras: [], ignoradas: [] })
    }
  })

  it('registra entrada de insights sem nome', () => {
    const resultado = adaptar({ data: [{ period: 'day', values: [{ value: 1 }] }] }, 'conta', DIA)
    expect(resultado.ignoradas).toEqual(['(entrada sem nome)'])
  })
})

describe('adaptar — entradas que são defeito de programação', () => {
  it('lança em escopo inválido', () => {
    expect(() => adaptar({}, 'perfil', DIA)).toThrow(/Escopo inválido: perfil/)
    expect(() => adaptar({}, undefined, DIA)).toThrow(/Escopo inválido/)
  })

  it('lança em data fora de YYYY-MM-DD', () => {
    expect(() => adaptar({}, 'conta', '30/08/2026')).toThrow(/Data inválida/)
    expect(() => adaptar({}, 'conta', '2026-08-30T00:00:00Z')).toThrow(/Data inválida/)
    expect(() => adaptar({}, 'conta', undefined)).toThrow(/Data inválida/)
  })
})

describe('acordo com o dicionário canônico', () => {
  const codigosProduzidos = (escopo) => {
    const nomesDaMeta = [
      'reach',
      'views',
      'impressions',
      'total_interactions',
      'profile_views',
      'follower_count',
      'followers_count',
      'saved',
      'shares',
      'likes',
      'like_count',
      'comments',
      'comments_count',
    ]
    const pares = nomesDaMeta.map((nome, indice) => [nome, indice + 1])
    // Um nome por chamada: junto, o desempate por duplicata esconderia o resto.
    return pares.flatMap(([nome, valor]) =>
      adaptar(envelope([[nome, valor]]), escopo, DIA).leituras.map((l) => l.metrica),
    )
  }

  it('só produz código que existe no dicionário', () => {
    for (const escopo of ['conta', 'midia']) {
      for (const codigo of codigosProduzidos(escopo)) expect(METRICAS[codigo]).toBeDefined()
    }
  })

  it('só produz código válido para o escopo em que foi lido', () => {
    for (const codigo of codigosProduzidos('conta')) expect(METRICAS_DE_CONTA).toContain(codigo)
    for (const codigo of codigosProduzidos('midia')) expect(METRICAS_DE_MIDIA).toContain(codigo)
  })
})

describe('registro de adaptadores', () => {
  it('serve a versão vigente', () => {
    expect(VERSAO_VIGENTE).toBe('1.0.0')
    expect(adaptadorVigente()).toBe(v1)
    expect(Object.isFrozen(ADAPTADORES)).toBe(true)
  })

  it('devolve o adaptador da época a partir da versão gravada no snapshot', () => {
    expect(adaptadorPorVersao('1.0.0')).toBe(v1)
  })

  it('lança em versão inexistente: snapshot sem adaptador perdeu o significado', () => {
    expect(() => adaptadorPorVersao('9.9.9')).toThrow(/Adaptador inexistente: 9.9.9/)
    expect(() => adaptadorPorVersao(undefined)).toThrow(/Adaptador inexistente/)
  })
})
