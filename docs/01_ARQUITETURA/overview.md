# Arquitetura — visao geral

> Uma pagina. Stack, fronteiras e o caminho do dado. Detalhe de assinatura de
> funcao mora em `contratos.md`; justificativa de escolha mora nos ADRs.
> Ultima revisao: 2026-09-05.

## Em uma frase

SPA React que **le diagnostico pronto**, sobre um Supabase que **coleta, guarda e
diagnostica** — a tela nunca calcula nada (ADR-005).

## Fronteira, e por que ela e onde e

```
  ┌─────────────────────────── navegador ────────────────────────────┐
  │  src/features/*      telas: leem, formatam, nunca calculam        │
  │  src/components/*    kit visual, sem regra de negocio             │
  │  src/lib/*           ÚNICA porta para o backend (envelope)        │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │ anon key + RLS
  ┌───────────────────────────────▼───────────────────────────────────┐
  │  Supabase Postgres      RLS derivada de tenant_membros            │
  │  Supabase Vault         token da Meta (o front nunca ve)          │
  │  Edge Function coleta   cron diario → snapshots_* (service_role)  │
  │  Edge Function motor    src/rules → diagnosticos                  │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │ token do tenant, server-side
  ┌───────────────────────────────▼───────────────────────────────────┐
  │  Graph API (Instagram API with Facebook Login, ADR-002)           │
  └───────────────────────────────────────────────────────────────────┘
```

Tres regras desenham essa fronteira, e todas vem dos ADRs:

1. **O token nunca cruza para cima.** Ele vive no Vault e so e lido pela Edge
   Function com `service_role`. `ig_contas.token_ref` guarda a referencia, nunca
   o segredo (`memory/restrictions.md`).
2. **O diagnostico nunca e calculado embaixo do usuario.** O motor roda no
   servidor, grava em `diagnosticos` com `ruleset_version`, e a tela le. Assim
   da para responder "mudou a conta ou mudou a regra?" (ADR-005).
3. **O nome da Meta morre na porta de entrada.** O adaptador traduz o payload
   para o dicionario canonico antes de qualquer gravacao (ADR-003).

## Camadas de codigo

| Camada | Onde | Pode | Nao pode |
|---|---|---|---|
| Telas | `src/features/<feature>/` | ler servicos, formatar, navegar | calcular diagnostico, falar com Supabase direto |
| Kit visual | `src/components/shared/` | receber props e renderizar | conhecer regra de negocio ou servico |
| Servicos | `src/lib/` | falar com Supabase, devolver envelope | conter regra de diagnostico |
| Metricas | `src/metricas/` | traduzir Meta → canonico | tocar rede ou DOM |
| Regras | `src/rules/` | declarar o metodo, versionado | tocar rede, DOM ou Supabase |
| Motor | `src/motor/` | aplicar regras sobre historico | tocar rede ou DOM |
| Tema | `src/tema/` | escrever `--tenant-*` | conhecer feature |

`src/metricas`, `src/rules` e `src/motor` sao **funcoes puras**. E de proposito:
rodam iguais no navegador (modo demonstracao) e no Deno da Edge Function, e sao
testaveis contra historico real sem subir nada.

## O caminho do dado, ponta a ponta

1. **Consentimento.** O tenant autoriza pelo OAuth da Meta. Guardamos
   `ig_contas` e o token no Vault.
2. **Coleta (04:00, diaria).** Edge Function le as contas ativas, chama a Graph
   API, passa o payload pelo adaptador da versao vigente e grava `snapshots_conta`
   e `snapshots_midia` — append-only, com `api_version` e `adapter_version` em
   cada linha (ADR-003, ADR-004).
3. **Falha nao some.** Qualquer erro vira linha em `coleta_eventos`. A tela
   sinaliza lacuna; serie com buraco nao esconde o buraco (ADR-004).
4. **Motor.** Le o historico canonico da conta, aplica o ruleset e grava um
   `diagnosticos` com `ruleset_version`. Ruleset novo nunca reescreve
   diagnostico antigo.
5. **Tela.** Le o diagnostico mais recente e mostra o veredito, a evidencia que
   o sustenta, a acao e — sempre — o que o diagnostico nao sabe.
6. **Relatorio.** O mesmo registro, em folha clara e impressao A4. Nunca um
   segundo produto, nunca um segundo calculo.

## Modo de demonstracao

Sem `VITE_SUPABASE_URL` configurada, `src/lib` serve um repositorio local de
fixtures (`src/lib/demonstracao/`) atras do **mesmo contrato**. Serve para
desenvolvimento, para a call de venda e para o screencast — e o diagnostico
exibido continua saindo do motor de regras real sobre serie real de fixture,
nunca de texto fixo.

A tela diz que esta em demonstracao. Dado de exemplo apresentado como dado do
cliente seria exatamente a desonestidade que `memory/identity.md` proibe.

## Ambientes

| Ambiente | Front | Banco | Coleta |
|---|---|---|---|
| local | `npm run dev` | modo demonstracao ou Supabase local | manual (`supabase functions serve`) |
| producao Fase 0 | Vercel (ver doc 12, 2.2) | Supabase Free | cron diario |

## Pendencias registradas

- Hospedagem definitiva antes da primeira cobranca (doc 12, secao 2.2). Bloqueante.
- Gateway de pagamento e Pix (doc 12, secao 3.5).

## Ligacoes

- `contratos.md` — assinaturas e formatos que atravessam as camadas
- `docs/04_MODELAGEM/` — schema e RLS
- `docs/08_DECISOES/` — ADR-001 a 006
- `docs/11_SEGURANCA/` — plano de seguranca
