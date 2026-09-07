# 12 — Custo e Precificacao

> Fonte de verdade financeira do Kora Insights. Toda estimativa aqui tem data e
> origem. Valores em USD sao convertidos a titulo de referencia; confira o cambio
> antes de decidir. Ultima revisao: 2026-09-05.

---

## 1. Custo de construir (uma vez, Fase 0)

### 1.1 Desembolso real

| Item | Custo | Nota |
|---|---|---|
| Supabase Free | R$ 0 | 500 MB de banco, 50 mil MAU. Pausa apos 7 dias ociosa, mas o cron diario de coleta impede a pausa |
| Vercel Hobby | R$ 0 | **Nao serve:** veda uso comercial, e a definicao alcanca ate a pagina que anuncia o produto. Ver secao 2.2 |
| Meta Developer + Graph API | R$ 0 | A Graph API nao cobra por chamada. O custo e tempo de review e limite de taxa |
| Dominio .com.br | ~R$ 40/ano | |
| **Total de desembolso ate o primeiro cliente** | **~R$ 40** | |

### 1.2 Custo de oportunidade (o custo real)

Estimativa de esforco do MVP, com o corte de escopo do ADR-006 (comparacao fica para a Fase 2):

| Bloco | Horas |
|---|---|
| Fundacao, auth, multi-tenant e RLS | 20 a 30 |
| OAuth Meta e onboarding da conta (inclui vinculo com Pagina do Facebook) | 25 a 35 |
| Camada de coleta, dicionario de metricas e adaptadores (ADR-003) | 30 a 40 |
| Snapshot diario agendado e historico (ADR-004) | 15 a 20 |
| Motor de regras versionado (ADR-005) | 35 a 50 |
| Dashboard e tela de diagnostico | 30 a 40 |
| Export de relatorio | 12 a 18 |
| Cobranca e ciclo de assinatura | 10 a 15 |
| **Total** | **177 a 248 h** |

A R$ 80/h de custo de oportunidade, entre **R$ 14 mil e R$ 20 mil** em tempo. Nao sai
do bolso, mas e o numero honesto para comparar com qualquer alternativa.

### 1.3 Custo do App Review (Fase 1)

Sem desembolso, mas com pedagio de calendario. A revisao exige verificacao de
negocio com documento (CNPJ), screencast por permissao, politica de privacidade
publicada e endpoint de exclusao de dados, com fila tipica de 2 a 4 semanas que
reinicia a cada pedido de correcao. **Planeje 4 a 8 semanas** e trate como caminho
critico, nao como etapa final.

---

## 2. Custo de operar (recorrente)

### 2.1 Fase 0 (ate ~20 contas conectadas)

| Item | Custo/mes |
|---|---|
| Supabase Free | R$ 0 |
| Cloudflare Pages (ADR-010) | R$ 0 |
| Gateway de pagamento | ~4% + R$ 0,40 por cobranca |
| **Piso** | **~R$ 0 + taxa de gateway** |

Consumo de banco estimado: cerca de 12 KB por conta por dia (1 snapshot de conta
mais ~30 snapshots de midia). Com 20 contas, sao ~88 MB por ano, bem dentro dos
500 MB do plano Free. Armazenamento nao e o gargalo; o gargalo e o limite de
testers do Development mode.

### 2.2 Hospedagem: o Hobby da Vercel morde antes do primeiro cliente

**Correcao de 2026-09-07.** Este documento dizia que a restricao valia "no momento
em que voce cobra do primeiro cliente". Nao e isso. A definicao da propria Vercel
e mais ampla:

> Commercial usage is defined as any Deployment that is used for the purpose of
> financial gain of **anyone** involved in **any part of the production** of the
> project, including a paid employee or consultant writing the code. Examples
> include […] **advertising the sale of a product or service**.
>
> — Vercel, *Fair Use Guidelines*, secao "Commercial usage"

Ou seja: uma pagina que anuncia a venda do produto ja e uso comercial, e o
proprio fato de alguem ser pago para escrever o codigo tambem entra. O gatilho
nao e a primeira cobranca — e o lancamento. Publicar a politica de privacidade e
a pagina de exclusao no Hobby, que e o que o App Review exige, ja fica em cima
dessa linha.

#### O que a troca custa

Quase nada, e vale medir antes de decidir por medo: **o build e estatico puro**
(`vite build` produz `index.html` + `assets/`). Nao ha funcao serverless no host
— as Edge Functions rodam no Supabase. O host so precisa servir arquivo e ter
fallback de SPA. Nao ha lock-in a desfazer.

#### As tres saidas

| Opcao | Custo | Uso comercial no gratuito | Limites que importam aqui |
|---|---|---|---|
| **Vercel Pro** | US$ 20/mes (~R$ 110) | — (pago) | Nenhum que este produto alcance |
| **Cloudflare Pages** | R$ 0 | **Permitido** | Banda ilimitada; 500 builds/mes; 20.000 arquivos |
| **Netlify Free** | R$ 0 | **Permitido**, exceto revender a hospedagem | 100 GB de banda, 300 min de build por mes |

Revender hospedagem nao e o nosso caso: vendemos diagnostico, e o cliente nunca
hospeda nada conosco.

#### Recomendacao

**Cloudflare Pages, agora.** Tres razoes, em ordem de peso:

1. E a unica das tres sem teto de banda. As outras duas tem um numero que um dia
   obriga a decidir de novo; esta nao cria a segunda decisao.
