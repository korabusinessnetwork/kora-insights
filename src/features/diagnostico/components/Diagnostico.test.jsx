/**
 * A tela de diagnostico contra a fixture do Estudio Vergara (ADR-007), que roda
 * o motor de regras real sobre serie real — nao ha veredito escrito a mao em
 * lugar nenhum, nem aqui.
 *
 * Os numeros da Casa Oliveira sao teste de regressao da identidade visual: 1,8
 * contra 3,0 publicacoes por semana, 26.900 contra 41.200 contas alcancadas e
 * 2.240 contra 2.290 por publicacao. Se a tela deixar de mostrar qualquer um
 * deles, a identidade e o argumento de venda quebraram junto.
 *
 * `src/lib` fica de pe com a implementacao real; so o caso de falha e dublado,
 * porque nao ha como fazer a fixture cair de proposito.
 */

import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CODIGOS, MENSAGENS, falha, obterDiagnosticoMaisRecente } from '../../../lib/index.js'
import Diagnostico from './Diagnostico.jsx'

vi.mock('../../../lib/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    // Espia que, por padrao, e a propria funcao: a tela continua lendo a fixture.
    obterDiagnosticoMaisRecente: vi.fn(original.obterDiagnosticoMaisRecente),
  }
})

const CASA_OLIVEIRA = 'conta-casa-oliveira'
const VERDEJAR = 'conta-verdejar'
const STUDIO_NOVE = 'conta-studio-nove'

const FRASE_DO_VEREDITO = 'Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto.'

const TITULO_DOS_LIMITES = 'O que este diagnóstico não sabe'

const FRASE_SEM_VEREDITO =
  'Você tem 2 semanas completas de histórico. Faltam 14 para o primeiro diagnóstico de causa.'

/** A unica acao possivel sem cobertura: manter a coleta rodando (docs/03, 6.4). */
const ACAO_DE_ESPERA = /Mantenha a conta conectada e a coleta diária ligada/

describe('Diagnostico — Casa Oliveira, a causa nomeada', () => {
  it('publica a frase do veredito como título da tela', async () => {
    render(<Diagnostico contaId={CASA_OLIVEIRA} />)

    expect(await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })).toBeInTheDocument()
    expect(screen.getByText('Frequência de publicação, causa nomeada')).toBeInTheDocument()
  })

  it('mostra os três indicadores com os números da identidade', async () => {
    const { container } = render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    // A evidencia e consultada em escopo: "Contas alcancadas" tambem e legenda
    // do grafico, e o teste precisa afirmar sobre o indicador, nao sobre ela.
    const evidencia = within(container.querySelector('.painel-evidencia__indicadores'))

    expect(evidencia.getByText('Publicações por semana')).toBeInTheDocument()
    expect(evidencia.getByText('1,8')).toBeInTheDocument()
    expect(evidencia.getByText('40% abaixo, era 3,0')).toBeInTheDocument()

    expect(evidencia.getByText('Contas alcançadas')).toBeInTheDocument()
    expect(evidencia.getByText('26.900')).toBeInTheDocument()
    expect(evidencia.getByText('35% abaixo, era 41.200')).toBeInTheDocument()

    expect(evidencia.getByText('Alcance por publicação')).toBeInTheDocument()
    expect(evidencia.getByText('2.240')).toBeInTheDocument()
    expect(evidencia.getByText('Estável, era 2.290')).toBeInTheDocument()
  })

  it('desenha a cadência como prova, com a legenda das duas séries', async () => {
    render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    const desenho = screen.getByRole('img')

    expect(desenho).toHaveAttribute('aria-label', expect.stringContaining('1,8'))
    expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument()
  })

  it('mostra a ação recomendada e como confirmar a causa depois', async () => {
    render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByText('Ação recomendada')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Volte para 3 publicações por semana durante 4 semanas, sem trocar formato nem horário.',
      ),
    ).toBeInTheDocument()
  })

  it('deixa o botão de marcar teste desabilitado e diz por quê', async () => {
    render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByRole('button', { name: 'Marcar teste de 4 semanas' })).toBeDisabled()
    expect(screen.getByText(/A marcação do teste chega na próxima versão/)).toBeInTheDocument()
  })

  it('lista o que o diagnóstico não sabe, ao lado do veredito', async () => {
    render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByRole('heading', { name: TITULO_DOS_LIMITES })).toBeInTheDocument()
    expect(
      screen.getByText(
        'A regra não enxerga sazonalidade, feriado, campanha paga nem mudança de ' +
          'distribuição da plataforma no período.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Não há tráfego pago vinculado a esta conta. Tudo que este diagnóstico afirma ' +
          'vale para alcance orgânico.',
      ),
    ).toBeInTheDocument()
  })

  it('não inventa lacuna: conta sem dia faltando não mostra o aviso', async () => {
    const { container } = render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(container.querySelector('.ki-lacuna')).toBeNull()
  })
})

