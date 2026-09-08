/**
 * Quanto historico o ruleset vigente exige para nomear uma causa.
 *
 * Mora sozinho, num modulo minusculo, porque **a tela e o motor precisam ler o
 * mesmo numero**. Enquanto a promessa do onboarding era um literal e o piso do
 * ruleset era outro, o produto anunciava 8 semanas e entregava em 16: o cliente
 * conectava a conta com base num prazo que o motor nunca poderia cumprir, e
 * descobria dois meses depois.
 *
 * Importar daqui custa nada em bundle (sao dois numeros) e fecha a classe do
 * defeito, nao so o caso: mudar o ruleset muda a promessa da tela junto.
 */

/** Semanas de cada lado da comparacao. Oito e o menor bloco que nao vira ruido. */
export const SEMANAS_POR_JANELA = 8

/** Total de semanas completas para o primeiro diagnostico de causa: 8 contra 8. */
export const SEMANAS_PARA_DIAGNOSTICO = SEMANAS_POR_JANELA * 2
