import { Navigate, useSearchParams } from 'react-router-dom'

import { Aviso, Botao, Estado, Marca } from '../../../components/shared/index.js'
import { PARAMETRO_DE_DESTINO, ROTAS } from '../../../constants/rotas.js'
import { useSessao } from '../../../context/SessaoContexto.jsx'
import useEntrar from '../hooks/useEntrar.js'
import './Entrar.css'

/**
 * A porta do produto. Link magico por e-mail: nao existe senha para criar, para
 * esquecer nem para vazar (`src/lib/autenticacao.js`).
 *
 * A tela tem tres obrigacoes que nao sao decoracao:
 *
 * - dizer que o acesso chega **por e-mail**, antes de a pessoa ficar esperando
 *   uma senha que nunca vai ser pedida;
 * - dizer o que fazer quando o link nao chega, que e a duvida numero um de quem
 *   nunca usou este tipo de login;
 * - **nao** revelar se um endereco esta cadastrado (ver `useEntrar.js`).
 */

const TITULO = 'Entre com seu e-mail. Não há senha para criar nem para esquecer.'

const EXPLICACAO =
  'Enviamos um link de acesso para o seu e-mail. Abrir o link entra na sua conta — ' +
  'é por isso que não existe senha aqui para alguém descobrir.'

const ROTULO_DO_CAMPO = 'Seu e-mail'

const ROTULO_DE_ENVIO = 'Enviar o link de acesso'

const TITULO_DA_CONFIRMACAO = 'Link enviado. Confira seu e-mail.'

/**
 * A frase que fecha a confirmacao sem responder se o endereco existe. Ela e
 * deliberadamente igual nos dois casos, e a tela diz por que — o cliente
 * merece saber que a ambiguidade e escolha, e nao descuido.
 */
const NEUTRALIDADE =
  'Não dizemos se um e-mail está ou não cadastrado: responder isso entregaria a lista ' +
  'de clientes para quem ficasse tentando endereços.'

/** @type {readonly string[]} */
const SE_NAO_CHEGAR = Object.freeze([
  'Procure no spam e na aba de promoções. Link automático costuma parar por lá.',
  'Confira se o endereço acima está escrito certo. Um caractere trocado leva o link ' +
    'para outra caixa.',
  'Cada link é de uso único. Se você pedir outro, use sempre o mais recente.',
])

const RODAPE =
  'Só usamos seu e-mail para dar acesso e falar com você sobre a conta. ' +
  'Nada de conta do Instagram é acessado antes de você autorizar.'

/**
 * Destino de volta, saneado.
 *
 * A rota protegida guarda em `?proximo=` o caminho que a pessoa tentou abrir
 * (`src/constants/rotas.js`). Como esse valor chega pela URL, ele e entrada de
 * usuario: sem esta funcao, `?proximo=https://outro.site` viraria um
 * redirecionamento aberto assinado pelo nosso dominio — o link parece nosso,
 * chega autenticado e sai do produto. So caminho interno passa.
 *
 * @param {string|null} bruto valor cru do parametro
 * @returns {string} caminho para onde mandar quem ja tem sessao
 */
export function destinoSeguro(bruto) {
  if (typeof bruto !== 'string' || bruto.length === 0) return ROTAS.contas
  // `//host` e `/\host` sao endereco de outro site com cara de caminho: o
  // navegador resolve os dois como protocolo relativo.
  if (bruto[0] !== '/' || bruto[1] === '/' || bruto[1] === '\\') return ROTAS.contas
  // Voltar para a propria entrada deixaria a pessoa em um circulo.
  if (bruto.startsWith(ROTAS.entrar)) return ROTAS.contas
  return bruto
}

/**
 * @returns {JSX.Element}
 */
export default function Entrar() {
  const { autenticado, carregando: conferindoSessao } = useSessao()
  const [parametros] = useSearchParams()
  const {
    email,
    definirEmail,
    erro,
    avisoDoLink,
    enviando,
    enviado,
    enviarLink,
    corrigirEndereco,
  } = useEntrar()

  if (conferindoSessao) {
    return (
      <Estado
        tipo="carregando"
        titulo="Conferindo sua sessão"
        descricao="Só um instante — pode ser que você já esteja dentro."
      />
    )
  }

  // A volta do link de acesso recarrega a pagina em `/entrar`: sem este desvio,
  // quem acabou de entrar ficaria olhando o formulario de login ja autenticado.
  if (autenticado) {
    return <Navigate to={destinoSeguro(parametros.get(PARAMETRO_DE_DESTINO))} replace />
  }

  /** @param {import('react').FormEvent<HTMLFormElement>} evento */
  function handleSubmit(evento) {
    evento.preventDefault()
    enviarLink()
  }

  return (
    <main className="entrar">
      <div className="entrar__folha">
        <Marca como="p" />

        {avisoDoLink ? (
          <Aviso variante="atencao" titulo="Link de acesso">
            {avisoDoLink}
          </Aviso>
        ) : null}

        {enviado ? (
          <section className="entrar__bloco" role="status">
            <h1 className="entrar__titulo">{TITULO_DA_CONFIRMACAO}</h1>
            <p className="entrar__apoio">
              Se <strong className="entrar__endereco">{email.trim()}</strong> tiver acesso ao Kora
              Insights, o link chega em alguns instantes.
            </p>
            <p className="entrar__nota">{NEUTRALIDADE}</p>

            <h2 className="entrar__subtitulo">Se não chegar</h2>
            <ul className="entrar__lista">
              {SE_NAO_CHEGAR.map((item) => (
                <li key={item} className="entrar__item">
                  {item}
                </li>
              ))}
            </ul>

            <p className="entrar__acoes">
              <Botao variante="secundario" aoClicar={corrigirEndereco}>
                Corrigir o endereço ou pedir outro link
              </Botao>
            </p>
          </section>
        ) : (
          <section className="entrar__bloco">
            <h1 className="entrar__titulo">{TITULO}</h1>
            <p className="entrar__apoio">{EXPLICACAO}</p>

            <form className="entrar__formulario" onSubmit={handleSubmit} noValidate>
              <div className="entrar__campo">
                <label className="entrar__rotulo" htmlFor="entrar-email">
                  {ROTULO_DO_CAMPO}
                </label>
                {/* `noValidate` no formulario e proposital: a validacao e a nossa,
                    em `useEntrar`, com frase em pt-BR — a do navegador muda de
                    idioma e de texto conforme a maquina do cliente. */}
                <input
                  className="entrar__entrada"
                  id="entrar-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="voce@suaagencia.com.br"
                  value={email}
                  onChange={(evento) => definirEmail(evento.target.value)}
                  aria-invalid={erro ? 'true' : undefined}
                  aria-describedby={erro ? 'entrar-erro' : undefined}
                  data-tom={erro ? 'ruim' : undefined}
                  disabled={enviando}
                />
              </div>

              {erro ? (
                <p className="entrar__erro" id="entrar-erro" role="alert" data-tom="ruim">
                  {erro.mensagem}
                </p>
              ) : null}

              <p className="entrar__acoes">
                <Botao tipo="submit" variante="primario" carregando={enviando}>
                  {ROTULO_DE_ENVIO}
                </Botao>
              </p>
            </form>
          </section>
        )}

        <p className="entrar__rodape">{RODAPE}</p>
      </div>
    </main>
  )
}
