import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Marca } from '../components/shared/index.js'
import { obterDiagnosticoMaisRecente } from '../lib/index.js'
import { formatarPeriodo } from '../metricas/index.js'
import { ROTAS, rotaDoHistorico, rotaDoRelatorio } from '../constants/rotas.js'
import { useTenant } from '../context/TenantContexto.jsx'
import SeletorDeConta from './SeletorDeConta.jsx'
import './Cabecalho.css'

/**
 * A barra da identidade (docs/02_DESIGN_SYSTEM/identidade/01-diagnostico.png).
 *
 * Marca à esquerda, separador, a conta em foco; à direita o período do
 * diagnóstico e as duas ações. Histórico e Exportar relatório são links, e não
 * botões: as duas levam a uma rota, e botão que navega quebra abrir em nova aba
 * (docs/06_COMPONENTES/catalogo.md).
 */

/** Enquanto a leitura não voltou, o cabeçalho não afirma período nenhum. */
const PERIODO_INICIAL = Object.freeze({ carregando: true, texto: null })

/**
 * @returns {JSX.Element}
 */
export default function Cabecalho() {
  const { contas, contaSelecionada, tenant } = useTenant()
  const [periodo, setPeriodo] = useState(PERIODO_INICIAL)

  const contaId = contaSelecionada?.id ?? null

  useEffect(() => {
    if (!contaId) {
      setPeriodo({ carregando: false, texto: null })
      return undefined
    }

    let montado = true
    setPeriodo(PERIODO_INICIAL)

    // O cabeçalho lê o mesmo diagnóstico que a tela lê, pelo mesmo serviço: o
    // período anunciado aqui e a janela mostrada lá saem do mesmo registro, e
    // por isso não têm como divergir. Nada é calculado aqui (ADR-005).
    obterDiagnosticoMaisRecente(contaId).then((envelope) => {
      if (!montado) return
      const janela = envelope.error ? null : envelope.data?.periodo
      if (!janela?.inicio || !janela?.fim) {
        setPeriodo({ carregando: false, texto: null })
        return
      }
      setPeriodo({ carregando: false, texto: formatarPeriodo(janela.inicio, janela.fim) })
    })

    return () => {
      montado = false
    }
  }, [contaId])

  return (
    <header className="ka-cabecalho" data-imprimir="nao">
      <div className="ka-cabecalho__identidade">
        <Link to={ROTAS.contas} className="ka-cabecalho__marca">
          <Marca />
        </Link>
        {contas.length > 0 ? (
          <span className="ka-cabecalho__separador" aria-hidden="true" />
        ) : null}
        <SeletorDeConta contas={contas} selecionada={contaSelecionada} />
      </div>

      {/* Qual espaço de trabalho está aberto. A identidade coloca o nome do
          tenant à direita do cabeçalho, e num produto em que uma agência
          gerencia várias marcas essa é a única pista de por quem se está
          respondendo. Sem conta selecionada ele fica sozinho, como na
          identidade da tela vazia. */}
      {tenant?.nome ? (
        <p className="ka-cabecalho__tenant">
          <span className="apenas-leitor">Espaço de trabalho: </span>
          {tenant.nome}
        </p>
      ) : null}

      {contaSelecionada ? (
        <div className="ka-cabecalho__acoes">
          {periodo.carregando ? null : (
            <p className="ka-cabecalho__periodo">
              {/* A identidade escreve "Semana de 24 a 30 de agosto" aqui, mas
                  `Diagnostico.periodo` é a janela inteira analisada — da
                  primeira semana do histórico até a última semana completa
                  (src/motor/motor.js). Anunciar uma semana onde o registro fala
                  de dezesseis seria o cabeçalho contradizendo a tela. */}
              <span className="apenas-leitor">Período analisado: </span>
              {periodo.texto ?? 'Sem diagnóstico ainda'}
            </p>
          )}
          <Link
            to={rotaDoHistorico(contaSelecionada.id)}
            className="ka-cabecalho__acao"
            data-variante="secundario"
          >
            Histórico
          </Link>
          <Link
            to={rotaDoRelatorio(contaSelecionada.id)}
            className="ka-cabecalho__acao"
            data-variante="primario"
          >
            Exportar relatório
          </Link>
        </div>
      ) : null}
    </header>
  )
}
