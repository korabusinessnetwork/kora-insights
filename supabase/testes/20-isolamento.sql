-- TESTE DE ISOLAMENTO ENTRE TENANTS.
--
-- E o teste que a fundacao chama de definition of done de toda tabela nova
-- (CLAUDE.md, "multi-tenant desde a linha 1"). Ele nao le SQL como texto: ele
-- conecta como `authenticated`, assume a identidade de um usuario de verdade
-- pelo mesmo `request.jwt.claims` que o Supabase usa, e conta linhas.
--
-- Cada asserção falha alto. Vazamento de multi-tenant nao aparece como erro na
-- tela: aparece como um numero maior do que deveria, e passa despercebido ate o
-- dia em que um cliente reconhece o dado de outro.

\set ON_ERROR_STOP on
-- A saida util sao os NOTICE; a tabela de retorno vazia de cada `select` so
-- atrapalha a leitura de quem esta conferindo o resultado.
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.conferir(rotulo text, obtido bigint, esperado bigint)
returns void
language plpgsql
as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % — esperado %, obtido %', rotulo, esperado, obtido;
  end if;
  raise notice 'ok: %', rotulo;
end
$$;

-- ── Ana, da Estúdio Vergara ─────────────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

select pg_temp.conferir('ana enxerga o proprio tenant, e so ele',
  (select count(*) from public.tenants), 1);
select pg_temp.conferir('e o tenant que ela enxerga e o dela',
  (select count(*) from public.tenants where nome = 'Estúdio Vergara'), 1);
select pg_temp.conferir('ana enxerga a propria conta, e so ela',
  (select count(*) from public.ig_contas), 1);
select pg_temp.conferir('ana nao enxerga a conta da rival',
  (select count(*) from public.ig_contas where username = 'cliente.rival'), 0);
select pg_temp.conferir('ana enxerga so o proprio snapshot',
  (select count(*) from public.snapshots_conta), 1);
select pg_temp.conferir('o numero que ana ve e o dela, nao a soma dos dois tenants',
  (select coalesce(sum(valor), 0)::bigint from public.snapshots_conta), 1700);
select pg_temp.conferir('ana enxerga so o proprio diagnostico',
  (select count(*) from public.diagnosticos), 1);
select pg_temp.conferir('o veredito da rival nao alcanca ana',
  (select count(*) from public.diagnosticos
    where achados::text like '%Segredo da Rival%'), 0);
select pg_temp.conferir('ana enxerga so o proprio evento de coleta',
  (select count(*) from public.coleta_eventos), 1);
select pg_temp.conferir('ana enxerga so o proprio vinculo de membro',
  (select count(*) from public.tenant_membros), 1);
select pg_temp.conferir('o dicionario de metricas e publico para quem esta autenticado',
  (select count(*) from public.metricas_canonicas), 1);
commit;

-- ── Bruno, da Agência Rival — o espelho ─────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222"}';

select pg_temp.conferir('bruno enxerga o proprio tenant, e so ele',
  (select count(*) from public.tenants where nome = 'Agência Rival'), 1);
select pg_temp.conferir('bruno nao enxerga a casa oliveira',
  (select count(*) from public.ig_contas where username = 'casa.oliveira'), 0);
select pg_temp.conferir('o numero que bruno ve e o dele',
  (select coalesce(sum(valor), 0)::bigint from public.snapshots_conta), 9900);
commit;

-- ── Usuario autenticado sem tenant nenhum ───────────────────────────────────
-- Conta criada e ainda nao vinculada. Ela nao pode enxergar nada, e este e o
-- caso que uma politica escrita com `using (true)` deixaria passar.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333"}';

select pg_temp.conferir('usuario sem tenant nao ve tenant', (select count(*) from public.tenants), 0);
select pg_temp.conferir('usuario sem tenant nao ve conta', (select count(*) from public.ig_contas), 0);
select pg_temp.conferir('usuario sem tenant nao ve snapshot',
  (select count(*) from public.snapshots_conta), 0);
select pg_temp.conferir('usuario sem tenant nao ve diagnostico',
  (select count(*) from public.diagnosticos), 0);
commit;

-- ── O token nunca alcanca o cliente ─────────────────────────────────────────
-- Nao e RLS que protege a coluna: RLS filtra LINHA. Quem impede a leitura de
-- `token_ref` e o GRANT por coluna. Sao duas travas diferentes, e o teste cobra
-- as duas separadamente.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

do $$
begin
  perform token_ref from public.ig_contas limit 1;
  raise exception 'FALHOU: authenticated conseguiu ler ig_contas.token_ref';
exception
  when insufficient_privilege then
    raise notice 'ok: token_ref e inalcancavel pelo cliente';
end
$$;

do $$
begin
  perform 1 from vault.decrypted_secrets limit 1;
  raise exception 'FALHOU: authenticated alcancou o cofre';
exception
  when insufficient_privilege or invalid_schema_name then
    raise notice 'ok: o cofre e inalcancavel pelo cliente';
end
$$;

-- `saude_das_contas` cruza contas de TODOS os tenants — e para isso que ela
-- serve de painel, e por isso ela nao pode chegar ao navegador. View comum roda
-- com os privilegios do dono e passaria por cima da RLS; esta declara
-- `security_invoker`, e o GRANT revogado e a trava que nao depende de eu ter
-- acertado a primeira.
do $$
begin
  perform 1 from public.saude_das_contas limit 1;
  raise exception 'FALHOU: authenticated alcancou saude_das_contas';
exception
  when insufficient_privilege then
    raise notice 'ok: o painel de saude e inalcancavel pelo cliente';
end
$$;
commit;

-- E o service_role alcanca, senao a trava acima passaria de graca num banco em
-- que a view nao existe para ninguem.
begin;
set local role service_role;
select pg_temp.conferir('service_role enxerga as duas contas no painel de saude',
  (select count(*) from public.saude_das_contas), 2);
commit;

-- ── Cliente nao escreve linha de coleta ─────────────────────────────────────
-- A coleta e escrita so pela Edge Function com service_role. Um cliente que
-- pudesse inserir snapshot poderia fabricar o proprio diagnostico.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

do $$
begin
  insert into public.snapshots_conta
    (ig_conta_id, data, metrica, valor, api_version, adapter_version)
  values ('a0000000-0000-4000-8000-000000000001', '2026-08-25', 'alcance', 999999, 'v23.0', '1.0.0');
  raise exception 'FALHOU: authenticated inseriu snapshot';
exception
  when insufficient_privilege then
    raise notice 'ok: cliente nao escreve snapshot';
end
$$;

do $$
begin
  update public.diagnosticos set ruleset_version = '9.9.9';
  raise exception 'FALHOU: authenticated alterou diagnostico';
exception
  when insufficient_privilege then
    raise notice 'ok: cliente nao reescreve diagnostico';
end
$$;
commit;

\echo ''
\echo '================================================='
\echo ' ISOLAMENTO ENTRE TENANTS: todas as asserções ok'
\echo '================================================='
