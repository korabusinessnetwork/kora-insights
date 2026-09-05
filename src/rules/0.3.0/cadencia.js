/**
 * Regra `cadencia-em-queda` — o caso da identidade do produto.
 *
 * Ela separa as duas unicas explicacoes possiveis para um alcance total menor:
 * ou o conteudo passou a alcancar menos, ou saiu menos conteudo. A segunda e
 * invisivel no painel nativo, porque la o alcance aparece so em total. Quando a
 * frequencia cai e o alcance por publicacao nao se mexe, a causa tem nome e a
 * acao e obvia — e e essa frase que o cliente repete em voz alta na reuniao.
 *
 * Pura: sem rede, sem DOM, sem relogio.
 */

import { obterMetrica } from '../../metricas/dicionario.js'
import {
  LIMIAR_DE_ESTABILIDADE,
  formatarNumero,
  formatarVariacao,
} from '../../metricas/formatar.js'
import {
  arredondar,
  media,
  mediaPorPublicacao,
  mediana,
  percentualAbsoluto,
  ultimasJanelasCompletas,
  valorDaJanela,
  variacaoExibida,
} from '../../motor/index.js'

const ROTULO_DE_PUBLICACOES = obterMetrica('publicacoes').rotulo
const ROTULO_DE_ALCANCE = obterMetrica('alcance').rotulo

/** Oito contra oito: dois meses de cada lado. Menos que isso vira ruido de semana. */
const SEMANAS_POR_JANELA = 8

/** Abaixo disso a queda de cadencia e oscilacao de agenda, nao mudanca de ritmo. */
const QUEDA_RELEVANTE = 0.15

/**
 * Duracao do teste sugerido. Quatro semanas e o menor bloco que fecha uma janela
 * de comparacao propria sem esticar o teste por um trimestre.
 */
const SEMANAS_DE_TESTE = 4

const CASAS_DE_CADENCIA = 1
const CASAS_DE_ALCANCE = 0
const DEZENA_DE_MILHAR = 10000

/** @param {string} iso `YYYY-MM-DD` @returns {string} `dd/mm` */
function rotuloDeSemana(iso) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/**
 * Nota de evidencia em pt-BR, ja com o valor anterior por extenso: a tabela da
 * tela precisa mostrar de onde saiu a conta, senao a variacao vira afirmacao
 * sem prova.
 *
 * @param {number|null} fracao
 * @param {number|null} anterior
 * @param {number} casas
 * @returns {string}
 */
function notaDeVariacao(fracao, anterior, casas) {
  const anteriorTexto = formatarNumero(anterior, casas)
  if (fracao === null) return `era ${anteriorTexto}`
  return `${formatarVariacao(fracao)}, era ${anteriorTexto}`
}

/**
 * @param {object} entrada
 * @param {string} entrada.rotulo
 * @param {string} entrada.metrica
 * @param {number} entrada.atual
 * @param {number} entrada.anterior
 * @param {number|null} entrada.variacao
 * @param {number} entrada.casas
 * @param {'bom'|'ruim'|'neutro'} entrada.tom
 * @returns {object} Evidencia de contratos.md
 */
function montarEvidencia({ rotulo, metrica, atual, anterior, variacao, casas, tom }) {
  return {
    rotulo,
    metrica,
    // O valor guardado ja e o valor exibido. Guardar o cru obrigaria a tela a
    // arredondar de novo, e duas rotinas de arredondamento sempre divergem.
    valor: arredondar(atual, casas),
    anterior: arredondar(anterior, casas),
    variacao,
    casas,
    tom,
    nota: notaDeVariacao(variacao, anterior, casas),
  }
}

/**
 * Plural de "publicacao" sem biblioteca de i18n: o produto e pt-BR unico.
 * @param {number} quantidade
 * @returns {string}
 */
function publicacoesPorExtenso(quantidade) {
  return quantidade === 1 ? 'publicação' : 'publicações'
}

