# 08 — DECISÕES · Kora Insights

> ADRs: por que escolhemos X em vez de Y, com a alternativa descartada escrita.
> Decisão sem alternativa registrada é preferência disfarçada de arquitetura.
> Última revisão: 2026-09-07.

## As decisões vigentes

| ADR | Decide | Onde o código mora |
|---|---|---|
| [001](adr-001-stack.md) | React + Vite + Supabase, JavaScript com JSDoc | o repositório inteiro |
| [002](adr-002-variante-api-instagram.md) | Instagram API **with Facebook Login**, quatro permissões | `src/lib/conexaoMeta.js` |
| [003](adr-003-dicionario-de-metricas.md) | Dicionário canônico + adaptadores versionados; nome da Meta nunca é persistido | `src/metricas/` |
| [004](adr-004-historico-proprio.md) | Snapshot diário próprio; lacuna nunca some da tela | `supabase/functions/coleta-diaria/`, `src/motor/historico.js` |
| [005](adr-005-motor-de-regras-versionado.md) | Regra versionada e pura, nunca modelo de linguagem, nunca cálculo na tela | `src/rules/`, `src/motor/` |
| [006](adr-006-escopo-mvp.md) | Comparação com concorrente fica para a Fase 2 | — |
| [007](adr-007-modo-de-demonstracao.md) | Demonstração atrás do mesmo contrato, com diagnóstico saindo do motor real | `src/lib/demonstracao/`, `src/fixtures/` |
| [008](adr-008-variacao-sobre-valor-exibido.md) | Variação calculada sobre o valor que a tela mostra | `src/rules/0.3.0/cadencia.js` |
| [009](adr-009-renovacao-do-token.md) | Renovação do token a 15 dias, aviso de reconexão a 7 | `src/token/validade.js`, `coleta-diaria` |
| [010](adr-010-hospedagem-cloudflare-pages.md) | Hospedagem no Cloudflare Pages, no gratuito que permite uso comercial | `public/_headers`, `.node-version` |

O ADR-010 **supera o ADR-001 no ponto do deploy** — "Vercel" deixou de valer. O
resto do ADR-001 continua de pé, e nenhum outro ADR foi supersedido.

## Como escrever o próximo

1. Copie `adr-000-template.md` para `adr-NNN-titulo.md`, numerando na sequência.
2. Preencha **Alternativas** com o que foi de fato considerado e por que caiu.
   Alternativa inventada para preencher seção é ruído.
3. Status nasce `Proposto`; vira `Aceito` quando o dono aprova.
4. ADR não se apaga nem se reescreve: decisão que mudou ganha um ADR novo, e os
   dois se linkam.
5. **Atualize a tabela acima no mesmo commit.** Índice que não lista o arquivo é
   igual a arquivo que não existe.

## O que NÃO vive aqui

- A implementação → `src/`, `supabase/`
- Como a regra se comporta no detalhe → `03_REGRAS_DE_NEGOCIO/`
- Contrato entre camadas → `01_ARQUITETURA/contratos.md`
- Aprendizado que ainda não virou decisão → `memory/learnings.md`
