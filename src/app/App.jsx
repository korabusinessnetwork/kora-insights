import { SessaoProvedor } from '../context/SessaoContexto.jsx'
import { TenantProvedor } from '../context/TenantContexto.jsx'
import Rotas from './rotas.jsx'

/**
 * O app: os dois contextos que valem para o produto inteiro, e a árvore de
 * rotas dentro deles.
 *
 * A ordem dos provedores não é arbitrária. O tenant é carregado a partir da
 * sessão e a identidade visual vem do tenant; invertê-los faria o espaço de
 * trabalho ser buscado antes de existir alguém autenticado para buscá-lo.
 *
 * O `Router` fica de fora, em `main.jsx`: assim o teste monta este mesmo
 * componente dentro de um `MemoryRouter` e navega sem tocar no endereço real.
 *
 * @param {{ telas: import('./rotas.jsx').Telas }} props telas de feature, montadas em main.jsx
 * @returns {JSX.Element}
 */
export default function App({ telas }) {
  return (
    <SessaoProvedor>
      <TenantProvedor>
        <Rotas telas={telas} />
      </TenantProvedor>
    </SessaoProvedor>
  )
}
