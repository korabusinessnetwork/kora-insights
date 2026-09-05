import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ehCodigoDeOAuth } from './validacao.js'

/**
 * O `code` do OAuth passa por dois filtros em serie: este modulo, no navegador,
 * antes de chamar; e a Edge Function, antes de trocar por token. Enquanto as
 * duas expressoes divergiram, o front barrava caractere que o servidor aceitava
 * e o cliente ficava num laco: refazer a conexao devolvia o mesmo `code` e o
 * mesmo bloqueio, sem nenhuma saida na tela.
 *
 * Nao ha como compartilhar o literal (Deno nao resolve o bundler do Vite), entao
 * o teste le os dois arquivos e cobra que a expressao seja a mesma.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NO_FRONT = readFileSync(join(RAIZ, 'src/lib/validacao.js'), 'utf8')
const NO_SERVIDOR = readFileSync(join(RAIZ, 'supabase/functions/conectar-conta/index.ts'), 'utf8')

/** @param {string} fonte @returns {string} o literal da expressao */
function expressaoDoCodigo(fonte) {
  const achado = fonte.match(/const CODIGO_DE_OAUTH = (\/.+\/)\s*$/m)
  if (!achado) throw new Error('CODIGO_DE_OAUTH nao encontrado no arquivo')
  return achado[1]
}

describe('formato do code do OAuth', () => {
  it('o front e a Edge Function usam a mesma expressao', () => {
    expect(expressaoDoCodigo(NO_FRONT)).toBe(expressaoDoCodigo(NO_SERVIDOR))
  })

  it('aceita os caracteres que a Meta realmente devolve', () => {
    expect(ehCodigoDeOAuth('AQBv-2iL_9xK.abcDEF12345')).toBe(true)
    expect(ehCodigoDeOAuth('AQD~codigo#comCerquilha1234')).toBe(true)
  })

  it('recusa o que nao e code: vazio, curto e com caractere de injecao', () => {
    expect(ehCodigoDeOAuth('')).toBe(false)
    expect(ehCodigoDeOAuth('abc')).toBe(false)
    expect(ehCodigoDeOAuth('codigo com espaco')).toBe(false)
    expect(ehCodigoDeOAuth("codigo'; drop--")).toBe(false)
    expect(ehCodigoDeOAuth(null)).toBe(false)
  })
})
