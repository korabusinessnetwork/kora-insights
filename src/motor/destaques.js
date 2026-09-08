/**
 * Reparte uma frase nos trechos que a REGRA marcou como portadores da
 * afirmacao.
 *
 * O destaque nao pode nascer na tela. "Sua frequencia caiu 40% e o alcance
 * seguiu junto" tem dois numeros possiveis e um so carrega a causa; procurar
 * por conta propria o que parece importante — o maior numero, o primeiro
 * percentual — seria a tela decidindo o que o motor ja decidiu (ADR-005). Por
 * isso `Achado.destaques` traz os trechos exatos, e aqui so se acha onde eles
 * caem.
 *
 * A busca e literal, nunca por expressao regular montada com o texto: '40%'
 * dentro de um `RegExp` faria de `%` um caractere qualquer, e um destaque com
 * parentese quebraria a expressao inteira.
 *
 * @param {string} texto a frase, como o motor a escreveu
 * @param {string[]} [destaques] trechos exatos a realcar
 * @returns {{ texto: string, realce: boolean }[]} pedacos na ordem original
 */
export function partirComDestaques(texto, destaques) {
  const original = typeof texto === 'string' ? texto : ''
  if (original === '') return []

  const procurados = (Array.isArray(destaques) ? destaques : [])
    .filter((d) => typeof d === 'string' && d !== '')
    // Do maior para o menor: com '40%' e '40' na mesma lista, casar '40'
    // primeiro deixaria o '%' orfao fora do realce.
    .sort((a, b) => b.length - a.length)

  if (procurados.length === 0) return [{ texto: original, realce: false }]

  const pedacos = []
  let inicio = 0
  let cursor = 0

  /** Empurra o texto acumulado desde o ultimo realce. */
  const fecharTrechoSimples = (ate) => {
    if (ate > inicio) pedacos.push({ texto: original.slice(inicio, ate), realce: false })
  }

  while (cursor < original.length) {
    const achado = procurados.find((d) => original.startsWith(d, cursor))
    if (achado === undefined) {
      cursor += 1
      continue
    }
    fecharTrechoSimples(cursor)
    pedacos.push({ texto: achado, realce: true })
    cursor += achado.length
    inicio = cursor
  }

  fecharTrechoSimples(original.length)
  return pedacos
}
