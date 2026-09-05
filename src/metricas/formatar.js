/**
 * Formatação pt-BR de número, variação e período.
 *
 * Por que sem `Intl` e sem `toLocaleString()`
 * -------------------------------------------
 * O mesmo código roda em três lugares: navegador do cliente, Deno da Edge
 * Function e Node do CI. `Intl` depende dos dados de ICU do runtime e do locale
 * de quem abre a tela — um Node sem os dados de pt-BR devolveria "26,900" e o
 * relatório do cliente sairia com o número trocado. Formatação de dinheiro do
 * cliente não pode mudar de forma conforme onde roda, então a regra pt-BR
 * (ponto de milhar, vírgula decimal) está escrita aqui, explícita e testada.
 *
 * Módulo puro, sem rede e sem DOM.
 */

import { obterMetrica } from './dicionario.js'

/**
 * Abaixo deste módulo de variação a tela diz "Estável" em vez de um número.
 *
 * O limiar é do produto, não do formatador: 3% de oscilação semanal é ruído de
 * plataforma, e chamar ruído de queda ensina o cliente a desconfiar da
 * ferramenta. O motor reusa esta constante para decidir tom e severidade — o
 * texto e a regra precisam concordar sobre o que é "estável".
 */
export const LIMIAR_DE_ESTABILIDADE = 0.05

/** O que a tela mostra no lugar de um número que não existe. Lacuna não vira zero. */
export const SEM_VALOR = '—'

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Aceita `YYYY-MM-DD` e o prefixo de um ISO completo (`2026-09-05T09:12:00Z`). */
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Quebra uma data ISO em partes, recusando o que não é dia real de calendário.
 *
 * A verificação de ida e volta pelo `Date.UTC` derruba `2026-02-31`, que passaria
 * por uma checagem de faixa e viraria "3 de março" sem ninguém perceber.
 *
 * @param {string} iso
 * @returns {{ ano: number, mes: number, dia: number }|null}
 */
function partesDaData(iso) {
  if (typeof iso !== 'string') return null

  const casamento = DATA_ISO.exec(iso)
  if (!casamento) return null

  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  const dia = Number(casamento[3])
  const carimbo = new Date(Date.UTC(ano, mes - 1, dia))
  if (carimbo.getUTCMonth() !== mes - 1 || carimbo.getUTCDate() !== dia) return null

  return { ano, mes, dia }
}

/**
 * Insere o ponto de milhar num inteiro já em texto.
 * @param {string} inteiro só dígitos
 * @returns {string}
 */
function separarMilhar(inteiro) {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formata um número em pt-BR: ponto de milhar, vírgula decimal.
 *
 * @param {number} valor
 * @param {number} [casas=0] casas decimais, sempre exibidas (3 com 1 casa vira "3,0")
 * @returns {string} o número formatado, ou `SEM_VALOR` se não houver número
 * @example formatarNumero(26900) // '26.900'
 * @example formatarNumero(1.8, 1) // '1,8'
 */
export function formatarNumero(valor, casas = 0) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return SEM_VALOR

  const precisao = Number.isInteger(casas) && casas >= 0 ? Math.min(casas, 20) : 0
  const arredondado = Math.abs(valor).toFixed(precisao)
  const [inteiro, decimal] = arredondado.split('.')
  // "-0,0" é ruído: só ganha sinal o que continua diferente de zero depois de
  // arredondado para as casas que a tela mostra.
  const sinal = valor < 0 && Number(arredondado) !== 0 ? '-' : ''

  return `${sinal}${separarMilhar(inteiro)}${decimal ? `,${decimal}` : ''}`
}

/**
 * Formata o valor de uma métrica canônica.
 *
 * A passagem pelo dicionário é o ponto: `formatarValorDeMetrica('reach', ...)`
 * lança em vez de imprimir. Nome da Meta não chega à tela nem por descuido de
 * quem escreve a regra (ADR-003).
 *
 * @param {string} codigo código canônico
 * @param {number} valor
 * @param {{ casas?: number }} [opcoes] `casas` é decisão de quem exibe; a mesma
 *   precisão vai gravada no achado para a conta da variação ser auditável
 * @returns {string}
 * @throws {Error} se o código não existe no dicionário
 */
