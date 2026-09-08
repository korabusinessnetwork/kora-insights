import { Link } from 'react-router-dom'

import { Aviso, Marca } from '../../components/shared/index.js'
import { formatarDataCurta } from '../../metricas/index.js'
import { ROTAS } from '../../constants/rotas.js'
import './paginas.css'

/**
 * Política de privacidade — rota pública (contratos.md, seção 6).
 *
 * O App Review exige política publicada em URL pública e estável, e a LGPD
 * exige o mesmo por conta própria (docs/11_SEGURANCA/app-review.md, seção 4).
 * A página é pública de verdade: não lê banco, não pede sessão.
 *
 * O que ainda não foi decidido aparece marcado como pendente, e não preenchido
 * com um valor plausível. Política com dado inventado é pior do que política
 * incompleta: a incompleta atrasa o review, a inventada é falsa.
 */

/** Data da última revisão deste texto. Muda junto com o texto, nunca sozinha. */
const ATUALIZADA_EM = '2026-09-05'

/**
 * O que falta para esta política ficar completa. Cada item tem dono fora da
 * engenharia (docs/03_REGRAS_DE_NEGOCIO/conformidade.md, seções 3.1 e 3.5).
 * @type {readonly string[]}
 */
const PENDENCIAS = Object.freeze([
  'Razão social, CNPJ e endereço do controlador.',
  'E-mail do encarregado pelo tratamento de dados.',
  'Prazo de retenção dos dados após o cancelamento ou a desconexão da conta.',
  'Confirmação da base legal com assessoria jurídica.',
])

/**
 * @returns {JSX.Element}
 */
export default function Privacidade() {
  return (
    <div className="ka-pagina">
      <header className="ka-pagina__topo">
        <Link to={ROTAS.raiz} className="ka-pagina__marca">
          <Marca />
        </Link>
        <Link to={ROTAS.dados} className="ka-pagina__atalho">
          Seus dados e exclusão
        </Link>
      </header>

      <main className="ka-pagina__conteudo" id="conteudo">
        <p className="ka-pagina__sobrenome">Documento público</p>
        <h1 className="ka-pagina__titulo">Política de privacidade</h1>
        <p className="ka-pagina__data">
          Última atualização: {formatarDataCurta(ATUALIZADA_EM)}
        </p>

        <Aviso variante="atencao" titulo="Versão incompleta">
          Esta política ainda não está fechada. O que falta depende de decisão do responsável
          pelo produto, aparece marcado como pendente ao longo do texto e não foi preenchido por
          suposição.
        </Aviso>

        {/* A lista fica fora do Aviso porque ele monta o texto dentro de um
            parágrafo, e lista dentro de parágrafo é marcação inválida. */}
        <ul className="ka-pagina__pendencias">
          {PENDENCIAS.map((pendencia) => (
            <li key={pendencia}>{pendencia}</li>
          ))}
        </ul>

        <section className="ka-pagina__secao">
          <h2>Quem trata os dados</h2>
          <p>
            O Kora Insights é operado pela Kora Business Network.{' '}
            <span className="ka-pagina__pendente">
              Pendente: razão social, CNPJ, endereço e e-mail do encarregado.
            </span>{' '}
            Enquanto esses dados não estiverem publicados aqui, pedidos sobre privacidade devem
            ser feitos pelo mesmo canal de suporte usado na contratação.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Que dados coletamos</h2>
          <p>
            Esta é a lista real do que existe no banco hoje, e não uma lista genérica de
            categorias possíveis.
          </p>
          <dl className="ka-pagina__lista">
            <dt>De quem usa o produto</dt>
            <dd>
              E-mail de acesso e o vínculo entre esse e-mail e o espaço de trabalho da
              assinatura. Não usamos senha: o acesso é por link enviado ao e-mail.
            </dd>

            <dt>Da conta de Instagram conectada</dt>
            <dd>
              Identificadores da conta profissional: identificador do Instagram, arroba, nome de
              exibição e a Página do Facebook vinculada.
            </dd>

            <dt>Métricas</dt>
            <dd>
              Valores agregados da conta e das publicações — contas alcançadas, visualizações,
              interações, curtidas, comentários, salvamentos, compartilhamentos, seguidores e
              visitas ao perfil.
            </dd>

            <dt>Registros de funcionamento</dt>
            <dd>
              Data e resultado de cada coleta, os diagnósticos gerados e o comprovante de cada
              pedido de exclusão. O comprovante guarda contagem de itens apagados, nunca o
              conteúdo apagado.
            </dd>
          </dl>
        </section>

        <section className="ka-pagina__secao">
          <h2>O que não coletamos</h2>
          <p>
            Nenhum dado demográfico da audiência: nem idade, nem gênero, nem cidade, nem
            qualquer recorte de público. Nenhum identificador de seguidor individual. Nenhuma
            mensagem direta e nenhum conteúdo de comentário.
          </p>
          <p>
            Também não pedimos permissão para publicar em seu nome nem para moderar comentários.
            As permissões solicitadas à Meta são só as quatro que o diagnóstico usa, e cada uma
            tem uma tela no produto que a justifica.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Para que usamos</h2>
          <p>
            Para gerar o diagnóstico de crescimento da sua própria conta e o relatório que sai
            dele. Não usamos os dados de uma conta para diagnosticar outra, não treinamos modelo
            com eles e não vendemos dado bruto de plataforma — o que vendemos é a interpretação.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Base legal</h2>
          <p>
            A conexão da conta acontece por autorização explícita do dono dela, pelo login da
            Meta, e o tratamento serve à execução do contrato de assinatura.{' '}
            <span className="ka-pagina__pendente">
              Pendente: confirmação da base legal com assessoria jurídica.
            </span>
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Como o token de acesso é guardado</h2>
          <p>
            O token que a Meta emite quando você autoriza a conta nunca chega ao seu navegador e
            nunca aparece em endereço, em registro de erro ou em relatório. Ele fica em um cofre
            no servidor e só é lido pela rotina de coleta. Desconectar a conta apaga esse token.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Com quem compartilhamos</h2>
          <p>
            Com ninguém. Os dados ficam na infraestrutura que hospeda o produto e não são
            repassados a terceiros, nem para publicidade, nem para venda de base.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Enquanto a conta estiver conectada, guardamos o histórico desde o primeiro dia de
            coleta: é ele que permite comparar semanas e apontar uma causa.{' '}
            <span className="ka-pagina__pendente">
              Pendente: prazo de retenção depois do cancelamento da assinatura ou da desconexão
              da conta.
            </span>{' '}
            Até que esse prazo seja publicado aqui, a única forma de apagar o histórico é pedir a
            exclusão, e ela apaga tudo na hora.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Seus direitos</h2>
          <p>
            Você pode pedir acesso, correção, portabilidade e exclusão dos dados tratados aqui. A
            página <Link to={ROTAS.dados}>Seus dados e exclusão</Link> explica o que cada pedido
            faz e permite disparar a exclusão pela própria tela.
          </p>
        </section>

        <section className="ka-pagina__secao">
          <h2>Mudanças nesta política</h2>
          <p>
            Quando este texto mudar, a data no topo muda junto. Mudança que aumente o que é
            coletado é avisada antes de entrar em vigor.
          </p>
        </section>
      </main>

      <footer className="ka-pagina__rodape">
        <Link to={ROTAS.raiz}>Voltar ao Kora Insights</Link>
      </footer>
    </div>
  )
}
