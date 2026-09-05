/**
 * Regra `formato-que-salva`.
 *
 * Salvamento e o sinal mais barato de atencao retida que a API entrega: custa
 * um toque deliberado do usuario, diferente da curtida. Quando um tipo de midia
 * salva consistentemente mais que os outros na mesma conta, existe um formato
 * que essa audiencia guarda para depois — e repeti-lo e a acao mais barata que
 * o cliente pode tomar na semana seguinte.
 *
 * Pura: sem rede, sem DOM, sem relogio.
 */

import { obterMetrica } from '../../metricas/dicionario.js'
import { formatarNumero } from '../../metricas/formatar.js'
import {
  arredondar,
  media,
  percentualAbsoluto,
  ultimasJanelasCompletas,
  variacao,
} from '../../motor/index.js'

const ROTULO_DE_SALVAMENTOS = obterMetrica('salvamentos').rotulo

const SEMANAS_DE_JANELA = 8

/** Menos de tres publicacoes de um tipo e anedota, nao padrao. */
const MINIMO_DE_PUBLICACOES = 3

/** Vantagem minima para o formato ser chamado de melhor, e nao de empate. */
const VANTAGEM_MINIMA = 1.2

/** Duracao do teste sugerido, igual a das demais regras do ruleset. */
const SEMANAS_DE_TESTE = 4

/**
 * Nome de tela de cada tipo de midia (contratos.md, secao 3). Nenhum destes e
 * nome da Meta: sao os rotulos do produto (ADR-003).
 * @type {Record<string, { singular: string, plural: string }>}
 */
const ROTULOS_DE_TIPO = {
  carrossel: { singular: 'Carrossel', plural: 'carrosséis' },
  imagem: { singular: 'Imagem', plural: 'imagens' },
  reel: { singular: 'Reel', plural: 'reels' },
  story: { singular: 'Story', plural: 'stories' },
}

/** @param {string} tipo @returns {{ singular: string, plural: string }} */
function rotuloDeTipo(tipo) {
  return ROTULOS_DE_TIPO[tipo] ?? { singular: tipo, plural: tipo }
}

/**
 * Agrupa os salvamentos por publicacao, por tipo de midia, descartando tipo sem
 * publicacoes suficientes para ter voz.
 *
 * @param {import('../../motor/historico.js').Janela[]} janelas
 * @returns {Map<string, number[]>}
 */
function salvamentosPorTipo(janelas) {
  /** @type {Map<string, number[]>} */
  const porTipo = new Map()
  for (const janela of janelas) {
    for (const midia of janela.midias) {
      const valor = midia.metricas.salvamentos
      if (!Number.isFinite(valor)) continue
      const atual = porTipo.get(midia.tipo)
      if (atual) atual.push(valor)
      else porTipo.set(midia.tipo, [valor])
    }
  }
  for (const [tipo, valores] of porTipo) {
    if (valores.length < MINIMO_DE_PUBLICACOES) porTipo.delete(tipo)
  }
  return porTipo
}

export default {
  codigo: 'formato-que-salva',
  versao: '0.3.0',
  peso: 60,
  minimoDeSemanas: SEMANAS_DE_JANELA,

  /**
   * @param {import('../../motor/historico.js').Historico} historico
   * @returns {object|null} Achado, ou null quando nenhum formato se destaca
   */
  avaliar(historico) {
    const janelas = ultimasJanelasCompletas(historico, SEMANAS_DE_JANELA)
    if (janelas.length < SEMANAS_DE_JANELA) return null

    const porTipo = salvamentosPorTipo(janelas)
    // Um tipo sozinho nao esta "acima dos demais": nao ha demais.
    if (porTipo.size < 2) return null

    const ranking = [...porTipo.entries()]
      .map(([tipo, valores]) => ({ tipo, valores, media: media(valores) }))
      .sort((a, b) => b.media - a.media)

    const campeao = ranking[0]
    const demais = ranking.slice(1).flatMap((entrada) => entrada.valores)
    const mediaDosDemais = media(demais)
    if (mediaDosDemais === null || mediaDosDemais === 0) return null

    // Duas condicoes, e nao uma: a media precisa ser maior E a pior publicacao do
    // tipo precisa bater a media dos outros. Sem a segunda, um unico post
    // excepcional elegeria um formato que o cliente nao consegue repetir.
    const vantagem = campeao.media / mediaDosDemais
    const piorDoCampeao = Math.min(...campeao.valores)
    if (vantagem < VANTAGEM_MINIMA || piorDoCampeao < mediaDosDemais) return null

    const rotulo = rotuloDeTipo(campeao.tipo)
    const percentual = percentualAbsoluto(variacao(campeao.media, mediaDosDemais))
    const mediaDoCampeaoTexto = formatarNumero(campeao.media, 0)
    const mediaDosDemaisTexto = formatarNumero(mediaDosDemais, 0)

    return {
      regra: 'formato-que-salva',
      versaoRegra: '0.3.0',
      severidade: 'ok',
      rotulo: 'Formato que retém atenção',
      frase:
        `${rotulo.singular} salva ${percentual}% mais por publicação que os outros ` +
        'formatos desta conta.',
      apoio:
        `Nas últimas ${SEMANAS_DE_JANELA} semanas saíram ${campeao.valores.length} ` +
        `${rotulo.plural}, com média de ${mediaDoCampeaoTexto} salvamentos por ` +
        `publicação, contra ${mediaDosDemaisTexto} dos demais formatos. A publicação ` +
        `mais fraca do formato ainda ficou acima da média das outras.`,
      acao:
        `Mantenha ${rotulo.singular.toLowerCase()} como formato principal nas próximas ` +
        `${SEMANAS_DE_TESTE} semanas, sem mexer em frequência nem em horário.`,
      confirmacao:
        `Se o salvamento por publicação continuar acima de ${mediaDosDemaisTexto} com ` +
        'mais publicações desse formato, o formato está confirmado. Se cair, o que ' +
        'segurava atenção era o assunto, não o formato.',
      evidencias: [
        {
          rotulo: `${ROTULO_DE_SALVAMENTOS} por publicação, ${rotulo.singular.toLowerCase()}`,
          metrica: 'salvamentos',
          valor: arredondar(campeao.media, 0),
          anterior: null,
          variacao: null,
          casas: 0,
          tom: 'bom',
          nota: `${percentual}% acima da média dos outros formatos`,
        },
        {
          rotulo: `${ROTULO_DE_SALVAMENTOS} por publicação, demais formatos`,
          metrica: 'salvamentos',
          valor: arredondar(mediaDosDemais, 0),
          anterior: null,
          variacao: null,
          casas: 0,
          tom: 'neutro',
          nota: `${demais.length} publicações no período`,
        },
      ],
      // Sem serie: a comparacao e entre formatos, nao ao longo do tempo. Um
      // grafico temporal aqui sugeriria uma tendencia que a regra nao afirmou.
      serie: null,
      limites: ['salvamento-nao-e-receita'],
      peso: 60,
    }
  },
}
