-- Kora Insights — fonte de verdade do banco.
-- RLS obrigatorio em TODA tabela. Definition of done inclui teste de isolamento.
-- Este arquivo e o esqueleto inicial; migrations vivem em supabase/migrations/.

-- Tenant = marca ou agencia assinante.
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  plan text not null default 'unico',        -- modelado desde ja (ADR: plano unico na fase 1)
  status text not null default 'ativo',
  criado_em timestamptz not null default now()
);

-- Vinculo usuario <-> tenant (agencia pode ter varios usuarios).
create table tenant_membros (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro',
  primary key (tenant_id, user_id)
);

-- Conta de Instagram conectada. Token NUNCA acessivel pelo front.
create table ig_contas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  fb_page_id text,                            -- exigido pela variante do ADR-002
  token_ref text not null,                    -- referencia ao Supabase Vault, nao o token
  token_expira_em timestamptz,
  conectada_em timestamptz not null default now(),
  unique (ig_user_id)
);

-- Dicionario canonico de metricas (ADR-003). Nome da Meta nunca vira coluna.
create table metricas_canonicas (
  codigo text primary key,                    -- ex: 'alcance', 'visualizacoes'
  rotulo text not null,
  unidade text not null,
  descontinuada_em date                       -- serie encerrada, nunca apagada
);

-- Snapshot diario da conta (ADR-004). Append-only.
create table snapshots_conta (
  id bigserial primary key,
  ig_conta_id uuid not null references ig_contas(id) on delete cascade,
  data date not null,
  metrica text not null references metricas_canonicas(codigo),
  valor numeric not null,
  api_version text not null,                  -- rastreabilidade (ADR-003)
  adapter_version text not null,
  unique (ig_conta_id, data, metrica)
);

-- Snapshot de midia (post, reel, story).
create table snapshots_midia (
  id bigserial primary key,
  ig_conta_id uuid not null references ig_contas(id) on delete cascade,
  ig_media_id text not null,
  data date not null,
  tipo text not null,
  publicada_em timestamptz,
  metrica text not null references metricas_canonicas(codigo),
  valor numeric not null,
  api_version text not null,
  adapter_version text not null,
  unique (ig_media_id, data, metrica)
);

-- Diagnostico gerado pelo motor de regras (ADR-005). A tela LE daqui.
create table diagnosticos (
  id uuid primary key default gen_random_uuid(),
  ig_conta_id uuid not null references ig_contas(id) on delete cascade,
  gerado_em timestamptz not null default now(),
  periodo_inicio date not null,
  periodo_fim date not null,
  ruleset_version text not null,              -- sem isso nao ha auditoria
  achados jsonb not null                      -- [{regra, severidade, causa, acao}]
);

-- Registro de falha de coleta. Lacuna nunca fica invisivel (ADR-004).
create table coleta_eventos (
  id bigserial primary key,
  ig_conta_id uuid references ig_contas(id) on delete cascade,
  ocorrido_em timestamptz not null default now(),
  status text not null,                       -- ok | falha | token_expirado | rate_limit
  detalhe text
);

-- Fase 2 (ADR-006): concorrentes monitorados via business_discovery.
-- create table concorrentes (...);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table tenants           enable row level security;
alter table tenant_membros    enable row level security;
alter table ig_contas         enable row level security;
alter table snapshots_conta   enable row level security;
alter table snapshots_midia   enable row level security;
alter table diagnosticos      enable row level security;
alter table coleta_eventos    enable row level security;
-- Politicas: todo acesso passa por tenant_membros do usuario autenticado.
-- A escrita de snapshots e feita SOMENTE pela Edge Function com service_role.
