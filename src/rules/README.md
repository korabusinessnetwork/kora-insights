# Ruleset — o metodo em codigo

O diferencial do Kora Insights nao e o grafico, e a interpretacao. Este diretorio
e onde essa interpretacao mora: os padroes da Atmosfera Viral escritos como
arquivos declarativos, versionados, testados contra serie real (ADR-005).

Nada aqui toca rede, DOM, Supabase ou relogio. Uma regra recebe um `Historico`
e devolve um `Achado` ou `null`. So isso.

## Anatomia de uma regra

```js
export default {
  codigo: 'cadencia-em-queda',   // estavel: viaja no diagnostico gravado
  versao: '0.3.0',
  peso: 90,                      // o maior peso vira o veredito da tela
  minimoDeSemanas: 16,           // o motor nem chama a regra abaixo disso
  avaliar(historico) { /* devolve Achado ou null */ },
}
```

O formato de `Historico` e de `Achado` esta fixado em
`docs/01_ARQUITETURA/contratos.md`, secao 3. Mudar qualquer um dos dois e
mudanca combinada: quem muda, atualiza o contrato no mesmo commit.

## Como escrever uma regra nova

1. **Crie o arquivo em `src/rules/<versao>/<nome>.js`.** Nome em portugues, sem
   acento, camelCase: `formatoQueSalva.js`.
2. **Calcule com `src/motor/index.js`.** `ultimasJanelasCompletas`,
   `compararJanelas`, `mediaPorPublicacao`, `variacaoExibida`. Regra que escreve
   a propria media e o proprio arredondamento produz uma tabela que discorda da
   tabela da regra ao lado, na mesma tela.
   Rotulo de metrica, texto de numero e a palavra "Estavel" vem de
   `src/metricas/` (`obterMetrica`, `formatarNumero`, `formatarVariacao`,
   `LIMIAR_DE_ESTABILIDADE`). Nenhuma regra escreve o rotulo de uma metrica a
   mao: o nome que a tela mostra e decisao do dicionario canonico (ADR-003).
3. **Use `variacaoExibida`, nunca `variacao` crua, em evidencia.** A variacao e
   calculada sobre os valores **como sao exibidos**: 1,8 dividido por 3,0 da os
   40% que o cliente obtem conferindo a tabela na reuniao. Se a tela disser 42%,
   ele conclui que a ferramenta erra — e estara certo em desconfiar.
4. **Monte o texto a partir do dado.** Nenhum numero literal em frase, acao ou
   confirmacao. Se a acao diz "volte para 3 publicacoes", o 3 e a mediana da
   janela anterior, calculada na hora.
5. **Decida o `tom` de cada evidencia.** Cair nem sempre e ruim, e o CSS nao tem
   como saber disso. O tom e decisao da regra.
6. **Declare o que a regra NAO sabe em `limites`.** Sao codigos, nao frases: o
   texto pt-BR vive em `CATALOGO_DE_LIMITES`, em `src/motor/motor.js`. Codigo
   novo precisa ser registrado la, senao a tela mostra o aviso sem texto.
7. **Registre a regra em `src/rules/<versao>/index.js`.**
8. **Nasca com teste.** Regra sem teste sobre serie conhecida nao entra.

## Por que o ruleset e versionado

Porque a pergunta que o cliente faz na segunda reuniao e: *"mudou a minha conta
ou mudou a sua regra?"*. Sem versao gravada em cada diagnostico, essa pergunta
nao tem resposta, e uma ferramenta que nao consegue responder isso nao serve
para defender uma estrategia.

A versao e semantica:

- **patch** — corrigiu conta errada ou texto, sem mudar quem dispara.
- **minor** — regra nova, ou limiar afrouxado/apertado.
- **major** — mudou o significado de um codigo existente.

Codigo de regra e como codigo de erro: **estavel entre versoes**. Se o
significado mudar, o codigo muda junto.

## Por que mudanca de ruleset nunca reescreve diagnostico passado

Um diagnostico e o registro do que o produto afirmou naquela semana, com a
regra que existia naquela semana. Reprocessar o passado com a regra de hoje
apagaria a unica evidencia de que a afirmacao anterior foi feita — e o cliente
que agiu com base nela ficaria sem o registro do que leu.

Por isso `diagnosticos` guarda `ruleset_version`, o motor gera `id`
deterministico a partir de conta, periodo e versao, e ruleset novo produz
**registro novo**, ao lado do antigo. Comparar as duas linhas e o que permite
dizer se o veredito mudou por causa da conta ou por causa da regra.

## O ruleset 0.3.0

| Codigo | Peso | Minimo | Severidade | O que nomeia |
|---|---|---|---|---|
| `dado-insuficiente` | 100 | 0 | `indeterminado` | historico curto demais para qualquer veredito |
| `cadencia-em-queda` | 90 | 16 | `atencao` / `critico` | frequencia caiu e o alcance seguiu junto |
| `formato-que-salva` | 60 | 8 | `ok` | um formato retem atencao acima dos demais |
| `consistencia-de-alcance` | 40 | 8 | `ok` / `atencao` | o resultado vem de metodo ou de sorte de post |

`dado-insuficiente` tem o maior peso de proposito: quando dispara, o motor
descarta os demais achados. Um veredito parcial ao lado de "ainda nao sei"
convida o cliente a agir com meia informacao — que e exatamente o que este
produto existe para nao fazer.
