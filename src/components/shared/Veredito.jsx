import SeloDeSeveridade from './SeloDeSeveridade.jsx'
import './Veredito.css'

/**
 * A palavra que acompanha cada severidade do motor. O achado traz o codigo
 * (`ok`, `atencao`, ...) e a tela precisa de uma palavra: cor sozinha nao
 * informa quem nao distingue cor (TOKENS.md, contraste).
 * @type {Record<string, string>}
 */
export const PALAVRA_DE_SEVERIDADE = {
  ok: 'Estável',
  atencao: 'Atenção',
  critico: 'Crítico',
  indeterminado: 'Indeterminado',
}

/**
 * O heroi da tela: o cartao claro com a frase que o cliente repete em voz alta.
 *
 * A frase chega pronta do motor (ADR-005) — este componente nao calcula, nao
 * resume e nao reescreve nada. A largura curta (`--largura-veredito`) e regra
 * de leitura, nao acaso: quebrar em duas ou tres linhas e o que faz a frase
 * soar como fala e nao como paragrafo.
 *
 * O cartao declara `data-superficie="papel"`: ele e uma folha clara dentro do
 * app escuro, e e a troca de pele de tokens.css que faz o ocre, o sage e o
 * tijolo virarem as versoes legiveis sobre osso. Sem isso o selo de severidade
 * sairia em ocre claro sobre fundo claro — bonito no escuro, ilegivel aqui.
 *
 * @param {object} props
 * @param {'ok'|'atencao'|'critico'|'indeterminado'} props.severidade
 * @param {string} props.rotulo ex: 'Frequência de publicação, causa nomeada'
 * @param {string} props.frase o veredito
 * @param {string} [props.apoio] paragrafo curto que sustenta a frase
 * @param {import('react').ElementType} [props.como] elemento raiz ('section' por padrao)
 * @returns {JSX.Element}
 */
export default function Veredito({ severidade, rotulo, frase, apoio, como: Como = 'section' }) {
  return (
    <Como
      className="ki-veredito"
      data-severidade={severidade}
      data-superficie="papel"
      data-bloco="veredito"
    >
      <p className="ki-veredito__rotulo">
        <SeloDeSeveridade severidade={severidade}>
          {PALAVRA_DE_SEVERIDADE[severidade] ?? severidade}
        </SeloDeSeveridade>
        {rotulo ? <span className="ki-veredito__assunto">{rotulo}</span> : null}
      </p>
      {/* Cabecalho de secao de verdade: quem navega por titulo cai no diagnostico. */}
      <h2 className="ki-veredito__frase">{frase}</h2>
      {apoio ? <p className="ki-veredito__apoio">{apoio}</p> : null}
    </Como>
  )
}
