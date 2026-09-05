import { ListaDeLimites, TituloDeSecao } from '../../../components/shared/index.js'
import { PERMISSOES } from '../../../lib/index.js'
import { obterMetrica } from '../../../metricas/index.js'
import './RequisitosDaConexao.css'

/**
 * O que precisa ser verdade antes do clique — a tela que o ADR-002 exige.
 *
 * A variante escolhida (Instagram API with Facebook Login) cobra um preco de
 * onboarding: conta profissional **e** vinculada a uma Pagina do Facebook que
 * quem autoriza administra. Mandar a pessoa para o dialogo da Meta e deixar que
 * ela descubra isso la dentro previne zero erros e exibe um depois — o inverso
 * de "prevencao de erro > mensagem de erro" (CLAUDE.md).
 *
 * Cada requisito traz uma checagem que a pessoa faz agora, no proprio celular,
 * e o que fazer se a resposta for nao. Requisito sem checagem vira duvida, e
 * duvida no onboarding vira chamada de suporte.
 */

/**
 * @typedef {object} Requisito
 * @property {string} codigo
 * @property {string} titulo
 * @property {string} checagem o que conferir agora, em uma frase
 * @property {string} comoResolver o caminho quando a resposta e nao
 * @property {string} porque a razao, para o requisito nao parecer capricho nosso
 */

/** @type {readonly Requisito[]} */
export const REQUISITOS = Object.freeze([
  {
    codigo: 'conta-profissional',
    titulo: 'A conta precisa ser Profissional — Empresa ou Criador de conteúdo',
    checagem:
      'Abra o Instagram, toque na sua foto e em Editar perfil. Se aparecer "Categoria" e ' +
      'botão de contato, a conta já é profissional.',
    comoResolver:
      'Se não for: Configurações e privacidade → Tipo de conta e ferramentas → Mudar para ' +
      'conta profissional. É gratuito, leva um minuto e dá para voltar atrás depois.',
    porque:
      'Alcance, salvamento e visita ao perfil só existem para conta profissional. Em conta ' +
      'pessoal esse dado não existe nem para o próprio dono — é limite da Meta, não escolha nossa.',
  },
  {
    codigo: 'pagina-vinculada',
    titulo: 'A conta precisa estar vinculada a uma Página do Facebook',
    checagem:
      'No Instagram: Editar perfil → Página. Se o campo estiver vazio, ainda não há vínculo.',
    comoResolver:
      'No mesmo lugar, toque em Página e escolha conectar uma Página existente ou criar uma ' +
      'na hora. Página nova, sem nenhuma publicação, serve.',
    porque:
      'É por esse vínculo que a Meta autoriza a leitura das métricas na versão da API que ' +
      'usamos. Sem ele, a autorização até acontece, mas volta sem nenhuma conta para ler.',
  },
  {
    codigo: 'administrador-da-pagina',
    titulo: 'Você precisa administrar essa Página do Facebook',
    checagem:
      'No Facebook, abra a Página e vá em Configurações → Acesso à Página. Seu nome precisa ' +
      'aparecer com acesso total.',
    comoResolver:
      'Se quem administra é outra pessoa — um sócio, a agência anterior —, peça acesso total ' +
      'antes de autorizar, ou façam a conexão juntos, no computador de quem administra.',
    porque:
      'A autorização é dada por quem administra a Página. Sem esse acesso, a conta simplesmente ' +
      'não aparece na tela de autorização da Meta, e a causa não fica óbvia por lá.',
  },
])

/**
 * O que passamos a ler, em codigo canonico. O rotulo sai do dicionario
 * (`src/metricas`), e nao de texto escrito aqui: assim a promessa da tela de
 * conexao e a palavra do diagnostico sao a mesma, e nenhum nome da Meta
 * aparece na interface (ADR-003).
 * @type {readonly string[]}
 */
export const METRICAS_QUE_LEMOS = Object.freeze([
  'alcance',
  'visualizacoes',
  'interacoes',
  'salvamentos',
  'seguidores',
  'visitas_ao_perfil',
  'publicacoes',
])

/** @type {readonly string[]} */
export const O_QUE_NAO_FAZEMOS = Object.freeze([
  'Não publicamos e não agendamos nada. Nenhuma permissão que pedimos permite postar.',
  'Não lemos nem respondemos mensagem direta.',
  'Não respondemos nem apagamos comentário.',
  'Não acessamos nenhuma conta que você não tenha autorizado, nem a de concorrente.',
  'Não revendemos dado bruto da plataforma. O que vendemos é a leitura dele.',
])

/**
 * Explicacao humana de cada permissao pedida. A chave e o nome tecnico que vai
 * no `scope` — e a lista renderizada e `PERMISSOES`, de `src/lib`, e nao esta:
 * uma permissao nova no servico aparece na tela como falta de explicacao, em
 * vez de ser pedida em silencio (ADR-002).
 * @type {Readonly<Record<string, string>>}
 */
