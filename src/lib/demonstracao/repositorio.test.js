/**
 * A demonstracao e o que a call de venda e o screencast do App Review mostram.
 * Dois riscos ela corre, e os dois estao testados aqui:
 *
 * 1. Virar tela de texto fixo. O diagnostico daqui tem que sair do motor real
 *    sobre a serie real da fixture (ADR-005) — por isso um dos testes recalcula
 *    o diagnostico do zero e exige igualdade.
 * 2. Devolver forma diferente da que o Supabase devolveria. Se a linha daqui nao
 *    for snake_case como a do banco, o conversor de cada modulo de servico deixa
 *    de rodar nos dois caminhos e a regra de negocio se duplica.
 */

import { describe, expect, it } from 'vitest'
import { AGORA, CONTAS, TENANT } from '../../fixtures/estudioVergara.js'
import { gerarDiagnostico } from '../../motor/motor.js'
import { regras, versao } from '../../rules/index.js'
import * as repositorio from './repositorio.js'

const CASA_OLIVEIRA = 'conta-casa-oliveira'
const VERDEJAR = 'conta-verdejar'
const STUDIO_NOVE = 'conta-studio-nove'

/** Campos que a linha precisa ter para o conversor da camada funcionar. */
const CAMPOS_DA_CONTA = ['id', 'tenant_id', 'ig_user_id', 'username', 'nome', 'fb_page_id']

describe('tenant e contas', () => {
  it('serve o único tenant da fixture', () => {
    expect(repositorio.listarTenants()).toEqual([TENANT])
    expect(repositorio.obterTenant(TENANT.id)?.nome).toBe('Estúdio Vergara')
    expect(repositorio.obterTenant('tenant-de-outra-agencia')).toBeNull()
  })

  it('devolve as três contas do Estúdio Vergara', () => {
    const contas = repositorio.listarContas(TENANT.id)

    expect(contas).toHaveLength(3)
    expect(contas.map((conta) => conta.id)).toEqual([CASA_OLIVEIRA, VERDEJAR, STUDIO_NOVE])
    expect(contas.map((conta) => conta.nome)).toEqual([
      'Casa Oliveira',
      'Verdejar Plantas',
      'Studio Nove',
    ])
  })

  it('não devolve conta de outro tenant: isolamento vale também na demonstração', () => {
    expect(repositorio.listarContas('tenant-de-outra-agencia')).toEqual([])
  })

  it('entrega a linha em snake_case, como o banco entregaria', () => {
    const conta = repositorio.obterConta(CASA_OLIVEIRA)

    for (const campo of CAMPOS_DA_CONTA) {
      expect(conta).toHaveProperty(campo)
    }
    expect(conta).toEqual(CONTAS[0])
  })

  it('devolve nulo para conta que não existe', () => {
    expect(repositorio.obterConta('conta-inexistente')).toBeNull()
  })

  it('não expõe token_ref em nenhuma conta', () => {
    for (const conta of repositorio.listarContas(TENANT.id)) {
      expect(conta).not.toHaveProperty('token_ref')
    }
  })
})

describe('histórico', () => {
  it('monta 16 semanas completas para a Casa Oliveira', () => {
    const historico = repositorio.obterHistorico(CASA_OLIVEIRA)

    expect(historico.contaId).toBe(CASA_OLIVEIRA)
    expect(historico.semanas.filter((semana) => semana.completa)).toHaveLength(16)
    expect(historico.primeiroDado).toBe('2026-05-11')
  })

  it('não conta a semana corrente como completa: ela está pela metade', () => {
    const { semanas } = repositorio.obterHistorico(CASA_OLIVEIRA)

    expect(semanas[semanas.length - 1].completa).toBe(false)
  })

  it('memoiza: navegar entre telas não recomputa 16 semanas de série', () => {
    expect(repositorio.obterHistorico(CASA_OLIVEIRA)).toBe(repositorio.obterHistorico(CASA_OLIVEIRA))
  })

  it('devolve nulo para conta que não existe', () => {
    expect(repositorio.obterHistorico('conta-inexistente')).toBeNull()
  })
})

