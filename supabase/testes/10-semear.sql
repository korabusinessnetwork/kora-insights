-- Duas agencias que nao se conhecem, com um cliente cada.
--
-- O dado e proposital: as duas contas tem a MESMA metrica no MESMO dia, com
-- valores diferentes. Uma politica frouxa que devolvesse linha demais apareceria
-- como um numero errado, e nao como um erro — que e exatamente como um vazamento
-- de multi-tenant se manifesta na vida real.

-- Os usuarios entram fora do papel de servico, como acontece de verdade: quem
-- cria linha em `auth.users` e o Supabase Auth, nao a aplicacao. O service_role
-- do produto nem deveria conseguir — e aqui ele nao consegue.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@vergara.test'),
  ('22222222-2222-4222-8222-222222222222', 'bruno@rival.test'),
  ('33333333-3333-4333-8333-333333333333', 'sem-tenant@ninguem.test');

-- Daqui para baixo, tudo o que a aplicacao grava, com o papel que a aplicacao usa.
begin;
set local role service_role;

insert into public.tenants (id, nome) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Estúdio Vergara'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Agência Rival');

insert into public.tenant_membros (tenant_id, user_id, papel) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'dono'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'dono');

reset role;
insert into vault.secrets (id, name, secret) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'ig:vergara', 'TOKEN-SECRETO-DA-VERGARA'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'ig:rival',   'TOKEN-SECRETO-DA-RIVAL');

set local role service_role;

insert into public.ig_contas (id, tenant_id, ig_user_id, username, nome, token_ref) values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '17841400000000001', 'casa.oliveira', 'Casa Oliveira',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '17841400000000002', 'cliente.rival', 'Cliente da Rival',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

insert into public.metricas_canonicas (codigo, rotulo, unidade, agregacao) values
  ('alcance', 'Contas alcançadas', 'contas', 'soma')
on conflict (codigo) do nothing;

insert into public.snapshots_conta
  (ig_conta_id, data, metrica, valor, api_version, adapter_version) values
  ('a0000000-0000-4000-8000-000000000001', '2026-08-24', 'alcance', 1700, 'v23.0', '1.0.0'),
  ('b0000000-0000-4000-8000-000000000002', '2026-08-24', 'alcance', 9900, 'v23.0', '1.0.0');

-- O id e o mesmo texto deterministico que `idDoDiagnostico` do motor produz.
insert into public.diagnosticos
  (id, ig_conta_id, periodo_inicio, periodo_fim, ruleset_version, achados) values
  ('diag:a0000000-0000-4000-8000-000000000001:2026-07-06:2026-08-30:0.3.0',
   'a0000000-0000-4000-8000-000000000001', '2026-07-06', '2026-08-30', '0.3.0',
   '[{"frase": "Segredo da Vergara"}]'::jsonb),
  ('diag:b0000000-0000-4000-8000-000000000002:2026-07-06:2026-08-30:0.3.0',
   'b0000000-0000-4000-8000-000000000002', '2026-07-06', '2026-08-30', '0.3.0',
   '[{"frase": "Segredo da Rival"}]'::jsonb);

insert into public.coleta_eventos (ig_conta_id, status, detalhe) values
  ('a0000000-0000-4000-8000-000000000001', 'ok', 'coleta da Vergara'),
  ('b0000000-0000-4000-8000-000000000002', 'ok', 'coleta da Rival');

commit;
