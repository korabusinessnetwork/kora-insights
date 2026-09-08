# Decisoes — Kora Insights

Indice de ADRs. Toda decisao de arquitetura relevante vira ADR em `docs/08_DECISOES/`.

| ADR | Titulo | Status |
|---|---|---|
| 001 | Stack React + Vite + Supabase + Vercel | Aceito |
| 002 | Instagram API with Facebook Login (nao Instagram Login) | Aceito |
| 003 | Dicionario de metricas proprio com adaptadores por versao | Aceito |
| 004 | Snapshot diario e historico proprio desde o dia 1 | Aceito |
| 005 | Motor de regras versionado (o metodo como codigo) | Aceito |
| 006 | Comparacao com concorrentes fica para a Fase 2 | Proposto |
| 007 | Modo de demonstracao com fixture deterministica | Aceito |
| 008 | Variacao calculada sobre o valor exibido | Aceito |

## Decisoes pendentes (viram ADR quando resolvidas)
- Hospedagem definitiva: Vercel Pro pago ou alternativa com free tier comercial
  (Cloudflare Pages, Netlify). Bloqueante antes da primeira cobranca.
- Gateway de pagamento e suporte a Pix.
- Preco de agencia com multiplas marcas: por marca ou pacote.

## Nome do produto
- **Kora Insights mantido.** "Just Insights" foi verificado em 2026-09-05 e descartado:
  colide com Just Insights (justinsights.co.uk, consultoria no Reino Unido), Just
  Insights Pty Ltd (justinsightsconsulting.com) e, o mais grave, com **Not Just
  Analytics**, plataforma ativa de analytics de Instagram, ou seja, concorrente
  direto no mesmo nicho. Registrar como decisao de marca, nao reabrir sem novo
  levantamento.
