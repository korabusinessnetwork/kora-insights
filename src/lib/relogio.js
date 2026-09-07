/**
 * Que horas sao, para o dado que esta na tela.
 *
 * Parece pergunta de uma resposta so, e nao e. Em modo de demonstracao os dados
 * vem de uma fixture congelada em `AGORA` (ADR-007, e fixture deterministica em
 * memory/patterns.md): comparar aquela serie com o relogio da maquina cria duas
 * verdades na mesma tela, e a segunda passa a mentir sozinha com o tempo — a
 * demonstracao anunciaria "coleta parada" em contas de exemplo assim que o
 * calendario passasse do vencimento escrito na fixture.
 *
 * Por isso o relogio entra pela camada de servicos, junto com o dado que ele
 * mede. Regra e motor continuam recebendo o instante por parametro; quem chama
 * e que precisa saber de onde tirar esse instante.
 */

import { AGORA } from '../fixtures/estudioVergara.js'
import { estaEmModoDemonstracao } from './supabase.js'

/**
 * O instante que vale para os dados que o produto esta mostrando.
 *
 * @returns {Date} o relogio da maquina, ou o instante congelado da demonstracao
 */
export function agoraDoProduto() {
  return estaEmModoDemonstracao() ? new Date(AGORA) : new Date()
}
