/**
 * A folha do relatorio contra a fixture do Estudio Vergara (ADR-007), que roda o
 * motor de regras real sobre serie real — nao ha veredito escrito a mao aqui,
 * nem em lugar nenhum do produto.
 *
 * O que estes testes protegem, alem da tela: a folha e o **mesmo** diagnostico
 * que a tela da conta mostra. Os numeros da Casa Oliveira sao os da identidade
 * (1,8 contra 3,0; 26.900 contra 41.200; 2.240 contra 2.290) e valem como teste
 * de regressao — se a folha deixar de mostrar qualquer um deles, o relatorio
 * deixou de fechar com a tela, e e a tabela que o cliente confere na reuniao.
 *
 * `src/lib` fica de pe com a implementacao real, servindo a fixture; so os casos
 * de falha e de espaco vazio sao dublados, porque nao ha como fazer a fixture
 * cair de proposito.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import {
  CODIGOS,
  MENSAGENS,
  falha,
  listarContasConectadas,
  obterDiagnosticoMaisRecente,
  ok,
} from '../../../lib/index.js'
import { SessaoProvedor } from '../../../context/SessaoContexto.jsx'
import { TenantProvedor } from '../../../context/TenantContexto.jsx'
import { inicioDaSemanaEncerrada } from './FolhaDoRelatorio.jsx'
import Relatorio from './Relatorio.jsx'

vi.mock('../../../lib/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    // Espias que, por padrao, sao as proprias funcoes: a tela continua lendo a
    // fixture pelo mesmo caminho que ela usa em producao.
    obterDiagnosticoMaisRecente: vi.fn(original.obterDiagnosticoMaisRecente),
    listarContasConectadas: vi.fn(original.listarContasConectadas),
  }
})

const CASA_OLIVEIRA = 'conta-casa-oliveira'
const VERDEJAR = 'conta-verdejar'
const STUDIO_NOVE = 'conta-studio-nove'

const FRASE_DO_VEREDITO = 'Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto.'

const FRASE_SEM_VEREDITO =
  'Você tem 2 semanas completas de histórico. Faltam 14 para o primeiro diagnóstico de causa.'

const TITULO_DOS_LIMITES = 'O que este diagnóstico não sabe'

/**
 * Monta a tela dentro dos dois contextos que ela precisa: a sessao e o espaco de
 * trabalho. O tenant nao e dublado de proposito — o nome de quem assina a folha
 * vem do registro do tenant, e e isso que o white-label da Fase 3 depende.
 *
 * @param {string} [contaId]
 * @param {string} [caminho] rota inicial, para o contexto achar a conta em foco
 * @returns {import('@testing-library/react').RenderResult}
 */
