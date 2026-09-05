import './Cartao.css'

/**
 * Superficie de conteudo: fundo de cartao, borda de 1px, raio pequeno.
 *
 * `alta` sobe um degrau de superficie (o bloco da acao recomendada na
 * identidade). `resto` passa adiante atributos de dado como `data-bloco` e
 * `data-imprimir`, que a folha de impressao usa para decidir o que vai ao papel.
 *
 * @param {object} props
 * @param {import('react').ElementType} [props.como] elemento raiz ('section' por padrao)
 * @param {boolean} [props.alta] usa a superficie elevada
 * @param {import('react').ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Cartao({ como: Como = 'section', alta = false, children, ...resto }) {
  return (
    <Como className="ki-cartao" data-elevacao={alta ? 'alta' : 'base'} {...resto}>
      {children}
    </Como>
  )
}
