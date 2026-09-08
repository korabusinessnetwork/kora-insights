# Módulo assinatura — plano, cobrança e o teto real da Fase 0

> Nenhuma linha de código de cobrança existe hoje. Este documento registra o que
> já foi decidido, o que está modelado à espera de decisão e o que ainda não foi
> decidido — porque assinatura mal escrita vira suporte, e suporte manual é o
> que come a margem deste produto.
> Fontes: `docs/12_CUSTO_E_PRECIFICACAO`, `docs/13_VENDA`,
> `supabase/schema.sql`, `respostas-intake.md`, `memory/restrictions.md`.
> Última revisão: 2026-09-05.

---

## 1. O que está decidido

| Item | Valor | Origem |
|---|---|---|
| Modelo | SaaS B2B multi-tenant, **plano único pago** | `respostas-intake.md`, bloco 3 |
| Unidade de cobrança | **por marca conectada**, não por usuário | doc 12, seção 3.3 |
| Preço cheio | **R$ 197/mês** | doc 12, seção 3.3 |
| Anual | R$ 1.970 (dois meses grátis) | doc 12, seção 3.3 |
| Faixa aceitável em teste | R$ 149 a R$ 297 | doc 12, seção 3.3 |
| Preço de fundador (Fase 0) | **R$ 97/mês, travado enquanto o cliente permanecer** | doc 12, seção 3.3 |
| Contrapartida do preço de fundador | depoimento gravado + autorização de uso do case | doc 12, seção 3.3 e doc 13, seção 7 |
| Piso de posicionamento | abaixo de R$ 149 o produto vira commodity e a tese de diagnóstico deixa de ser crível | doc 12, seção 3.3 |
| Ponto de equilíbrio | 2 clientes a R$ 197, ou 3 ao preço de fundador | doc 12, seção 3.4 |

A âncora de preço não é a mLabs, é o custo do que o produto substitui: 4 a 6
horas por cliente por mês montando relatório, entre R$ 200 e R$ 300 de trabalho
manual (doc 12, seção 3.2). Se cobrarmos R$ 50, o cliente compara com ferramenta
de relatório e perdemos. A R$ 197, ele compara com as próprias horas.

---

## 2. O teto real da Fase 0

A escassez comunicada na venda **não é artifício**: o app está em Development
mode e só atende contas adicionadas manualmente como testers no painel Meta, na
ordem de algumas dezenas (`memory/restrictions.md`). Esse é o número máximo de
marcas que podem existir como assinantes antes do App Review.

```
SE app.modo = 'development' ENTAO
  marcasConectaveis <= testers cadastrados manualmente no painel Meta
  E cada tester precisa ser adicionado ANTES da primeira tentativa de conexao
FIM
```

Regra de comunicação, que é regra de negócio porque protege a marca: nunca
inflar o número e nunca reabrir vaga depois de dizer que fechou (doc 13, seção
7). Neste caso a escassez nem precisa de retórica — o limite é técnico.

---

## 3. O que está modelado à espera de decisão

O schema já carrega a assinatura, sem nenhum código que a escreva:

| Coluna | Valores | Escritor hoje |
|---|---|---|
| `tenants.plan` | texto, `'unico'` por padrão | nenhum |
| `tenants.status` | `'ativo'`, `'suspenso'`, `'cancelado'` (check) | nenhum |
| `ig_contas.status` | inclui `'pausada'`, previsto para suspensão | nenhum |

Modelar antes de precisar foi decisão consciente: coluna nova em tabela com RLS
custa migration, revisão de `grant` por coluna e teste de isolamento. Mas **estado
sem escritor precisa estar escrito**, senão vira mistério na primeira leitura.

### Tensão entre o preço e o schema

O preço é **por marca conectada** (doc 12) e `plan` vive em **`tenants`**, não em
`ig_contas`. Uma agência com 8 marcas tem um `plan` e oito contas. Hoje isso não
quebra nada porque ninguém cobra; no dia da primeira cobrança, ou a coluna muda
de tabela, ou o cálculo passa a ser "plano do tenant × contagem de contas
ativas". As duas saídas são defensáveis, e nenhuma foi escolhida.

**Onde a decisão mora:** ADR de cobrança, com migration no mesmo commit
(`contratos.md`, seção 7).

---

## 4. As regras que a cobrança vai precisar respeitar

Estas não dependem do gateway escolhido. Elas derivam de decisões que já existem
e valem para qualquer implementação:

