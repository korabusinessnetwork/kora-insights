import { describe, expect, it } from 'vitest'

import { ROTAS } from '../constants/rotas.js'
import { ROTAS_SEM_TELA, TELAS } from './telas.jsx'

/**
 * Este arquivo existe por causa de um defeito real, e a forma dele e resposta a
 * esse defeito.
 *
 * Autenticacao, conexao e relatorio foram construidas em paralelo, cada uma com
 * a propria suite verde, e nenhuma delas chegou a ser ligada a uma rota. A
 * suite inteira passava, o build passava, e o produto subia sem tela de entrada:
 * com Supabase configurado, ninguem conseguia entrar. Teste de peca nao pega
 * isso — so teste de juncao pega.
 */

/** Rotas do contrato que precisam de tela de feature (contratos.md, secao 6). */
const ROTAS_DE_FEATURE = [
  'entrada',
  'conexao',
  'retornoDaConexao',
  'contas',
  'diagnostico',
  'relatorio',
  'historico',
]

describe('composicao de telas', () => {
  it('toda rota do contrato tem uma entrada em TELAS', () => {
    for (const rota of ROTAS_DE_FEATURE) {
      expect(TELAS, `rota ${rota} sem tela declarada`).toHaveProperty(rota)
    }
  })

  it('nenhuma rota fora de ROTAS_SEM_TELA cai no aviso de tela ausente', () => {
    for (const [rota, elemento] of Object.entries(TELAS)) {
      if (ROTAS_SEM_TELA.includes(rota)) continue
      const titulo = elemento?.props?.titulo ?? ''
      expect(titulo, `a rota ${rota} nao esta ligada a nenhuma feature`).not.toContain(
        'ainda não foi construída',
      )
    }
  })

  it('a divida declarada em ROTAS_SEM_TELA e de verdade e esta no contrato', () => {
    for (const rota of ROTAS_SEM_TELA) {
      expect(ROTAS, `ROTAS_SEM_TELA cita ${rota}, que nao existe no contrato`).toHaveProperty(rota)
      expect(TELAS[rota]?.props?.titulo).toContain('ainda não foi construída')
    }
  })

  it('cada tela ligada e um elemento React montavel, nao um placeholder', () => {
    for (const [rota, elemento] of Object.entries(TELAS)) {
      expect(elemento, `rota ${rota}`).toBeTruthy()
      expect(typeof elemento.type, `rota ${rota}`).toMatch(/function|object|string/)
    }
  })
})
