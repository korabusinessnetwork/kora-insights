import './Tabela.css'

/**
 * Tabela da folha do relatorio: cabecalho discreto, numero a direita e a coluna
 * de variacao colorida pelo tom que a regra decidiu.
 *
 * A celula aceita texto puro ou `{ texto, tom }`. E assim que a variacao ganha
 * cor sem nenhum `if` de estilo: o tom vira `data-tom` e o CSS reage.
 *
 * @typedef {{ chave: string, rotulo: string, numerica?: boolean }} Coluna
 * @typedef {string|number|{ texto: string|number, tom?: 'bom'|'ruim'|'neutro' }} Celula
 * @typedef {{ id?: string, celulas: Celula[] }} Linha
 *
 * @param {object} props
 * @param {Coluna[]} props.colunas na ordem em que aparecem
 * @param {Linha[]} props.linhas cada `celulas` segue a ordem das colunas
 * @param {string} props.legenda o que a tabela mostra; vira o nome acessivel
 * @returns {JSX.Element}
 */
export default function Tabela({ colunas, linhas, legenda }) {
  return (
    <div className="ki-tabela">
      <table className="ki-tabela__grade">
        {/* Legenda so para leitor de tela: na folha quem nomeia a tabela e o
            titulo da secao, e repetir na tela roubaria linha do relatorio. */}
        <caption className="apenas-leitor">{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                data-alinhamento={coluna.numerica ? 'direita' : 'esquerda'}
              >
                {coluna.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => (
            <tr key={linha.id ?? `linha-${indice}`}>
              {colunas.map((coluna, posicao) => {
                const celula = linha.celulas?.[posicao]
                const conteudo = celula !== null && typeof celula === 'object' ? celula.texto : celula
                const tom = celula !== null && typeof celula === 'object' ? celula.tom : undefined
                const Celula = posicao === 0 ? 'th' : 'td'
                return (
                  <Celula
                    key={coluna.chave}
                    scope={posicao === 0 ? 'row' : undefined}
                    data-alinhamento={coluna.numerica ? 'direita' : 'esquerda'}
                    data-tom={tom}
                  >
                    {conteudo}
                  </Celula>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