export function formatarValorDeMetrica(codigo, valor, opcoes = {}) {
  obterMetrica(codigo)
  return formatarNumero(valor, opcoes.casas ?? 0)
}

/**
 * Traduz uma variação em fração para a frase que a tela usa.
 *
 * Sem sinal de porcentagem negativa e sem seta: "40% abaixo" é o que o cliente
 * repete em voz alta na reunião, "-40%" não é (memory/identity.md, tom de voz).
 *
 * @param {number} fracao -0.4 = 40% abaixo
 * @returns {string} '40% abaixo' | '35% acima' | 'Estável' | `SEM_VALOR`
 */
export function formatarVariacao(fracao) {
  if (typeof fracao !== 'number' || !Number.isFinite(fracao)) return SEM_VALOR
  if (Math.abs(fracao) < LIMIAR_DE_ESTABILIDADE) return 'Estável'

  return `${Math.round(Math.abs(fracao) * 100)}% ${fracao < 0 ? 'abaixo' : 'acima'}`
}

/**
 * Escreve um período por extenso, colapsando o que se repete.
 *
 * "24 a 30 de agosto de 2026" cabe no cabeçalho e se lê em voz alta; repetir
 * mês e ano nas duas pontas só ocuparia a linha.
 *
 * @param {string} inicio ISO
 * @param {string} fim ISO
 * @returns {string} período por extenso, ou `SEM_VALOR` se alguma ponta faltar
 * @example formatarPeriodo('2026-08-24', '2026-08-30') // '24 a 30 de agosto de 2026'
 */
export function formatarPeriodo(inicio, fim) {
  const a = partesDaData(inicio)
  const b = partesDaData(fim)
  if (!a || !b) return SEM_VALOR

  if (a.ano === b.ano && a.mes === b.mes) {
    return `${a.dia} a ${b.dia} de ${MESES[a.mes - 1]} de ${a.ano}`
  }
  if (a.ano === b.ano) {
    return `${a.dia} de ${MESES[a.mes - 1]} a ${b.dia} de ${MESES[b.mes - 1]} de ${a.ano}`
  }
  return `${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`
}

/**
 * Escreve uma data por extenso, sem zero à esquerda no dia.
 *
 * @param {string} iso `YYYY-MM-DD` ou ISO completo
 * @returns {string} ex: '5 de setembro de 2026', ou `SEM_VALOR`
 */
export function formatarDataCurta(iso) {
  const data = partesDaData(iso)
  if (!data) return SEM_VALOR

  return `${data.dia} de ${MESES[data.mes - 1]} de ${data.ano}`
}

/**
 * As duas formas de anunciar a janela que o diagnostico comparou.
 *
 * Existe para acabar com um defeito de coerencia: o cabecalho anunciava as
 * dezesseis semanas do registro, o bloco de evidencia mostrava numeros de oito,
 * e a folha do relatorio falava de uma semana — tres janelas diferentes para um
 * unico diagnostico, e o cliente levando qualquer uma delas para a reuniao.
 *
 * @param {{ semanas: number, recentes: { inicio: string, fim: string } }|null|undefined} janela
 * @returns {{ longo: string, curto: string }|null}
 */
export function formatarJanelaComparada(janela) {
  const recentes = janela?.recentes
  if (!recentes?.inicio || !recentes?.fim || !janela?.semanas) return null
  return {
    longo:
      `Últimas ${janela.semanas} semanas ` +
      `(${formatarPeriodo(recentes.inicio, recentes.fim)}), comparadas às ` +
      `${janela.semanas} anteriores`,
    curto: `${janela.semanas} semanas até ${formatarDataCurta(recentes.fim)}`,
  }
}
