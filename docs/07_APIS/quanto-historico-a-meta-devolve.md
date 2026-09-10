# Quanto histórico a Meta devolve na conexão

> Investigação levantada pelo backlog: "se der para retroagir semanas, o prazo
> cai sem mexer no rigor da regra". Feita em 2026-09-10 contra a documentação da
> Meta. **Ainda não confirmada contra uma conta real** — não existe conta
> conectada (ver `criar-o-app-na-meta.md`), e a seção final diz o que medir.

## Por que isso importa

O ruleset 0.3.0 compara 8 semanas contra 8, então exige **16 semanas** de
histórico próprio (`src/rules/requisitos.js`). Quatro meses de espera até o valor
central do produto, e o funil de `docs/13_VENDA` faz o diagnóstico ao vivo numa
call de 20 minutos.

O backlog registra três saídas, e a terceira é a única que não custa nada em
rigor nem em discurso: **se a API devolver histórico, o prazo cai sem mexer na
regra.** Esta investigação responde quanto ela devolve.

## A resposta curta

**Metade do diagnóstico é retroagível hoje. A outra metade não.**

| O que a regra precisa | De onde vem | Retroagível? |
|---|---|---|
| `publicacoes` por semana | `timestamp` de `/{ig-user-id}/media` | **Sim, inteiro** |
| Alcance **por publicação** | `insights.metric(reach)` aninhado na mídia | **Sim**, com a ressalva abaixo |
| Alcance **da conta** | `/{ig-user-id}/insights`, `period=day` | **Não** além da janela da plataforma |

A diferença é de natureza, e não de esforço: `/media` devolve **objetos que
existem** — a publicação de março continua lá, com o `timestamp` dela e as
métricas acumuladas dela. `/insights` devolve **série temporal diária da conta**,
e série temporal a plataforma retém pelo tempo que quiser.

## O detalhe de cada um

### `publicacoes` — retroagível por inteiro

`GET /{ig-user-id}/media` pagina o histórico. Hoje `coleta-diaria` passa
`since = dia - 7`, mas o parâmetro é escolha nossa, não teto da API. Sem ele, a
paginação desce até a primeira publicação da conta.

Isso já basta para reconstruir a **causa** que a regra principal nomeia:
`cadencia-em-queda` acusa a frequência de publicação, e frequência é contagem de
`timestamp` por semana.

### Alcance por publicação — retroagível, com uma ressalva

`reach` de mídia é total acumulado por objeto, não série da conta, e vem
aninhado na própria chamada de `/media` (`graph-api.md`, §2.4).

**A ressalva:** ele continua se movendo depois da publicação, e uma mídia de doze
semanas atrás já parou de se mover, enquanto a de ontem não. Comparar as duas
janelas com dado de maturidades diferentes não é o mesmo que comparar duas
janelas coletadas do mesmo jeito. O efeito favorece a janela antiga, ou seja,
**exagera a queda** — que é exatamente a direção em que este produto não pode
errar.

### Alcance da conta — não retroagível

`GET /{ig-user-id}/insights` com `period=day` é uma série diária, e a Meta **não
publica um teto explícito** de retroação para ela. O que se encontra: o painel do
próprio Instagram mostra ~90 dias de dados de perfil e ~30 dias de histórico de
seguidores, e ferramentas de mercado usam ~60 dias como faixa padrão de backfill.
Nenhum desses números é contrato — são observação de terceiros.

Custo, se funcionasse: uma chamada por dia por conta, 112 chamadas para 16
semanas, contra um teto de 200 por hora por conta. Cabe. **O que não cabe é a
disponibilidade do dado, não a cota.**

## O que isto muda na decisão do dono

Não elimina a escolha, mas troca a pergunta.

A pergunta antiga era "aceitar 4 meses, afrouxar a regra, ou investigar?".
A nova é: **"um diagnóstico que nomeia a causa (frequência) com alcance por
publicação retroagido, e sem alcance de conta na janela antiga, é honesto o
bastante para ir à tela?"**

As três saídas continuam sendo do dono, e nenhuma delas é decisão de código:

1. **Aceitar 16 semanas.** O retroagido não entra, e a call de venda passa a
   vender o método e o histórico próprio, não o veredito imediato.
2. **Ruleset 0.4.0 com janela curta e retroação**, severidade e confiança
   menores, e a limitação dita na tela. Exige ADR próprio — ADR-005 proíbe troca
   silenciosa de regra.
3. **Retroagir só a cadência**, e deixar o alcance acumular. O produto nomearia
   "sua frequência caiu" no primeiro dia e só afirmaria "e o alcance seguiu
   junto" quando tivesse alcance dos dois lados.

A terceira é a que este documento acha mais defensável, e a razão é a de sempre
aqui: ela não afirma nada que não meça. Mas quem decide é o dono.

## O que medir na primeira conta conectada

Nenhum número acima foi observado — todos vêm de documentação e de relato de
terceiros. Na primeira conexão real, medir:

- [ ] `/media` sem `since`: até que data a paginação desce? Bate com a criação da conta?
- [ ] `insights.metric(reach)` vem preenchido em mídia de 4, 8 e 16 semanas atrás, ou vem nulo a partir de algum ponto?
- [ ] `/insights` com `period=day` e `since` de 30, 60, 90 e 120 dias: em qual a API para de devolver, e ela erra ou devolve vazio? (vazio silencioso é pior, e muda o desenho da coleta)
- [ ] Quanto uma mídia recente ainda move `reach` entre o dia 1 e o dia 7 — é o tamanho do viés da ressalva acima

## Ligações

- `graph-api.md` §2.3 e §2.4 — as duas chamadas
- `src/rules/requisitos.js` — o número que a tela e o motor leem
- `docs/09_BACKLOG` — a decisão de 16 semanas
- `criar-o-app-na-meta.md` — o que falta para haver conta conectada
