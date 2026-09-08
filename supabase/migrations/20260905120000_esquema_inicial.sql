-- 20260905120000 — esquema inicial do Kora Insights.
--
-- Tabelas, indices e as funcoes de pertencimento e de cofre. As politicas de RLS
-- vem na migration seguinte, e nao aqui, porque separar deixa o diff da unica
-- coisa que pode vazar dado entre tenants legivel sozinho em review.
--
-- O "por que" de cada tabela mora em supabase/schema.sql, que e a fonte de
-- verdade descrita em contratos.md (secao 7). Migration e schema mudam juntos,
-- no mesmo commit.
--
-- ATENCAO: entre esta migration e a proxima, as tabelas existem SEM RLS. Aplique
-- as duas na mesma janela, nunca so a primeira.

create extension if not exists pgcrypto with schema extensions;

-- Vault guarda o token da Meta. A tabela guarda so a referencia (ADR-002,
-- docs/11_SEGURANCA: "Token OAuth da Meta — Critico").
create extension if not exists supabase_vault with schema vault cascade;

-- ── Tabelas ─────────────────────────────────────────────────────────────────

-- Tenant = marca ou agencia assinante.
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  plan text not null default 'unico',        -- modelado desde ja (ADR: plano unico na fase 1)
  status text not null default 'ativo',
  -- Tokens de marca do white-label da Fase 3. Fica no tenant, e nunca no
  -- codigo, porque CLAUDE.md proibe cor, logo ou nome de cliente hardcodado.
  -- O conteudo e validado por src/tema/identidadeVisual.js antes de virar CSS:
  -- o banco guarda o que o tenant mandou, a aplicacao decide o que aplica.
  identidade jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  constraint tenants_status_valido check (status in ('ativo', 'suspenso', 'cancelado'))
);

-- Vinculo usuario <-> tenant (agencia pode ter varios usuarios).
create table if not exists public.tenant_membros (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro',
  primary key (tenant_id, user_id),
  constraint tenant_membros_papel_valido check (papel in ('dono', 'membro'))
);

-- Conta de Instagram conectada. Token NUNCA acessivel pelo front.
create table if not exists public.ig_contas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  -- Nome que o cliente reconhece; sem ele a tela cai no @ (src/lib/contas.js).
  nome text,
  fb_page_id text,                            -- exigido pela variante do ADR-002
  token_ref text not null,                    -- referencia ao Supabase Vault, nao o token
  token_expira_em timestamptz,
  -- Ciclo de vida da conexao. A coleta so roda em 'ativa', e o motor declara o
  -- limite "sem trafego pago" quando `tem_trafego_pago` e falso: sem esse dado a
  -- tela atribuiria ao conteudo um alcance que veio de anuncio.
  status text not null default 'ativa',
  tem_trafego_pago boolean not null default false,
  conectada_em timestamptz not null default now(),
  unique (ig_user_id),
  constraint ig_contas_status_valido
    check (status in ('ativa', 'pausada', 'token_expirado', 'desconectada'))
);

-- Dicionario canonico de metricas (ADR-003). Nome da Meta nunca vira coluna.
create table if not exists public.metricas_canonicas (
  codigo text primary key,                    -- ex: 'alcance', 'visualizacoes'
  rotulo text not null,
  unidade text not null,
  -- Agregacao nao e detalhe: seguidores e estoque e vale o ultimo saldo da
  -- semana; alcance e fluxo e soma. Somar seguidores por sete dias daria sete
  -- vezes a conta (contratos.md, secao 2).
  agregacao text not null,
  -- Frase que a tela e obrigada a mostrar quando a metrica for somada por
  -- janela. So `alcance` tem uma: somar alcance de varias semanas conta duas
  -- vezes quem foi alcancado em duas semanas, e a Meta nao devolve alcance
  -- unico de periodo longo. Limite de plataforma vira texto, nunca silencio.
  limite_de_agregacao text,
  descontinuada_em date,                      -- serie encerrada, nunca apagada
  constraint metricas_agregacao_valida check (agregacao in ('soma', 'ultimo', 'media'))
);

