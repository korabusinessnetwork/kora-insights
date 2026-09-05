import { describe, expect, it } from 'vitest'

import {
  AGORA,
  CONTAS,
  EVENTOS_DE_COLETA,
  SNAPSHOTS_CONTA,
  SNAPSHOTS_MIDIA,
} from '../fixtures/estudioVergara.js'
import ruleset from '../rules/index.js'
import { montarHistorico } from './historico.js'
import { CATALOGO_DE_LIMITES, gerarDiagnostico } from './motor.js'

/** @param {number} indice @returns {object} Historico */
function historicoDaFixture(indice) {
  return montarHistorico({
    conta: CONTAS[indice],
    snapshotsConta: SNAPSHOTS_CONTA,
    snapshotsMidia: SNAPSHOTS_MIDIA,
    eventosDeColeta: EVENTOS_DE_COLETA,
    ate: AGORA,
  })
}

const contexto = { agora: AGORA }

describe('gerarDiagnostico — relogio injetado', () => {
  it('recusa rodar sem contexto.agora, em vez de ler o relogio do processo', () => {
    expect(() => gerarDiagnostico(historicoDaFixture(0), ruleset, {})).toThrow(/agora/)
  })

  it('carimba geradoEm com o instante recebido', () => {
    expect(gerarDiagnostico(historicoDaFixture(0), ruleset, contexto).geradoEm).toBe(AGORA)
  })
})

describe('gerarDiagnostico — determinismo', () => {
  it('duas chamadas com a mesma entrada devolvem o mesmo id e o mesmo conteudo', () => {
    const primeiro = gerarDiagnostico(historicoDaFixture(0), ruleset, contexto)
    const segundo = gerarDiagnostico(historicoDaFixture(0), ruleset, contexto)
    expect(primeiro.id).toBe(segundo.id)
    expect(primeiro).toEqual(segundo)
  })

  it('o id e derivado de conta, periodo e versao do ruleset', () => {
    const diagnostico = gerarDiagnostico(historicoDaFixture(0), ruleset, contexto)
    expect(diagnostico.id).toBe('diag:conta-casa-oliveira:2026-05-11:2026-08-30:0.3.0')
    expect(diagnostico.periodo).toEqual({ inicio: '2026-05-11', fim: '2026-08-30' })
  })

  it('ruleset novo gera registro novo, sem reescrever o id do antigo', () => {
    const antigo = gerarDiagnostico(historicoDaFixture(0), ruleset, contexto)
    const novo = gerarDiagnostico(
      historicoDaFixture(0),
      { versao: '0.4.0', regras: ruleset.regras },
      contexto,
    )
    expect(novo.id).not.toBe(antigo.id)
    expect(novo.rulesetVersion).toBe('0.4.0')
  })
})

