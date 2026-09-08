/**
 * O cliente Supabase e o modo de demonstracao.
 *
 * Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas nao ha
 * backend: o produto entra em modo de demonstracao e a camada de servicos serve
 * a fixture atras do mesmo contrato (overview.md, "Modo de demonstracao").
 *
 * A chave anon e publica por definicao — ela vai no bundle e a seguranca real
 * mora na RLS. Publica nao significa gritada: nada aqui a imprime, nem em log de
 * erro, nem em mensagem de diagnostico.
 */

import { createClient } from '@supabase/supabase-js'
import { CODIGOS, erroDeServico, traduzirErroDoSupabase } from './erros.js'

/** @typedef {import('@supabase/supabase-js').SupabaseClient} ClienteSupabase */

/**
 * Cliente criado sob demanda, junto da URL que o originou.
 * @type {{ url: string, cliente: ClienteSupabase }|null}
 */
let clienteAtual = null

/**
 * Le a configuracao do ambiente. Lida a cada chamada, e nao uma vez no topo do
 * modulo, para que trocar de ambiente (ou de stub, em teste) nao dependa de
 * ordem de import.
 *
 * @returns {{ url: string, chave: string }}
 */
function configuracaoDoAmbiente() {
  const url = String(import.meta.env?.VITE_SUPABASE_URL ?? '').trim()
  const chave = String(import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '').trim()
  return { url, chave }
}

/**
 * Nao ha backend configurado, entao a camada de servicos responde pela fixture.
 * @returns {boolean}
 */
export function estaEmModoDemonstracao() {
  const { url, chave } = configuracaoDoAmbiente()
  return !url || !chave
}

/**
 * Cliente singleton, criado na primeira necessidade.
 *
 * `persistSession` e `autoRefreshToken` ficam ligados porque a sessao do
 * usuario precisa sobreviver ao refresh da pagina — e o token que nunca pode ser
 * persistido no navegador e o **da Meta**, que nem chega aqui: ele vive no Vault
 * e so a Edge Function le (docs/11_SEGURANCA).
 *
 * @returns {ClienteSupabase|null} `null` em modo de demonstracao
 */
export function obterCliente() {
  const { url, chave } = configuracaoDoAmbiente()
  if (!url || !chave) return null
  if (clienteAtual && clienteAtual.url === url) return clienteAtual.cliente

  const cliente = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  clienteAtual = { url, cliente }
  return cliente
}

/**
 * Roda uma consulta no cliente e devolve `{ data, erro }` com o erro **ja
 * traduzido** para `CODIGOS`.
 *
 * Existe para que nenhum modulo de servico precise repetir try/catch, checagem
 * de `.error` e traducao — repetir isso em nove arquivos e garantir que um deles
 * um dia esqueca e deixe a mensagem crua do banco vazar para a tela.
 *
 * Nao esta na tabela de contratos.md (secao 4) por ser peca interna da camada:
 * nenhuma tela chama esta funcao.
 *
 * @template T
 * @param {(cliente: ClienteSupabase) => PromiseLike<{ data: T, error: object|null }>} operacao
 * @returns {Promise<{ data: T|null, erro: { codigo: string, mensagem: string, detalhe?: string }|null }>}
 */
export async function executarNoSupabase(operacao) {
  const cliente = obterCliente()
  if (!cliente) {
    return {
      data: null,
      erro: erroDeServico(
        CODIGOS.FALHA_INESPERADA,
        'Modo demonstração: não há backend configurado neste ambiente.',
      ),
    }
  }

  try {
    const { data, error } = await operacao(cliente)
    if (error) return { data: null, erro: traduzirErroDoSupabase(error) }
    return { data, erro: null }
  } catch (excecao) {
    // Excecao aqui e quase sempre transporte (fetch recusado, DNS, CORS). O
    // tradutor separa isso de falha inesperada, e o payload nunca e logado.
    return { data: null, erro: traduzirErroDoSupabase(excecao) }
  }
}
