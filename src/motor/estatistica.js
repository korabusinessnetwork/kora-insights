/**
 * Aritmetica do motor. Tudo puro: sem rede, sem DOM, sem relogio.
 *
 * A funcao que justifica o modulo e `variacaoExibida`. As demais existem para
 * que nenhuma regra escreva a propria media e o proprio arredondamento — duas
 * regras arredondando de formas diferentes produzem duas tabelas que discordam
 * na mesma tela, e o cliente confia na que estiver pior.
 */

/** Casas com que a fracao de variacao e guardada: a tela exibe percentual inteiro. */
const CASAS_DA_FRACAO = 4

/**
 * @param {number[]} valores
 * @returns {number} 0 para lista vazia — soma de nada e zero, nao ausencia
 */
export function soma(valores) {
  return valores.reduce((total, valor) => total + valor, 0)
}

/**
 * @param {number[]} valores
 * @returns {number|null} null para lista vazia: media de nada nao e zero, e ausencia
 */
export function media(valores) {
  if (valores.length === 0) return null
  return soma(valores) / valores.length
}

/**
 * @param {number[]} valores
 * @returns {number|null} ultimo elemento, ou null se nao ha nenhum
 */
export function ultimo(valores) {
  if (valores.length === 0) return null
  return valores[valores.length - 1]
}

/**
 * Mediana. Usada onde a media mente: a acao recomendada nao pode ser puxada por
 * uma semana atipica de mutirao de posts.
 *
 * @param {number[]} valores
 * @returns {number|null}
 */
export function mediana(valores) {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 1) return ordenados[meio]
  return (ordenados[meio - 1] + ordenados[meio]) / 2
}

/**
 * Desvio padrao populacional. Populacional, e nao amostral, porque as semanas
 * observadas sao o universo do diagnostico: nao inferimos sobre semanas que
 * ninguem coletou.
 *
 * @param {number[]} valores
 * @returns {number|null}
 */
export function desvioPadrao(valores) {
  const centro = media(valores)
  if (centro === null) return null
  const quadrados = valores.map((valor) => (valor - centro) ** 2)
  return Math.sqrt(soma(quadrados) / valores.length)
}

/**
 * Coeficiente de variacao: dispersao relativa ao proprio tamanho. E o que
 * permite comparar a irregularidade de um perfil de 2 mil com a de um de 200 mil.
 *
 * @param {number[]} valores
 * @returns {number|null} null quando nao ha valores ou a media e zero
 */
export function coeficienteDeVariacao(valores) {
  const centro = media(valores)
  const desvio = desvioPadrao(valores)
  if (centro === null || desvio === null || centro === 0) return null
  return desvio / Math.abs(centro)
}

/**
 * Arredondamento meio-para-longe-do-zero, com correcao de erro binario.
 *
 * `Math.round` sozinho erra duas vezes: quebra a simetria no negativo
 * (`Math.round(-0.5)` da `-0`) e herda o residuo do float (`2.675 * 100` vale
 * `267.49999999999997`, que arredondaria para 2,67 e nao para 2,68). Numero de
 * tela que nao fecha com a calculadora do cliente destroi a confianca na
 * ferramenta inteira.
 *
 * @param {number} valor
 * @param {number} [casas=0]
 * @returns {number|null} null se o valor nao for finito
 */
export function arredondar(valor, casas = 0) {
  if (!Number.isFinite(valor)) return null
  const fator = 10 ** casas
  const escalado = Number((Math.abs(valor) * fator).toPrecision(12))
  return (Math.sign(valor) * Math.round(escalado)) / fator
}

/**
 * Variacao relativa entre dois valores.
 *
 * @param {number|null|undefined} atual
 * @param {number|null|undefined} anterior
 * @returns {number|null} fracao (-0.4 = 40% abaixo), ou null quando a conta nao existe
 */
export function variacao(atual, anterior) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null
  // Divisao por zero devolveria Infinity, e "crescimento infinito" na tela e
  // pior que nenhuma resposta: sem base de comparacao nao ha variacao.
  if (anterior === 0) return null
  return arredondar((atual - anterior) / anterior, CASAS_DA_FRACAO)
}

/**
 * Variacao calculada sobre os valores **como sao exibidos** (contratos.md, 3).
 *
 * Publicacoes por semana caiu de 3,0 para 1,8. Quem conferir a tabela na reuniao
 * divide 1,8 por 3,0 e obtem 40%. Se a variacao viesse dos valores crus (1,75 e
 * 3,00) a tela diria 42% e o cliente concluiria que a ferramenta erra — e ele
 * estaria certo em desconfiar. Por isso arredonda antes de dividir.
 *
 * @param {number|null|undefined} atual
 * @param {number|null|undefined} anterior
 * @param {number} [casas=0] casas com que os dois valores aparecem na tela
 * @returns {number|null}
 */
export function variacaoExibida(atual, anterior, casas = 0) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null
  return variacao(arredondar(atual, casas), arredondar(anterior, casas))
}

/**
 * Fracao de variacao em percentual inteiro e positivo, para texto de tela.
 * O sinal vira palavra ("abaixo"/"acima") na regra, nao simbolo no numero.
 *
 * @param {number|null|undefined} fracao
 * @returns {number|null}
 */
export function percentualAbsoluto(fracao) {
  if (!Number.isFinite(fracao)) return null
  return Math.round(Math.abs(fracao) * 100)
}
