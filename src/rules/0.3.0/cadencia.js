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
  intervaloDaJanela,
  media,
  mediaPorPublicacao,
  mediana,
  percentualAbsoluto,
  ultimasJanelasCompletas,
  valorDaJanela,
  variacaoExibida,
} from '../../motor/index.js'
import { SEMANAS_POR_JANELA } from '../requisitos.js'

const ROTULO_DE_PUBLICACOES = obterMetrica('publicacoes').rotulo
const ROTULO_DE_ALCANCE = obterMetrica('alcance').rotulo

// Oito contra oito: dois meses de cada lado. O numero vive em requisitos.js
// porque a tela de onboarding promete o mesmo prazo que esta regra exige.

/** Abaixo disso a queda de cadencia e oscilacao de agenda, nao mudanca de ritmo. */
const QUEDA_RELEVANTE = 0.15

/**
 * Duracao do teste sugerido. Quatro semanas e o menor bloco que fecha uma janela
 * de comparacao propria sem esticar o teste por um trimestre.
 */
const SEMANAS_DE_TESTE = 4

const CASAS_DE_CADENCIA = 1
const CASAS_DE_ALCANCE = 0

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

/**
 * Faixa redonda para a frase de confirmacao ("a faixa de 40 mil").
 *
 * Arredondar sempre para a dezena de milhar quebra em conta pequena: um perfil
 * com 4.100 de alcance viraria "a faixa de 0 mil", e o cliente recebe uma meta
 * de zero. A unidade acompanha a ordem de grandeza, e nunca chega a zero.
 *
 * @param {number} valor
 * @returns {string}
 */
function faixaPorExtenso(valor) {
  const unidade = valor >= 10000 ? 10000 : valor >= 1000 ? 1000 : 100
  const arredondado = Math.max(unidade, Math.round(valor / unidade) * unidade)
  return arredondado >= 1000
    ? `${formatarNumero(arredondado / 1000, 0)} mil`
    : formatarNumero(arredondado, 0)
}

/**
 * Tom de uma evidencia a partir da propria variacao que a linha mostra.
 *
 * Fixar o tom no codigo faz a cor contradizer o numero ao lado dela — e a cor e
 * a primeira coisa que o olho le na tabela. Quem decide se subir e bom e a
 * regra, por isso `quedaEhRuim` e um parametro e nao uma suposicao.
 *
 * @param {number|null} fracao
 * @param {boolean} quedaEhRuim
 * @returns {'bom'|'ruim'|'neutro'}
 */
