# App Review da Meta — o roteiro

> Sem aprovação, o produto atende apenas as contas adicionadas manualmente como
> testers. O App Review não é a etapa final: é **caminho crítico**, e roda em
> paralelo com o desenvolvimento.
> Fontes: `memory/restrictions.md`, ADR-002, `docs/12`, seção 1.3,
> `docs/13_VENDA/plano-de-apresentacao.md`. Última revisão: 2026-09-05.

---

## 1. O que a Meta exige

| Exigência | Estado hoje | Onde resolver |
|---|---|---|
| **Verificação de negócio** no Meta Business Manager, com documento (CNPJ) | não iniciada | processo administrativo, fora do código |
| **Política de privacidade publicada**, em URL pública e estável | rota `/privacidade` prevista, texto **não escrito** | `contratos.md`, seção 6 |
| **Instruções de exclusão de dados**, em URL pública | rota `/dados` prevista, texto **não escrito** | idem |
| **Screencast por permissão**, mostrando cada uma sendo usada em tela | não gravado | seção 3 |
| **Descrição do caso de uso** de cada permissão | esboçada em `docs/07_APIS/graph-api.md`, seção 1 | idem |
| **App funcional** para o revisor testar | depende das telas do produto | `docs/09_BACKLOG` |

**Permissão sem tela correspondente é causa clássica de reprovação**
(`memory/restrictions.md`). A tabela permissão ↔ tela de
`docs/07_APIS/graph-api.md` é material de submissão, não documentação interna.

### As quatro permissões, e o que precisa aparecer no vídeo

| Permissão | O que o revisor precisa ver acontecendo |
|---|---|
| `instagram_basic` | a conta sendo nomeada na tela após a conexão, com `@` e nome |
| `instagram_manage_insights` | os indicadores e o gráfico da tela de diagnóstico, e a tabela do relatório |
| `pages_show_list` | a descoberta da Página administrada durante a conexão |
| `pages_read_engagement` | o vínculo Página ↔ conta profissional sendo lido na conexão |

`pages_read_engagement` é a mais frágil de justificar, porque o produto **não
exibe dado de engajamento da Página**. Ver `docs/07_APIS/graph-api.md`, seção 1 —
ou o screencast demonstra que sem ela a descoberta falha, ou a permissão sai do
pedido. **A verificação prática ainda não foi feita**, e ela é barata: uma
conexão de teste sem a permissão responde a pergunta.

---

## 2. O prazo, sem otimismo

- Fila típica de revisão: **2 a 4 semanas**.
- **A fila reinicia a cada pedido de correção.**
- Planejamento realista: **4 a 8 semanas** (`docs/12`, seção 1.3).

Custo em dinheiro: zero. Custo em calendário: o suficiente para atrasar a
abertura do produto se a submissão for tratada como última tarefa. Por isso a
preparação do review roda em paralelo desde a Fase 0 (`docs/09_BACKLOG`).

Enquanto o app estiver em Development mode, só operam testers adicionados
manualmente no painel, na ordem de algumas dezenas — **esse é o teto real da
Fase 0**, e é ele que torna legítima a escassez comunicada na venda
(`docs/13_VENDA`, seção 7).

---

## 3. O screencast

Roteiro derivado de `docs/13_VENDA/plano-de-apresentacao.md`: mesmas telas 5, 6 e
7, **sem venda**. A Meta precisa ver, em ordem:

```
1. A tela /conectar, explicando o requisito da Pagina do Facebook
2. O clique, o dialogo de consentimento da Meta e as permissoes pedidas
3. O retorno em /conectar/retorno, com a conta nomeada na tela
   -> justifica instagram_basic, pages_show_list, pages_read_engagement
4. A tela de diagnostico, com indicadores, grafico e o bloco de limites
   -> justifica instagram_manage_insights
5. O relatorio exportado da mesma conta
   -> mesma permissao, segunda tela
6. O fluxo de exclusao de dados, com o protocolo aparecendo na tela
   -> exigencia propria do review, e da LGPD
```

Duas regras de gravação:

- **Uma permissão por trecho, nomeada.** O revisor precisa ligar o que vê ao que
  foi pedido; vídeo que mostra "o produto" sem amarrar cada tela a uma permissão
  convida a pedido de correção — e pedido de correção reinicia a fila.
