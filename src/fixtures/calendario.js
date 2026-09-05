/**
 * Utilitarios de data para fixtures e para o motor.
 *
 * Tudo aqui e puro e trabalha em `YYYY-MM-DD` no fuso UTC. Semana e ISO:
 * comeca na segunda. O produto compara janelas de semanas inteiras, entao
 * "semana" precisa ser um conceito estavel, nao "os ultimos 7 dias a partir de
 * agora" — que muda de resposta conforme a hora em que o cliente abre a tela.
 */

const DIA_EM_MS = 86400000

/** @param {string} iso `YYYY-MM-DD` @returns {number} epoch ms em UTC */
function paraEpoch(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return Date.UTC(ano, mes - 1, dia)
}

/** @param {number} epoch @returns {string} `YYYY-MM-DD` */
function paraIso(epoch) {
  return new Date(epoch).toISOString().slice(0, 10)
}

/**
 * @param {string} iso
 * @param {number} dias pode ser negativo
 * @returns {string} `YYYY-MM-DD`
 */
export function somarDias(iso, dias) {
  return paraIso(paraEpoch(iso) + dias * DIA_EM_MS)
}

/**
 * @param {string} inicio
 * @param {string} fim
 * @returns {number} diferenca em dias (fim - inicio)
 */
export function diferencaEmDias(inicio, fim) {
  return Math.round((paraEpoch(fim) - paraEpoch(inicio)) / DIA_EM_MS)
}

/**
 * Segunda-feira da semana ISO que contem a data.
 * @param {string} iso
 * @returns {string}
 */
export function segundaDaSemana(iso) {
  const data = new Date(paraEpoch(iso))
  const diaDaSemana = data.getUTCDay() // 0 = domingo
  const deslocamento = diaDaSemana === 0 ? -6 : 1 - diaDaSemana
  return somarDias(iso, deslocamento)
}

/**
 * Lista de dias de uma semana, a partir da segunda.
 * @param {string} segunda
 * @returns {string[]} 7 datas
 */
export function diasDaSemana(segunda) {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
}

/**
 * Distribui um total inteiro por N dias sem perder nem inventar unidade:
 * o resto cai nos primeiros dias. A soma dos dias devolve exatamente o total,
 * que e o que mantem o numero da tela igual ao numero do banco.
 *
 * @param {number} total
 * @param {number} partes
 * @returns {number[]}
 */
export function distribuir(total, partes) {
  const base = Math.floor(total / partes)
  const resto = total - base * partes
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0))
}
