# Módulo diagnóstico — quando o produto pode opinar

> O diagnóstico é o produto; o gráfico é só a prova dele (`memory/identity.md`).
> Este documento decide em que condições o produto tem direito de nomear uma
> causa — e o que ele é obrigado a dizer quando não tem.
> Fontes: ADR-003, ADR-004, ADR-005, ADR-008, `src/rules/0.3.0/`,
> `src/motor/`, `supabase/schema.sql`. Última revisão: 2026-09-05.

---

## 1. Vocabulário fechado

Estas cinco palavras têm significado exato. Usar qualquer uma delas com outro
sentido em código, em tela ou em conversa de venda é erro.

| Palavra | Significado |
|---|---|
| **semana** | segunda a domingo, ISO. `segundaDaSemana` (`src/fixtures/calendario.js`) define o corte |
| **semana completa** | os 7 dias da semana têm coleta. `Janela.completa === true` |
| **janela** | bloco de semanas **completas** consecutivas usado em comparação |
| **lacuna** | intervalo contíguo de dias sem coleta, com motivo nomeado |
| **cobertura** | quantas semanas completas o diagnóstico teve, e se isso bastou |

Uma semana **existe** na série mesmo sem nenhum dia coletado: `montarHistorico`
gera a série da primeira segunda coletada até a semana do corte, sem pular
nenhuma. Semana que some da lista é semana que ninguém vê faltar.

---

## 2. Quando um diagnóstico pode ser gerado

Um diagnóstico é gerado **sempre** que a função `gerar-diagnostico` roda para a
conta — inclusive quando não há dado nenhum. O que muda com a quantidade de
histórico não é a existência do registro, é o que ele tem direito de afirmar.

```
semanasCompletas = contar(historico.semanas onde completa = verdadeiro)

PARA CADA regra EM ruleset.regras:
  SE semanasCompletas >= regra.minimoDeSemanas ENTAO
    achado = regra.avaliar(historico)          -- pode devolver nulo
  SENAO
    a regra nem e consultada
FIM

achados = ordenar(achados por peso, do maior para o menor)

SE achados[0].severidade = 'indeterminado' ENTAO
  achados = [achados[0]]                       -- os demais sao DESCARTADOS
  cobertura.suficiente = falso
SENAO
  cobertura.suficiente = verdadeiro
FIM
```

O descarte da linha 10 é regra de produto, não otimização: um veredito parcial
ao lado da admissão de ignorância convida o cliente a agir com meia informação,
que é exatamente o que este produto existe para não fazer (`src/motor/motor.js`).

### O ruleset vigente (0.3.0)

Valores lidos de `src/rules/0.3.0/`. Mudar qualquer um deles é mudança de versão
de ruleset, e ruleset novo nunca reescreve diagnóstico antigo (ADR-005).

| Código | Peso | Mínimo de semanas completas | Severidade possível | O que nomeia |
|---|---|---|---|---|
| `dado-insuficiente` | 100 | 0 | `indeterminado` | histórico curto demais para qualquer veredito |
| `cadencia-em-queda` | 90 | 16 | `atencao`, `critico` | a frequência caiu e o alcance foi junto |
| `formato-que-salva` | 60 | 8 | `ok` | um formato retém atenção acima dos demais |
| `consistencia-de-alcance` | 40 | 8 | `ok`, `atencao` | o resultado vem de método ou de sorte de post |

**16 semanas completas é o piso para nomear uma causa.** O número não é
arbitrário: `cadencia-em-queda` compara 8 semanas completas com as 8 anteriores
(`SEMANAS_POR_JANELA = 8`), e comparar exige as duas janelas inteiras. Abaixo
disso, `dado-insuficiente` dispara (`SEMANAS_NECESSARIAS = 16`).

### Consequência que precisa estar escrita

Entre **8 e 15** semanas completas, `formato-que-salva` e
`consistencia-de-alcance` são avaliadas, produzem achado válido — e são
descartadas, porque `dado-insuficiente` ainda dispara e tem peso maior. Na
prática, **nenhuma regra do ruleset 0.3.0 chega à tela antes de 16 semanas
completas**, apesar de duas delas declararem mínimo 8.

