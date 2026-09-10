# ADR-011 — A varredura diaria passa pela conta pausada, so para renovar

**Status**: Aceito · **Data**: 2026-09-10 · **Decisores**: Matheus Bonato
**Supersede**: ADR-009, no ponto de quem a varredura toca

## Contexto
O ADR-009 pos a renovacao do token **dentro** da coleta, com um argumento que
continua valendo: a coleta ja roda todo dia por conta, ja leu o token do cofre e
ja tem o orcamento de chamadas na mao. Um job separado duplicaria as tres coisas.

O que ele nao resolveu, e registrou como divida na propria secao de
consequencias, e que a coleta so varre `ativa`. Conta `pausada` nunca era
visitada, entao o token dela envelhecia ate morrer.

O tamanho do estrago nao e o de um token perdido:

1. Pausar e o cliente decidindo parar a **coleta**. Soltar a conexao e outra
   coisa, tem outro botao (`desconectar-conta`) e apaga o segredo do cofre.
2. O token longo da Meta vive ~60 dias, e `fb_exchange_token` so aceita como
   entrada um token longo **dentro** da validade. Passados os 60 dias de pausa,
   nao ha mais troca possivel: so reconexao, com dialogo de consentimento.
3. O ruleset 0.3.0 exige 16 semanas completas para nomear uma causa
   (`src/rules/requisitos.js`), e dia nao coletado nao volta (ADR-004).

Somando: uma pausa de dois meses virava desconexao de fato. O cliente volta,
encontra um pedido de reconexao que ele nao provocou, e a serie que ele achava
estar guardando parou de crescer no dia em que ele pausou — em silencio, que
neste produto e a pior categoria de defeito.

Hoje **nenhum codigo grava `pausada`** (`modulo-conexao.md`, secao 6): o estado
esta modelado para a suspensao de assinatura, que ainda nao foi decidida. E
exatamente por isso a hora de consertar e agora — o escritor, quando chegar, nao
pode nascer com a perda embutida.

## Decisao

**1. A varredura diaria passa por `ativa` e por `pausada`. Na pausada, so
renova.** Sem chamada de insights, sem snapshot, sem linha em `coleta_eventos` e
sem mudanca de status. Renovar nao desfaz a pausa: mantem a porta destrancada
para quando o cliente voltar.

Nao ha linha em `coleta_eventos` porque aquela tabela alimenta `montarHistorico`,
e a lacuna de uma conta pausada e a pausa em si. Gravar `token_expirado` ali
seria o produto se acusando de um problema que nao existe — e a tela nomearia a
lacuna errada para o cliente que a pediu.

**2. `desconectada` e `token_expirado` ficam de fora, e por motivos diferentes.**
Na desconectada, `desconectar-conta` ja apagou o segredo do cofre: nao ha token
para trocar. Na de token expirado, a Meta ja recusa a troca — a saida dela e a
reconexao, que a tela ja pede. Nos dois casos a tentativa gastaria chamada para
receber uma recusa previsivel.

**3. Quem a varredura toca vira uma view: `public.contas_da_varredura`.** Ela
devolve a lista e, em cada linha, `coletar` — `true` na ativa, `false` na
pausada.

A regra deixou de ser uma (`where status = 'ativa'`) e virou duas: quem e
varrido, e quem dentro dessa lista pode virar snapshot. Duas regras em lugares
diferentes se contradizem no primeiro ajuste — e a contradicao aqui nao levanta
erro: ou coleta uma conta que pediu pausa, ou deixa um token morrer.

O segundo motivo e de prova. Nao ha Deno no CI, entao Edge Function nao tem teste
automatizado; o que se prova sobre elas e o que o banco lhes garante
(`supabase/testes/README.md`). Com a lista no banco, a regra ganhou asserção em
Postgres de verdade (`supabase/testes/50-varredura.sql`) — e a view carrega
`token_ref`, entao ela nasce com as duas travas de `saude_das_contas`:
`security_invoker` e `revoke` de `anon` e `authenticated`.

**4. Coletavel primeiro na fila.** O dia de uma conta ativa nao volta se o teto
de chamadas da Meta estourar antes da vez dela; a renovacao de uma pausada tem
quinze dias de folga para acontecer amanha. Barrada a execucao por limite, a
pausada e pulada em silencio — sem evento, porque nao ha coleta parando hoje por
causa disso.

## Alternativas
- **Deixar como estava e renovar na hora de despausar.** So funciona dentro dos
  60 dias, que e justamente o caso em que nada precisava ser feito. Passado o
  prazo, nao ha o que renovar. Descartada: conserta o caso que nao doi.
- **Job proprio de renovacao.** E a alternativa que o ADR-009 ja descartou, pelo
  mesmo motivo: duplica leitura do cofre e varredura de contas, e cria um segundo
  lugar que pode estar fora do ar sem ninguem notar.
- **`in ('ativa','pausada')` na Edge Function, com o `if` do lado do TypeScript.**
  Menor diff. Descartada: deixa as duas metades da regra num arquivo sem teste, e
  a que erra em silencio (coletar uma conta pausada) e exatamente a que ficaria
  sem asserção.
- **Renovar tambem `desconectada`.** Descartada: o segredo dela nao existe mais
  no cofre, e o cliente desligou de proposito.
- **Marcar a conta pausada como `token_expirado` quando a renovacao falhar.**
  Descartada pelo ADR-009 e continua descartada: apagaria a decisao do cliente
  por causa de uma falha que pode ser de rede, e a folga de 15 dias existe
  justamente para a tentativa de amanha.

## Consequencias
- Positivas: a pausa volta a ser o que a tela promete — coleta parada, conexao
  viva. O estado `pausada` deixa de carregar uma perda embutida antes mesmo de
  ter escritor. E a lista da varredura passou a ser uma regra provada, e nao uma
  linha de codigo sem teste.
- Negativas: uma view a mais para manter em sincronia com `ig_contas`, e a
  renovacao da conta pausada continua dependendo de a coleta rodar — se o cron
  estiver fora do ar por 60 dias, nada disso acontece. E o resto do ADR-009 segue
  valendo, inclusive a ausencia de teste da propria Edge Function: o que esta
  coberto e a lista que ela recebe, nao o que ela faz com cada linha.

## Ligacoes
- ADR-009 — os dois prazos e por que a renovacao mora na coleta
- `supabase/migrations/20260910120000_varredura_da_coleta.sql` — a view
- `supabase/functions/coleta-diaria/index.ts` — `manterTokenVivo`
- `supabase/testes/50-varredura.sql` — a asserção em Postgres de verdade
- `docs/03_REGRAS_DE_NEGOCIO/modulo-conexao.md`, secoes 2, 4 e 6
