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
| **Política de privacidade publicada**, em URL pública e estável | **publicada** em https://kora-insights.pages.dev/privacidade (2026-09-08). Faltam três pendências que só o dono tem | `docs/12`, seção 2.2 |
| **Instruções de exclusão de dados**, em URL pública | **publicada** em https://kora-insights.pages.dev/dados, com as duas saídas (desconectar e excluir) e o protocolo | idem |
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

## 4. Política de privacidade — escrita, não publicada

**Atualizado em 2026-09-07.** Esta seção dizia "nada disso existe ainda". Existe:
`/privacidade` está escrita e é rota pública. O que segue é a lista mínima com o
estado real de cada item, e o que ainda falta.

| Item | Estado |
|---|---|
| Quem trata os dados | escrito, **pendente**: razão social, CNPJ, endereço e e-mail do encarregado |
| Que dados coletamos | escrito, com a lista real — identificadores da conta profissional e métricas agregadas |
| O que **não** coletamos | escrito: nenhum dado demográfico, nenhum identificador de seguidor |
| Para que usamos | escrito |
| Base legal | escrito, **pendente**: confirmação com assessoria jurídica |
| Como o token é guardado | escrito |
| Com quem compartilhamos | escrito: ninguém |
| Por quanto tempo | escrito, **pendente**: prazo de retenção |
| Seus direitos e como pedir exclusão | escrito, apontando para `/dados` |

As três pendências aparecem **marcadas na própria página**, e não preenchidas com
texto plausível — o que está certo, e é o que `docs/03_REGRAS_DE_NEGOCIO` manda.
Mas duas delas travam a submissão: a Meta exige um controlador identificável, e
sem CNPJ e e-mail do encarregado a política não sustenta a verificação de
negócio.

Sobre a exportação do histórico: a política **não a promete**. `/dados` declara
que a exportação automática não existe e manda pedir ao suporte. Promessa sem
implementação teria sido o defeito; declarar a lacuna resolve.

O conteúdo mínimo, derivado de `docs/03_REGRAS_DE_NEGOCIO/conformidade.md`:

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

A função `excluir-dados` implementa o fluxo completo, com protocolo
(`docs/07_APIS/edge-functions.md`, seção 6), e `/dados` explica publicamente como
pedir. **Atualizado em 2026-09-07:** esta seção dizia que faltava o texto — ele
existe, e a página agora oferece **duas** saídas.

Isso importa para o review mais do que parece: o revisor da Meta procura um
caminho de exclusão, e encontra também um de desconexão. São direitos diferentes
— parar de coletar e apagar o que já foi coletado — e oferecer os dois demonstra
controle real do titular sobre o dado, que é exatamente o que a exigência busca.

**Não decidido:** se a Meta será atendida por *Data Deletion Instructions URL*
(uma página com instruções) ou por *callback* de exclusão (um endpoint que a Meta
chama quando o usuário remove o app). O produto tem a rota para a primeira e a
função para a segunda; falta escolher e configurar no painel do app.

---

## 6. Checklist de submissão

Separado por **quem destrava cada item**, porque misturar as três colunas faz o
checklist parecer intransponível quando na verdade metade dele já está feita.

### Pronto no código

- [x] `/privacidade` escrita, rota pública fora da área autenticada
- [x] `/dados` escrita, com instruções de exclusão e a saída de desconexão
- [x] Fluxo de exclusão funcionando, com protocolo (`excluir-dados`)
- [x] Fluxo de desconexão funcionando (`desconectar-conta`)
- [x] Nenhuma permissão a mais no `scope` — as quatro estão congeladas em
      `PERMISSOES` e comparadas caractere a caractere em teste
- [x] Tela de conexão explicando o requisito da Página **antes** do clique

### Depende do dono (nenhum destes é código)

- [ ] **CNPJ, razão social, endereço e e-mail do encarregado** — três pendências
      marcadas na política, e a Meta exige controlador identificável. Bloqueia o
      acesso avançado (cliente pagante), **não** o modo de desenvolvimento
- [ ] **Verificação de negócio** no Meta Business Manager (exige o CNPJ acima).
      Para empresa brasileira a Meta pede CNPJ ativo, com razão social e endereço
      batendo exatamente com a Receita Federal
