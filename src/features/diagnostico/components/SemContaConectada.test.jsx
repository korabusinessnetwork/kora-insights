/**
 * O vazio e a tela mais delicada do produto: e ela que promete o que a
 * ferramenta faz antes de existir um unico dado do cliente. O que estes testes
 * protegem e a promessa — os tres passos, o rodape de privacidade e a recusa a
 * mostrar grafico de exemplo (identidade, pagina 2).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SemContaConectada, { PASSOS_ATE_O_DIAGNOSTICO } from './SemContaConectada.jsx'

const TITULO = 'Nenhuma conta conectada, então não existe diagnóstico para mostrar.'

const RODAPE =
  'Não publicamos, não agendamos e não acessamos nenhuma conta que você não autorizou.'

describe('SemContaConectada', () => {
  it('anuncia o vazio como conteúdo, com o título da identidade', () => {
    render(<SemContaConectada />)

    expect(screen.getByRole('heading', { name: TITULO })).toBeInTheDocument()
  })

  it('explica por que a tela está vazia em vez de mostrar gráfico de exemplo', () => {
    render(<SemContaConectada />)

    expect(
      screen.getByText(
        'A tela fica vazia de propósito. Preferimos não ter nada aqui a colocar um ' +
          'gráfico de exemplo que não é da sua marca.',
      ),
    ).toBeInTheDocument()
  })

  it('mostra os três passos até o primeiro diagnóstico, na ordem', () => {
    render(<SemContaConectada />)

    const titulos = screen.getAllByRole('heading', { level: 3 }).map((item) => item.textContent)

    expect(titulos).toEqual([
      'Você autoriza o acesso',
      'Guardamos o histórico desde hoje',
      'O primeiro diagnóstico sai em 24 horas',
    ])
  })

  it('mantém a descrição de cada passo, que é onde mora a promessa', () => {
    render(<SemContaConectada />)

    for (const passo of PASSOS_ATE_O_DIAGNOSTICO) {
      expect(screen.getByText(passo.descricao)).toBeInTheDocument()
    }
  })

  it('fecha a tela com o rodapé de privacidade', () => {
    render(<SemContaConectada />)

    expect(screen.getByText(RODAPE)).toBeInTheDocument()
  })

  it('oferece as duas saídas como link — navegar é trabalho de âncora, não de botão', () => {
    render(<SemContaConectada />)

    expect(screen.getByRole('link', { name: 'Conectar uma conta do Instagram' })).toHaveAttribute(
      'href',
      '/conectar',
    )
    expect(
      screen.getByRole('link', { name: 'Ver o que é preciso antes de conectar' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('aceita destino próprio: a rota é do shell, não desta tela', () => {
    render(<SemContaConectada hrefDeConexao="/onboarding" hrefDeRequisitos="/ajuda" />)

    expect(screen.getByRole('link', { name: 'Conectar uma conta do Instagram' })).toHaveAttribute(
      'href',
      '/onboarding',
    )
    expect(
      screen.getByRole('link', { name: 'Ver o que é preciso antes de conectar' }),
    ).toHaveAttribute('href', '/ajuda')
  })
})
