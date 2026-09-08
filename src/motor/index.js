/**
 * Porta unica do motor. As regras, a camada de servicos e — para descrever um
 * diagnostico ja pronto, nunca para calcular um — a tela importam daqui, nunca
 * dos arquivos internos: assim mover um calculo de `janelas.js` para
 * `estatistica.js` nao quebra ruleset publicado.
 *
 * `frescorDoDiagnostico` e o caso da tela: ele nao produz veredito nenhum, so
 * diz ha quanto tempo o veredito foi produzido.
 */

export {
  arredondar,
  coeficienteDeVariacao,
  desvioPadrao,
  media,
  mediana,
  percentualAbsoluto,
  soma,
  ultimo,
  variacao,
  variacaoExibida,
} from './estatistica.js'

export { DIAS_ATE_ENVELHECER, frescorDoDiagnostico } from './frescor.js'

export { montarHistorico } from './historico.js'

export {
  compararJanelas,
  intervaloDaJanela,
  janelasSaoContiguas,
  mediaPorPublicacao,
  ultimasJanelasCompletas,
  valorDaJanela,
  valoresPorPublicacao,
} from './janelas.js'

export { CATALOGO_DE_LIMITES, gerarDiagnostico, idDoDiagnostico } from './motor.js'