export const EXPLICACAO_DA_PERMISSAO = Object.freeze({
  instagram_basic:
    'Ler o perfil e a lista de publicações da conta autorizada: data, formato e legenda.',
  instagram_manage_insights:
    'Ler as métricas da conta e das publicações. É o insumo do diagnóstico: sem isso não ' +
    'existe produto.',
  pages_show_list:
    'Ver quais Páginas do Facebook você administra, para encontrar a que está vinculada à conta.',
  pages_read_engagement:
    'Confirmar o vínculo entre a Página e a conta profissional. Sem essa confirmação a Meta não ' +
    'libera a leitura das métricas.',
})

/**
 * O que a conexao **nao** entrega. Nao e letra miuda: e a diferenca entre um
 * cliente que confia no numero e um que descobre o buraco sozinho, depois de
 * pagar (memory/identity.md, honestidade de dado).
 * @type {readonly {codigo: string, texto: string}[]}
 */
export const LIMITES_DA_CONEXAO = Object.freeze([
  {
    codigo: 'sem-passado',
    texto:
      'O histórico anterior à conexão. O Instagram não devolve o passado, então a sua série ' +
      'começa no dia em que você autoriza.',
  },
  {
    codigo: 'sem-identidade-da-audiencia',
    texto:
      'Quem são as pessoas alcançadas. A Meta entrega contagem, nunca a lista de quem viu.',
  },
  { codigo: 'alcance-somado', texto: obterMetrica('alcance').limiteDeAgregacao },
  {
    codigo: 'sem-concorrente',
    texto:
      'Dado de concorrente. A comparação está no roteiro do produto e ainda não existe aqui — ' +
      'e quando existir, vai dizer o que não dá para saber do outro perfil.',
  },
  {
    codigo: 'sem-conta-pessoal',
    texto:
      'Qualquer coisa sobre conta pessoal. Sem conta profissional não há métrica, e nenhuma ' +
      'ferramenta contorna isso.',
  },
])

/**
 * @param {object} props
 * @param {readonly string[]} [props.permissoes] permissoes pedidas; padrao: as do serviço
 * @returns {JSX.Element}
 */
export default function RequisitosDaConexao({ permissoes = PERMISSOES }) {
  return (
    <div className="requisitos">
      <section className="requisitos__secao" aria-labelledby="requisitos-condicoes">
        <TituloDeSecao apoio="Confira agora, leva dois minutos">
          <span id="requisitos-condicoes">Três coisas precisam ser verdade na conta</span>
        </TituloDeSecao>

        <ol className="requisitos__lista">
          {REQUISITOS.map((requisito) => (
            <li className="requisitos__item" key={requisito.codigo}>
              <h3 className="requisitos__titulo">{requisito.titulo}</h3>
              <p className="requisitos__linha" data-papel="checagem">
                <strong className="requisitos__marcador">Como conferir:</strong>{' '}
                {requisito.checagem}
              </p>
              <p className="requisitos__linha" data-papel="resolver">
                <strong className="requisitos__marcador">Se não estiver assim:</strong>{' '}
                {requisito.comoResolver}
              </p>
              <p className="requisitos__linha" data-papel="porque">
                {requisito.porque}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="requisitos__colunas">
        <section className="requisitos__secao" aria-labelledby="requisitos-leitura">
          <TituloDeSecao>
            <span id="requisitos-leitura">O que passamos a ler</span>
          </TituloDeSecao>
          <ul className="requisitos__marcada">
            {METRICAS_QUE_LEMOS.map((codigo) => (
              <li className="requisitos__marcado" key={codigo}>
                {obterMetrica(codigo).rotulo}
              </li>
            ))}
            <li className="requisitos__marcado">
              A lista das publicações, com data e formato — é o que permite comparar semanas.
            </li>
          </ul>
        </section>

        <section className="requisitos__secao" aria-labelledby="requisitos-nao-fazemos">
          <TituloDeSecao>
            <span id="requisitos-nao-fazemos">O que não fazemos</span>
          </TituloDeSecao>
          <ul className="requisitos__marcada" data-tom="negativa">
            {O_QUE_NAO_FAZEMOS.map((item) => (
              <li className="requisitos__marcado" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="requisitos__secao" aria-labelledby="requisitos-permissoes">
        <TituloDeSecao apoio="Quatro, e nenhuma a mais">
          <span id="requisitos-permissoes">As permissões que a Meta vai pedir</span>
        </TituloDeSecao>
        <ul className="requisitos__permissoes">
          {permissoes.map((permissao) => (
            <li className="requisitos__permissao" key={permissao}>
              <p className="requisitos__uso">
                {EXPLICACAO_DA_PERMISSAO[permissao] ??
                  'Permissão sem explicação nesta tela. Permissão que a tela não justifica não ' +
                    'deveria ser pedida — trate isto como pendência, não como detalhe.'}
              </p>
              <p className="requisitos__escopo">{permissao}</p>
            </li>
          ))}
        </ul>
      </section>

      <ListaDeLimites titulo="O que a conexão não nos dá" limites={LIMITES_DA_CONEXAO} />
    </div>
  )
}