- **Conta real de tester, não conta fictícia.** Development mode existe
  exatamente para isso.

### Conflito a resolver antes de gravar

ADR-007 lista o screencast do App Review entre os usos do **modo de
demonstração**. `docs/13_VENDA/plano-de-apresentacao.md` diz o contrário:
*"grave com um cliente-teste real, não com conta fictícia"*.

A leitura desta equipe, **a confirmar**: o modo de demonstração serve ao
desenvolvimento e à call de venda, e **não** ao screencast. Dois motivos
concretos:

1. o modo de demonstração exibe um aviso permanente de demonstração na tela, por
   decisão do próprio ADR-007 — e um vídeo de revisão com esse aviso convida a
   pergunta errada;
2. em demonstração **nenhuma chamada à Graph API acontece**, e o que o revisor
   precisa ver é justamente cada permissão sendo exercida.

Onde a decisão mora: uma emenda ao ADR-007, no mesmo formato da emenda do
ADR-005 — decisão não se apaga, se emenda.

---

## 4. Política de privacidade — o que precisa estar escrito

Nada disso existe ainda. O conteúdo mínimo, derivado de
`docs/03_REGRAS_DE_NEGOCIO/conformidade.md`:

- **Que dado é coletado**, com a lista real da seção 1 daquele documento — e não
  uma lista genérica. Hoje: identificadores da conta profissional e métricas
  agregadas. **Nenhum dado demográfico.**
- **Para quê**: gerar diagnóstico de crescimento da própria conta do cliente.
- **Base legal**, declarada.
- **Por quanto tempo**: prazo de retenção. **Não decidido** — e este é o item que
  bloqueia a redação da política inteira.
- **Com quem é compartilhado**: hoje, ninguém.
- **Como pedir exclusão**: apontando para `/dados`.
- **Como exportar o próprio histórico**: prometido em ADR-004 e **sem
  implementação**; ou o exportador nasce, ou a política não pode prometê-lo.

`/privacidade` e `/dados` são rotas **públicas** e de conteúdo estático: elas não
consultam o banco, e por isso `anon` não tem `select` em tabela nenhuma
(`contratos.md`, seção 6).

---

## 5. Exclusão de dados — o que já funciona

A função `excluir-dados` já implementa o fluxo completo, com protocolo
(`docs/07_APIS/edge-functions.md`, seção 6). O que falta é o texto público de
`/dados` explicando como pedir.

**Não decidido:** se a Meta será atendida por *Data Deletion Instructions URL*
(uma página com instruções) ou por *callback* de exclusão (um endpoint que a Meta
chama quando o usuário remove o app). O produto tem a rota para a primeira e a
função para a segunda; falta escolher e configurar no painel do app.

---

## 6. Checklist de submissão

**Antes de submeter**
- [ ] Verificação de negócio concluída (exige CNPJ)
- [ ] `/privacidade` publicada, com prazo de retenção declarado
- [ ] `/dados` publicada, com instruções de exclusão
- [ ] Escolha entre instruções e callback de exclusão, configurada no painel
- [ ] Conta de tester real conectada e coletando
- [ ] Screencast gravado, uma permissão por trecho
- [ ] Descrição do caso de uso escrita para cada uma das quatro permissões
- [ ] `pages_read_engagement`: justificada ou removida do pedido
- [ ] Nenhuma permissão a mais no `scope` (teste de `conexaoMeta` garante)
- [ ] Retenção do histórico após desconexão conferida contra os Platform Terms

**Depois de submeter**
- [ ] Contar 4 a 8 semanas, não 2
- [ ] Tratar pedido de correção como reinício de fila
- [ ] Não abrir a venda pública antes da aprovação

---

## 7. Como a Fase 0 paga a Fase 1

Os clientes do preço de fundador têm contrapartida obrigatória: depoimento
gravado e autorização de uso do case (`docs/12`, seção 3.3). Esses mesmos
clientes são as contas de tester do Development mode.

**Um esforço resolve venda e aprovação:** a call de 20 minutos que fecha a
assinatura é, com foco trocado e sem a parte de oferta, exatamente o material do
screencast. Quem entender isso desde o primeiro cliente não vai precisar produzir
um vídeo do zero na semana da submissão.
