/**
 * Os caminhos de rota do produto (docs/01_ARQUITETURA/contratos.md, seção 6).
 *
 * Caminho escrito à mão dentro do JSX espalha o contrato de rotas por dezenas
 * de arquivos, e o dia em que uma rota muda vira caçada a string. Aqui ele é
 * um só, e quem monta link chama a função em vez de concatenar.
 *
 * Módulo puro: sem React, sem router, sem DOM. É o que permite testar a leitura
 * de um caminho sem montar árvore de rotas nenhuma.
 */

/**
 * Caminhos, exatamente como na tabela de contratos.md. Congelado: rota nova
 * aqui é mudança combinada com aquele documento, no mesmo commit.
 * @type {Readonly<Record<string, string>>}
 */
export const ROTAS = Object.freeze({
  raiz: '/',
  entrar: '/entrar',
  conectar: '/conectar',
  retornoDaConexao: '/conectar/retorno',
  contas: '/contas',
  conta: '/contas/:contaId',
  relatorio: '/contas/:contaId/relatorio',
  historico: '/contas/:contaId/historico',
  privacidade: '/privacidade',
  dados: '/dados',
})

/**
 * Onde a rota protegida guarda o destino de quem foi barrado sem sessão.
 * Fica na URL, e não em estado de memória, porque a volta do link de acesso é
 * um carregamento novo da página: estado em memória não sobrevive a ele.
 */
export const PARAMETRO_DE_DESTINO = 'proximo'

/** Reconhece `/contas/<id>` e qualquer coisa abaixo dele. */
const CAMINHO_DE_CONTA = /^\/contas\/([^/]+)(?:\/|$)/

/**
 * Caminho do diagnóstico de uma conta.
 *
 * @param {string} contaId
 * @returns {string}
 */
export function rotaDaConta(contaId) {
  return `${ROTAS.contas}/${encodeURIComponent(contaId)}`
}

/**
 * Caminho do relatório de uma conta.
 *
 * @param {string} contaId
 * @returns {string}
 */
export function rotaDoRelatorio(contaId) {
  return `${rotaDaConta(contaId)}/relatorio`
}

/**
 * Caminho do histórico de diagnósticos de uma conta.
 *
 * @param {string} contaId
 * @returns {string}
 */
export function rotaDoHistorico(contaId) {
  return `${rotaDaConta(contaId)}/historico`
}

/**
 * Caminho da tela de entrada, carregando o destino de quem foi barrado.
 *
 * @param {string} [destino] caminho que a pessoa tentou abrir
 * @returns {string}
 */
export function rotaDeEntrada(destino) {
  if (!destino || destino === ROTAS.entrar) return ROTAS.entrar
  return `${ROTAS.entrar}?${PARAMETRO_DE_DESTINO}=${encodeURIComponent(destino)}`
}

/**
 * A conta em foco, lida do caminho atual.
 *
 * A URL é a fonte de verdade de qual conta está aberta: recarregar a página,
 * abrir em outra aba e mandar o link para o cliente precisam mostrar a mesma
 * conta. Guardar isso em estado paralelo criaria duas verdades, e um dia elas
 * discordariam — o cabeçalho anunciando uma conta e a tela mostrando outra.
 *
 * @param {string} caminho `location.pathname`
 * @returns {string|null} o id, ou `null` se o caminho não fala de conta alguma
 */
export function contaIdDaRota(caminho) {
  if (typeof caminho !== 'string') return null
  const encontrado = CAMINHO_DE_CONTA.exec(caminho)
  if (!encontrado) return null
  try {
    return decodeURIComponent(encontrado[1])
  } catch {
    // `%` solto vem de URL digitada à mão e não decodifica. Não é id de conta
    // nenhuma, e devolver o texto cru faria a comparação achar que é.
    return null
  }
}
