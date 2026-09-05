/**
 * Regra `consistencia-de-alcance`.
 *
 * Mede o quanto o alcance oscila de uma publicacao para outra. Duas contas com
 * a mesma media contam historias opostas: uma alcanca sempre a mesma faixa, a
 * outra vive de um post que estourou no meio de sete que ninguem viu. A
 * primeira tem metodo; a segunda tem sorte, e sorte nao se planeja.
 *
 * Pura: sem rede, sem DOM, sem relogio.
 */

import { obterMetrica } from '../../metricas/dicionario.js'
import { formatarNumero } from '../../metricas/formatar.js'
import {
  arredondar,
  coeficienteDeVariacao,
  media,
  intervaloDaJanela,
  ultimasJanelasCompletas,
  valoresPorPublicacao,
} from '../../motor/index.js'

const SEMANAS_DE_JANELA = 8

/** Abaixo disso a dispersao nao descreve o perfil, descreve o punhado de posts. */
const MINIMO_DE_PUBLICACOES = 6

/**
 * Coeficiente de variacao a partir do qual o resultado passa a depender de
 * acertar o post. Trinta e cinco por cento e o ponto em que a maior e a menor
 * publicacao deixam de caber na mesma faixa aos olhos de quem le a tela.
 */
const DISPERSAO_ALTA = 0.35

export default {
  codigo: 'consistencia-de-alcance',
  versao: '0.3.0',
  peso: 40,
  minimoDeSemanas: SEMANAS_DE_JANELA,

  /**
   * @param {import('../../motor/historico.js').Historico} historico
   * @returns {object|null}
   */
  avaliar(historico) {
    const janelas = ultimasJanelasCompletas(historico, SEMANAS_DE_JANELA)
    if (janelas.length < SEMANAS_DE_JANELA) return null

    const alcances = valoresPorPublicacao(janelas, 'alcance')
    if (alcances.length < MINIMO_DE_PUBLICACOES) return null

    const dispersao = coeficienteDeVariacao(alcances)
    const alcanceMedio = media(alcances)
    if (dispersao === null || alcanceMedio === null) return null

    const alta = dispersao >= DISPERSAO_ALTA
    const percentual = Math.round(dispersao * 100)
    const limiar = Math.round(DISPERSAO_ALTA * 100)
    const medioTexto = formatarNumero(alcanceMedio, 0)

    return {
      regra: 'consistencia-de-alcance',
      // Toda regra declara a janela que olhou. Sem isso o cabecalho nao tem o
      // que anunciar e cai num "sem diagnostico ainda" com um diagnostico na
      // tela — o produto contradizendo a si mesmo em duas linhas de distancia.
      janela: {
        semanas: SEMANAS_DE_JANELA,
        recentes: intervaloDaJanela(janelas),
        anteriores: null,
      },
      versaoRegra: '0.3.0',
      severidade: alta ? 'atencao' : 'ok',
      rotulo: alta
        ? 'Alcance dependente de sorte de post'
        : 'Alcance consistente entre publicações',
      frase: alta
        ? `Seu alcance varia ${percentual}% de uma publicação para outra. O resultado ` +
          'da conta depende de acertar o post, não de um método.'
        : `Suas publicações alcançam a mesma faixa: ${percentual}% de variação entre ` +
          'elas. O resultado vem do método, não de sorte de post.',
      apoio:
        `Nas últimas ${SEMANAS_DE_JANELA} semanas saíram ${alcances.length} publicações, ` +
        `com alcance médio de ${medioTexto} contas. A variação entre elas foi de ` +
        `${percentual}%, contra um limiar de ${limiar}%.`,
      acao: alta
        ? 'Pegue as três publicações de maior alcance destas 8 semanas, liste o que elas ' +
          'têm em comum e repita um único desses elementos na próxima semana.'
        : 'Não mexa no que está estável. Use a próxima mudança para testar frequência ou ' +
          'formato, uma variável por vez.',
      confirmacao: alta
        ? `Se a variação cair abaixo de ${limiar}% mantendo o alcance médio, o padrão ` +
          'virou método. Se continuar igual, o que move o resultado não está no ' +
          'conteúdo que você controla.'
        : `Se a variação subir acima de ${limiar}% depois de uma mudança, foi a mudança ` +
          'que introduziu a instabilidade.',
      evidencias: [
        {
          rotulo: 'Alcance por publicação',
          metrica: 'alcance',
          valor: arredondar(alcanceMedio, 0),
          anterior: null,
          variacao: null,
          casas: 0,
          tom: alta ? 'ruim' : 'bom',
          nota: `${alcances.length} publicações, variação de ${percentual}% entre elas`,
        },
      ],
      serie: {
        rotuloBarra: obterMetrica('publicacoes').rotulo,
        rotuloLinha: 'Alcance por publicação',
        pontos: janelas.map((janela) => {
          const daSemana = janela.midias
            .map((midia) => midia.metricas.alcance)
            .filter((valor) => Number.isFinite(valor))
          const [, mes, dia] = janela.inicio.split('-')
          return {
            rotulo: `${dia}/${mes}`,
            barra: janela.valores.publicacoes ?? null,
            linha: arredondar(media(daSemana), 0),
          }
        }),
      },
      limites: ['dispersao-nao-explica-causa'],
      peso: 40,
    }
  },
}