Isso é comportamento observado no código, não intenção documentada em lugar
nenhum. É defensável — dizer "seu carrossel salva mais" enquanto se admite não
saber ler a conta é confuso — mas **não foi decidido, foi herdado**. A decisão
de manter ou afrouxar mora em um ADR novo e numa versão de ruleset (0.4.0), não
numa mudança silenciosa de peso.

### Limiares de cada regra

| Regra | Constante | Valor | O que significa |
|---|---|---|---|
| `cadencia-em-queda` | `QUEDA_RELEVANTE` | 0,15 | abaixo de 15% a queda é oscilação de agenda, não mudança de ritmo |
| `cadencia-em-queda` | `SEMANAS_DE_TESTE` | 4 | duração do teste sugerido na ação |
| `formato-que-salva` | `MINIMO_DE_PUBLICACOES` | 3 | tipo com menos que isso na janela não entra no ranking |
| `formato-que-salva` | `VANTAGEM_MINIMA` | 1,2 | o campeão precisa salvar 20% acima da média dos demais |
| `consistencia-de-alcance` | `MINIMO_DE_PUBLICACOES` | 6 | abaixo disso não há distribuição para medir |
| `consistencia-de-alcance` | `DISPERSAO_ALTA` | 0,35 | coeficiente de variação a partir do qual o resultado depende do post |
| todas | `LIMIAR_DE_ESTABILIDADE` | 0,05 | variação abaixo de 5% é escrita como "Estável", não como número |

---

## 3. O que acontece com a semana incompleta

**Ela não entra em janela de comparação. Nunca.**

```
SE semana.diasComColeta < 7 ENTAO
  semana.completa = falso
  semana NAO entra em ultimasJanelasCompletas()
  semana NAO entra no periodo do diagnostico
  os dias faltantes viram lacuna, com motivo
FIM
```

São duas semanas incompletas diferentes, e as duas são igualmente perigosas:

- **a semana corrente**, que está pela metade porque hoje é quarta;
- **a semana com falha de coleta**, que tem menos dias porque o token venceu.

Qualquer uma das duas, somada às outras, produz uma queda que não aconteceu — e
o cliente vai à reunião defender um problema inexistente. Por isso
`periodoDoDiagnostico` encerra o período na **última semana completa**, e não na
última semana existente: o cabeçalho do relatório não pode anunciar um período
que a comparação não usou.

A coleta reforça a mesma regra do outro lado: `coleta-diaria` coleta o **dia
fechado anterior** (`diaFechadoAnterior`), nunca o dia em curso, porque meia
jornada gravada como dia inteiro produz exatamente a mesma queda falsa.

### O que o cliente vê

A semana incompleta não desaparece da tela — ela aparece **como incompleta**. A
lacuna vira texto, com o motivo traduzido do status do evento de coleta:

| `coleta_eventos.status` | Frase na tela (`src/motor/historico.js`) |
|---|---|
| `token_expirado` | "Token expirado: a coleta do dia não aconteceu." |
| `limite_de_taxa` | "Limite de chamadas da Meta atingido: coleta do dia adiada." |
| `falha_de_rede` | "Falha de rede: a coleta do dia não completou." |
| outro status | "A coleta do dia falhou." |
| dia sem snapshot e sem evento | "Sem coleta registrada neste dia." |

Dias contíguos com o mesmo motivo viram **uma** lacuna, não cinco avisos iguais.
Cinco avisos idênticos na tela viram ruído e o cliente para de ler.

---

## 4. Como uma métrica vira valor de semana

A agregação vem do dicionário canônico (ADR-003), nunca da regra:

```
SE metrica.agregacao = 'soma'   ENTAO valorDaSemana = somar(leituras)
SE metrica.agregacao = 'ultimo' ENTAO valorDaSemana = ultima leitura
```

Seguidores é **estoque**: a semana vale o último saldo. Somar sete dias de
seguidores daria sete vezes a conta. Alcance é **fluxo**: soma — e é por isso
que ele carrega um limite obrigatório (seção 6).