-- Snapshot diario da conta (ADR-004). Append-only.
create table if not exists public.snapshots_conta (
  id bigserial primary key,
  ig_conta_id uuid not null references public.ig_contas(id) on delete cascade,
  data date not null,
  metrica text not null references public.metricas_canonicas(codigo),
  valor numeric not null,
  api_version text not null,                  -- rastreabilidade (ADR-003)
  adapter_version text not null,
  unique (ig_conta_id, data, metrica)
);

-- Snapshot de midia (post, reel, story).
create table if not exists public.snapshots_midia (
  id bigserial primary key,
  ig_conta_id uuid not null references public.ig_contas(id) on delete cascade,
  ig_media_id text not null,
  data date not null,
  tipo text not null,
  publicada_em timestamptz,
  metrica text not null references public.metricas_canonicas(codigo),
  valor numeric not null,
  api_version text not null,
  adapter_version text not null,
  unique (ig_media_id, data, metrica)
);

-- Diagnostico gerado pelo motor de regras (ADR-005). A tela LE daqui.
create table if not exists public.diagnosticos (
  -- `text`, e nao `uuid`: o id vem de `idDoDiagnostico` do motor e e
  -- deterministico ("diag:<conta>:<inicio>:<fim>:<versao>"). Reprocessar o mesmo
  -- periodo com o mesmo ruleset precisa cair na MESMA linha; com uuid aleatorio
  -- cada reprocessamento viraria registro novo e a pergunta "mudou a conta ou
  -- mudou a regra?" perderia resposta. Ver nota de conflito no README.
  id text primary key,
  ig_conta_id uuid not null references public.ig_contas(id) on delete cascade,
  gerado_em timestamptz not null default now(),
  periodo_inicio date not null,
  periodo_fim date not null,
  ruleset_version text not null,              -- sem isso nao ha auditoria
  achados jsonb not null,                     -- [{regra, severidade, frase, acao, ...}]
  -- O que ESTE diagnostico nao sabe, e quanto historico ele teve. Nao sao
  -- enfeite: a tela e proibida de mostrar veredito sem os limites que o
  -- sustentam, e `cobertura.suficiente` e o que separa "esta tudo bem" de
  -- "ainda nao da para saber" (CLAUDE.md, principio n1).
  limites jsonb not null default '[]'::jsonb,
  cobertura jsonb not null default '{}'::jsonb,
  constraint diagnosticos_periodo_coerente check (periodo_fim >= periodo_inicio)
);

-- Registro de falha de coleta. Lacuna nunca fica invisivel (ADR-004).
create table if not exists public.coleta_eventos (
  id bigserial primary key,
  -- Nulo quando o evento e do job inteiro (ex: cron caiu antes de escolher
  -- conta). A politica de leitura filtra por conta, entao evento sem conta fica
  -- so para o operador — cliente nao ve falha que nao e da conta dele.
  ig_conta_id uuid references public.ig_contas(id) on delete cascade,
  ocorrido_em timestamptz not null default now(),
  status text not null,
  detalhe text,
  -- Vocabulario fechado porque `montarHistorico` traduz status em frase de
  -- lacuna: status desconhecido vira "A coleta do dia falhou.", que informa
  -- menos do que "Token expirado". Erro prevenido > erro exibido (CLAUDE.md).
  constraint coleta_eventos_status_valido
    check (status in ('ok', 'token_expirado', 'limite_de_taxa', 'falha_de_rede',
                      'falha_inesperada'))
);

-- Comprovante de exclusao de dados (LGPD e App Review).
-- Sem FK para `ig_contas` de proposito: a linha existe justamente para
-- sobreviver a exclusao que ela registra. Guarda contagem, nunca conteudo — o
-- comprovante nao pode ser uma copia do que foi apagado.
create table if not exists public.exclusoes_de_dados (
  protocolo text primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  ig_conta_id uuid not null,
  solicitado_por uuid references auth.users(id) on delete set null,
  solicitado_em timestamptz not null default now(),
  concluido_em timestamptz,
  itens_apagados jsonb not null default '{}'::jsonb
);

-- Fase 2 (ADR-006): concorrentes monitorados via business_discovery.
-- create table concorrentes (...);

-- ── Indices para as consultas que existem de verdade ────────────────────────
-- A serie semanal filtra por conta e faixa de data (src/lib/snapshots.js) e a
-- tela de diagnostico pede o mais recente da conta (src/lib/diagnosticos.js).
-- Sem estes dois, as duas telas principais varrem a tabela inteira.

