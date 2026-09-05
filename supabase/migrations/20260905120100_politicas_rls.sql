-- 20260905120100 — politicas de RLS e privilegios de coluna.
--
-- Esta migration e a que decide se um tenant enxerga o dado de outro. Ela vem
-- separada da criacao das tabelas para caber inteira em uma tela de review.
--
-- Duas travas, e as duas precisam existir:
--   GRANT diz QUAIS COLUNAS o papel `authenticated` pode ler;
--   RLS  diz QUAIS LINHAS ele pode ler.
-- RLS ligada sem politica nega tudo em silencio, e o silencio e o problema: a
-- tela mostra "sem dado" e ninguem descobre que a causa foi a politica que
-- faltou. Por isso `supabase/politicas.test.js` falha quando uma tabela com RLS
-- fica sem politica de select.

alter table public.tenants             enable row level security;
alter table public.tenant_membros      enable row level security;
alter table public.ig_contas           enable row level security;
alter table public.metricas_canonicas  enable row level security;
alter table public.snapshots_conta     enable row level security;
alter table public.snapshots_midia     enable row level security;
alter table public.diagnosticos        enable row level security;
alter table public.coleta_eventos      enable row level security;
alter table public.exclusoes_de_dados  enable row level security;

-- Politicas: todo acesso passa por tenant_membros do usuario autenticado.
-- A escrita de snapshots e feita SOMENTE pela Edge Function com service_role.
--
-- Nota sobre `service_role`: o papel tem BYPASSRLS, entao as politicas abaixo
-- nao sao o que autoriza a Edge Function — elas declaram a intencao por escrito
-- e continuam valendo se um dia a coleta rodar com um papel sem bypass. O que
-- de fato impede o cliente de escrever linha de coleta e a ausencia de politica
-- de INSERT/UPDATE para `authenticated` somada a ausencia do GRANT.

drop policy if exists tenants_leitura_por_membro on public.tenants;
create policy tenants_leitura_por_membro on public.tenants
  for select to authenticated
  using (id in (select public.tenants_do_usuario()));

drop policy if exists tenant_membros_leitura_do_proprio_tenant on public.tenant_membros;
create policy tenant_membros_leitura_do_proprio_tenant on public.tenant_membros
  for select to authenticated
  using (tenant_id in (select public.tenants_do_usuario()));

drop policy if exists ig_contas_leitura_por_tenant on public.ig_contas;
create policy ig_contas_leitura_por_tenant on public.ig_contas
  for select to authenticated
  using (tenant_id in (select public.tenants_do_usuario()));

-- Dicionario, nao dado do cliente: `metricas_canonicas` diz o que "alcance"
-- significa. Esconder isso por tenant nao protegeria nada e quebraria a tela.
drop policy if exists metricas_leitura_autenticada on public.metricas_canonicas;
create policy metricas_leitura_autenticada on public.metricas_canonicas
  for select to authenticated
  using (true);

drop policy if exists snapshots_conta_leitura_por_conta on public.snapshots_conta;
create policy snapshots_conta_leitura_por_conta on public.snapshots_conta
  for select to authenticated
  using (ig_conta_id in (select public.contas_do_usuario()));

drop policy if exists snapshots_midia_leitura_por_conta on public.snapshots_midia;
create policy snapshots_midia_leitura_por_conta on public.snapshots_midia
  for select to authenticated
  using (ig_conta_id in (select public.contas_do_usuario()));

drop policy if exists diagnosticos_leitura_por_conta on public.diagnosticos;
create policy diagnosticos_leitura_por_conta on public.diagnosticos
  for select to authenticated
  using (ig_conta_id in (select public.contas_do_usuario()));

-- `ig_conta_id` nulo cai fora do `in (...)` e o evento de job fica invisivel
-- para o cliente, que e o comportamento desejado.
drop policy if exists coleta_eventos_leitura_por_conta on public.coleta_eventos;
create policy coleta_eventos_leitura_por_conta on public.coleta_eventos
  for select to authenticated
  using (ig_conta_id in (select public.contas_do_usuario()));

