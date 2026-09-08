/**
 * Identidade visual por tenant (white-label, Fase 3 — modelado desde ja).
 *
 * CLAUDE.md: "nada de marca, nome, cor, logo ou regra de cliente hardcodada —
 * identidade vem do tenant". Este modulo e o unico ponto do produto autorizado
 * a escrever cor de marca, e ele escreve apenas em custom properties `--tenant-*`
 * consumidas por src/styles/tokens.css.
 *
 * Nao ha `style={{ color: tenant.cor }}` em lugar nenhum do JSX: o tenant muda
 * a variavel, a variavel muda o produto inteiro.
 */

/**
 * Chaves aceitas vindas do tenant. Allowlist, nao denylist: um campo novo no
 * banco nao vira CSS por acidente, e ninguem injeta propriedade arbitraria.
 * @type {Record<string, string>}
 */
export const TOKENS_DE_TENANT = {
  fundo: '--tenant-fundo',
  fundoFosco: '--tenant-fundo-fosco',
  superficie: '--tenant-superficie',
  superficieAlta: '--tenant-superficie-alta',
  linha: '--tenant-linha',
  linhaForte: '--tenant-linha-forte',
  tinta: '--tenant-tinta',
  tintaSuave: '--tenant-tinta-suave',
  tintaFraca: '--tenant-tinta-fraca',
  acento: '--tenant-acento',
  acentoFirme: '--tenant-acento-firme',
  acentoTinta: '--tenant-acento-tinta',
  positivo: '--tenant-positivo',
  atencao: '--tenant-atencao',
  critico: '--tenant-critico',
  papelFundo: '--tenant-papel-fundo',
  papelTinta: '--tenant-papel-tinta',
  papelAcento: '--tenant-papel-acento',
  fonteDisplay: '--fonte-display',
  fonteTexto: '--fonte-texto',
}

/** Cor em hex de 3, 4, 6 ou 8 digitos. Nada alem disso vira CSS. */
const COR_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Pilha de fontes: nomes, aspas e virgulas. Sem parenteses, sem url(), sem ;. */
const PILHA_DE_FONTES = /^[a-z0-9 '"_-]+(?:\s*,\s*[a-z0-9 '"_-]+)*$/i

/**
 * Valida um valor de identidade antes de ele virar CSS.
 *
 * Um `--tenant-acento` vindo do banco entra em folha de estilo: sem validacao,
 * um valor com `url(...)` viraria requisicao a servidor de terceiro a partir do
 * CSS. Por isso hex e pilha de fonte sao as unicas formas aceitas.
 *
 * @param {string} chave chave logica (ex: 'acento')
 * @param {unknown} valor valor cru vindo do registro do tenant
 * @returns {boolean} true se pode ser aplicado
 */
export function valorDeIdentidadeEhValido(chave, valor) {
  if (typeof valor !== 'string') return false
  const limpo = valor.trim()
  if (!limpo || limpo.length > 120) return false
  if (chave === 'fonteDisplay' || chave === 'fonteTexto') return PILHA_DE_FONTES.test(limpo)
  return COR_HEX.test(limpo)
}

/**
 * Traduz a identidade do tenant em pares [propriedade CSS, valor], descartando
 * chave desconhecida e valor invalido em silencio (identidade quebrada nao pode
 * derrubar a tela — cai no padrao Kora).
 *
 * @param {Record<string, unknown> | null | undefined} identidade
 * @returns {Array<[string, string]>}
 */
export function resolverTokensDeIdentidade(identidade) {
  if (!identidade || typeof identidade !== 'object') return []
  return Object.entries(identidade)
    .filter(([chave, valor]) => chave in TOKENS_DE_TENANT && valorDeIdentidadeEhValido(chave, valor))
    .map(([chave, valor]) => [TOKENS_DE_TENANT[chave], String(valor).trim()])
}

/**
 * Aplica a identidade do tenant no elemento raiz e devolve uma funcao que
 * desfaz. Trocar de tenant sem limpar deixaria cor do cliente anterior na tela.
 *
 * @param {Record<string, unknown> | null | undefined} identidade
 * @param {HTMLElement} [raiz] alvo (padrao: documentElement)
 * @returns {() => void} desfaz a aplicacao
 */
export function aplicarIdentidadeVisual(identidade, raiz) {
  const alvo = raiz ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!alvo) return () => {}

  const tokens = resolverTokensDeIdentidade(identidade)
  for (const [propriedade, valor] of tokens) alvo.style.setProperty(propriedade, valor)

  return () => {
    for (const [propriedade] of tokens) alvo.style.removeProperty(propriedade)
  }
}

/**
 * Limpa toda identidade de tenant da raiz. Usada no logout e na troca de conta.
 * @param {HTMLElement} [raiz]
 */
export function limparIdentidadeVisual(raiz) {
  const alvo = raiz ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!alvo) return
  for (const propriedade of Object.values(TOKENS_DE_TENANT)) alvo.style.removeProperty(propriedade)
}
