/**
 * O que estes testes protegem e a porta do produto.
 *
 * Duas garantias valem mais que as outras e por isso vem primeiro: e-mail
 * invalido **nao vira chamada ao servico** (prevencao de erro > mensagem de
 * erro), e a confirmacao **nao responde** se o endereco esta cadastrado — quem
 * ficasse tentando enderecos nesta tela nao pode montar a lista de clientes.
 *
 * `src/lib` e dublado so no que precisa de resposta controlada: a sessao e o
 * envio do link. O resto da camada continua o real.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { CODIGOS, entrarComEmail, falha, ok, sessaoAtual } from '../../../lib/index.js'
import { SessaoProvedor } from '../../../context/SessaoContexto.jsx'
import Entrar, { destinoSeguro } from './Entrar.jsx'

vi.mock('../../../lib/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    sessaoAtual: vi.fn(async () => original.ok(null)),
    aoMudarSessao: vi.fn(() => () => {}),
    entrarComEmail: vi.fn(async () => original.ok({ enviado: true })),
  }
})

const EMAIL = 'camila@estudiovergara.com.br'

const NEUTRALIDADE =
  'Não dizemos se um e-mail está ou não cadastrado: responder isso entregaria a lista ' +
  'de clientes para quem ficasse tentando endereços.'

/**
 * Monta a tela dentro dos mesmos provedores que ela tem em producao.
 *
 * @param {string} [caminho] endereco inicial, com ou sem `?proximo=`
 * @returns {import('@testing-library/react').RenderResult}
 */
function montar(caminho = '/entrar') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <SessaoProvedor>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/contas" element={<p>lista de contas</p>} />
          <Route path="/contas/:contaId" element={<p>diagnóstico da conta</p>} />
        </Routes>
      </SessaoProvedor>
    </MemoryRouter>,
  )
}

/** @returns {Promise<HTMLElement>} o campo de e-mail, depois da conferencia de sessao */
function campoDeEmail() {
  return screen.findByLabelText('Seu e-mail')
}

afterEach(() => {
  vi.clearAllMocks()
  window.location.hash = ''
})

describe('Entrar — o pedido do link', () => {
  it('diz que o acesso chega por e-mail, e não por senha', async () => {
    montar()

    expect(
      await screen.findByRole('heading', {
        name: 'Entre com seu e-mail. Não há senha para criar nem para esquecer.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Enviamos um link de acesso para o seu e-mail/)).toBeInTheDocument()
  })

  it('não chama o serviço com e-mail inválido — a barreira é antes da chamada', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(await campoDeEmail(), 'camila@')
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))

    expect(entrarComEmail).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este endereço não parece um e-mail. Confira antes de pedir o link.',
    )
  })

  it('some com o erro assim que a pessoa corrige o endereço', async () => {
    const usuario = userEvent.setup()
    montar()

    const campo = await campoDeEmail()
    await usuario.type(campo, 'camila@')
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await usuario.type(campo, 'estudiovergara.com.br')

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('envia o endereço válido sem espaço em volta e confirma na tela', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(await campoDeEmail(), `  ${EMAIL}  `)
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))

    expect(entrarComEmail).toHaveBeenCalledWith(EMAIL)
    expect(
      await screen.findByRole('heading', { name: 'Link enviado. Confira seu e-mail.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
  })

  it('diz o que fazer quando o link não chega', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(await campoDeEmail(), EMAIL)
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))
    await screen.findByRole('heading', { name: 'Link enviado. Confira seu e-mail.' })

    expect(screen.getByText(/Procure no spam e na aba de promoções/)).toBeInTheDocument()
    expect(screen.getByText(/Cada link é de uso único/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Corrigir o endereço ou pedir outro link' }),
    ).toBeInTheDocument()
  })

  it('não revela que o e-mail não está na base: a mesma confirmação, sempre', async () => {
    const usuario = userEvent.setup()
    entrarComEmail.mockResolvedValueOnce(
      falha(CODIGOS.NAO_ENCONTRADO, 'Não encontramos este registro.'),
    )
    montar()

    await usuario.type(await campoDeEmail(), EMAIL)
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))

    expect(
      await screen.findByRole('heading', { name: 'Link enviado. Confira seu e-mail.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(NEUTRALIDADE)).toBeInTheDocument()
    expect(screen.queryByText('Não encontramos este registro.')).toBeNull()
  })

  it('mostra a falha real e mantém o formulário quando o servidor não responde', async () => {
    const usuario = userEvent.setup()
    entrarComEmail.mockResolvedValueOnce(
      falha(CODIGOS.FALHA_DE_REDE, 'Não foi possível falar com o servidor.'),
    )
    montar()

    await usuario.type(await campoDeEmail(), EMAIL)
    await usuario.click(screen.getByRole('button', { name: 'Enviar o link de acesso' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o servidor.',
    )
    expect(screen.getByLabelText('Seu e-mail')).toHaveValue(EMAIL)
  })
})

describe('Entrar — a volta do link', () => {
  it('explica o link expirado com frase nossa, sem ecoar o texto da URL', async () => {
    window.location.hash =
      '#error=access_denied&error_code=otp_expired&error_description=Link+is+invalid'
    montar()

    expect(
      await screen.findByText(/Este link expirou ou já tinha sido usado/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Link is invalid/)).toBeNull()
  })

  it('não deixa quem já tem sessão olhando o formulário: manda para o destino', async () => {
    sessaoAtual.mockResolvedValueOnce(
      ok({ usuarioId: 'usuario-1', email: EMAIL, expiraEm: null }),
    )
    montar('/entrar?proximo=%2Fcontas%2Fconta-casa-oliveira')

    expect(await screen.findByText('diagnóstico da conta')).toBeInTheDocument()
  })
})

describe('destinoSeguro', () => {
  it('mantém caminho interno', () => {
    expect(destinoSeguro('/contas/conta-casa-oliveira')).toBe('/contas/conta-casa-oliveira')
  })

  it('recusa endereço de outro site disfarçado de caminho', () => {
    expect(destinoSeguro('//outro.site/roubo')).toBe('/contas')
    expect(destinoSeguro('/\\outro.site')).toBe('/contas')
    expect(destinoSeguro('https://outro.site')).toBe('/contas')
  })

  it('não devolve a pessoa para a própria entrada', () => {
    expect(destinoSeguro('/entrar')).toBe('/contas')
    expect(destinoSeguro('')).toBe('/contas')
    expect(destinoSeguro(null)).toBe('/contas')
  })
})