function tomDaVariacao(fracao, quedaEhRuim) {
  if (fracao === null || Math.abs(fracao) < LIMIAR_DE_ESTABILIDADE) return 'neutro'
  const caiu = fracao < 0
  return caiu === quedaEhRuim ? 'ruim' : 'bom'
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
    // Sem alcance de conta nas duas janelas nao ha queda para explicar, e a
    // frase sairia com "o total alcancado caiu null%". A regra prefere se calar.
    if (alcanceAtual === null || alcanceAnterior === null) return null

    const porPublicacaoAtual = mediaPorPublicacao(recentes, 'alcance')
    const porPublicacaoAnterior = mediaPorPublicacao(anteriores, 'alcance')
    if (porPublicacaoAtual.valor === null || porPublicacaoAnterior.valor === null) return null

    const quedaDeAlcance = variacaoExibida(alcanceAtual, alcanceAnterior, CASAS_DE_ALCANCE)
    const variacaoPorPublicacao = variacaoExibida(
      porPublicacaoAtual.valor,
      porPublicacaoAnterior.valor,
      CASAS_DE_ALCANCE,
    )

    // Tres desfechos, e quem os separa e o alcance TOTAL:
    //   sem-queda    publicou menos e alcancou o mesmo — nao ha problema a nomear
    //   acompanhado  alcance total e alcance por publicacao caindo juntos
    //   cadencia     o caso da identidade: so o volume caiu
    // Sem a primeira trava a regra mandava desfazer uma melhora real: cadencia
    // caindo com alcance por publicacao em alta virava "volte ao volume anterior".
    const alcanceCaiu = quedaDeAlcance !== null && quedaDeAlcance <= -LIMIAR_DE_ESTABILIDADE
    const porPublicacaoCaiu =
      variacaoPorPublicacao !== null && variacaoPorPublicacao <= -LIMIAR_DE_ESTABILIDADE
    const desfecho = !alcanceCaiu ? 'sem-queda' : porPublicacaoCaiu ? 'acompanhado' : 'cadencia'

    const percentualDeCadencia = percentualAbsoluto(quedaDeCadencia)
    const percentualPorPublicacao = percentualAbsoluto(variacaoPorPublicacao)
    const percentualDeAlcance = percentualAbsoluto(quedaDeAlcance)

    const alvo = arredondar(mediana(publicacoesAnteriores), 0)
    const faixa = faixaPorExtenso(alcanceAnterior)
    const volta =
      `Volte para ${alvo} ${publicacoesPorExtenso(alvo)} por semana durante ` +
      `${SEMANAS_DE_TESTE} semanas, sem trocar formato nem horário.`

    const cadenciaAtualTexto = formatarNumero(cadenciaAtual, CASAS_DE_CADENCIA)
    const cadenciaAnteriorTexto = formatarNumero(cadenciaAnterior, CASAS_DE_CADENCIA)
    const porPublicacaoAtualTexto = formatarNumero(porPublicacaoAtual.valor, CASAS_DE_ALCANCE)
    const porPublicacaoAnteriorTexto = formatarNumero(porPublicacaoAnterior.valor, CASAS_DE_ALCANCE)
    const alcanceAtualTexto = formatarNumero(alcanceAtual, CASAS_DE_ALCANCE)
    const alcanceAnteriorTexto = formatarNumero(alcanceAnterior, CASAS_DE_ALCANCE)
    const comparacaoDeCadencia =
      `A média de publicações por semana foi ${cadenciaAtualTexto} nas últimas ` +
      `${SEMANAS_POR_JANELA} semanas, contra ${cadenciaAnteriorTexto} nas ` +
      `${SEMANAS_POR_JANELA} anteriores.`

    /**
     * Um texto por desfecho, em vez de um complemento condicional dentro de uma
     * frase unica: foi o complemento que deixou "ficou praticamente igual"
     * aparecer ao lado de uma alta de 50%.
     */
    const TEXTOS = {
      cadencia: {
        severidade: 'atencao',
        peso: 90,
        rotulo: 'Frequência de publicação, causa nomeada',
        frase:
          `Seu alcance não caiu. Sua frequência caiu ${percentualDeCadencia}% e o ` +
          'alcance seguiu junto.',
        apoio:
          `${comparacaoDeCadencia} O alcance por publicação ficou praticamente igual: ` +
          `${porPublicacaoAtualTexto} contra ${porPublicacaoAnteriorTexto}. O total ` +
          `alcançado caiu ${percentualDeAlcance}% porque saiu menos conteúdo.`,
        acao: volta,
        confirmacao:
          `Se o alcance voltar para a faixa de ${faixa} sem nenhuma outra mudança, a ` +
          'causa está confirmada. Se não voltar, o próximo suspeito é formato, e o ' +
          'teste seguinte muda uma variável só.',
      },
      acompanhado: {
        severidade: 'critico',
        peso: 95,
        rotulo: 'Frequência e alcance por publicação em queda',
        frase:
          `Sua frequência caiu ${percentualDeCadencia}% e o alcance por publicação caiu ` +
          `${percentualPorPublicacao}%. Não é só volume: o que você publica também está ` +
          'alcançando menos.',
        apoio:
          `${comparacaoDeCadencia} O alcance por publicação também recuou: ` +
          `${porPublicacaoAtualTexto} contra ${porPublicacaoAnteriorTexto}. São duas ` +
          'variáveis se movendo juntas, e o teste precisa separar uma da outra.',
        acao: volta,
        confirmacao:
          `Restabelecida a cadência, se o alcance por publicação continuar abaixo de ` +
          `${porPublicacaoAnteriorTexto}, a causa não era volume e o próximo teste é ` +
          'de formato — uma variável por vez.',
      },
      'sem-queda': {
        severidade: 'ok',
        // Peso baixo: nao e problema, e nao pode roubar o veredito de quem e.
        peso: 55,
        rotulo: 'Menos publicações, mesmo alcance',
        frase:
          variacaoPorPublicacao !== null && variacaoPorPublicacao >= LIMIAR_DE_ESTABILIDADE
            ? `Você publicou ${percentualDeCadencia}% menos e o alcance total não caiu: ` +
              `cada publicação passou a alcançar ${percentualPorPublicacao}% a mais.`
            : `Sua frequência caiu ${percentualDeCadencia}%, e o alcance total não ` +
              'acompanhou a queda.',
        apoio:
          `${comparacaoDeCadencia} O alcance total ficou em ${alcanceAtualTexto} contra ` +
          `${alcanceAnteriorTexto}, e o alcance por publicação foi de ` +
          `${porPublicacaoAnteriorTexto} para ${porPublicacaoAtualTexto}. Menos conteúdo ` +
          'entregando o mesmo resultado é ganho de eficiência, não perda de alcance.',
        acao:
          'Antes de voltar ao volume anterior, descubra o que mudou nas publicações ' +
          'recentes: o ganho por publicação é o ativo aqui, e mais volume pode diluí-lo.',
        confirmacao:
          `Se você voltar para ${alvo} ${publicacoesPorExtenso(alvo)} por semana e o ` +
          `alcance por publicação cair de volta para ${porPublicacaoAnteriorTexto}, o ` +
          'ganho vinha da seleção do conteúdo, não do formato.',
      },
    }

    const texto = TEXTOS[desfecho]
    const intervaloRecente = intervaloDaJanela(recentes)
    const intervaloAnterior = intervaloDaJanela(anteriores)
    const contiguo = intervaloRecente.contiguo && intervaloAnterior.contiguo

    return {
      regra: 'cadencia-em-queda',
      versaoRegra: '0.3.0',
      severidade: texto.severidade,
      rotulo: texto.rotulo,
      frase: texto.frase,
      apoio: texto.apoio,
      acao: texto.acao,
      confirmacao: texto.confirmacao,
      // A tela anuncia o periodo que a regra realmente comparou. O periodo do
      // diagnostico e maior — ele cobre o historico inteiro — e usar um no lugar
      // do outro faz o mesmo numero aparecer sob duas janelas diferentes.
      janela: {
        semanas: SEMANAS_POR_JANELA,
        recentes: intervaloRecente,
        anteriores: intervaloAnterior,
      },
      evidencias: [
        montarEvidencia({
          rotulo: `${ROTULO_DE_PUBLICACOES} por semana`,
          metrica: 'publicacoes',
          atual: cadenciaAtual,
          anterior: cadenciaAnterior,
          variacao: quedaDeCadencia,
          casas: CASAS_DE_CADENCIA,
          // Publicar menos so e ruim quando custou alcance. No desfecho sem-queda
          // custou nada, e pintar a linha de alerta contradiria a propria frase.
          tom: desfecho === 'sem-queda' ? 'neutro' : tomDaVariacao(quedaDeCadencia, true),
        }),
        montarEvidencia({
          rotulo: ROTULO_DE_ALCANCE,
          metrica: 'alcance',
          atual: alcanceAtual,
          anterior: alcanceAnterior,
          variacao: quedaDeAlcance,
          casas: CASAS_DE_ALCANCE,
          tom: tomDaVariacao(quedaDeAlcance, true),
        }),
        montarEvidencia({
          rotulo: 'Alcance por publicação',
          metrica: 'alcance',
          atual: porPublicacaoAtual.valor,
          anterior: porPublicacaoAnterior.valor,
          variacao: variacaoPorPublicacao,
          casas: CASAS_DE_ALCANCE,
          tom: tomDaVariacao(variacaoPorPublicacao, true),
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
      limites: [
        porPublicacaoAtual.limiteDeAgregacao,
        'sem-causa-externa',
        contiguo ? null : 'janela-nao-contigua',
      ].filter(Boolean),
      peso: texto.peso,
    }
  },
}