describe('gerarDiagnostico — Casa Oliveira', () => {
  const diagnostico = gerarDiagnostico(historicoDaFixture(0), ruleset, contexto)

  it('ordena os achados por peso decrescente', () => {
    expect(diagnostico.achados.map((achado) => achado.regra)).toEqual([
      'cadencia-em-queda',
      'consistencia-de-alcance',
    ])
    expect(diagnostico.achados.map((achado) => achado.peso)).toEqual([90, 40])
  })

  it('declara cobertura suficiente, com as 16 semanas e sem lacuna', () => {
    expect(diagnostico.cobertura).toEqual({
      semanas: 16,
      primeiroDado: '2026-05-11',
      lacunas: [],
      suficiente: true,
    })
  })

  it('reune os limites das regras e os que valem sempre, sem repetir codigo', () => {
    const codigos = diagnostico.limites.map((limite) => limite.codigo)
    expect(codigos).toEqual([
      'agregacao-de-alcance',
      'sem-causa-externa',
      'dispersao-nao-explica-causa',
      'sem-trafego-pago',
      'sem-comparacao-com-concorrente',
      'story-fora-da-janela',
    ])
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('todo limite chega a tela com texto cadastrado', () => {
    for (const limite of diagnostico.limites) {
      expect(limite.texto).toBe(CATALOGO_DE_LIMITES[limite.codigo])
      expect(limite.texto.length).toBeGreaterThan(0)
    }
  })

  it('omite o limite de trafego pago quando a conta tem trafego vinculado', () => {
    const historico = historicoDaFixture(0)
    historico.recursos.temTrafegoPago = true
    const comTrafego = gerarDiagnostico(historico, ruleset, contexto)
    expect(comTrafego.limites.map((l) => l.codigo)).not.toContain('sem-trafego-pago')
  })
})

describe('gerarDiagnostico — historico curto', () => {
  it('o Studio Nove produz apenas dado-insuficiente', () => {
    const diagnostico = gerarDiagnostico(historicoDaFixture(2), ruleset, contexto)
    expect(diagnostico.achados.map((achado) => achado.regra)).toEqual(['dado-insuficiente'])
    expect(diagnostico.achados[0].severidade).toBe('indeterminado')
    expect(diagnostico.cobertura.suficiente).toBe(false)
    expect(diagnostico.cobertura.semanas).toBe(2)
  })

  it('nenhum veredito acompanha o "ainda nao sei", mesmo com regra menor disparando', () => {
    const historico = historicoDaFixture(0)
    const comIndeterminado = {
      versao: '0.3.0-teste',
      regras: [
        ...ruleset.regras,
        {
          codigo: 'regra-de-teste',
          versao: '0.3.0-teste',
          peso: 120,
          minimoDeSemanas: 0,
          avaliar: () => ({
            regra: 'regra-de-teste',
            versaoRegra: '0.3.0-teste',
            severidade: 'indeterminado',
            rotulo: 'Teste',
            frase: 'Ainda não sei.',
            apoio: '',
            acao: '',
            confirmacao: '',
            evidencias: [],
            serie: null,
            limites: [],
            peso: 120,
          }),
        },
      ],
    }
    const diagnostico = gerarDiagnostico(historico, comIndeterminado, contexto)
    expect(diagnostico.achados.map((a) => a.regra)).toEqual(['regra-de-teste'])
    expect(diagnostico.cobertura.suficiente).toBe(false)
  })

  it('a lacuna do Verdejar viaja no diagnostico e nunca some da tela', () => {
    const diagnostico = gerarDiagnostico(historicoDaFixture(1), ruleset, contexto)
    expect(diagnostico.cobertura.lacunas).toEqual([
      {
        inicio: '2026-08-10',
        fim: '2026-08-14',
        motivo: 'Token expirado: a coleta do dia não aconteceu.',
      },
    ])
  })

  it('conta sem coleta nenhuma nao quebra o motor', () => {
    const vazio = montarHistorico({
      conta: { id: 'conta-sem-coleta' },
      snapshotsConta: [],
      snapshotsMidia: [],
      eventosDeColeta: [],
      ate: AGORA,
    })
    const diagnostico = gerarDiagnostico(vazio, ruleset, contexto)
    expect(diagnostico.achados.map((a) => a.regra)).toEqual(['dado-insuficiente'])
    expect(diagnostico.periodo).toEqual({ inicio: '2026-09-05', fim: '2026-09-05' })
    expect(diagnostico.cobertura.semanas).toBe(0)
  })
})

describe('ruleset publicado', () => {
  it('expoe versao e regras conforme o contrato', () => {
    expect(ruleset.versao).toBe('0.3.0')
    expect(ruleset.regras.map((regra) => regra.codigo)).toEqual([
      'dado-insuficiente',
      'cadencia-em-queda',
      'formato-que-salva',
      'consistencia-de-alcance',
    ])
  })

  it('toda regra declara peso, minimo e uma avaliacao pura', () => {
    for (const regra of ruleset.regras) {
      expect(typeof regra.peso).toBe('number')
      expect(typeof regra.minimoDeSemanas).toBe('number')
      expect(typeof regra.avaliar).toBe('function')
      expect(regra.versao).toBe('0.3.0')
    }
  })
})