describe('Diagnostico — lacuna de coleta', () => {
  it('mostra os dias sem coleta com o motivo, acima da evidência', async () => {
    render(<Diagnostico contaId={VERDEJAR} />)

    expect(await screen.findByRole('heading', { name: 'Dias sem coleta' })).toBeInTheDocument()
    expect(screen.getByText('10 a 14 de agosto de 2026')).toBeInTheDocument()
    expect(screen.getByText('Token expirado: a coleta do dia não aconteceu.')).toBeInTheDocument()
  })
})

describe('Diagnostico — histórico curto', () => {
  it('diz quantas semanas faltam, sem chutar veredito', async () => {
    render(<Diagnostico contaId={STUDIO_NOVE} />)

    expect(
      await screen.findByRole('heading', { name: FRASE_SEM_VEREDITO }),
    ).toBeInTheDocument()
    expect(screen.getByText(ACAO_DE_ESPERA)).toBeInTheDocument()
  })

  it('não oferece marcar teste quando não há causa nomeada para testar', async () => {
    render(<Diagnostico contaId={STUDIO_NOVE} />)
    await screen.findByText(ACAO_DE_ESPERA)

    expect(screen.queryByRole('button', { name: 'Marcar teste de 4 semanas' })).toBeNull()
  })

  it('declara os limites mesmo sem veredito', async () => {
    render(<Diagnostico contaId={STUDIO_NOVE} />)
    await screen.findByText(ACAO_DE_ESPERA)

    expect(screen.getByRole('heading', { name: TITULO_DOS_LIMITES })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Com menos de 16 semanas completas o motor não compara janelas e não nomeia ' +
          'nenhuma causa.',
      ),
    ).toBeInTheDocument()
  })
})

describe('Diagnostico — os estados que não são a tela', () => {
  it('sem conta, mostra o vazio da identidade em vez de esqueleto', () => {
    render(<Diagnostico contaId={null} />)

    expect(
      screen.getByRole('heading', {
        name: 'Nenhuma conta conectada, então não existe diagnóstico para mostrar.',
      }),
    ).toBeInTheDocument()
  })

  it('enquanto carrega, não mostra número nenhum na tela', () => {
    obterDiagnosticoMaisRecente.mockImplementationOnce(() => new Promise(() => {}))

    const { container } = render(<Diagnostico contaId={CASA_OLIVEIRA} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('1,8')).toBeNull()
    expect(screen.queryByText('26.900')).toBeNull()
    expect(container.querySelector('.tela-diagnostico__peca')).not.toBeNull()
  })

  it('em falha, mostra a mensagem pt-BR do código de erro e oferece sair dela', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.FALHA_DE_REDE, MENSAGENS[CODIGOS.FALHA_DE_REDE]),
    )

    render(<Diagnostico contaId={CASA_OLIVEIRA} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGENS[CODIGOS.FALHA_DE_REDE])
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('tentar de novo refaz a busca e a tela volta ao veredito', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.FALHA_DE_REDE, MENSAGENS[CODIGOS.FALHA_DE_REDE]),
    )

    render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })).toBeInTheDocument()
  })

  it('conta sem diagnóstico ainda gravado não vira erro: vira espera', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.SEM_DADO_SUFICIENTE, MENSAGENS[CODIGOS.SEM_DADO_SUFICIENTE]),
    )

    render(<Diagnostico contaId={CASA_OLIVEIRA} />)

    expect(
      await screen.findByRole('heading', { name: MENSAGENS[CODIGOS.SEM_DADO_SUFICIENTE] }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('descarta a resposta da conta anterior quando a tela troca de conta', async () => {
    let concluirPrimeira
    obterDiagnosticoMaisRecente.mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          concluirPrimeira = resolver
        }),
    )

    const { rerender } = render(<Diagnostico contaId={CASA_OLIVEIRA} />)
    rerender(<Diagnostico contaId={STUDIO_NOVE} />)
    await screen.findByText(ACAO_DE_ESPERA)

    await act(async () => {
      concluirPrimeira(falha(CODIGOS.FALHA_DE_REDE, MENSAGENS[CODIGOS.FALHA_DE_REDE]))
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(ACAO_DE_ESPERA)).toBeInTheDocument()
  })
})