- [ ] **Prazo de retenção** depois do cancelamento ou da desconexão
- [ ] **Base legal**, confirmada com assessoria jurídica
- [x] **Hospedagem escolhida e publicando** — Cloudflare Pages (ADR-010), no ar
      desde 2026-09-08 em https://kora-insights.pages.dev. As duas URLs que a
      Meta exige respondem, e a cada push na `main` o deploy refaz sozinho
- [ ] **Criar o app no painel Meta** e converter a conta de teste para
      profissional — **é o próximo passo real**, e não depende de CNPJ nenhum
- [ ] Conta de tester real conectada e coletando — destrava o screencast e o
      teste de `pages_read_engagement`

### Depende de uma decisão registrada

- [ ] **Screencast: demonstração ou cliente real?** Dois documentos discordam;
      a leitura desta equipe está na seção 3 e vira emenda ao ADR-007
- [ ] **Instruções de exclusão × callback** — o produto tem a rota para a
      primeira e a função para a segunda; falta escolher e configurar no painel
- [ ] **`pages_read_engagement`: justificada ou removida.** A verificação é
      barata e ninguém fez: uma conexão de teste **sem** a permissão responde se
      a descoberta da Página falha. Se não falhar, a permissão sai do pedido — e
      permissão sem tela é causa clássica de reprovação
- [ ] Retenção do histórico após desconexão conferida contra os Platform Terms

### Só depois de tudo acima

- [ ] Screencast gravado, uma permissão por trecho
- [ ] Descrição do caso de uso escrita para cada uma das quatro permissões

**Depois de submeter**
- [ ] Contar 4 a 8 semanas, não 2
- [ ] Tratar pedido de correção como reinício de fila
- [ ] Não abrir a venda pública antes da aprovação

### O caminho crítico, em uma linha

~~Hospedagem → URLs publicadas~~ → **app criado + conta real conectada como
tester** → screencast → CNPJ → verificação de negócio → submissão.

Os dois primeiros elos caíram em 2026-09-08. **Correção de 2026-09-08:** esta
linha dizia que o elo seguinte era o CNPJ. Estava errado, e o erro custaria
semanas de espera pela coisa errada.

A Meta separa dois níveis de acesso, e o CNPJ só aparece no segundo:

| Nível | Quem consegue conectar | Exige |
|---|---|---|
| **Desenvolvimento** | só contas com papel no app (*Instagram Tester*) | nada: nem App Review, nem verificação de negócio, nem CNPJ |
| **Avançado** | qualquer conta, ou seja, cliente pagante | App Review **+ verificação de negócio** → CNPJ |

No modo de desenvolvimento a coleta é **real**: token de verdade, dados de
verdade, diagnóstico de verdade. O que muda é só quem pode conectar.

Isso importa porque o **screencast que o App Review exige mostra cada permissão
sendo usada em tela** — e não existe como gravá-lo sem uma conta conectada. O
caminho de tester não é um atalho nem um desvio: é pré-requisito da submissão.
Ele também é onde `pages_read_engagement` finalmente pode ser testada.

**O elo que segura a fila é criar o app no painel da Meta e conectar a primeira
conta como tester.** Custa R$ 0 e não espera terceiros. O CNPJ corre em
paralelo, e só bloqueia o último elo.

> **MEI não resolve este CNPJ.** Os CNAEs de desenvolvimento e licenciamento de
> software (6201-5/01, 6202-3/00) estão fora da lista de ocupações do MEI, e a
> previsão para 2026 é que continuem fora — então o caminho é ME no Simples
> Nacional, com contador e tributação sobre faturamento, e não os ~R$ 80/mês que
> se costuma supor. **Confirmar com contador antes de abrir**; este repositório
> não é fonte de verdade fiscal.

---

## 7. Como a Fase 0 paga a Fase 1

Os clientes do preço de fundador têm contrapartida obrigatória: depoimento
gravado e autorização de uso do case (`docs/12`, seção 3.3). Esses mesmos
clientes são as contas de tester do Development mode.

**Um esforço resolve venda e aprovação:** a call de 20 minutos que fecha a
assinatura é, com foco trocado e sem a parte de oferta, exatamente o material do
screencast. Quem entender isso desde o primeiro cliente não vai precisar produzir
um vídeo do zero na semana da submissão.