2. Custa R$ 0 e destrava a cadeia que hoje esta parada: sem URL publica nao ha
   politica de privacidade publicada, sem ela nao ha submissao ao App Review, e o
   App Review e o caminho critico (`memory/learnings.md`, 2026-09-05).
3. A troca e barata **hoje** e continua barata depois. Adiar nao compra nada.

Contra a Vercel Pro agora: US$ 20/mes por 12 meses sao ~R$ 1.320 gastos antes do
primeiro real de receita, para resolver um problema que R$ 0 resolvem igual. A
regra de custo do projeto (`CLAUDE.md`) manda adiar o pago por padrao, e aqui o
gratuito nao e um degrau abaixo — e o mesmo servico para um site estatico.

**Decidido em 2026-09-07: Cloudflare Pages** (ADR-010). O custo fixo de
hospedagem da Fase 0 e da Fase 1 cai para R$ 0, e some a linha "Vercel Pro" do
orcamento pos-review.

### 2.3 Fase 1 (pos review, 20 a 100 contas)

| Item | USD/mes | ~BRL/mes |
|---|---|---|
| Supabase Pro | US$ 25 | ~R$ 138 |
| Cloudflare Pages (ADR-010) | US$ 0 | R$ 0 |
| **Total fixo** | **US$ 25** | **~R$ 138** |

O Supabase Pro e cobrado por organizacao, nao por projeto, e ja inclui US$ 10 de
credito de computacao que cobre exatamente uma instancia Micro. Projeto adicional
(staging) sai por US$ 10, nao por US$ 25. Excedentes so aparecem acima de 8 GB de
banco e 250 GB de egresso, o que este produto nao alcanca tao cedo.

Conversao usada: US$ 1 = R$ 5,50. **Confirme o cambio antes de fechar preco.**

---

## 3. Precificacao

### 3.1 O que o mercado cobra

| Ferramenta | Preco de entrada |
|---|---|
| mLabs | a partir de ~US$ 9,90 a 12,90/mes por marca (equivalente mensal do plano anual) |
| Reportei | R$ 19,90 a R$ 59,90/mes; planos internacionais de US$ 24 a US$ 79 |
| Etus | a partir de ~R$ 9,90/mes |

**Leitura:** o mercado de *relatorio de Instagram* esta comoditizado e barato no
Brasil. Competir nessa categoria significa brigar por preco com empresas que tem
dez anos de mercado, equipe de suporte e mais de vinte integracoes. Nao entramos ai.

### 3.2 A tese de preco

Kora Insights nao vende relatorio, vende diagnostico. A ancora nao e o preco da
mLabs, e o custo do que ele substitui:

- Agencia que monta relatorio na mao: 4 a 6 horas por cliente por mes. A R$ 50/h,
  entre **R$ 200 e R$ 300 por cliente por mes** so de trabalho manual.
- Uma sessao de consultoria de conteudo: R$ 300 a R$ 1.500, pontual e sem historico.

Se cobrarmos R$ 50, o cliente compara com a mLabs e perdemos. Se cobrarmos R$ 197,
ele compara com as proprias horas e ganhamos.

### 3.3 Preco recomendado

**Plano unico: R$ 197/mes por marca conectada.** Anual a R$ 1.970 (dois meses gratis).

Faixa de teste aceitavel: R$ 149 a R$ 297. Abaixo de R$ 149 o posicionamento de
diagnostico deixa de ser cri­vel e o produto vira commodity.

**Preco de fundador (Fase 0): R$ 97/mes, travado enquanto o cliente permanecer.**
Vagas limitadas de verdade, porque o Development mode so atende testers adicionados
manualmente no painel Meta, na ordem de algumas dezenas de contas. A escassez e real,
nao inventada, e e exatamente o tipo que pode ser comunicada sem queimar a marca.

Contrapartida obrigatoria do preco de fundador: depoimento gravado e autorizacao de
uso do case. Esses clientes viram, ao mesmo tempo, prova social e o material do
screencast do App Review. Um mesmo esforco resolve venda e aprovacao.

### 3.4 Ponto de equilibrio e margem

Custo fixo de referencia na Fase 1: R$ 248/mes. Gateway a 4%.

| Clientes | Receita a R$ 197 | Custo total | Margem | % |
|---|---|---|---|---|
| 2 | R$ 394 | R$ 264 | R$ 130 | 33% |
| 5 | R$ 985 | R$ 287 | R$ 698 | 71% |
| 10 | R$ 1.970 | R$ 327 | R$ 1.643 | 83% |
| 30 | R$ 5.910 | R$ 484 | R$ 5.426 | 92% |

**Ponto de equilibrio: 2 clientes pagantes.** Com o preco de fundador de R$ 97, sao
3 clientes. O custo de infraestrutura deste produto e irrelevante frente ao preco;
o custo real e o tempo de construcao e a fila do App Review.

Sinal de alerta: se a margem cair abaixo de 80% com mais de 10 clientes, a causa nao
sera infraestrutura, sera suporte manual. Instrumente o onboarding antes de escalar.

### 3.5 O que ainda nao esta decidido

- Gateway (Stripe, Asaas ou Pagar.me) e se aceita Pix, que derruba a taxa de ~4% para
  centavos por transacao
- ~~Hospedagem definitiva~~ — **decidido**: Cloudflare Pages (ADR-010)
- Se agencia com varias marcas paga por marca ou tem preco de pacote. Recomendacao
  inicial: por marca, com desconto progressivo a partir da quinta

---

## Revisao
Revisar este documento a cada mudanca de fase e sempre que a Meta alterar limites
de taxa ou metricas disponiveis (ver ADR-003).
