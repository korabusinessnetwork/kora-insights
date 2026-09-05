import { Estado, ListaDePassos } from '../../../components/shared/index.js'
import { ROTAS } from '../../../constants/rotas.js'
import './SemContaConectada.css'
import { SEMANAS_PARA_DIAGNOSTICO } from '../../../rules/requisitos.js'

/**
 * Textos da identidade (`docs/02_DESIGN_SYSTEM/identidade/02-sem-conta-conectada.png`),
 * copiados palavra por palavra. Quando o desenho e o codigo divergirem, o
 * codigo esta errado (identidade/README.md) — por isso ficam em constante, e
 * nao espalhados no JSX: mudar a copia e uma linha, no lugar obvio.
 */
const TITULO = 'Nenhuma conta conectada, então não existe diagnóstico para mostrar.'

const EXPLICACAO =
  'A tela fica vazia de propósito. Preferimos não ter nada aqui a colocar um gráfico ' +
  'de exemplo que não é da sua marca.'

const ROTULO_DE_CONEXAO = 'Conectar uma conta do Instagram'

const ROTULO_DOS_REQUISITOS = 'Ver o que é preciso antes de conectar'

const RODAPE =
  'Não publicamos, não agendamos e não acessamos nenhuma conta que você não autorizou.'

/**
 * Os tres passos ate o primeiro diagnostico, na ordem em que acontecem.
 *
 * O prazo do passo 3 vem de `src/rules/requisitos.js`, nao de um literal: e o
 * proprio ruleset dizendo de quanto historico precisa. A identidade desenhou
 * "8 semanas"; o ruleset 0.3.0 compara 8 contra 8 e portanto exige 16. Prometer
 * o numero menor faria o cliente conectar a conta contando com um prazo que o
 * motor nunca poderia cumprir — ver a nota em docs/09_BACKLOG sobre encurtar a
 * janela para a Fase 0.
 *
 * @type {{ titulo: string, descricao: string }[]}
 */
export const PASSOS_ATE_O_DIAGNOSTICO = [
  {
    titulo: 'Você autoriza o acesso',
    descricao:
      'Conta profissional vinculada a uma Página do Facebook. Se não estiver, a gente ' +
      'resolve isso junto em 3 minutos.',
  },
  {
    titulo: 'Guardamos o histórico desde hoje',
    descricao:
      'O Instagram apaga parte do dado com o tempo. A partir da conexão, o histórico é ' +
      'seu e exportável.',
  },
  {
    titulo: 'O primeiro diagnóstico sai em 24 horas',
    descricao:
      `Precisamos de ${SEMANAS_PARA_DIAGNOSTICO} semanas de publicação para nomear uma ` +
      'causa com segurança. Com menos que isso, dizemos que ainda não sabemos.',
  },
]

/**
 * O destino vem de `src/constants/rotas.js`, a tabela de contratos.md (secao 6)
 * escrita uma vez so — caminho digitado dentro do JSX espalha o contrato de
 * rotas por dezenas de arquivos.
 *
 * As duas acoes apontam para o mesmo lugar de proposito: `/conectar` **e** a
 * tela que explica o requisito da Pagina do Facebook antes do clique (ADR-002).
 * Uma chega la como acao, a outra como convite a ler antes.
 */
export const ROTA_DE_CONEXAO = ROTAS.conectar

/**
 * O vazio como conteudo: nenhuma conta conectada, e por isso nenhum grafico de
 * exemplo.
 *
 * As duas acoes sao ancoras, e nao botoes, porque as duas **navegam**: botao que
 * navega quebra abrir em nova aba (`docs/06_COMPONENTES/catalogo.md`). O destino
 * chega por prop para que o shell possa trocar a rota sem tocar nesta tela.
 *
 * @param {object} props
 * @param {string} [props.hrefDeConexao] destino do botao principal
 * @param {string} [props.hrefDeRequisitos] destino do link de requisitos (ADR-002)
 * @returns {JSX.Element}
 */
export default function SemContaConectada({
  hrefDeConexao = ROTA_DE_CONEXAO,
  hrefDeRequisitos = ROTA_DE_CONEXAO,
}) {
  return (
    <div className="sem-conta">
      <div className="sem-conta__colunas">
        <Estado tipo="vazio" titulo={TITULO} descricao={EXPLICACAO}>
          <p className="sem-conta__acoes">
            <a className="sem-conta__conectar" href={hrefDeConexao}>
              {ROTULO_DE_CONEXAO}
            </a>
            <a className="sem-conta__requisitos" href={hrefDeRequisitos}>
              {ROTULO_DOS_REQUISITOS}
            </a>
          </p>
        </Estado>

        <ListaDePassos passos={PASSOS_ATE_O_DIAGNOSTICO} />
      </div>

      <p className="sem-conta__rodape">{RODAPE}</p>
    </div>
  )
}
