/**
 * Quando este diagnostico foi gerado — e o que dizer quando ele parou de ser
 * refeito.
 *
 * O relatorio carimba a data e o historico data cada linha; a tela de
 * diagnostico, que e a que o cliente le em voz alta numa reuniao, nao dizia
 * nada. A assimetria tem consequencia: `gerar-diagnostico` falhando por conta
 * so vai para o log (`docs/07_APIS/edge-functions.md`, secao 5) e nao vira
 * evento de coleta — de proposito, porque `montarHistorico` traduziria isso em
 * lacuna e lacuna inventada e tao desonesta quanto lacuna escondida. O efeito
 * colateral e que a tela continuava mostrando o veredito antigo sem sinal
 * nenhum de que ele envelheceu.
 *
 * O que este modulo produz **nao** e um julgamento sobre a conta: e sobre a
 * nossa propria operacao. Por isso ele nao vive em `src/rules` e nao entra em
 * `achados` — a frase que o cliente repete continua saindo so do ruleset
 * (ADR-005).
 *
 * Puro, com relogio injetado, como todo o resto de `src/motor`.
 */

import { formatarDataCurta } from '../metricas/formatar.js'

/**
 * A partir de quantos dias uma leitura deixa de ser corrente.
 *
 * Dois, e o numero sai do agendamento, nao do gosto: `gerar-diagnostico` roda
 * todo dia (`supabase/migrations/20260905120200_agendamento_da_coleta.sql`), e
 * o `id` do diagnostico e deterministico — rodar de novo no mesmo periodo cai na
 * mesma linha e refaz `gerado_em`. Com a rotina de pe, `gerado_em` tem menos de
 * um dia. Dois cobre a folga de fuso e a execucao que atrasou; a partir dai,
 * pelo menos uma rodada faltou.
 */
export const DIAS_ATE_ENVELHECER = 2

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * @typedef {object} Frescor
 * @property {number} diasDesde dias inteiros desde a geracao
 * @property {boolean} envelhecido a rotina diaria deixou de rodar
 * @property {string} rotulo a data da geracao, sempre visivel
 * @property {string|null} aviso o que a idade significa, quando significa algo
 */

/**
 * Ha quantos dias esta leitura foi feita, e o que isso quer dizer.
 *
 * @param {{ geradoEm?: string|null }|null|undefined} diagnostico
 * @param {Date|string} agora relogio injetado
 * @returns {Frescor|null} `null` quando nao ha data de geracao para afirmar
 */
export function frescorDoDiagnostico(diagnostico, agora) {
  const geradoEm = diagnostico?.geradoEm
  if (typeof geradoEm !== 'string' || geradoEm.length === 0) return null

  const feitoEm = new Date(geradoEm).getTime()
  const referencia = new Date(agora).getTime()
  if (!Number.isFinite(feitoEm) || !Number.isFinite(referencia)) return null

  // Leitura com data no futuro so acontece com relogio errado de um dos lados.
  // Zero em vez de negativo: "feita ha -3 dias" nao quer dizer nada para quem le.
  const diasDesde = Math.max(0, Math.floor((referencia - feitoEm) / MS_POR_DIA))
  const envelhecido = diasDesde > DIAS_ATE_ENVELHECER

  return {
    diasDesde,
    envelhecido,
    // "Gerado em", a mesma palavra da folha do relatorio. Nao e detalhe de
    // estilo: a tela ja anuncia "8 semanas ate 30 de agosto", que e o periodo
    // dos DADOS, e um segundo rotulo de data ao lado dele precisa dizer sozinho
    // que fala de outra coisa. "Leitura de 5 de setembro" convidava a ler como
    // "os dados vao ate 5 de setembro" — a terceira janela do mesmo diagnostico,
    // que este produto ja teve uma vez (memory/learnings.md, 2026-09-06).
    rotulo: `Gerado em ${formatarDataCurta(geradoEm)}`,
    // A frase diz o que sabemos e para no que nao sabemos. O veredito continua
    // valendo para a janela que ele comparou — o que falta e o que aconteceu
    // desde entao. Afirmar que a leitura "esta errada" seria inventar.
    aviso: envelhecido
      ? `Este diagnóstico foi gerado há ${diasDesde} dias e não foi refeito ` +
        'desde então. O que está na tela continua valendo para o período que ' +
        'ele compara, mas não inclui o que aconteceu depois. Normalmente ele é ' +
        'refeito todo dia: se parou, o problema é do nosso lado, não do seu.'
      : null,
  }
}
