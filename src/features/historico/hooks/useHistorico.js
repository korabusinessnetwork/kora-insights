import { useCallback, useEffect, useState } from 'react'

import { useTenant } from '../../../context/TenantContexto.jsx'
import { listarDiagnosticos } from '../../../lib/index.js'

/** Estados da tela. Os quatro obrigatorios de CLAUDE.md, mais "sem conta". */
export const ESTADOS = Object.freeze({
  SEM_CONTA: 'sem-conta',
  CARREGANDO: 'carregando',
  VAZIO: 'vazio',
  ERRO: 'erro',
  SUCESSO: 'sucesso',
})

/** Quantos diagnosticos a tela busca. Um ano de leituras semanais cabe folgado. */
const LIMITE = 12

/**
 * Le os diagnosticos anteriores da conta.
 *
 * Nao ordena, nao filtra e nao recalcula nada: a ordem vem do servico, que a
 * recebe do banco. Reordenar aqui seria a tela discordando do registro que ela
 * exibe — e o registro e o que vale (ADR-005).
 *
 * @param {string|null} [contaId] sem id, vale a conta em foco
 * @returns {{ estado: string, diagnosticos: object[], conta: object|null,
 *   origem: string|null, erro: object|null, recarregar: () => void }}
 */
export default function useHistorico(contaId) {
  const { contas, contaSelecionada, carregando: carregandoEspaco } = useTenant()
  const [tentativa, setTentativa] = useState(0)
  const [leitura, setLeitura] = useState({ carregando: true, lista: [], origem: null, erro: null })

  const idEmFoco = contaId ?? contaSelecionada?.id ?? null
  const conta = contas.find((candidata) => candidata.id === idEmFoco) ?? null

  useEffect(() => {
    if (!idEmFoco) {
      setLeitura({ carregando: false, lista: [], origem: null, erro: null })
      return undefined
    }

    let ativo = true
    setLeitura({ carregando: true, lista: [], origem: null, erro: null })

    listarDiagnosticos(idEmFoco, { limite: LIMITE }).then((envelope) => {
      // Depois do desmonte nao ha estado para atualizar, e insistir derrubaria a
      // proxima tela com um aviso de atualizacao fora de arvore.
      if (!ativo) return
      setLeitura({
        carregando: false,
        lista: envelope.error ? [] : (envelope.data ?? []),
        origem: envelope.meta?.origem ?? null,
        erro: envelope.error,
      })
    })

    return () => {
      ativo = false
    }
  }, [idEmFoco, tentativa])

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), [])

  return {
    estado: situacaoDaTela({ carregandoEspaco, idEmFoco, leitura }),
    diagnosticos: leitura.lista,
    conta,
    origem: leitura.origem,
    erro: leitura.erro,
    recarregar,
  }
}

/**
 * Qual dos cinco estados a tela esta vivendo.
 *
 * Separado do efeito porque e decisao pura: da para ler a tabela de estados de
 * uma vez, em vez de reconstrui-la mentalmente a partir de tres booleanos
 * espalhados pelo JSX.
 *
 * @param {{ carregandoEspaco: boolean, idEmFoco: string|null, leitura: object }} entrada
 * @returns {string}
 */
function situacaoDaTela({ carregandoEspaco, idEmFoco, leitura }) {
  if (carregandoEspaco) return ESTADOS.CARREGANDO
  if (!idEmFoco) return ESTADOS.SEM_CONTA
  if (leitura.carregando) return ESTADOS.CARREGANDO
  // Historico curto nao e erro de sistema: e a conta nova, e a tela diz isso
  // com as palavras do proprio serviço em vez de um alerta vermelho.
  if (leitura.erro && leitura.erro.codigo !== 'SEM_DADO_SUFICIENTE') return ESTADOS.ERRO
  if (leitura.lista.length === 0) return ESTADOS.VAZIO
  return ESTADOS.SUCESSO
}