Três regras derivadas, todas com consequência visível:

1. **Ausência não é zero.** Métrica sem leitura na semana fica **ausente** do
   objeto `valores`. Zero é uma afirmação ("não publicou"); ausência é uma
   lacuna ("não sabemos"). Trocar uma pela outra é a mentira mais barata que
   este produto poderia contar.
2. **`publicacoes` é derivada**, não vem da Meta: é a contagem de mídias
   publicadas no dia, gravada por `coleta-diaria` **mesmo valendo zero**, porque
   ali o zero é fato observado.
3. **Métrica de mídia é acumulado, não fluxo.** A leitura que vale é a mais
   recente (`montarMidias`). Somar as leituras diárias de um post contaria o
   mesmo salvamento todos os dias até ele sair do ar.

Métrica que a Meta manda e que não está no dicionário **não vira coluna nova**:
entra em `ignoradas` e aparece no evento de coleta do dia.

---

## 5. A variação é calculada sobre o valor exibido

Regra fechada em ADR-008, e ela é regra de negócio, não de formatação.

```
variacaoExibida(atual, anterior, casas):
  a = arredondar(atual, casas)
  b = arredondar(anterior, casas)
  devolver (a - b) / b            -- arredonda ANTES de dividir
```

A Casa Oliveira publicou 14 vezes em 8 semanas e 24 nas 8 anteriores: 1,75 e
3,00 por semana no cru, 1,8 e 3,0 na tela. A variação crua é 41,7%; a exibida é
40%. O produto mostra **40%**, porque é o que o cliente obtém dividindo 1,8 por
3,0 na frente do consultor. Se a tela dissesse 42%, ele concluiria que a
ferramenta erra — e estaria certo em desconfiar, porque a tabela não fecharia
com ela mesma.

Cada evidência guarda `casas`, a precisão usada, para a conta continuar
auditável depois. Quem derivar outra métrica a partir de um achado precisa ler
`casas` junto.

---

## 6. O que a tela é OBRIGADA a declarar

Nenhum destes blocos é opcional, e nenhum é nota de rodapé: eles vão junto do
veredito, na tela e no papel (`src/styles/impressao.css` protege
`[data-bloco="limites"]` de ser cortado da folha).

### 6.1 Limites que valem sempre

Emitidos por `limitesQueValemSempre` em todo diagnóstico, tenha regra disparado
ou não. São limites de plataforma e de escopo, não conclusões:

| Código | Quando entra | Por quê |
|---|---|---|
| `agregacao-de-alcance` | sempre | somar alcance de várias semanas conta duas vezes quem foi alcançado em duas; a Meta não devolve alcance único de período longo |
| `sem-comparacao-com-concorrente` | sempre | a API não entrega alcance, salvamento nem demografia de terceiro (ADR-006) |
| `story-fora-da-janela` | sempre | métrica de story existe por 24 h; story publicado e expirado entre duas coletas não entra em número nenhum |
| `sem-trafego-pago` | quando `ig_contas.tem_trafego_pago = falso` | sem essa frase, a tela atribuiria ao conteúdo um alcance que veio de anúncio |

### 6.2 Limites da regra que disparou

Cada regra declara **códigos**, não frases (`achado.limites`). O texto pt-BR
mora em `CATALOGO_DE_LIMITES`, em `src/motor/motor.js`. Código novo sem texto
cadastrado aparece na tela como "Limite declarado pela regra, sem texto
cadastrado" — feio de propósito, para ser corrigido antes de chegar ao cliente.

### 6.3 As lacunas

Toda lacuna de `cobertura.lacunas` aparece. Não há limiar de "lacuna pequena
demais para mostrar": um dia sem coleta é um dia em que o produto não sabe o que
aconteceu.

### 6.4 A cobertura

`cobertura.suficiente = falso` muda a tela inteira: não há veredito, há a
admissão de que ainda não dá para saber, com quantas semanas completas existem e
quantas faltam. A ação recomendada nesse estado é uma só — manter a coleta
rodando. **Não há palpite provisório, não há tendência estimada.**

