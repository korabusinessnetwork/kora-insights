# 04 — Modelagem

> Como o dado do Kora Insights é guardado, e por quê. A fonte de verdade
> **técnica** é `supabase/schema.sql`; este diretório explica as decisões que o
> SQL não consegue explicar sozinho.
> Última revisão: 2026-09-05.

## O documento

| Documento | O que traz |
|---|---|
| [`esquema.md`](esquema.md) | diagrama ER, tabela a tabela com o porquê de cada coluna, a estratégia de RLS em português e a política de retenção e exclusão |

## A hierarquia de verdade

1. **`supabase/schema.sql`** — o estado final do banco. Se o código diverge
   dele, o código está errado.
2. **`supabase/migrations/`** — como o banco chega àquele estado, na ordem do
   nome do arquivo. Migration e `schema.sql` mudam no **mesmo commit**.
3. **`esquema.md`** — o porquê. Se a explicação daqui contradiz o SQL, a
   explicação está desatualizada e é corrigida (CLAUDE.md).

## Três regras que valem para qualquer tabela nova

- **RLS habilitada e com política.** Habilitar sem política nega tudo em
  silêncio: o erro mais caro possível aqui, porque passa em review e só aparece
  com cliente na tela. Os dois erros contam como falha (`contratos.md`, seção 7).
- **`grant` explícito depois de `revoke`.** O Supabase concede tudo por padrão
  em tabela nova. O `revoke all ... from anon, authenticated` do schema vale
  para as tabelas que existiam quando ele rodou: **tabela criada depois nasce
  com o grant amplo de novo**, e a migration que a cria precisa repetir o
  próprio revoke/grant.
- **Teste de isolamento entre tenants na definição de pronto.** O teste que
  existe hoje (`supabase/politicas.test.js`) lê o SQL como texto e prova que a
  política **existe**; ele não prova que ela **filtra certo**. O roteiro manual
  com banco real está em `supabase/README.md`.

## Nomes

Tabela e coluna em **português**, como manda a regra de nomear domínio
(`memory/patterns.md`). O ADR-005 cita a tabela como `diagnoses`; a grafia
correta é `diagnosticos`, e o ADR foi emendado em vez de reescrito — decisão não
se apaga, se emenda.

## O que NÃO vive aqui

- Consultas e endpoints que usam as tabelas → `docs/07_APIS/`
- Regras que decidem o conteúdo das linhas → `docs/03_REGRAS_DE_NEGOCIO/`
- Sequência de chamadas → `docs/05_FLUXOS/`
- Como o token é protegido, e de quem → `docs/11_SEGURANCA/`

## Ligações

- `supabase/schema.sql` e `supabase/migrations/` — o SQL
- `supabase/README.md` — como subir o banco e rodar o teste de políticas
- `docs/01_ARQUITETURA/contratos.md`, seção 7 — o contrato do banco
- `docs/08_DECISOES/adr-003`, `adr-004`, `adr-005` — as decisões que o schema aplica
