import { useState } from 'react'

import { Botao } from '../../../components/shared/index.js'
import './BarraDeAcoes.css'

const ROTULO_DO_PDF = 'Baixar PDF'

const ROTULO_DA_COPIA = 'Copiar link de leitura'

const ROTULO_DO_EMAIL = 'Enviar por e-mail'

/**
 * O PDF e a impressao do navegador: custo zero na fase de bootstrap
 * (memory/restrictions.md) e saida identica ao que o cliente viu na tela, sem um
 * segundo gerador para manter em sincronia. O caminho ate o arquivo muda de
 * navegador para navegador, e dizer isso antes do clique evita a pergunta
 * "cadê o download?" (CLAUDE.md: prevenção de erro > mensagem de erro).
 */
const NOTA_DO_PDF = 'O PDF sai pela impressão do navegador: escolha "Salvar como PDF" no destino.'

/**
 * O endereco copiado e o da propria folha, e ele continua exigindo sessao. Dizer
 * quem consegue abrir e o que separa um link util de uma promessa quebrada na
 * frente do cliente (memory/identity.md, honestidade de dado).
 */
const COPIA_CONFIRMADA = 'Link copiado. Ele abre para quem tem acesso a este espaço de trabalho.'

const COPIA_RECUSADA =
  'O navegador recusou a cópia. Copie o endereço direto da barra do navegador.'

const COPIA_INDISPONIVEL =
  'Seu navegador não libera a área de transferência nesta página. Copie o endereço da barra ' +
  'do navegador.'

/**
 * Nao existe envio de e-mail no produto. O botao aparece desabilitado e diz o
 * motivo, em vez de fingir que enviou: botao que finge funcionar custa a
 * confianca que este relatorio vende.
 */
const EMAIL_INDISPONIVEL =
  'O envio por e-mail chega em uma próxima versão. Por enquanto, baixe o PDF e anexe você mesmo.'

/** Os desfechos do "Copiar link de leitura". */
const COPIA = Object.freeze({ OCIOSA: 'ociosa', FEITA: 'feita', RECUSADA: 'recusada' })

/** Frase de cada desfecho da copia. @type {Record<string, string>} */
const MENSAGEM_DA_COPIA = {
  [COPIA.FEITA]: COPIA_CONFIRMADA,
  [COPIA.RECUSADA]: COPIA_RECUSADA,
}

/** Tom de cada desfecho; sem desfecho, sem cor. @type {Record<string, string>} */
const TOM_DA_COPIA = { [COPIA.FEITA]: 'bom', [COPIA.RECUSADA]: 'ruim' }

/**
 * O navegador libera a area de transferencia nesta pagina?
 *
 * Contexto inseguro (http) e navegador antigo simplesmente nao expoem a API.
 * Saber disso antes do clique deixa o botao nascer desabilitado com o motivo, em
 * vez de falhar depois que o cliente ja contava com o link.
 *
 * @returns {boolean}
 */
function podeCopiar() {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'
}

/** @returns {string} o endereco desta folha, ou vazio fora do navegador */
function enderecoDaFolha() {
  return typeof window === 'undefined' ? '' : window.location.href
}

/**
 * As acoes da folha: levar para o papel, mandar o link, e a que ainda nao existe.
 *
 * A barra nao vai para a impressao (`data-imprimir="nao"`, src/styles/impressao.css):
 * botao impresso e tinta gasta com o que ninguem pode clicar.
 *
 * @returns {JSX.Element}
 */
export default function BarraDeAcoes() {
  const [copia, setCopia] = useState(COPIA.OCIOSA)
  const areaDisponivel = podeCopiar()

  function baixarPdf() {
    window.print()
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(enderecoDaFolha())
      setCopia(COPIA.FEITA)
    } catch {
      // Recusa no clique nao e o mesmo que API ausente: o botao estava ativo, e
      // quem clicou precisa saber que a copia nao aconteceu.
      setCopia(COPIA.RECUSADA)
    }
  }

  const avisoDaCopia = areaDisponivel
    ? { texto: copia === COPIA.OCIOSA ? '' : MENSAGEM_DA_COPIA[copia], tom: TOM_DA_COPIA[copia] }
    : { texto: COPIA_INDISPONIVEL, tom: undefined }

  return (
    <div className="barra-de-acoes" data-imprimir="nao">
      <div className="barra-de-acoes__botoes">
        <Botao variante="primario" aoClicar={baixarPdf}>
          {ROTULO_DO_PDF}
        </Botao>
        <Botao aoClicar={copiarLink} desabilitado={!areaDisponivel}>
          {ROTULO_DA_COPIA}
        </Botao>
        <Botao desabilitado>{ROTULO_DO_EMAIL}</Botao>
      </div>

      <div className="barra-de-acoes__notas">
        <p className="barra-de-acoes__nota">{NOTA_DO_PDF}</p>
        {/* A regiao viva existe desde o primeiro render: criada junto com o
            texto, a confirmacao nao seria anunciada por leitor de tela. */}
        <p className="barra-de-acoes__nota" role="status" data-tom={avisoDaCopia.tom}>
          {avisoDaCopia.texto}
        </p>
        <p className="barra-de-acoes__nota">{EMAIL_INDISPONIVEL}</p>
      </div>
    </div>
  )
}
