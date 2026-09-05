# 00 — Visao

## Uma frase
Kora Insights conecta o Instagram da marca e transforma insight bruto em
diagnostico de crescimento acionavel.

## O problema
Metrica nao falta. Leitura falta. O painel nativo do Instagram mostra o numero e
deixa a causa em aberto. Ferramentas de relatorio automatizam o grafico e mantem o
mesmo vazio: entregam uma pergunta em forma de dashboard. Quem decide conteudo
segue decidindo por intuicao, e quem presta servico segue montando slide na mao.

## A aposta
O valor nao esta na coleta, que qualquer um faz, nem no grafico, que ja e
commodity. Esta na interpretacao. O metodo da Atmosfera Viral, transformado em
regras versionadas de software, e o ativo que sustenta o produto e o preco.

## O que o produto faz
1. A marca conecta a conta profissional por OAuth
2. Coletamos e guardamos historico proprio desde o primeiro dia
3. O motor de regras aplica o metodo sobre esse historico
4. A tela mostra a causa nomeada e a proxima acao, nao so a serie
5. O relatorio exportavel sai do mesmo diagnostico

## O que o produto NAO faz (fronteira explicita)
- Nao acessa insight de conta que nao autorizou o app. Nao existe caminho oficial
  para isso, e nao vamos por caminho nao oficial
- Nao agenda nem publica conteudo. Nao competimos com ferramenta de agendamento
- Nao promete alcance, salvamento ou demografia de concorrente, porque a API nao
  entrega (ver ADR-006)
- Nao revende dado bruto da plataforma

## Aha moment
A primeira tela diz o que esta travando o crescimento, com a causa nomeada.

## Metrica de sucesso da Fase 0
Cliente-teste que, depois de ler o diagnostico, muda algo concreto no proprio
conteudo. Se nada muda, o produto e um dashboard bonito e falhou.
