# Identidade visual — referencia

Tres telas fechadas, entregues como PDF pelo dono do produto. Sao a **fonte de
verdade visual**: quando este diretorio e o codigo divergirem, o codigo esta
errado.

| Arquivo | Tela | O que fixa |
|---|---|---|
| `01-diagnostico.png` | diagnostico | o veredito como heroi, cartao de osso sobre carvao, barra ocre, evidencia em tres indicadores, grafico barra + linha, acao recomendada, "o que este diagnostico nao sabe" |
| `02-sem-conta-conectada.png` | estado vazio | o vazio como conteudo: tres passos ate o primeiro diagnostico e a frase que explica por que nao ha grafico de exemplo |
| `03-relatorio.png` | relatorio | a folha clara: cabecalho com marca do cliente e de quem preparou, veredito, acao, limites, tabela de evidencia e grafico |
| `korainsights_identidade.pdf` | original | as tres paginas como recebidas |

Paleta, tipografia e contraste extraidos daqui estao em `../TOKENS.md`;
a implementacao em `src/styles/tokens.css`.

## Onde o codigo diverge da imagem, e por que

A regra e "o codigo esta errado". Estas tres sao as excecoes, todas registradas
porque uma imagem nao pode decidir sozinha contra acessibilidade ou contra a
verdade do motor:

1. **Contraste.** A identidade desenha as barras do grafico e o contorno dos
   botoes secundarios abaixo de 3:1. O codigo os clareia ate o minimo da WCAG.
   Grafico e a prova visual da frase do veredito; prova ilegivel nao prova nada.
   Detalhe em `../TOKENS.md`.
2. **"Precisamos de 8 semanas" (pagina 2).** O ruleset 0.3.0 compara oito
   semanas contra oito e portanto exige dezesseis. O numero na tela vem de
   `src/rules/requisitos.js`, entao promessa e motor nao tem como divergir.
   O prazo em si e decisao aberta do dono (`docs/09_BACKLOG`).
3. **"O primeiro diagnostico sai em 24 horas" (pagina 2).** O titulo e a
   descricao do mesmo passo se contradiziam: 24 horas contra semanas. O codigo
   diz "a primeira leitura sai em 24 horas" e explica que ela vai dizer que
   ainda nao sabe — que e a resposta certa no primeiro dia.
