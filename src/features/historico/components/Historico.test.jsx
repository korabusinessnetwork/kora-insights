import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { SessaoProvedor } from '../../../context/SessaoContexto.jsx'
import { TenantProvedor } from '../../../context/TenantContexto.jsx'
import Historico from './Historico.jsx'

/**
 * O que estes testes protegem e a promessa do ADR-005.
 *
 * O motor grava a versao do ruleset em cada diagnostico para que se possa
 * perguntar, meses depois, se o veredito mudou porque a conta mudou ou porque a
 * regra mudou. Sem uma tela que ponha os registros lado a lado com a versao
 * visivel, a promessa fica so no banco — e promessa que nao aparece na tela nao
 * e cumprida do ponto de vista de quem paga.
 */

const CASA_OLIVEIRA = 'conta-casa-oliveira'
const STUDIO_NOVE = 'conta-studio-nove'

/** @param {string} contaId @returns {import('@testing-library/react').RenderResult} */
function montar(contaId) {
  return render(
    <MemoryRouter initialEntries={[`/contas/${contaId}/historico`]}>
      <SessaoProvedor>
        <TenantProvedor>
          <Historico contaId={contaId} />
        </TenantProvedor>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

describe('Histórico — a linha do tempo do diagnóstico', () => {
  it('lista os diagnósticos anteriores, do mais recente para o mais antigo', async () => {
    montar(CASA_OLIVEIRA)
    const lista = await screen.findByRole('list')
    const linhas = within(lista).getAllByRole('listitem')

    expect(linhas.length).toBeGreaterThan(1)
    expect(linhas[0]).toHaveTextContent('5 de setembro de 2026')
    expect(linhas[0]).toHaveTextContent('Diagnóstico em vigor')
    expect(linhas[linhas.length - 1]).toHaveTextContent('13 de junho de 2026')
  })

  it('mostra a versão do ruleset de cada registro, que é o que torna a série auditável', async () => {
    montar(CASA_OLIVEIRA)
    const lista = await screen.findByRole('list')
    for (const linha of within(lista).getAllByRole('listitem')) {
      expect(linha).toHaveTextContent(/regra v\d+\.\d+\.\d+/)
    }
  })

  it('conta a história da conta: primeiro estável, depois a causa nomeada', async () => {
    // O valor da tela está aqui. Um diagnóstico isolado é uma foto; a série é o
    // que mostra QUANDO o problema apareceu — e a Casa Oliveira passou meses
    // sem nada a apontar antes de a cadência cair.
    montar(CASA_OLIVEIRA)
    const lista = await screen.findByRole('list')
    const linhas = within(lista).getAllByRole('listitem')

    expect(linhas[0]).toHaveTextContent('Atenção')
    expect(linhas[0]).toHaveTextContent('Sua frequência caiu 40%')
    expect(linhas.slice(1).some((linha) => linha.textContent.includes('Estável'))).toBe(true)
  })

  it('marca apenas o diagnóstico em vigor, e é o primeiro da lista', async () => {
    montar(CASA_OLIVEIRA)
    const lista = await screen.findByRole('list')
    const linhas = within(lista).getAllByRole('listitem')

    expect(linhas.filter((l) => l.dataset.atual === 'sim')).toHaveLength(1)
    expect(linhas[0].dataset.atual).toBe('sim')
  })

  it('conta sem histórico não vira erro: a tela diz o que falta', async () => {
    montar(STUDIO_NOVE)
    // Studio Nove tem duas semanas de coleta. Existe um diagnóstico — o de
    // "ainda não sei" — e ele aparece; o que não pode é um alerta vermelho.
    const lista = await screen.findByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(lista).toHaveTextContent('Indeterminado')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('oferece a volta para o diagnóstico em vigor', async () => {
    montar(CASA_OLIVEIRA)
    expect(
      await screen.findByRole('link', { name: 'Voltar ao diagnóstico em vigor' }),
    ).toHaveAttribute('href', `/contas/${CASA_OLIVEIRA}`)
  })
})
