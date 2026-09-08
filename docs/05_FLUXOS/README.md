# 05 — Fluxos

> O caminho do dado ponta a ponta, em ordem temporal e com os atores reais. Se um
> fluxo daqui não bate com o código, um dos dois está errado — e a documentação
> prevalece até ser corrigida (CLAUDE.md).
> Última revisão: 2026-09-05.

## Os três fluxos

| Fluxo | O que cobre |
|---|---|
| [`fluxo-conexao.md`](fluxo-conexao.md) | consentimento na Meta, troca do código por token, cofre — e desconexão e exclusão |
| [`fluxo-coleta.md`](fluxo-coleta.md) | o cron das 04:00, a Graph API, o adaptador e o snapshot diário |
| [`fluxo-diagnostico.md`](fluxo-diagnostico.md) | o motor das 04:40, o registro gravado e a tela que só lê |

Os três são o mesmo caminho do dado de `docs/01_ARQUITETURA/overview.md`,
abertos em passos. Quem quer a visão de uma página começa por lá.

## Convenção destes documentos

- **Mermaid `sequenceDiagram`**, versionável em texto. Nada de imagem exportada
  que ninguém consegue editar depois.
- **Caminho feliz e caminhos infelizes no mesmo documento.** O caminho infeliz é
  o que decide se o produto é honesto: é nele que a lacuna aparece ou some.
- **Nome real.** `conectar-coleta`, `coleta_eventos`, `TOKEN_EXPIRADO`, e não
  "serviço de coleta" ou "erro de autenticação". Fluxo que não dá para conferir
  contra o código não serve para nada.

## Os quatro caminhos infelizes que todo fluxo precisa cobrir

Eles vêm de `memory/restrictions.md` e do ADR-004, e cada um tem tratamento
próprio nos documentos:

| Caminho infeliz | Onde é tratado |
|---|---|
| Conta sem Página do Facebook vinculada | `fluxo-conexao.md` |
| Token expirado no meio da coleta | `fluxo-coleta.md` |
| Limite de taxa da Meta (200 chamadas/hora por usuário) | `fluxo-coleta.md` |
| Histórico curto demais para opinar | `fluxo-diagnostico.md` |

## Os atores

| Ator nos diagramas | O que é |
|---|---|
| Cliente | quem usa o produto: a agência ou a marca |
| Tela | `src/features/*`, que só lê e formata |
| Serviços | `src/lib/*`, a única porta para o backend, sempre em envelope |
| Postgres | Supabase com RLS derivada de `tenant_membros` |
| Vault | Supabase Vault, onde o token da Meta vive |
| Função | Edge Function em Deno, com `service_role` |
| Meta | Graph API (Instagram API with Facebook Login, ADR-002) |
| Cron | pg_cron + pg_net, 04:00 e 04:40 America/Sao_Paulo |

## Ligações

- `docs/01_ARQUITETURA/overview.md` — o caminho do dado em uma página
- `docs/03_REGRAS_DE_NEGOCIO/` — as regras que cada passo aplica
- `docs/07_APIS/` — o contrato de cada chamada
- `docs/11_SEGURANCA/` — o que cada passo pode e não pode registrar em log
