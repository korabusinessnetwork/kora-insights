# Padrões Consolidados — Kora Insights

> Padrão só entra aqui depois de valer em código de verdade. Cada um traz o
> arquivo onde vive, um exemplo real e o contraexemplo que ele existe para
> impedir. Padrão sem exemplo é opinião.
> Última revisão: 2026-09-06.

## Regras deste documento

- Padrão nasce de código que rodou, não de preferência.
- Padrão obsoleto ganha `[DEPRECADO]`, data e sucessor. Não se apaga.
- Padrão de segurança entra na hora, sem esperar segunda opinião.

---

## Nomenclatura

Domínio em português, técnico em inglês. A regra existe porque o domínio deste
produto **é** português: `alcance`, `cadência`, `veredito`. Traduzir isso para
inglês obriga a traduzir de volta em toda conversa com o dono do produto.

✅ `montarHistorico()`, `listarContasConectadas()`, `gerarDiagnostico()`
✅ `handleSubmit`, `useEffect`, `aoClicar`
❌ `buildHistory()`, `getConnectedAccounts()` — jargão onde o domínio é pt-BR

Constantes em maiúsculas com o mesmo critério: `SEMANAS_POR_JANELA`,
`LIMIAR_DE_ESTABILIDADE`, `CODIGOS`.

## Estrutura por feature

```
src/features/<feature>/
├── components/<Nome>.jsx + <Nome>.css + <Nome>.test.jsx
├── hooks/use<Feature>.js
└── index.js        barril: é por onde as rotas importam
```

✅ `src/features/diagnostico/components/Diagnostico.jsx`
❌ `src/components/diagnostico/` + `src/hooks/diagnostico.js` espalhados

O barril não é cerimônia: `src/app/telas.jsx` importa só dele, então mover um
bloco entre componentes nunca quebra uma rota.

## Camadas, e o que cada uma não pode

| Camada | Onde | Não pode |
|---|---|---|
| Telas | `src/features/` | calcular diagnóstico, falar com Supabase |
| Kit visual | `src/components/shared/` | conhecer regra de negócio ou rota |
| Serviços | `src/lib/` | conter regra de diagnóstico |
| Métricas, regras, motor | `src/metricas`, `src/rules`, `src/motor` | tocar rede ou DOM |

`src/metricas`, `src/rules` e `src/motor` são **puros**, com relógio injetado.
É o que permite rodá-los iguais no navegador e no Deno da Edge Function, e
testá-los contra histórico real sem subir nada.

## Envelope em toda chamada de serviço

```js
{ data, error: { codigo, mensagem } | null, meta: { carimbo, versao, origem } }
```

✅ Envelope sempre, inclusive em sucesso — quem consome tem um caminho só.
❌ Devolver array nu em sucesso e objeto de erro em falha: dois formatos, dois
   caminhos de leitura, e um deles sempre esquecido.

`error.codigo` é estável entre versões (`src/lib/erros.js`); `error.mensagem` é
pt-BR e vai para a tela. Mensagem crua do banco nunca sobe: vaza schema.

## Estilo entra por atributo de dado, nunca por `if` de JavaScript

```jsx
<li data-severidade={achado.severidade}>   ✅ o dado escolhe, o CSS reage
<li className={grave ? 'vermelho' : ''}>   ❌ regra de cor espalhada no JSX
```

Zero `style={{...}}`, zero hex fora de `src/styles`, zero cor em prop. É o que
faz o white-label ser uma troca de token em vez de uma varredura de componentes
(`src/tema/identidadeVisual.js`).

## Um número, uma fonte

Quando o mesmo número aparece em dois lugares, ele vem de um módulo só.
Aprendido caro: o prazo até o primeiro diagnóstico era literal na tela e
constante no ruleset, e o produto passou a prometer 8 semanas entregando 16.

✅ `src/rules/requisitos.js` — a tela e o motor leem o mesmo valor
✅ `formatarJanelaComparada()` — cabeçalho, tela e relatório dizem a mesma janela
❌ o mesmo prazo escrito à mão em dois arquivos

## O que a ferramenta não sabe também é entrega

Toda regra devolve `limites`, e o motor acrescenta os que valem sempre. A tela é
obrigada a mostrá-los. Serve para a lacuna de coleta, para o limite de
agregação da Meta e para o que a API simplesmente não entrega.

❌ Omitir a limitação porque "atrapalha a venda". Quem diz o próprio limite
   ganha credibilidade no resto (`docs/13_VENDA`, seção 8).

## Estados obrigatórios

Toda tela renderiza `carregando`, `vazio`, `erro` e `sucesso`. O vazio é
conteúdo, não encolher de ombros: a tela sem conta conectada explica os três
passos até o primeiro diagnóstico.

A decisão de qual estado mostrar mora numa função pura separada do efeito
(`situacaoDaTela()` em `useHistorico.js`, `useRelatorio.js`): dá para ler a
tabela de estados de uma vez em vez de reconstruí-la a partir de booleanos
espalhados pelo JSX.

## Botão que não funciona é declarado, não escondido

"Marcar teste de 4 semanas" e "Enviar por e-mail" ainda não existem. Os dois
aparecem desabilitados **com o motivo escrito ao lado**.

❌ Botão que finge funcionar. ❌ Botão removido em silêncio, que some do radar
de quem vai construir a funcionalidade.

## Teste que prova o que importa

- Função pura nasce com teste.
- Teste de peça não pega defeito de junção: `src/app/telas.test.jsx` existe
  porque três features testadas ficaram fora do bundle.
- Número de documento que pode envelhecer vira teste:
  `src/styles/contraste.test.js` lê a paleta do CSS e reprova a suite quando um
  par cai abaixo de AA — a tabela do `TOKENS.md` sai dele.
- Fixture é determinística: sem `Math.random`, sem relógio. Fixture que muda
  sozinha não serve de base para teste.

## Comentário explica POR QUE

✅ `// Soma de subconjunto não é total de janela: uma semana completa sem a`
   `// métrica puxaria o bloco para baixo e fabricaria uma queda que não houve.`
❌ `// soma os valores`

Função com mais de 3 linhas ganha JSDoc com tipos.

---

## Padrões [DEPRECADO]

| Padrão | Razão | Data | Sucessor |
|---|---|---|---|
| `src/components/` + `src/hooks/` planos | Espalhava a feature por três diretórios; achar o que muda junto virava caça | 2026-09-06 | estrutura por feature |
| `--cor-linha-forte` como borda de controle | Compartilhava token com a linha decorativa e media 1,50:1 | 2026-09-06 | `--cor-contorno`, com mínimo de 3:1 |
| `telaAusente()` / `ROTAS_SEM_TELA` | Virou código morto quando a última rota ganhou tela | 2026-09-06 | `telas.test.jsx` cobre o mesmo |

## Checklist de padrão novo

- [ ] Vale em pelo menos dois lugares do código de verdade
- [ ] Tem exemplo ✅ e contraexemplo ❌, os dois reais
- [ ] Diz onde mora o código que o implementa
- [ ] Se dá para transformar em teste, virou teste
