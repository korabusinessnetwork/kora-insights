import { Link } from 'react-router-dom'

import { ROTAS, rotaDaConta } from '../constants/rotas.js'
import useMenuSuspenso, { PROPS_DO_ITEM } from './useMenuSuspenso.js'
import './SeletorDeConta.css'

/**
 * A conta em foco, e a porta para trocar de conta.
 *
 * É um botão com menu, e não um `<select>` nu, por dois motivos: o `<select>`
 * não cabe o par nome + arroba que identifica a conta na cabeça do cliente, e
 * ele não mostra que uma conta parou de coletar. Como cada item é um link real,
 * "abrir em nova aba" continua funcionando e a URL segue sendo a fonte de
 * verdade de qual conta está aberta.
 *
 * Abrir, fechar e andar pelo teclado moram em `useMenuSuspenso`: é o mesmo
 * comportamento do seletor de espaço de trabalho, e comportamento duplicado
 * conserta pela metade.
 */

/**
 * A inicial que ocupa o selo da conta.
 *
 * O selo era um quadrado de cor sólida, sem conteúdo — a identidade o desenhou
 * como lugar da foto de perfil, e a foto nunca existiu porque não guardamos
 * imagem de perfil. Quadrado cinza vazio não lê como "espaço reservado": lê
 * como imagem que falhou ao carregar, em toda tela do produto.
 *
 * A inicial resolve sem depender de rede, de armazenamento ou de permissão nova
 * da Meta, e ainda distingue duas contas na hora de trocar. Vem do nome, e não
 * do arroba, porque é o nome que o cliente reconhece.
 *
 * `Array.from` e não `[0]`: nome começado por emoji ou por letra acentuada fora
 * do BMP quebraria no meio do caractere e renderizaria lixo.
 *
 * @param {string} [nome]
 * @returns {string} uma letra maiúscula, ou vazio quando não há nome
 */
export function inicialDaConta(nome) {
  const limpo = (nome ?? '').trim()
  if (limpo === '') return ''
  return Array.from(limpo)[0].toLocaleUpperCase('pt-BR')
}

/**
 * O que dizer de uma conta que não está coletando. Vocabulário do produto, não
 * regra de cliente: o status vem do banco (`ig_contas.status`).
 * @type {Readonly<Record<string, string>>}
 */
const AVISO_DE_STATUS = Object.freeze({
  token_expirado: 'Precisa reconectar',
  pausada: 'Coleta pausada',
  desconectada: 'Desconectada',
})

/**
 * @param {object} props
 * @param {import('../lib/contas.js').Conta[]} [props.contas] contas conectadas do tenant
 * @param {import('../lib/contas.js').Conta|null} [props.selecionada] conta em foco
 * @returns {JSX.Element|null} `null` quando não há conta conectada
 */
export default function SeletorDeConta({ contas = [], selecionada = null }) {
  const { aberto, fechar, propsDaRaiz, propsDoGatilho, propsDoMenu } = useMenuSuspenso()

  if (contas.length === 0) return null

  return (
    <div className="ka-seletor" {...propsDaRaiz}>
      <button className="ka-seletor__gatilho" {...propsDoGatilho}>
        {/* `selecionada` é nulo quando a URL nomeia uma conta que não é deste
            espaço — link antigo, conta excluída, endereço de outro cliente. O
            contexto devolve nulo de propósito, e sem o `?.` aqui o cabeçalho
            derrubava a aplicação inteira com tela branca. */}
        <span className="ka-seletor__avatar" aria-hidden="true">
          {inicialDaConta(selecionada?.nome)}
        </span>
        <span className="ka-seletor__identificacao">
          <span className="ka-seletor__nome">
            {selecionada ? selecionada.nome : 'Escolher conta'}
          </span>
          {selecionada ? (
            <span className="ka-seletor__arroba">@{selecionada.username}</span>
          ) : null}
        </span>
        <span className="ka-seletor__seta" aria-hidden="true" />
        <span className="apenas-leitor">Trocar de conta</span>
      </button>

      {aberto ? (
        <div className="ka-seletor__menu" aria-label="Contas conectadas" {...propsDoMenu}>
          <p className="ka-seletor__rotulo" aria-hidden="true">
            Contas conectadas
          </p>

          {contas.map((conta) => {
            const ehSelecionada = selecionada?.id === conta.id
            const aviso = AVISO_DE_STATUS[conta.status]
            return (
              <Link
                key={conta.id}
                to={rotaDaConta(conta.id)}
                className="ka-seletor__item"
                role="menuitemradio"
                aria-checked={ehSelecionada}
                data-selecionada={ehSelecionada ? 'sim' : undefined}
                onClick={() => fechar(true)}
                {...PROPS_DO_ITEM}
              >
                <span className="ka-seletor__avatar" aria-hidden="true">
                  {inicialDaConta(conta.nome)}
                </span>
                <span className="ka-seletor__identificacao">
                  <span className="ka-seletor__nome">{conta.nome}</span>
                  <span className="ka-seletor__arroba">@{conta.username}</span>
                </span>
                {/* Conta parada some do diagnóstico sem avisar se a troca de
                    conta não disser que ela parou (ADR-004). */}
                {aviso ? (
                  <span className="ka-seletor__status" data-status={conta.status}>
                    {aviso}
                  </span>
                ) : null}
              </Link>
            )
          })}

          <Link
            to={ROTAS.conectar}
            className="ka-seletor__item"
            data-acao="conectar"
            role="menuitem"
            onClick={() => fechar(true)}
            {...PROPS_DO_ITEM}
          >
            Conectar outra conta
          </Link>
        </div>
      ) : null}
    </div>
  )
}
