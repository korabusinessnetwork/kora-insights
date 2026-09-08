/**
 * Validade do token da Meta: quando o produto renova sozinho e quando ele
 * precisa pedir socorro ao cliente.
 *
 * O token de longa duracao da Meta vive ~60 dias e pode ser trocado por outro
 * de 60 dias a qualquer momento dentro da propria validade. Quem nao troca
 * perde a conta no dia 60 — e perder a conta neste produto nao e um
 * inconveniente de operacao, e o dano central: `montarHistorico` trata dia sem
 * coleta como lacuna, uma lacuna de cinco dias custa a semana inteira de
 * comparacao (memory/learnings.md, 2026-09-06) e o ruleset exige 16 semanas
 * completas para nomear uma causa. Token vencido em silencio apaga meses de
 * caminho andado.
 *
 * Modulo puro, com relogio injetado, porque as duas pontas precisam do mesmo
 * numero: a Edge Function da coleta decide renovar, e a casca do app decide
 * avisar. Um prazo escrito duas vezes vira dois prazos no primeiro ajuste
 * (memory/patterns.md, "Um numero, uma fonte").
 */

/**
 * Quantos dias antes do vencimento a coleta troca o token sozinha.
 *
 * Quinze dias e folga deliberada: a renovacao so acontece quando a coleta roda,
 * e a coleta pode falhar por rede, por limite de taxa ou por a funcao estar
 * fora do ar. Quinze dias sao quinze tentativas antes de o problema virar do
 * cliente.
 */
export const DIAS_PARA_RENOVAR = 15

/**
 * Quantos dias antes do vencimento a tela passa a pedir reconexao.
 *
 * Sete e menor que {@link DIAS_PARA_RENOVAR} de proposito: se o aviso aparecer,
 * e porque a renovacao automatica ja teve mais de uma semana de tentativas e
 * nao deu conta. O aviso e o ultimo recurso, nao a rotina — e por isso ele pode
 * ser alarmante sem virar ruido.
 */
export const DIAS_PARA_AVISAR = 7

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Status de conta que nao rende aviso de reconexao.
 *
 * Conta desconectada foi o cliente que desligou: avisar que a conexao dele vai
 * vencer e responder uma pergunta que ele nao fez. Conta pausada continua
 * avisando — a pausa e temporaria e o token vencido a torna definitiva.
 */
const SEM_AVISO = new Set(['desconectada'])

/**
 * Quantos dias inteiros faltam para o token vencer.
 *
 * @param {string|null|undefined} expiraEm vencimento em ISO, ou nulo
 * @param {Date|string} agora relogio injetado
 * @returns {number|null} dias restantes (negativo quando ja venceu), ou `null`
 *   quando nao ha vencimento conhecido
 */
export function diasAteVencer(expiraEm, agora) {
  if (typeof expiraEm !== 'string' || expiraEm.length === 0) return null

  const vencimento = new Date(expiraEm).getTime()
  const referencia = new Date(agora).getTime()
  if (!Number.isFinite(vencimento) || !Number.isFinite(referencia)) return null

  return Math.floor((vencimento - referencia) / MS_POR_DIA)
}

/**
 * A coleta deve trocar este token agora?
 *
 * Vencimento nulo devolve `false`, e isso e regra da Meta, nao descuido: a
 * Graph API omite `expires_in` justamente nos tokens que nao expiram. Tratar
 * "nao expira" como "expirou" gastaria uma chamada por conta por dia para
 * renovar o que nao precisa.
 *
 * @param {{ tokenExpiraEm?: string|null }} conta conta conectada
 * @param {Date|string} agora relogio injetado
 * @returns {boolean}
 */
export function precisaRenovar(conta, agora) {
  const dias = diasAteVencer(conta?.tokenExpiraEm, agora)
  return dias !== null && dias <= DIAS_PARA_RENOVAR
}

/**
 * Frase de quanto tempo resta, do jeito que se fala.
 *
 * @param {number} dias dias restantes, nunca negativo
 * @returns {string}
 */
function prazoPorExtenso(dias) {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/**
 * @typedef {object} AvisoDeReconexao
 * @property {string} contaId
 * @property {string} nome nome da conta, como o cliente a chama
 * @property {string} username o @ da conta
 * @property {'vencido'|'vencendo'} estado
 * @property {number|null} diasRestantes negativo quando ja passou do prazo
 * @property {string} titulo manchete curta
 * @property {string} texto o que aconteceu e o que fazer
 */

/**
 * As contas do tenant que precisam de reconexao, mais urgente primeiro.
 *
 * A varredura e do tenant inteiro, e nao so da conta aberta: uma conta perde
 * dias de historico esteja ou nao na tela, e quem descobre depois nao recupera
 * o que passou.
 *
 * `token_expirado` e vencimento no passado dao o mesmo aviso de proposito. Os
 * dois dizem a mesma coisa ao cliente, e sao momentos diferentes so por dentro:
 * o status muda quando uma coleta falha, entao entre o vencimento e a primeira
 * falha existe uma janela em que o relogio ja sabe e o banco ainda nao.
 *
 * @param {Array<{ id: string, nome: string, username: string, status?: string,
 *   tokenExpiraEm?: string|null }>} contas contas conectadas do tenant
 * @param {Date|string} agora relogio injetado
 * @returns {AvisoDeReconexao[]}
 */
export function avisosDeReconexao(contas, agora) {
  if (!Array.isArray(contas)) return []

  const avisos = []

  for (const conta of contas) {
    if (!conta || SEM_AVISO.has(conta.status)) continue

    const dias = diasAteVencer(conta.tokenExpiraEm, agora)
    // `dias < 0`, e nao `<= 0`: zero e o ultimo dia de token valido, porque a
    // contagem arredonda para baixo. Chamar de vencido quem ainda tem doze
    // horas seria a tela anunciando uma coleta parada que nao parou.
    const venceu = conta.status === 'token_expirado' || (dias !== null && dias < 0)
    const vencendo = !venceu && dias !== null && dias <= DIAS_PARA_AVISAR
    if (!venceu && !vencendo) continue

    const arroba = `@${conta.username}`
    avisos.push({
      contaId: conta.id,
      nome: conta.nome,
      username: conta.username,
      estado: venceu ? 'vencido' : 'vencendo',
      diasRestantes: dias,
      titulo: venceu ? 'Coleta parada' : 'Conexão expirando',
      texto: venceu
        ? `A conexão de ${arroba} com o Instagram expirou e a coleta diária parou. ` +
          'Reconecte para voltar a registrar os dias: os que passaram não voltam.'
        : `A conexão de ${arroba} com o Instagram ${prazoPorExtenso(dias)}. ` +
          'Reconecte antes disso — sem token válido a coleta diária para, e dia ' +
          'sem coleta não volta.',
    })
  }

  // Vencido antes de vencendo, e dentro de cada grupo o prazo mais curto
  // primeiro: a lista e lida de cima para baixo e a primeira linha e a que tem
  // menos tempo de conserto.
  const peso = { vencido: 0, vencendo: 1 }
  return avisos.sort(
    (a, b) => peso[a.estado] - peso[b.estado] || (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0),
  )
}