### 6.5 O aviso de demonstração

Quando `meta.origem = 'demonstracao'`, a tela diz isso de forma permanente e
visível (ADR-007). Dado de exemplo apresentado como dado do cliente é exatamente
a desonestidade que `memory/identity.md` proíbe.

---

## 7. Severidade, tom e o veredito único

- A escala é `ok`, `atencao`, `critico`, `indeterminado`. **`critico` é raro.** A
  maioria dos achados é `atencao`, e inflacionar severidade destrói a escala
  (`docs/02_DESIGN_SYSTEM/TOKENS.md`).
- **A severidade nunca é decidida pelo CSS.** Ela vem do achado e entra na
  marcação como `data-severidade`.
- **O `tom` de cada evidência é decisão da regra**, não do estilo: cair nem
  sempre é ruim.
- **Cor nunca é o único portador de significado**: severidade sempre vem com a
  palavra ("Atenção", "Estável") e variação sempre traz o valor anterior por
  escrito.
- O veredito da tela é o achado de **maior peso**. Os demais existem no registro
  e podem aparecer como evidência secundária, mas a frase que o cliente repete em
  voz alta é uma só.

---

## 8. Reprocessar, versionar e nunca reescrever

```
id = 'diag:' + contaId + ':' + periodo.inicio + ':' + periodo.fim + ':' + rulesetVersion
```

O id é determinístico de propósito. Rodar o mesmo ruleset sobre o mesmo período
da mesma conta cai na **mesma linha** (`upsert` por `id`). Ruleset novo muda o
id e nasce um registro **novo, ao lado do antigo**.

É isso que responde a pergunta da segunda reunião: *"mudou a minha conta ou
mudou a sua regra?"*. Uma ferramenta que não consegue responder isso não serve
para defender uma estratégia.

Consequência operacional: `diagnosticos.id` é `text`, não `uuid`, e a coluna
`ruleset_version` é obrigatória (`supabase/schema.sql`).

---

## 9. Quem gera, e quando

| Gatilho | Quem | Quando |
|---|---|---|
| cron | `gerar-diagnostico` | 04:40 America/Sao_Paulo, diariamente, depois da coleta das 04:00 |
| manual | `gerar-diagnostico` com `contaId` no corpo | suporte e desenvolvimento |

O motor lê **24 semanas** de histórico por conta (`SEMANAS_DE_HISTORICO`), o que
cobre com folga as 16 exigidas pela regra mais exigente. São diagnosticadas as
contas em `ativa`, `pausada` e `token_expirado` — **conta com token vencido
continua sendo diagnosticada de propósito**: o histórico dela não some porque a
coleta parou, e a lacuna precisa aparecer na tela em vez de a tela ficar vazia.

Falha ao gerar diagnóstico **não** vira linha em `coleta_eventos`: a coleta do
dia pode ter ido bem, e marcar ali pintaria na tela um buraco de dado que não
existe. Lacuna inventada é tão desonesta quanto lacuna escondida.

---

## 10. O que não está decidido

| Pergunta em aberto | Onde a decisão vai morar |
|---|---|
| Manter ou afrouxar o piso de 16 semanas para as regras de mínimo 8 (seção 2) | ADR novo + ruleset 0.4.0 |
| Frequência de geração — hoje é diária, o produto é vendido como semanal (`docs/13_VENDA`, seção 1) | ADR novo; hoje o cliente recebe diariamente um diagnóstico cujo período fecha na última semana completa |
| Exportação do próprio histórico pelo cliente, prometida em ADR-004 e vendida em `docs/13_VENDA` (objeção "e se vocês sumirem?") | não existe código; entra em `docs/09_BACKLOG` como dívida de promessa |
| A tela de identidade (`02-sem-conta-conectada.png`) diz "8 semanas de publicação para nomear uma causa"; o ruleset exige 16 semanas completas | conflito aberto: ou o texto da tela muda, ou o ruleset muda. Não pode ficar como está |