create index if not exists idx_snapshots_conta_conta_data
  on public.snapshots_conta (ig_conta_id, data);

create index if not exists idx_snapshots_midia_conta_data
  on public.snapshots_midia (ig_conta_id, data);

create index if not exists idx_diagnosticos_conta_gerado_em
  on public.diagnosticos (ig_conta_id, gerado_em desc);

create index if not exists idx_coleta_eventos_conta_ocorrido_em
  on public.coleta_eventos (ig_conta_id, ocorrido_em desc);

-- `tenant_membros` e lida uma vez por consulta (ver `tenants_do_usuario`), e a
-- chave primaria comeca por tenant_id: o caminho por usuario precisa do proprio.
create index if not exists idx_tenant_membros_user_id
  on public.tenant_membros (user_id);

create index if not exists idx_ig_contas_tenant_id
  on public.ig_contas (tenant_id);

-- ── Funcoes de pertencimento (SECURITY DEFINER, e por que) ──────────────────
--
-- A politica de `tenant_membros` precisa consultar `tenant_membros` para saber
-- se a linha e do usuario. Uma politica que le a propria tabela reentra na
-- politica e o Postgres aborta com recursao infinita (42P17). SECURITY DEFINER
-- executa como o dono da funcao, que nao passa pela RLS da tabela lida, e corta
-- o ciclo.
--
-- `stable` faz o planner avaliar a funcao uma vez por consulta (InitPlan) em vez
-- de uma vez por linha — a diferenca entre uma varredura e milhares.
--
-- `search_path` fixo e obrigatorio em SECURITY DEFINER: sem ele, quem chama
-- escolhe qual `tenant_membros` a funcao enxerga.

create or replace function public.tenants_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id
    from public.tenant_membros
   where user_id = auth.uid()
$$;

comment on function public.tenants_do_usuario() is
  'Tenants do usuario autenticado. SECURITY DEFINER para evitar recursao de politica.';

-- Mesma ideia um nivel abaixo: snapshots, diagnosticos e eventos pertencem a uma
-- conta, e a conta pertence a um tenant. Sem esta funcao cada politica faria um
-- subselect em `ig_contas` sujeito a RLS, encadeando duas politicas por linha.
create or replace function public.contas_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
    from public.ig_contas c
   where c.tenant_id in (select public.tenants_do_usuario())
$$;

comment on function public.contas_do_usuario() is
  'Contas de Instagram visiveis para o usuario autenticado.';

revoke all on function public.tenants_do_usuario() from public;
revoke all on function public.contas_do_usuario() from public;
grant execute on function public.tenants_do_usuario() to authenticated, service_role;
grant execute on function public.contas_do_usuario() to authenticated, service_role;

-- ── Cofre do token da Meta ──────────────────────────────────────────────────
--
-- O front nunca chama nada disto: as tres funcoes sao SECURITY DEFINER e o
-- EXECUTE e revogado de `public`, `anon` e `authenticated`. Se `ler_token` fosse
-- executavel pelo usuario logado, o Vault viraria enfeite — qualquer membro de
-- qualquer tenant pediria o token de qualquer conta pelo PostgREST.

create or replace function public.guardar_token(p_nome text, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_nome;
  if v_id is null then
    v_id := vault.create_secret(p_token, p_nome, 'Token de longa duracao da Meta');
  else
    perform vault.update_secret(v_id, p_token, p_nome, 'Token de longa duracao da Meta');
  end if;
  return v_id;
end;
$$;

create or replace function public.ler_token(p_ref uuid)
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_ref
$$;

create or replace function public.apagar_token(p_ref uuid)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  delete from vault.secrets where id = p_ref;
  return found;
end;
$$;

revoke all on function public.guardar_token(text, text) from public, anon, authenticated;
revoke all on function public.ler_token(uuid) from public, anon, authenticated;
revoke all on function public.apagar_token(uuid) from public, anon, authenticated;
grant execute on function public.guardar_token(text, text) to service_role;
grant execute on function public.ler_token(uuid) to service_role;
grant execute on function public.apagar_token(uuid) to service_role;