describe('diagnóstico da Casa Oliveira', () => {
  it('tem achados e nomeia a causa', () => {
    const diagnostico = repositorio.obterDiagnostico(CASA_OLIVEIRA)

    expect(diagnostico.achados.length).toBeGreaterThan(0)
    expect(diagnostico.achados[0].severidade).not.toBe('indeterminado')
    expect(diagnostico.achados[0].frase).toBeTruthy()
    expect(diagnostico.cobertura.suficiente).toBe(true)
  })

  it('sai do motor real, e não de veredito escrito à mão (ADR-005)', () => {
    // Recalcula do zero, pelo mesmo caminho do servidor. Se alguem um dia trocar
    // o motor por texto fixo para "melhorar a demonstracao", este teste cai.
    const esperado = gerarDiagnostico(repositorio.obterHistorico(CASA_OLIVEIRA), { versao, regras }, {
      agora: AGORA,
    })

    expect(repositorio.obterDiagnostico(CASA_OLIVEIRA)).toEqual(esperado)
  })

  it('carrega a versão do ruleset que o gerou', () => {
    const diagnostico = repositorio.obterDiagnostico(CASA_OLIVEIRA)

    expect(diagnostico.rulesetVersion).toBe(versao)
    expect(diagnostico.id).toContain(versao)
  })

  it('congela o relógio em AGORA: demonstração que muda por dia não é regressão', () => {
    expect(repositorio.obterDiagnostico(CASA_OLIVEIRA).geradoEm).toBe(AGORA)
  })

  it('ordena os achados por peso, do maior para o menor', () => {
    const pesos = repositorio.obterDiagnostico(CASA_OLIVEIRA).achados.map((achado) => achado.peso)

    expect(pesos).toEqual([...pesos].sort((a, b) => b - a))
  })

  it('cada achado traz veredito, apoio, ação, confirmação e limites', () => {
    for (const achado of repositorio.obterDiagnostico(CASA_OLIVEIRA).achados) {
      expect(typeof achado.frase).toBe('string')
      expect(typeof achado.apoio).toBe('string')
      expect(typeof achado.acao).toBe('string')
      expect(typeof achado.confirmacao).toBe('string')
      expect(Array.isArray(achado.evidencias)).toBe(true)
      expect(Array.isArray(achado.limites)).toBe(true)
    }
  })

  it('lista os limites da conta: o que o diagnóstico não sabe não some da tela', () => {
    const { limites } = repositorio.obterDiagnostico(CASA_OLIVEIRA)

    expect(limites.length).toBeGreaterThan(0)
    for (const limite of limites) {
      expect(limite.codigo).toBeTruthy()
      expect(limite.texto).toBeTruthy()
    }
  })

  it('memoiza o diagnóstico junto com o histórico', () => {
    expect(repositorio.obterDiagnostico(CASA_OLIVEIRA)).toBe(
      repositorio.obterDiagnostico(CASA_OLIVEIRA),
    )
  })
})

describe('as outras duas contas cobrem os outros desfechos', () => {
  it('Studio Nove: histórico curto, sem veredito inventado', () => {
    const diagnostico = repositorio.obterDiagnostico(STUDIO_NOVE)

    expect(diagnostico.cobertura.suficiente).toBe(false)
    expect(diagnostico.achados).toHaveLength(1)
    expect(diagnostico.achados[0].severidade).toBe('indeterminado')
  })

  it('Verdejar: a lacuna de coleta aparece na cobertura (ADR-004)', () => {
    const { cobertura } = repositorio.obterDiagnostico(VERDEJAR)

    expect(cobertura.lacunas).toHaveLength(1)
    expect(cobertura.lacunas[0]).toMatchObject({ inicio: '2026-08-10', fim: '2026-08-14' })
    expect(cobertura.lacunas[0].motivo).toContain('Token expirado')
  })

  it('devolve nulo para conta que não existe', () => {
    expect(repositorio.obterDiagnostico('conta-inexistente')).toBeNull()
  })
})

describe('eventos de coleta', () => {
  it('registra a falha que produziu a lacuna do Verdejar', () => {
    const eventos = repositorio.listarEventos(VERDEJAR)

    expect(eventos.length).toBeGreaterThan(0)
    expect(eventos.some((evento) => evento.status === 'token_expirado')).toBe(true)
  })

  it('dá id estável a cada evento: a lista da tela precisa de chave', () => {
    const ids = repositorio.listarEventos(VERDEJAR).map((evento) => evento.id)

    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ordena do mais recente para o mais antigo', () => {
    const datas = repositorio.listarEventos(VERDEJAR).map((evento) => evento.ocorrido_em)

    expect(datas).toEqual([...datas].sort((a, b) => b.localeCompare(a)))
  })

  it('não mistura evento de outra conta', () => {
    const eventos = repositorio.listarEventos(CASA_OLIVEIRA)

    expect(eventos.every((evento) => evento.ig_conta_id === CASA_OLIVEIRA)).toBe(true)
  })
})

describe('sessaoDeDemonstracao', () => {
  it('abre a rota protegida sem backend, e sem inventar e-mail de cliente', () => {
    const sessao = repositorio.sessaoDeDemonstracao()

    expect(sessao.usuarioId).toBeTruthy()
    expect(sessao.email).toBeNull()
  })
})
