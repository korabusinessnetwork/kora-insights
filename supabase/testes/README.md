# Testes de banco

## Isolamento entre tenants

```bash
./scripts/testar-isolamento.sh
```

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
| `20-isolamento.sql` | As asserções |

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

## Ele sabe falhar

Verificado nos dois sentidos: com a política de `snapshots_conta` sabotada para
`using (true)`, o script reprova com

```
FALHOU: ana enxerga so o proprio snapshot — esperado 1, obtido 2
```

e sai com código diferente de zero. Um teste que não sabe falhar não é teste.

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
- Criptografia real do Vault. O teste valida quem alcança o quê, não como o
  segredo é guardado.
