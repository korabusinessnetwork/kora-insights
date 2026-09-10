# ADR-009 — Renovacao automatica do token, e o aviso como ultimo recurso

**Status**: Aceito · **Data**: 2026-09-07 · **Decisores**: Matheus Bonato

## Contexto
A Meta entrega token de longa duracao de ~60 dias. A coleta lia esse token do
cofre, usava, e nada mais: nao renovava e nao avisava ninguem. O vencimento so
aparecia quando a coleta ja tinha falhado e a conta virava `token_expirado`.

Numa integracao qualquer isso seria um incidente de operacao. Aqui e o dano
central do produto, por tres fatos que ja estao escritos:

1. O que a Graph API nao devolve depois e o passado. Dia nao coletado hoje nao
   existe amanha (ADR-004).
2. Lacuna de coleta custa a **semana inteira** de comparacao. Cinco dias de
   token vencido ja derrubaram uma conta com quatro meses de historico abaixo do
   piso do ruleset (`memory/learnings.md`, 2026-09-06).
3. O ruleset 0.3.0 exige 16 semanas completas para nomear uma causa
   (`src/rules/requisitos.js`).

Somando: um token vencido em silencio apaga meses de caminho andado, e o cliente
que percebeu tarde nao recupera o que passou. O backlog da Fase 0 ja pedia
*"Token no Vault, refresh antes do vencimento, aviso de reconexao"* — o cofre
existia desde a conexao, o refresh e o aviso nao.

Nota de procedencia, porque ela ensina algo: `modulo-conexao.md` atribuia essa
promessa a `docs/11_SEGURANCA/plano.md`, entre aspas, e o plano nunca disse isso.
Citacao com fonte errada envelhece pior que texto sem fonte — quem for conferir
encontra o documento certo dizendo outra coisa e passa a duvidar dos dois.

## Decisao

**1. A coleta renova o token sozinha, 15 dias antes do vencimento.**
`renovarTokenLongo` refaz a troca `fb_exchange_token`, que a Meta aceita tendo
como entrada um token longo ainda dentro da validade. Nao ha dialogo de
consentimento no caminho: o cliente nao e interrompido. O prazo novo conta a
partir da troca, entao renovar cedo nao desperdica dia nenhum — nao ha soma de
saldo, ha substituicao.

A renovacao mora **dentro da coleta diaria**, e nao num job proprio, porque a
coleta ja roda todo dia por conta, ja leu o token do cofre e ja tem o orcamento
de chamadas daquela conta na mao. Um job separado duplicaria as tres coisas.

**2. A tela pede reconexao a 7 dias do vencimento** — menos que os 15 da
renovacao, e essa distancia e a decisao, nao um detalhe. Com a renovacao
funcionando, o aviso nunca aparece. Se ele apareceu, e porque a troca automatica
ja teve mais de uma semana de tentativas e nao deu conta (permissao revogada pelo
usuario no painel da Meta, senha trocada, app suspenso). O aviso e o ultimo
recurso, e por isso pode ser alarmante sem virar ruido.

**3. "Vencendo" continua derivado, nunca persistido.** Nao ha coluna nova e nao
ha status novo em `ig_contas`. O estado sai de `token_expira_em` contra o
relogio, em `src/token/validade.js`. Status persistido de algo que muda com a
passagem do tempo precisaria de um job so para envelhecer linha, e daria a
terceira verdade sobre a mesma conta.

**4. Falha de renovacao nao e falha de coleta, e nao vira `coleta_eventos`.**
O token de hoje continua valido — e para isso que serve a folga de 15 dias.
Derrubar a coleta do dia por causa dela transformaria um problema futuro em
lacuna imediata. E gravar em `coleta_eventos` seria pior: aquela tabela alimenta
`montarHistorico`, entao o evento desenharia lacuna na tela num dia que tem dado.
A falha vai para o log estruturado (`coleta.token_nao_renovado`), sem token e sem
referencia do cofre.

**5. O aviso e do tenant, nao da tela aberta.** A casca varre todas as contas do
espaco de trabalho. Uma conta perde dias esteja ou nao em foco, e quem descobre
depois nao recupera.

Os dois prazos sao constantes exportadas de um modulo puro que a Edge Function e
a tela importam. Prazo escrito duas vezes vira dois prazos no primeiro ajuste
(`memory/patterns.md`, "Um numero, uma fonte").

## Alternativas
- **Renovar todo dia, sem prazo.** Simples, e gasta uma chamada por conta por dia
  para trocar o que tem 50 dias de validade. Descartada: o teto da Meta e de 200
  chamadas por hora por usuario e ele e do produto inteiro.
- **Job proprio de renovacao, semanal.** Duplica leitura do cofre e varredura de
  contas, e cria um segundo lugar que pode estar fora do ar sem ninguem notar.
  Descartada.
- **So avisar, sem renovar.** Empurra para o cliente um trabalho que a API faz
  sozinha, a cada 60 dias, para sempre. Descartada.
- **Renovar e, se falhar, marcar a conta `token_expirado` na hora.** Mataria a
  coleta de uma conta cujo token ainda tem 15 dias bons, por causa de uma falha
  que pode ser de rede. Descartada.

## Consequencias
- Positivas: a conta conectada nao morre mais por decurso de prazo, que era a
  unica forma garantida de o produto perder o historico do cliente. O aviso, por
  ser raro, significa alguma coisa quando aparece.
- Negativas: a renovacao so acontece se a coleta rodar, e a varredura escrita
  aqui so passava por `ativa` — entao o token de conta `pausada` ou
  `desconectada` envelhecia ate morrer. Para `pausada` isso era uma divida real,
  e o **ADR-011 a pagou**: a varredura passou a incluir a conta pausada, so para
  renovar. Para `desconectada` continua sendo o comportamento certo, porque o
  segredo dela ja saiu do cofre. E a Edge
  Function segue sem teste automatizado (nao ha Deno no CI): o que esta coberto e
  a decisao pura, em `src/token/validade.test.js`, e a faixa de aviso, em
  `src/app/Casca.test.jsx`.

## Ligacoes
- ADR-011 — quem a varredura toca (supera este ADR nesse ponto)
- `src/token/validade.js` — os dois prazos e o estado derivado
- `supabase/functions/coleta-diaria/index.ts` — `renovarSeNecessario`
- `docs/03_REGRAS_DE_NEGOCIO/modulo-conexao.md`, secao 4
- ADR-004 (historico proprio) — por que dia perdido nao volta
