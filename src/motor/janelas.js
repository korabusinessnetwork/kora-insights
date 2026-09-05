/**
 * Recorte de janelas de comparacao.
 *
 * A regra do produto e uma so e vale para todo este arquivo: **semana
 * incompleta nao entra em comparacao** (contratos.md, secao 3). A semana
 * corrente esta pela metade e a semana com falha de coleta tem menos dias;
 * qualquer uma das duas, somada com as outras, produz uma queda que nao
 * aconteceu — e o cliente vai a reuniao defender um problema inexistente.
 */

import { agregar, obterMetrica } from '../metricas/dicionario.js'
import { media, variacao } from './estatistica.js'

/**
 * @typedef {object} Comparacao
 * @property {number|null} atual
 * @property {number|null} anterior
 * @property {number|null} variacao
 */

/** Codigo do limite que o motor exibe quando a metrica e somada por janela. */
const LIMITE_DE_AGREGACAO = 'agregacao-de-alcance'

/**
 * As `quantidade` semanas completas mais recentes.
 *
 * Seleciona da mais recente para tras e devolve em ordem cronologica, igual a
 * `historico.semanas`: quem consome monta serie da esquerda para a direita.
 * Devolve menos que o pedido quando nao ha semanas completas suficientes — a
 * regra que chamou decide se isso a impede de opinar.
 *
 * @param {import('./historico.js').Historico} historico
 * @param {number} quantidade
 * @returns {import('./historico.js').Janela[]}
 */
export function ultimasJanelasCompletas(historico, quantidade) {
  if (quantidade <= 0) return []
  const completas = historico.semanas.filter((semana) => semana.completa)
  return completas.slice(Math.max(0, completas.length - quantidade))
}

/**
 * Valor de uma metrica de conta em um bloco de semanas, respeitando a agregacao
 * do dicionario: fluxo soma, estoque vale o ultimo saldo.
 *
 * @param {import('./historico.js').Janela[]} janelas em ordem cronologica
 * @param {string} metrica codigo canonico
 * @returns {number|null} null quando nenhuma semana do bloco tem a metrica
 */
export function valorDaJanela(janelas, metrica) {
  const valores = janelas
    .filter((janela) => metrica in janela.valores)
    .map((janela) => janela.valores[metrica])
  if (valores.length === 0) return null
  return agregar(metrica, valores)
}

/**
 * Compara dois blocos de semanas, metrica de conta a metrica de conta.
 *
 * A `variacao` devolvida aqui e a crua, sobre os valores agregados. Quem monta
 * evidencia troca por `variacaoExibida`, porque so a regra sabe com quantas
 * casas o numero vai aparecer na tela (contratos.md, secao 3).
 *
 * @param {import('./historico.js').Janela[]} recentes
 * @param {import('./historico.js').Janela[]} anteriores
 * @returns {Record<string, Comparacao>}
 */
export function compararJanelas(recentes, anteriores) {
  const metricas = new Set([
    ...recentes.flatMap((janela) => Object.keys(janela.valores)),
    ...anteriores.flatMap((janela) => Object.keys(janela.valores)),
  ])

  /** @type {Record<string, Comparacao>} */
  const comparacao = {}
  for (const metrica of [...metricas].sort()) {
    const atual = valorDaJanela(recentes, metrica)
    const anterior = valorDaJanela(anteriores, metrica)
    comparacao[metrica] = { atual, anterior, variacao: variacao(atual, anterior) }
  }
  return comparacao
}

/**
 * Media da metrica **por midia** das janelas — nao por semana.
 *
 * E assim que sai "alcance por publicacao", o numero que separa "publiquei
 * menos" de "o conteudo alcanca menos". Dividir o alcance da semana pela
 * quantidade de posts da semana e depois tirar a media das semanas daria peso
 * igual a uma semana de 1 post e a uma de 5.
 *
 * @param {import('./historico.js').Janela[]} janelas
 * @param {string} metrica codigo canonico presente nas midias
 * @returns {{ valor: number|null, publicacoes: number, limiteDeAgregacao: string|null }}
 */
export function mediaPorPublicacao(janelas, metrica) {
  const valores = janelas
    .flatMap((janela) => janela.midias)
    .map((midia) => midia.metricas[metrica])
    .filter((valor) => Number.isFinite(valor))

  return {
    valor: media(valores),
    publicacoes: valores.length,
    // Metrica de fluxo somada por janela conta duas vezes quem foi alcancado em
    // duas semanas. Quem sabe disso e o dicionario; o motor e obrigado a
    // declarar o limite na tela (ADR-003).
    limiteDeAgregacao: obterMetrica(metrica).limiteDeAgregacao ? LIMITE_DE_AGREGACAO : null,
  }
}

/**
 * Valores de uma metrica, uma entrada por midia das janelas. Base das medidas
 * de dispersao, que precisam da distribuicao e nao so do total.
 *
 * @param {import('./historico.js').Janela[]} janelas
 * @param {string} metrica
 * @returns {number[]}
 */
export function valoresPorPublicacao(janelas, metrica) {
  return janelas
    .flatMap((janela) => janela.midias)
    .map((midia) => midia.metricas[metrica])
    .filter((valor) => Number.isFinite(valor))
}