drop policy if exists exclusoes_leitura_por_tenant on public.exclusoes_de_dados;
create policy exclusoes_leitura_por_tenant on public.exclusoes_de_dados
  for select to authenticated
  using (tenant_id in (select public.tenants_do_usuario()));

-- Escrita de coleta, diagnostico e conexao: so o servidor.
drop policy if exists ig_contas_servico on public.ig_contas;
create policy ig_contas_servico on public.ig_contas
  for all to service_role using (true) with check (true);

drop policy if exists snapshots_conta_servico on public.snapshots_conta;
create policy snapshots_conta_servico on public.snapshots_conta
  for all to service_role using (true) with check (true);

drop policy if exists snapshots_midia_servico on public.snapshots_midia;
create policy snapshots_midia_servico on public.snapshots_midia
  for all to service_role using (true) with check (true);

drop policy if exists diagnosticos_servico on public.diagnosticos;
create policy diagnosticos_servico on public.diagnosticos
  for all to service_role using (true) with check (true);

drop policy if exists coleta_eventos_servico on public.coleta_eventos;
create policy coleta_eventos_servico on public.coleta_eventos
  for all to service_role using (true) with check (true);

drop policy if exists exclusoes_servico on public.exclusoes_de_dados;
create policy exclusoes_servico on public.exclusoes_de_dados
  for all to service_role using (true) with check (true);

drop policy if exists tenants_servico on public.tenants;
create policy tenants_servico on public.tenants
  for all to service_role using (true) with check (true);

drop policy if exists tenant_membros_servico on public.tenant_membros;
create policy tenant_membros_servico on public.tenant_membros
  for all to service_role using (true) with check (true);

drop policy if exists metricas_servico on public.metricas_canonicas;
create policy metricas_servico on public.metricas_canonicas
  for all to service_role using (true) with check (true);

-- ── Privilegios: a trava que a RLS nao da ───────────────────────────────────
--
-- RLS filtra LINHA. Nenhuma politica esconde uma COLUNA, e `ig_contas.token_ref`
-- e exatamente um problema de coluna: a linha da conta precisa ser legivel pelo
-- dono, a referencia do cofre nao.
--
-- Escolhemos privilegio de coluna em vez de view por tres razoes:
--   1. `src/lib/contas.js` consulta `from('ig_contas')` e o nome esta fixado em
--      contratos.md (secao 4). Uma view obrigaria a renomear a tabela base e a
--      reescrever FK e Edge Functions para ganhar o nome de volta.
--   2. A view protege quem passa por ela; o privilegio protege a coluna em todo
--      caminho — PostgREST, psql, um servico futuro.
--   3. Como efeito colateral util, `select *` passa a falhar com "permission
--      denied for column token_ref". A regra "nada de select *" do CLAUDE.md
--      deixa de depender de review e passa a ser verificada pelo banco.
--
-- Default-deny primeiro: o Supabase concede tudo por padrao em tabela nova, e
-- confiar no que sobrou do padrao e como o token vaza. O `revoke` abaixo vale
-- para as tabelas que existem no momento em que ele roda: TABELA CRIADA DEPOIS
-- nasce com o grant amplo de novo, e a migration que a cria precisa repetir o
-- seu proprio revoke/grant.

revoke all on all tables in schema public from anon, authenticated;

grant select (id, nome, plan, status, identidade, criado_em)
  on public.tenants to authenticated;

grant select (tenant_id, user_id, papel)
  on public.tenant_membros to authenticated;

-- `token_ref` esta fora, e essa ausencia e a regra, nao esquecimento.
grant select (id, tenant_id, ig_user_id, username, nome, fb_page_id, status,
              tem_trafego_pago, token_expira_em, conectada_em)
  on public.ig_contas to authenticated;

grant select on public.metricas_canonicas to authenticated;
grant select on public.snapshots_conta   to authenticated;
grant select on public.snapshots_midia   to authenticated;
grant select on public.diagnosticos      to authenticated;
grant select on public.coleta_eventos    to authenticated;
grant select on public.exclusoes_de_dados to authenticated;

-- `anon` nao le nada: as rotas publicas (/privacidade, /dados) sao conteudo
-- estatico e nao consultam o banco (contratos.md, secao 6).
