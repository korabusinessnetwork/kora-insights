# Respostas do Intake — Kora Insights

> Fonte de verdade das respostas da entrevista de fundação. O `scaffold.sh` lê
> este arquivo para substituir os placeholders. Preencha durante a Fase 1.
> Data do intake: 2026-09-05 · Conduzido por: Matheus Bonato

## Bloco 1 — Produto e identidade
- **PRODUTO (nome + essência):** Kora Insights
- **ESSENCIA (1 frase):** Plataforma que conecta o Instagram da marca e transforma os insights em diagnostico de crescimento acionavel
- **PROBLEMA que resolve:** Marcas e agencias tem acesso a metricas do Instagram mas nao sabem ler o proprio dado nem transformar numero em decisao de conteudo
- **PROPOSTA de valor / diferencial:** Nao entrega grafico, entrega diagnostico. O metodo da Atmosfera Viral codificado em regras versionadas que dizem o que esta travando o crescimento e o que fazer a seguir
- **Existe código ou é do zero?** Do zero

## Bloco 2 — Público e escopo
- **PUBLICO_ALVO primário:** Marcas e agencias de social media do Vale do Sinos e Brasil que ja postam com constancia e investem em conteudo
- **PERSONAS (1-3):** Agencia pequena que entrega relatorio manual; Marca com social media interno sem analista de dados
- **B2B / B2C / B2B2C:** B2B
- **"Aha moment":** Ver na primeira tela o que esta travando o crescimento do perfil, com a causa nomeada e nao apenas o numero

## Bloco 3 — Multi-tenant e white-label
- **MULTI_TENANT:** Multi-tenant desde ja  <!-- multi-desde-já / single-agora-multi-roadmap / single-definitivo -->
- **WHITE_LABEL:** Nao na fase 1, modelado para entrar na fase 3     <!-- sim / não -->
- **PLANOS (free/pro/enterprise):** Plano unico pago, mas coluna plan modelada desde o inicio

## Bloco 4 — Stack e arquitetura
- **STACK:** React + Vite + Supabase (Auth, RLS, Edge Functions) + Vercel
- **MODELO_ARQUITETURA:** A: SPA + BaaS  <!-- A: SPA+BaaS / B: API própria / C: serviço sem UI -->
- **TEM_UI:** Sim
- **DEPLOY:** Vercel
- **SCHEMA_PATH:** supabase/schema.sql
- **ENV_PREFIX:** import.meta.env.VITE_  <!-- ex: import.meta.env.VITE_* -->
- **TEST_CMD:** npm test       <!-- ex: npm test -->

## Bloco 5 — Segurança e compliance
- **Trata dado pessoal/financeiro/de menores?** Sim. Tokens OAuth de terceiros e dados demograficos agregados de audiencia
- **COMPLIANCE específico:** LGPD e Meta Platform Terms  <!-- LGPD / GDPR / PCI / fiscal / nenhum -->
- **Nível de isolamento entre clientes:** Rigido. RLS em toda tabela com teste automatizado de vazamento entre tenants

## Bloco 6 — Custo
- **FASE_CUSTO:** Orcamento pequeno para infra  <!-- bootstrap gratuito / com orçamento -->
- **Serviços pagos já aprovados:** Dominio e gateway de pagamento. Supabase Pro e Vercel Pro adiados ate haver receita

## Bloco 7 — Design (se tem UI)
- **Identidade visual definida?** Herda a linha visual Kora, a definir
- **Referências / tom visual:** Escuro, denso em dado, sobrio
- **Contexto de uso crítico:** Desktop primeiro, leitura de relatorio em reuniao  <!-- toque/PDV, mobile, desktop -->
- **PRINCIPIO_N1:** INTUITIVIDADE  <!-- default UI: INTUITIVIDADE -->

## Roadmap inicial
- **FASE_ATUAL:** Fase 0 - Development mode com clientes-teste
- **Próximas fases:** Fase 1 App Review e abertura; Fase 2 comparacao com concorrentes; Fase 3 white-label
