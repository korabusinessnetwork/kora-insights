/**
 * Porta unica da camada de servicos.
 *
 * Tela importa daqui, nunca de um arquivo interno e nunca do `@supabase/supabase-js`
 * (overview.md: `src/lib` e a UNICA porta para o backend). Assim, trocar o
 * caminho de uma consulta, ou o backend inteiro, nao toca em nenhuma feature.
 *
 * `demonstracao/` fica de fora de proposito: quem consome nao escolhe a origem —
 * a camada decide, e conta a decisao em `meta.origem`.
 */

export { estaEmModoDemonstracao, obterCliente } from './supabase.js'

export {
  falha,
  falhaDeErro,
  montarMeta,
  ok,
  ORIGEM_DEMONSTRACAO,
  ORIGEM_SUPABASE,
  VERSAO_DO_ENVELOPE,
} from './envelope.js'

export { CODIGOS, MENSAGENS, erroDeServico, mensagemDoErro, traduzirErroDoSupabase } from './erros.js'

export {
  ehCodigoDeOAuth,
  ehDataIso,
  ehEmail,
  ehEstadoDeOAuth,
  ehIdentificador,
  ehIdentificadorDeConta,
  ehIdentificadorDeTenant,
  ehInteiroEntre,
  ehIso8601,
  ehTextoNaoVazio,
  ehUuid,
} from './validacao.js'

export { aoMudarSessao, entrarComEmail, exigirSessao, sair, sessaoAtual } from './autenticacao.js'

export { converterTenant, listarTenantsDoUsuario, obterTenant } from './tenants.js'

export {
  contaEstaVisivel,
  converterConta,
  listarContasConectadas,
  obterConta,
} from './contas.js'

export {
  converterDiagnostico,
  listarDiagnosticos,
  obterDiagnosticoMaisRecente,
} from './diagnosticos.js'

export { listarSerieSemanal } from './snapshots.js'

export { converterEvento, listarEventosDeColeta } from './coleta.js'

export {
  FUNCOES,
  PERMISSOES,
  concluirConexao,
  desconectarConta,
  gerarEstadoDeOAuth,
  solicitarExclusaoDeDados,
  urlDeConsentimento,
} from './conexaoMeta.js'
