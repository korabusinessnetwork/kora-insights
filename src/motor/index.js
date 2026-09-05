/**
 * Porta unica do motor. As regras e a camada de servicos importam daqui, nunca
 * dos arquivos internos: assim mover um calculo de `janelas.js` para
 * `estatistica.js` nao quebra ruleset publicado.
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
