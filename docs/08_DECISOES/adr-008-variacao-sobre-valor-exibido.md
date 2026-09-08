# ADR-008 — A variacao e calculada sobre o valor exibido

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
A Casa Oliveira publicou 14 vezes em 8 semanas e 24 vezes nas 8 anteriores. A
media crua e 1,75 e 3,00 por semana; a tela mostra 1,8 e 3,0, com uma casa
decimal, porque "1,75 publicacao por semana" nao e como ninguem fala.

A variacao entre os valores crus e 41,7%. Entre os valores exibidos, 40%.

Nao e um detalhe de arredondamento. O produto e vendido para ser lido em voz alta
numa reuniao, e a primeira coisa que um cliente cetico faz e conferir a conta na
propria tabela: divide 1,8 por 3,0. Se a tela disser 42%, ele conclui que a
ferramenta erra — e ele tem razao em desconfiar, porque a tabela nao fecha com
ela mesma.

## Decisao
A variacao mostrada e calculada sobre os valores **como aparecem na tela**, com a
mesma precisao. Cada evidencia guarda `casas`, a precisao usada, para a conta
continuar auditavel depois.

O valor guardado no achado ja e o valor exibido: guardar o cru obrigaria a tela a
arredondar de novo, e duas rotinas de arredondamento sempre divergem.

## Alternativas
- **Variacao sobre o valor cru:** matematicamente mais exata e praticamente pior.
  Produz uma tabela que se contradiz. Descartada.
- **Mostrar mais casas decimais:** resolveria a contradicao e devolveria "1,75
  publicacao por semana" para a tela, que e ilegivel. Descartada.

## Consequencias
- Positivas: o numero da tela fecha com a propria tela. O cliente pode conferir a
  conta na frente do consultor, e e exatamente isso que sustenta o preco.
- Negativas: a variacao exibida difere da variacao crua em metricas com casa
  decimal. Quem for calcular metrica derivada a partir do achado precisa saber
  disso — por isso `casas` viaja junto.
- Regra: `variacaoExibida` arredonda **antes** de dividir. `variacao` crua
  continua existindo em `src/motor/estatistica.js` para uso interno das regras.