function montar(contaId, caminho) {
  return render(
    <MemoryRouter initialEntries={[caminho ?? `/contas/${contaId}/relatorio`]}>
      <SessaoProvedor>
        <TenantProvedor>
          <Relatorio contaId={contaId} />
        </TenantProvedor>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

/** A folha impressa, para afirmar que um bloco vai ao papel junto com ela. */
function folha(container) {
  return container.querySelector('[data-imprimir="folha"]')
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete navigator.clipboard
})

describe('Relatório — a folha da Casa Oliveira', () => {
  it('encabeça a folha com o cliente, a semana e quem preparou', async () => {
    montar(CASA_OLIVEIRA)

    expect(await screen.findByRole('heading', { level: 1, name: 'Casa Oliveira' })).toBeVisible()
    expect(
      screen.getByText(
        'Diagnóstico de crescimento no Instagram, semana de 24 a 30 de agosto de 2026',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Preparado por')).toBeInTheDocument()
    // O nome sai do tenant, nunca do código: na Fase 3 é a agência que assina.
    expect(screen.getByText('Estúdio Vergara')).toBeInTheDocument()
  })

  it('traz o veredito do diagnóstico, com a palavra da severidade', async () => {
    montar(CASA_OLIVEIRA)

    expect(await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })).toBeInTheDocument()
    expect(screen.getByText('Atenção')).toBeInTheDocument()
  })

  it('põe a evidência em tabela, com os números da identidade', async () => {
    const { container } = montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    // A tabela é consultada em escopo: o gráfico publica a própria tabela para
    // leitor de tela, e o teste precisa afirmar sobre a evidência.
    const tabela = within(container.querySelector('.ki-tabela'))

    expect(tabela.getByRole('columnheader', { name: 'Indicador' })).toBeInTheDocument()
    expect(tabela.getByRole('columnheader', { name: '8 anteriores' })).toBeInTheDocument()
    expect(tabela.getByRole('columnheader', { name: 'Últimas 8' })).toBeInTheDocument()
    expect(tabela.getByRole('columnheader', { name: 'Variação' })).toBeInTheDocument()

    const cadencia = within(tabela.getByRole('row', { name: /Publicações por semana/ }))
    expect(cadencia.getByText('3,0')).toBeInTheDocument()
    expect(cadencia.getByText('1,8')).toBeInTheDocument()
    expect(cadencia.getByText('40% abaixo')).toBeInTheDocument()

    const alcance = within(tabela.getByRole('row', { name: /Contas alcançadas/ }))
    expect(alcance.getByText('41.200')).toBeInTheDocument()
    expect(alcance.getByText('26.900')).toBeInTheDocument()
    expect(alcance.getByText('35% abaixo')).toBeInTheDocument()

    const porPublicacao = within(tabela.getByRole('row', { name: /Alcance por publicação/ }))
    expect(porPublicacao.getByText('2.290')).toBeInTheDocument()
    expect(porPublicacao.getByText('2.240')).toBeInTheDocument()
    // Abaixo do limiar de estabilidade a tabela escreve a palavra, não o número:
    // chamar 2% de queda ensina o cliente a desconfiar da ferramenta.
    expect(porPublicacao.getByText('Estável')).toBeInTheDocument()
  })

  it('desenha a cadência como prova, na mesma folha', async () => {
    const { container } = montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    const desenho = screen.getByRole('img')
    expect(desenho).toHaveAttribute('aria-label', expect.stringContaining('1,8'))
    expect(folha(container).contains(desenho)).toBe(true)
  })

  it('leva a ação recomendada e como confirmar a causa depois', async () => {
    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByRole('heading', { name: 'Ação recomendada' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Volte para 3 publicações por semana durante 4 semanas, sem trocar formato nem horário.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Se o alcance voltar para a faixa de 40 mil/)).toBeInTheDocument()
  })

  it('imprime o que o diagnóstico não sabe junto com o que ele sabe', async () => {
    const { container } = montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    const limites = screen.getByRole('heading', { name: TITULO_DOS_LIMITES })
    expect(folha(container).contains(limites)).toBe(true)
    expect(
      screen.getByText(
        'Não há tráfego pago vinculado a esta conta. Tudo que este diagnóstico afirma ' +
          'vale para alcance orgânico.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A API da Meta não entrega alcance, salvamento nem demografia de contas de ' +
          'terceiros. Não há comparação com concorrente neste diagnóstico.',
      ),
    ).toBeInTheDocument()
  })

  it('assina o rodapé com a marca e diz de onde vieram os números', async () => {
    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByText('Kora')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    // Em demonstração o rodapé não pode afirmar procedência que a folha não tem:
    // ele nomeia a demonstração em vez da conta (ADR-007).
    expect(screen.getByText(/a partir de dados de exemplo/)).toBeInTheDocument()
  })
})

describe('Relatório — o que a folha não esconde', () => {
  it('leva os dias sem coleta para o papel', async () => {
    const { container } = montar(VERDEJAR)

    const aviso = await screen.findByRole('heading', { name: 'Dias sem coleta' })
    expect(folha(container).contains(aviso)).toBe(true)
    expect(screen.getByText('2026-08-10 a 2026-08-14')).toBeInTheDocument()
    expect(screen.getByText('Token expirado: a coleta do dia não aconteceu.')).toBeInTheDocument()
  })

  it('sem evidência, a folha diz quantas semanas faltam e não inventa tabela', async () => {
    const { container } = montar(STUDIO_NOVE)

    expect(await screen.findByRole('heading', { name: FRASE_SEM_VEREDITO })).toBeInTheDocument()
    expect(screen.getByText('Indeterminado')).toBeInTheDocument()
    expect(container.querySelector('.ki-tabela')).toBeNull()
    expect(folha(container)).toHaveAttribute('data-prova', 'nao')
  })
})

describe('Relatório — as ações da folha', () => {
  it('"Baixar PDF" manda a folha para a impressão do navegador', async () => {
    const imprimir = vi.fn()
    vi.stubGlobal('print', imprimir)

    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })
    await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF' }))

    expect(imprimir).toHaveBeenCalledTimes(1)
  })

  it('copia o link de leitura e confirma na tela quem consegue abrir', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escrever },
      configurable: true,
    })

    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })
    await userEvent.click(screen.getByRole('button', { name: 'Copiar link de leitura' }))

    expect(escrever).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(/Link copiado\. Ele abre para quem tem acesso/),
    ).toBeInTheDocument()
  })

  it('sem área de transferência, o botão de copiar nasce desabilitado e diz por quê', async () => {
    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByRole('button', { name: 'Copiar link de leitura' })).toBeDisabled()
    expect(screen.getByText(/não libera a área de transferência/)).toBeInTheDocument()
  })

  it('"Enviar por e-mail" aparece desabilitado com o motivo, nunca como botão morto', async () => {
    montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(screen.getByRole('button', { name: 'Enviar por e-mail' })).toBeDisabled()
    expect(screen.getByText(/O envio por e-mail chega em uma próxima versão/)).toBeInTheDocument()
  })

  it('a barra de ações não vai para o papel', async () => {
    const { container } = montar(CASA_OLIVEIRA)
    await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })

    expect(container.querySelector('.barra-de-acoes')).toHaveAttribute('data-imprimir', 'nao')
  })
})

