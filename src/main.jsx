import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Ordem obrigatória: os tokens declaram as variáveis, a base as consome, e a
// folha de impressão sobrescreve as duas. Trocar a ordem faz a base ler token
// que ainda não existe e a impressão perder para o CSS de componente.
import './styles/tokens.css'
import './styles/base.css'
import './styles/impressao.css'

import App from './app/App.jsx'
import { TELAS } from './app/telas.jsx'

/**
 * Ponto de montagem. Só isso.
 *
 * Qual feature responde por cada rota é decisão de `src/app/telas.jsx`, que
 * pode ser montado em teste sem subir o app — e por isso a composição tem
 * teste, o que este arquivo nunca teve.
 */

const raiz = document.getElementById('raiz')
if (!raiz) {
  // Falhar alto: tela em branco sem explicação custa mais tempo de depuração
  // do que qualquer erro escrito.
  throw new Error('Elemento #raiz não encontrado: index.html e main.jsx saíram de sincronia.')
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App telas={TELAS} />
    </BrowserRouter>
  </StrictMode>,
)