```
-- 1. Falta de pagamento NUNCA apaga historico.
--    ADR-004: o historico e o ativo de retencao e e do cliente, sem lock-in.
SE assinatura vencida ENTAO
  tenant.status = 'suspenso'
  contas do tenant -> status = 'pausada'      -- coleta para
  historico e diagnosticos PERMANECEM legiveis
  exclusao so acontece por pedido explicito ou por politica de retencao
FIM

-- 2. Coleta parada precisa aparecer, nao sumir.
--    Conta pausada continua sendo diagnosticada, e a lacuna cresce na tela
--    com motivo. Tela vazia por inadimplencia seria lacuna escondida (ADR-004).

-- 3. Cancelar nao e excluir.
--    Excluir dado do cliente exige pedido do titular (conformidade.md).
--    Cancelamento sem pedido de exclusao mantem o dado ate o prazo de retencao.

-- 4. O cliente exporta o proprio historico a qualquer momento.
--    Promessa de ADR-004 e argumento de venda em doc 13, secao 8.
--    NAO EXISTE CODIGO. E divida de promessa, nao recurso futuro.
```

A regra 4 merece o nome que tem: o produto é **vendido** dizendo "exporta o
histórico completo quando quiser, foi decisão de arquitetura, não favor". Até
existir o exportador, essa frase não pode ser dita em call de venda.

---

## 5. Custo por trás do preço

Números de `docs/12_CUSTO_E_PRECIFICACAO`, repetidos aqui só no que muda uma
regra de negócio:

- Custo fixo de referência na Fase 1: **R$ 248/mês** (Supabase Pro + Vercel Pro
  ou alternativa).
- Gateway: **~4% + R$ 0,40 por cobrança**. Pix derrubaria a taxa para centavos.
- Consumo de banco: **~12 KB por conta por dia**, ~88 MB/ano com 20 contas,
  dentro dos 500 MB do Supabase Free. **Armazenamento não é o gargalo.**
- Sinal de alerta: se a margem cair abaixo de 80% com mais de 10 clientes, a
  causa não será infraestrutura, será suporte manual.

Consequência de produto, e não de finanças: **instrumentar o onboarding antes de
escalar**. A taxa de conexão concluída na própria call é a métrica que mede a
fricção do ADR-002 (doc 13, seção 10) — e é ela que diz se o suporte vai comer a
margem.

---

## 6. Quem não deve assinar

Recusar a venda errada vale mais que o MRR dela: cliente errado em produto novo
consome o suporte inteiro e depõe mal (doc 13, seção 9).

| Sinal | Por quê |
|---|---|
| Perfil que publica menos de 2 vezes por mês | não há dado suficiente para diagnóstico; a tela dirá `indeterminado` por meses |
| Quem quer agendar ou publicar conteúdo | não é o produto e não está no roadmap |
| Quem quer dado de concorrente além do público | não é o produto e não será (ADR-006) |
| Conta pessoal que não quer virar profissional | tecnicamente impossível (ADR-002) |
| Conta sem Página do Facebook e sem disposição de vincular | tecnicamente impossível na variante escolhida |

O primeiro item é o mais fácil de ignorar e o mais caro: um perfil de baixa
cadência gera assinatura que paga e nunca vê veredito, porque
`dado-insuficiente` domina o diagnóstico (`modulo-diagnostico.md`, seção 2).

---

## 7. O que não está decidido

| Pergunta em aberto | Impacto | Onde a decisão vai morar |
|---|---|---|
| Gateway de pagamento (Stripe, Asaas ou Pagar.me) e se aceita Pix | taxa de ~4% contra centavos por transação | ADR novo + doc 12, seção 3.5 |
| Hospedagem definitiva — Vercel Hobby veda uso comercial | **bloqueante antes da primeira cobrança** | ADR novo + doc 12, seção 2.2 |
| Agência paga por marca ou tem preço de pacote | recomendação inicial: por marca, com desconto progressivo a partir da quinta | ADR de cobrança |
| `plan` no tenant ou na conta (seção 3) | define como o valor é calculado | ADR de cobrança + migration |
| Prazo de retenção após cancelamento | LGPD exige prazo declarado | `conformidade.md` |
| Se existe teste gratuito, e de quanto tempo | nunca foi discutido; o funil de doc 13 usa diagnóstico gratuito único na call, não trial de produto | doc 13 + ADR |

Enquanto o gateway não existir, a cobrança da Fase 0 é **manual, fora do
produto**, e nenhuma tela pode afirmar o contrário.
