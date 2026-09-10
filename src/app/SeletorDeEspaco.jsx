import useMenuSuspenso, { PROPS_DO_ITEM } from './useMenuSuspenso.js'
import './SeletorDeEspaco.css'

/**
 * O espaço de trabalho aberto, e a porta para os outros.
 *
 * "Espaço de trabalho" é o nome do tenant na tela: o cliente entende o espaço
 * onde as contas dele moram, não o vocabulário de banco. Uma agência pertence a
 * um espaço por cliente, e antes deste seletor o produto abria o primeiro da
 * lista e calava sobre o resto — sem erro, sem aviso, sem jeito de chegar lá.
 *
 * Aqui os itens são `<button>`, e não links como no seletor de conta: o espaço
 * não vive na URL, então escolher um é uma ação, não uma navegação. Quem age
 * precisa de botão (docs/06_COMPONENTES/catalogo.md).
 */

/** @typedef {import('../lib/tenants.js').Tenant} Tenant */

/**
 * @param {object} props
 * @param {Tenant[]} [props.espacos] espaços a que o usuário pertence
 * @param {Tenant|null} [props.selecionado] espaço aberto
 * @param {(tenantId: string) => void} [props.aoEscolher]
 * @returns {JSX.Element|null} `null` quando não há espaço nenhum
 */
export default function SeletorDeEspaco({ espacos = [], selecionado = null, aoEscolher }) {
  const { aberto, fechar, propsDaRaiz, propsDoGatilho, propsDoMenu } = useMenuSuspenso()

  if (!selecionado) return null

  // Com um espaço só não há escolha a fazer, e um menu de item único é ruído
  // permanente no cabeçalho de todo cliente de plano único — que é a maioria.
  // O nome continua dito, porque ele responde "de quem é esta tela"; o que some
  // é a promessa de uma troca que não existe. Mesmo critério do seletor de
  // conta, que também não desenha controle onde não há alternativa.
  if (espacos.length < 2) {
    return (
      <p className="ka-espaco__unico">
        <span className="apenas-leitor">Espaço de trabalho: </span>
        {selecionado.nome}
      </p>
    )
  }

  return (
    <div className="ka-espaco" {...propsDaRaiz}>
      <button className="ka-espaco__gatilho" {...propsDoGatilho}>
        <span className="apenas-leitor">Espaço de trabalho: </span>
        <span className="ka-espaco__nome">{selecionado.nome}</span>
        <span className="ka-espaco__seta" aria-hidden="true" />
        <span className="apenas-leitor">Trocar de espaço de trabalho</span>
      </button>

      {aberto ? (
        <div className="ka-espaco__menu" aria-label="Espaços de trabalho" {...propsDoMenu}>
          <p className="ka-espaco__rotulo" aria-hidden="true">
            Espaços de trabalho
          </p>

          {espacos.map((espaco) => {
            const ehSelecionado = selecionado.id === espaco.id
            return (
              <button
                key={espaco.id}
                type="button"
                className="ka-espaco__item"
                role="menuitemradio"
                aria-checked={ehSelecionado}
                data-selecionado={ehSelecionado ? 'sim' : undefined}
                onClick={() => {
                  fechar(true)
                  aoEscolher?.(espaco.id)
                }}
                {...PROPS_DO_ITEM}
              >
                {espaco.nome}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