describe('Relatório — os estados que não são a folha', () => {
  it('enquanto carrega, não mostra número nenhum', async () => {
    obterDiagnosticoMaisRecente.mockImplementationOnce(() => new Promise(() => {}))

    const { container } = montar(CASA_OLIVEIRA)

    // O espaço de trabalho resolve numa microtarefa; esperar por ele deixa a
    // tela no estado que interessa aqui — esperando o diagnóstico, não o tenant.
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('1,8')).toBeNull()
    expect(screen.queryByText('26.900')).toBeNull()
    expect(container.querySelector('.tela-relatorio__peca')).not.toBeNull()
  })

  it('em falha, mostra a mensagem pt-BR do código de erro e oferece sair dela', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.FALHA_DE_REDE, MENSAGENS[CODIGOS.FALHA_DE_REDE]),
    )

    montar(CASA_OLIVEIRA)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGENS[CODIGOS.FALHA_DE_REDE])
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('tentar de novo refaz a leitura e a folha aparece', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.FALHA_DE_REDE, MENSAGENS[CODIGOS.FALHA_DE_REDE]),
    )

    montar(CASA_OLIVEIRA)
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('heading', { name: FRASE_DO_VEREDITO })).toBeInTheDocument()
  })

  it('conta sem diagnóstico gravado não vira erro: vira espera, sem folha em branco', async () => {
    obterDiagnosticoMaisRecente.mockResolvedValueOnce(
      falha(CODIGOS.SEM_DADO_SUFICIENTE, MENSAGENS[CODIGOS.SEM_DADO_SUFICIENTE]),
    )

    const { container } = montar(CASA_OLIVEIRA)

    expect(
      await screen.findByRole('heading', { name: MENSAGENS[CODIGOS.SEM_DADO_SUFICIENTE] }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(folha(container)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Baixar PDF' })).toBeNull()
  })

  it('sem conta conectada, explica por que não existe relatório', async () => {
    listarContasConectadas.mockResolvedValueOnce(ok([]))

    montar(undefined, '/contas')

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhuma conta conectada, então não existe relatório para preparar.',
      }),
    ).toBeInTheDocument()
  })
})

describe('inicioDaSemanaEncerrada', () => {
  it('devolve a segunda-feira da semana que o período fecha', () => {
    expect(inicioDaSemanaEncerrada('2026-08-30')).toBe('2026-08-24')
  })

  it('aceita ISO completo, porque o período pode chegar com hora', () => {
    expect(inicioDaSemanaEncerrada('2026-08-30T00:00:00.000Z')).toBe('2026-08-24')
  })

  it('atravessa a virada de mês e de ano sem inventar dia', () => {
    expect(inicioDaSemanaEncerrada('2026-01-03')).toBe('2025-12-28')
  })

  it('recusa o que não é data em vez de escrever uma semana falsa', () => {
    expect(inicioDaSemanaEncerrada('2026-02-31')).toBeNull()
    expect(inicioDaSemanaEncerrada('semana que vem')).toBeNull()
    expect(inicioDaSemanaEncerrada(undefined)).toBeNull()
  })
})

describe('o papel nunca sai passando dado de exemplo por dado do cliente', () => {
  it('em modo de demonstracao o carimbo esta DENTRO da arvore que vai para a impressao', async () => {
    montar(CASA_OLIVEIRA)
    const folha = await screen.findByRole('article')
    expect(folha).toHaveAttribute('data-imprimir', 'folha')
    expect(folha).toHaveAttribute('data-demonstracao', 'sim')
    // O aviso da casca tem data-imprimir="nao" e some no PDF; este nao.
    expect(folha).toHaveTextContent(/Demonstração/)
  })

  it('o rodape nao afirma procedencia que a demonstracao nao tem', async () => {
    montar(CASA_OLIVEIRA)
    const folha = await screen.findByRole('article')
    expect(folha).not.toHaveTextContent('a partir dos dados da conta @')
    expect(folha).toHaveTextContent('a partir de dados de exemplo')
  })
})
