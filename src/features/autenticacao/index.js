/**
 * Porta unica da feature de autenticacao.
 *
 * O shell de rotas importa daqui, nunca de um arquivo interno: mover um bloco
 * entre componentes nao pode quebrar a rota `/entrar` (contratos.md, secao 6).
 */

export { default as Entrar, destinoSeguro } from './components/Entrar.jsx'
export { default as useEntrar, ESTADOS, falhaDoLinkNoFragmento } from './hooks/useEntrar.js'
