import { Cartao, ListaDeLimites } from '../../../components/shared/index.js'
import './LimitesDoDiagnostico.css'

/** O titulo da identidade (pagina 1), palavra por palavra. */
const TITULO = 'O que este diagnóstico não sabe'

/**
 * Os limites da conta, do jeito que o motor os declarou.
 *
 * Este bloco nao e letra miuda e nao e opcional: ele fica ao lado do veredito,
 * na tela e no papel, porque o que a API da Meta nao entrega aparece como
 * limite explicito e nunca como lacuna silenciosa (CLAUDE.md, principio n1).
 *
 * A tela nao filtra, nao resume e nao ordena a lista — ela ja chega ordenada do
 * motor, com os limites da regra que disparou na frente dos limites de
 * plataforma (docs/03, secao 6).
 *
 * @param {object} props
 * @param {{ codigo: string, texto: string }[]} props.limites `diagnostico.limites`
 * @returns {JSX.Element|null} nulo so quando o motor nao declarou limite nenhum
 */
export default function LimitesDoDiagnostico({ limites }) {
  const itens = Array.isArray(limites) ? limites : []
  if (itens.length === 0) return null

  return (
    <Cartao data-bloco="limites">
      <ListaDeLimites titulo={TITULO} limites={itens} />
    </Cartao>
  )
}
