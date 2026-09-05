# 13 — Venda

> Como o Kora Insights e vendido. Oferta, funil, objecoes e plano de apresentacao.
> Precos e margens vivem em `docs/12_CUSTO_E_PRECIFICACAO`. Ultima revisao: 2026-09-05.

---

## 1. A oferta em uma frase

Conecte o Instagram da marca e receba, toda semana, o diagnostico do que esta
travando o crescimento, com a acao recomendada e o relatorio pronto para o cliente.
R$ 197 por mes por marca.

**Teste da frase:** tem publico definido, resultado nomeado e preco. Se alguem
perguntar "o que voces fazem?", essa e a resposta inteira.

## 2. O inimigo comum

O relatorio bonito que ninguem sabe usar. O mercado inteiro vende grafico e chama
de insight. Grafico e pergunta em forma de imagem. O cliente sai da reuniao sabendo
que o alcance caiu 30% e sem ideia do que fazer na segunda-feira.

Essa e a crenca que o produto ataca em todo material publico: **dashboard nao e
resposta**.

## 3. O que a oferta NAO e

Dito na primeira conversa, nao na terceira. Escopo vago mata venda depois.

- Nao agenda nem publica conteudo
- Nao acessa a conta de quem nao autorizou
- Nao entrega alcance, salvamento ou demografia de concorrente (a API nao permite)
- Nao promete crescimento; promete leitura correta do proprio dado

## 4. Publico e ordem de ataque

**Primeiro: agencias pequenas do Vale do Sinos.** Motivo: dor mensal, mensuravel em
horas, e uma agencia traz varias marcas de uma vez. Um cliente vale de 3 a 15
contas. Canal: rede direta do Matheus, Casa Coffee Colab e Atmosfera Viral.

**Depois: marcas com social media interno.** Ticket igual, ciclo mais longo,
volume maior.

## 5. Funil

**Topo (atencao).** Conteudo que assume ponto de vista, nunca dica generica. O
formato que funciona aqui e o diagnostico publico: pegar um perfil que autorizou,
mostrar o dado e nomear a causa em publico. Prova o produto e ensina ao mesmo tempo.

**Meio (confianca).** Diagnostico gratuito unico, feito na frente da pessoa em call
de 20 minutos, com a conta dela conectada. Nao e demo com dado ficticio: e o dado
dela. O aha acontece na call, nao depois.

**Fundo (oferta).** Preco de fundador com vaga limitada de verdade (ver secao 7).

## 6. Script da call de 20 minutos

1. **(2 min) Contexto.** "Como voce monta o relatorio hoje e quanto tempo leva?"
   Nao venda ainda. O numero de horas que ela disser e a ancora de preco depois.
2. **(3 min) Conexao.** Conecta a conta ao vivo. Se travar no requisito da Pagina
   do Facebook, resolve junto; isso ja e demonstracao de suporte.
3. **(8 min) Diagnostico.** Le o veredito em voz alta e cala a boca. Deixa a pessoa
   reagir. A frase precisa ser tao especifica que ela responda "e verdade" ou
   "isso nao procede", nunca "interessante".
4. **(3 min) Relatorio.** Exporta na frente dela.
5. **(4 min) Oferta.** Retoma as horas do passo 1. "Voce me disse 5 horas por
   cliente por mes. Isso e R$ 250 do seu tempo. O Kora custa R$ 197 e ja fez isso
   em 20 minutos." Preco de fundador, vagas, proxima acao.

## 7. Escassez, e por que ela e legitima

O Development mode da Meta so atende contas adicionadas manualmente como testers,
na ordem de algumas dezenas. Isso e um teto tecnico, nao inventado. Comunicar assim:

> "Ate a aprovacao da Meta, consigo atender um numero limitado de contas. Quem
> entrar agora paga R$ 97 e mantem esse valor enquanto ficar."

Nunca inflar o numero nem reabrir a vaga depois de dizer que fechou. Escassez falsa
queima a marca, e neste caso ela nem e necessaria: o limite e real.

Contrapartida obrigatoria do preco de fundador: depoimento gravado e autorizacao de
uso do case. Esses clientes viram, no mesmo esforco, prova social e o material do
screencast exigido pelo App Review.

## 8. Objecoes e respostas

**"Ja uso mLabs / Reportei, e mais barato."**
Sao ferramentas de relatorio e fazem isso bem. Elas entregam o grafico, voce faz a
leitura. O Kora entrega a leitura. Se o que falta e grafico, fique com a mLabs.
(Nao ataque o concorrente. Redefina a categoria.)

**"Meu cliente nao vai conectar a conta."**
Sem conexao nao existe insight, para ninguem. Qualquer ferramenta que prometa dado
profundo sem autorizacao esta ou mentindo ou fora dos termos da Meta.

**"Por que preciso de Pagina do Facebook?"**
Exigencia da Meta para o tipo de acesso que traz insight de verdade. Leva 3 minutos
e a gente faz junto na call.

**"E se voces sumirem? Perco o historico?"**
Exporta o historico completo quando quiser. Foi decisao de arquitetura, nao favor.

**"Voces dao alcance dos concorrentes?"**
Nao, e ninguem da de forma legitima. A Meta so expoe dado publico de terceiros.
Quem promete mais que isso esta raspando dado fora dos termos.

**"Esta caro."**
Comparado a que? Se comparado a ferramenta de relatorio, sim. Comparado as suas
horas montando slide, custa menos que um mes de trabalho manual em um unico cliente.

## 9. Sinais de que a venda nao deve acontecer

- Perfil que posta menos de 2 vezes por mes: nao ha dado suficiente para diagnostico
- Quem quer agendamento de post: nao e o produto
- Quem quer espionar concorrente: nao e o produto e nao sera
- Conta pessoal que nao quer virar profissional: tecnicamente impossivel

Recusar essas vendas na primeira call vale mais que o MRR delas. Cliente errado em
produto novo consome o suporte inteiro e depoe mal.

## 10. Metricas do funil (acompanhar desde o cliente 1)

- Calls agendadas por semana
- Taxa de conexao concluida na propria call (mede a fricao do ADR-002)
- Taxa call para pagamento
- Quantos clientes mudaram algo no conteudo apos o diagnostico (metrica de sucesso
  do produto, ver `docs/00_VISAO`)
