# Testes de banco

```bash
./scripts/testar-isolamento.sh
```

Um comando, um PostgreSQL efêmero, três suítes: **isolamento entre tenants**,
**cofre do token** e **painel de saúde**.

## Isolamento entre tenants

Sobe um PostgreSQL efêmero, aplica as **migrations reais** de produção sobre um
stub mínimo do Supabase, semeia duas agências que não se conhecem e faz 22
asserções contando linha — como `authenticated`, com a identidade trocada pelo
mesmo `request.jwt.claims` que o Supabase usa.

É o *definition of done* que a fundação exige de toda tabela nova
(`CLAUDE.md`, "multi-tenant desde a linha 1"). Sem Docker, sem Supabase CLI e
sem custo.

| Arquivo | Papel |
|---|---|
| `00-ambiente-supabase.sql` | O contorno exato do Supabase que as migrations tocam: schema `auth` com `users` e `uid()`, `vault`, `extensions`, os três papéis e os grants padrão do `service_role` |
| `10-semear.sql` | Estúdio Vergara e Agência Rival, com a **mesma métrica no mesmo dia** e valores diferentes |
| `20-isolamento.sql` | As asserções de isolamento |
| `30-cofre.sql` | As asserções do cofre do token |
| `40-saude.sql` | As asserções do painel de saúde da operação |

O dado das duas agências colide de propósito. Vazamento de multi-tenant não
aparece como erro na tela: aparece como um número maior do que deveria, e passa
despercebido até o dia em que um cliente reconhece o dado de outro. Por isso uma
das asserções compara **o valor somado**, e não só a contagem de linhas.

## O que ele cobre

- Cada tenant enxerga o próprio tenant, conta, snapshot, diagnóstico, evento de
  coleta e vínculo de membro — e nada do outro.
- Usuário autenticado **sem tenant nenhum** não enxerga nada. É o caso que uma
  política escrita com `using (true)` deixaria passar.
- `ig_contas.token_ref` é inalcançável pelo cliente, e o cofre também. Não é RLS
  que protege isso: RLS filtra linha, o `GRANT` por coluna filtra coluna. São
  duas travas diferentes, e o teste cobra as duas separadamente.
- Cliente não insere snapshot nem reescreve diagnóstico.

## Cofre do token

`guardar_token`, `ler_token` e `apagar_token` sustentam duas coisas que o produto
já faz e que, se falharem, falham **em silêncio**:

1. **A renovação do token (ADR-009)** grava o token novo com o mesmo nome e conta
   receber a mesma referência de volta. Se `guardar_token` criasse um segredo
   novo a cada chamada, `ig_contas.token_ref` passaria a apontar para o segredo
   velho a cada renovação, e a coleta leria um token vencido achando que leu o
   novo — pior que não renovar, porque parece que renovou.
2. **A desconexão** apaga o segredo e mantém a linha. Se `apagar_token` não
   apagasse, ficaria uma autorização viva para uma conta que o cliente pediu para
   soltar.

Ler o SQL como texto não pega nenhuma das duas: as duas funções *parecem* certas
na leitura, e é o comportamento que importa. O teste cobre ainda que nome
diferente é segredo diferente (sem isso, uma renovação sobrescreveria o token de
outra conta), que referência inexistente devolve nulo em vez de explodir — a
coleta trata nulo como conexão quebrada, e uma exceção mataria a varredura do dia
para todas as contas seguintes — e que `authenticated` e `anon` não executam
nenhuma das três, enquanto `service_role` executa as três.

`SECURITY DEFINER` sem revogar EXECUTE seria pior que não ter cofre: qualquer
membro de qualquer tenant pediria o token de qualquer conta pelo PostgREST, e a
RLS não teria como impedir — a função roda como dono.

## Painel de saúde

`public.saude_das_contas` responde "a coleta parou?" numa consulta só, e uma view
que devolve número errado ali é pior que view nenhuma: ela diz que está tudo bem
e o operador para de olhar.

O que o teste cobra não é só a aritmética — é a **escolha do evento**. "Última
coleta OK" e "último evento de coleta" parecem a mesma coluna e são o oposto uma
da outra: uma conta que falha todo dia tem evento de hoje e está parada há
semanas. O cenário monta exatamente essa conta e exige `5`, não `0`. Cobre também
conta que nunca coletou devolvendo **nulo, nunca zero** (zero diria "coletou
hoje", e a conta recém-conectada quebrada passaria por saudável), e que uma linha
não herda o estado da vizinha — o erro clássico de `join` mal escrito.

O acesso à view é cobrado em `20-isolamento.sql`, junto das outras travas: o
cliente é recusado, o `service_role` não.

## Ele sabe falhar

Verificado nos dois sentidos: com a política de `snapshots_conta` sabotada para
`using (true)`, o script reprova com

```
FALHOU: ana enxerga so o proprio snapshot — esperado 1, obtido 2
```

e sai com código diferente de zero.

O do cofre também: com `guardar_token` sabotada para ignorar o nome e criar um
segredo a cada chamada — exatamente o bug que arruinaria a renovação —, ele
reprova com

```
FALHOU: renovar devolve a MESMA referencia
```

e sai com código 3.

E o do painel: com a view sabotada para olhar o último evento em vez da última
coleta OK — o bug que ela existe para não ter —, reprova com

```
FALHOU: conta parada ha 5 dias aparece com 5, e nao com 0 — esperado 5, obtido 0
```

Um teste que não sabe falhar não é teste.

## Duas dependências que ele expôs

1. As migrations **contam com os grants padrão que o Supabase dá ao
   `service_role`** — elas só concedem para `authenticated`. A dependência era
   implícita até a semeadura falhar com "permission denied for table tenants"
   num Postgres puro. Agora está escrita em `00-ambiente-supabase.sql`.
2. `create extension` de `pgcrypto` e `supabase_vault` não existe fora do
   Supabase. O runner comenta essas linhas — de forma declarada e visível — e o
   stub cria os objetos que as extensões criariam.

## O que ele NÃO cobre

- `pg_cron` e `pg_net`: a migration de agendamento é pulada, e a decisão está
  impressa na saída do script. `supabase/politicas.test.js` continua conferindo
  o conteúdo dela como texto.
- Criptografia real do Vault. O stub guarda o segredo em texto: o que está sob
  prova é a lógica das **nossas** funções e quem alcança o quê, não a cifra do
  Supabase. As assinaturas de `vault.create_secret` e `vault.update_secret` no
  stub são as documentadas — é essa fidelidade que faz o teste dizer algo sobre o
  código de produção em vez de sobre o stub.
- As Edge Functions. Elas orquestram estas funções, e não há Deno no CI: o que
  está coberto é o que o banco garante a elas.
