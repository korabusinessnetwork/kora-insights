# ADR-001 — Stack: React + Vite + Supabase + Vercel

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
Produto novo, SaaS multi-tenant B2B, fase de bootstrap com orcamento pequeno.
Carga real e leve: coleta agendada diaria e leitura de dashboard. Nao ha
requisito de tempo real nem de processamento pesado.

## Decisao
Stack padrao Kora: React + Vite no front, Supabase (Auth, Postgres com RLS,
Edge Functions, Cron) como backend, deploy na Vercel.

## Alternativas
- **API propria (Node + Drizzle + Postgres):** mais controle, custo de ops e de
  tempo que a fase nao comporta. Descartada por ora; reavaliar se o motor de
  regras crescer alem do que cabe numa Edge Function.
- **Firebase:** RLS inadequado para isolamento rigido entre tenants.

## Consequencias
- Positivas: RLS resolve multi-tenant no banco, nao no codigo; Edge Functions
  cobrem coleta agendada; tier gratuito atende toda a Fase 0.
- Negativas: lock-in parcial no Supabase, mitigado por schema Postgres puro e
  exportavel. Vercel Hobby veda uso comercial, decisao pendente (ver doc 12, 2.2).