export default {
  codigo: 'cadencia-em-queda',
  versao: '0.3.0',
  peso: 90,
  // Dezesseis: oito semanas recentes contra oito anteriores.
  minimoDeSemanas: SEMANAS_POR_JANELA * 2,

  /**
   * @param {import('../../motor/historico.js').Historico} historico
   * @returns {object|null} Achado, ou null quando a cadencia nao caiu
   */
  avaliar(historico) {
    const completas = ultimasJanelasCompletas(historico, SEMANAS_POR_JANELA * 2)
    if (completas.length < SEMANAS_POR_JANELA * 2) return null

    const anteriores = completas.slice(0, SEMANAS_POR_JANELA)
    const recentes = completas.slice(SEMANAS_POR_JANELA)

    const publicacoesRecentes = recentes.map((janela) => janela.valores.publicacoes)
    const publicacoesAnteriores = anteriores.map((janela) => janela.valores.publicacoes)
    // Semana sem contagem de publicacoes nao vira zero: sem esse dado a regra
    // nao tem o que comparar e se cala.
    const todas = [...publicacoesRecentes, ...publicacoesAnteriores]
    if (todas.some((valor) => !Number.isFinite(valor))) return null

    const cadenciaAtual = media(publicacoesRecentes)
    const cadenciaAnterior = media(publicacoesAnteriores)
    const quedaDeCadencia = variacaoExibida(cadenciaAtual, cadenciaAnterior, CASAS_DE_CADENCIA)
    if (quedaDeCadencia === null || quedaDeCadencia > -QUEDA_RELEVANTE) return null

    const alcanceAtual = valorDaJanela(recentes, 'alcance')
    const alcanceAnterior = valorDaJanela(anteriores, 'alcance')
    const porPublicacaoAtual = mediaPorPublicacao(recentes, 'alcance')
    const porPublicacaoAnterior = mediaPorPublicacao(anteriores, 'alcance')
    if (porPublicacaoAtual.valor === null || porPublicacaoAnterior.valor === null) return null

    const quedaDeAlcance = variacaoExibida(alcanceAtual, alcanceAnterior, CASAS_DE_ALCANCE)
    const variacaoPorPublicacao = variacaoExibida(
      porPublicacaoAtual.valor,
      porPublicacaoAnterior.valor,
      CASAS_DE_ALCANCE,
    )

    // Duas coisas caindo ao mesmo tempo nao sao uma causa nomeada: a frase muda
    // de forma e a severidade sobe, porque o teste de uma variavel so nao basta.
    const acompanhado =
      variacaoPorPublicacao !== null && variacaoPorPublicacao <= -LIMIAR_DE_ESTABILIDADE
    const percentualDeCadencia = percentualAbsoluto(quedaDeCadencia)
    const percentualPorPublicacao = percentualAbsoluto(variacaoPorPublicacao)

    const alvo = arredondar(mediana(publicacoesAnteriores), 0)
    const faixa = arredondar(alcanceAnterior / DEZENA_DE_MILHAR, 0) * DEZENA_DE_MILHAR
    const faixaPorExtenso = `${formatarNumero(faixa / 1000, 0)} mil`

    const cadenciaAtualTexto = formatarNumero(cadenciaAtual, CASAS_DE_CADENCIA)
    const cadenciaAnteriorTexto = formatarNumero(cadenciaAnterior, CASAS_DE_CADENCIA)
    const porPublicacaoAtualTexto = formatarNumero(porPublicacaoAtual.valor, CASAS_DE_ALCANCE)
    const porPublicacaoAnteriorTexto = formatarNumero(porPublicacaoAnterior.valor, CASAS_DE_ALCANCE)

    const frase = acompanhado
      ? `Sua frequência caiu ${percentualDeCadencia}% e o alcance por publicação caiu ` +
        `${percentualPorPublicacao}%. Não é só volume: o que você publica também está ` +
        'alcançando menos.'
      : `Seu alcance não caiu. Sua frequência caiu ${percentualDeCadencia}% e o alcance ` +
        'seguiu junto.'

    const apoio = acompanhado
      ? `A média de publicações por semana foi ${cadenciaAtualTexto} nas últimas ` +
        `${SEMANAS_POR_JANELA} semanas, contra ${cadenciaAnteriorTexto} nas ` +
        `${SEMANAS_POR_JANELA} anteriores. O alcance por publicação também recuou: ` +
        `${porPublicacaoAtualTexto} contra ${porPublicacaoAnteriorTexto}. São duas ` +
        'variáveis se movendo juntas, e o teste precisa separar uma da outra.'
      : `A média de publicações por semana foi ${cadenciaAtualTexto} nas últimas ` +
        `${SEMANAS_POR_JANELA} semanas, contra ${cadenciaAnteriorTexto} nas ` +
        `${SEMANAS_POR_JANELA} anteriores. O alcance por publicação ficou praticamente ` +
        `igual: ${porPublicacaoAtualTexto} contra ${porPublicacaoAnteriorTexto}. O total ` +
        `alcançado caiu ${percentualAbsoluto(quedaDeAlcance)}% porque saiu menos conteúdo.`

    const tomPorPublicacao = acompanhado
      ? 'ruim'
      : variacaoPorPublicacao !== null && variacaoPorPublicacao >= LIMIAR_DE_ESTABILIDADE
        ? 'bom'
        : 'neutro'

    return {
      regra: 'cadencia-em-queda',
      versaoRegra: '0.3.0',
      severidade: acompanhado ? 'critico' : 'atencao',
      rotulo: acompanhado
        ? 'Frequência e alcance por publicação em queda'
        : 'Frequência de publicação, causa nomeada',
      frase,
      apoio,
      acao:
        `Volte para ${alvo} ${publicacoesPorExtenso(alvo)} por semana durante ` +
        `${SEMANAS_DE_TESTE} semanas, sem trocar formato nem horário.`,
      confirmacao:
        `Se o alcance voltar para a faixa de ${faixaPorExtenso} sem nenhuma outra ` +
        'mudança, a causa está confirmada. Se não voltar, o próximo suspeito é formato, ' +
        'e o teste seguinte muda uma variável só.',
      evidencias: [
        montarEvidencia({
          rotulo: `${ROTULO_DE_PUBLICACOES} por semana`,
          metrica: 'publicacoes',
          atual: cadenciaAtual,
          anterior: cadenciaAnterior,
          variacao: quedaDeCadencia,
          casas: CASAS_DE_CADENCIA,
          tom: 'ruim',
        }),
        montarEvidencia({
          rotulo: ROTULO_DE_ALCANCE,
          metrica: 'alcance',
          atual: alcanceAtual,
          anterior: alcanceAnterior,
          variacao: quedaDeAlcance,
          casas: CASAS_DE_ALCANCE,
          tom: 'ruim',
        }),
        montarEvidencia({
          rotulo: 'Alcance por publicação',
          metrica: 'alcance',
          atual: porPublicacaoAtual.valor,
          anterior: porPublicacaoAnterior.valor,
          variacao: variacaoPorPublicacao,
          casas: CASAS_DE_ALCANCE,
          tom: tomPorPublicacao,
        }),
      ],
      serie: {
        rotuloBarra: ROTULO_DE_PUBLICACOES,
        rotuloLinha: ROTULO_DE_ALCANCE,
        pontos: recentes.map((janela) => ({
          rotulo: rotuloDeSemana(janela.inicio),
          barra: janela.valores.publicacoes ?? null,
          linha: janela.valores.alcance ?? null,
        })),
      },
      limites: [porPublicacaoAtual.limiteDeAgregacao, 'sem-causa-externa'].filter(Boolean),
      peso: 90,
    }
  },
}
