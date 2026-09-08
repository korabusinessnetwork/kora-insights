-- TESTE DO PAINEL DE SAUDE.
--
-- `saude_das_contas` existe para responder, do nosso lado, "a coleta parou?".
-- Uma view que devolve numero errado ai e pior que nao ter view nenhuma: ela
-- diz que esta tudo bem e o operador para de olhar.
--
-- Duas coisas sao contadas aqui. A aritmetica — dias contados contra o evento
-- certo — e a escolha do evento: "ultima coleta OK", e nao "ultimo evento", que
-- e a diferenca entre uma conta parada ha semanas e uma conta que falha todo
-- dia. As duas parecem iguais no painel se a view olhar so o evento mais
-- recente, e sao o oposto uma da outra.
--
-- O isolamento da view (cliente nao alcanca, service_role alcanca) e cobrado em
-- `20-isolamento.sql`, junto das outras travas de acesso.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.conferir_num(rotulo text, obtido bigint, esperado bigint)
returns void
language plpgsql
as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % — esperado %, obtido %',
      rotulo, coalesce(esperado::text, '<nulo>'), coalesce(obtido::text, '<nulo>');
  end if;
  raise notice 'ok: %', rotulo;
end
$$;

create or replace function pg_temp.conferir_txt(rotulo text, obtido text, esperado text)
returns void
language plpgsql
as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % — esperado %, obtido %',
      rotulo, coalesce(esperado, '<nulo>'), coalesce(obtido, '<nulo>');
  end if;
  raise notice 'ok: %', rotulo;
end
$$;

begin;
set local role service_role;

-- Uma conta que coletou bem ate cinco dias atras e vem falhando desde entao. E
-- o caso que mais importa acertar: ela tem evento de HOJE, e esta parada ha
-- cinco dias. Uma view que olhasse "ultimo evento" diria zero.
--
-- O `ok` que a semeadura criou e empurrado para tras em vez de acompanhado por
-- outro: com os dois, o mais recente seria o de hoje e o cenario descreveria
-- uma conta saudavel — que foi exatamente o que este teste pegou na primeira
-- execucao, no setup e nao na view.
update public.coleta_eventos
   set ocorrido_em = now() - interval '5 days'
 where ig_conta_id = 'a0000000-0000-4000-8000-000000000001' and status = 'ok';

insert into public.coleta_eventos (ig_conta_id, ocorrido_em, status, detalhe) values
  ('a0000000-0000-4000-8000-000000000001', now() - interval '1 day', 'token_expirado', 'falhou'),
  ('a0000000-0000-4000-8000-000000000001', now(), 'token_expirado', 'falhou de novo');

update public.ig_contas
   set token_expira_em = now() + interval '9 days'
 where id = 'a0000000-0000-4000-8000-000000000001';

update public.diagnosticos
   set gerado_em = now() - interval '3 days'
 where ig_conta_id = 'a0000000-0000-4000-8000-000000000001';

select pg_temp.conferir_num('conta parada ha 5 dias aparece com 5, e nao com 0',
  (select dias_sem_coleta from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000001'), 5);

select pg_temp.conferir_txt('e o motivo da ultima falha vem junto',
  (select motivo_da_ultima_falha from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000001'), 'token_expirado');

select pg_temp.conferir_num('dias sem diagnostico contam do ultimo gerado',
  (select dias_sem_diagnostico from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000001'), 3);

select pg_temp.conferir_num('e o prazo do token aparece em dias',
  (select dias_ate_o_token_vencer from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000001'), 9);

-- A outra conta continua saudavel: a view nao pode contaminar uma linha com o
-- estado da outra, que e o erro classico de `join` mal escrito.
select pg_temp.conferir_num('a conta saudavel do outro tenant continua em zero',
  (select dias_sem_coleta from public.saude_das_contas
    where ig_conta_id = 'b0000000-0000-4000-8000-000000000002'), 0);

select pg_temp.conferir_txt('e ela nao herda a falha da vizinha',
  (select motivo_da_ultima_falha from public.saude_das_contas
    where ig_conta_id = 'b0000000-0000-4000-8000-000000000002'), null);

-- Conta que nunca coletou: nulo, nao zero. Zero diria "coletou hoje", que e a
-- afirmacao oposta — e a conta recem-conectada cairia no painel como saudavel.
insert into public.ig_contas (id, tenant_id, ig_user_id, username, nome, token_ref) values
  ('a0000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '17841400000000009', 'recem.conectada', 'Recem Conectada',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

select pg_temp.conferir_num('conta que nunca coletou devolve nulo, nunca zero',
  (select dias_sem_coleta from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000009'), null);

select pg_temp.conferir_num('e sem diagnostico tambem e nulo',
  (select dias_sem_diagnostico from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000009'), null);

select pg_temp.conferir_num('e sem prazo de token conhecido, idem',
  (select dias_ate_o_token_vencer from public.saude_das_contas
    where ig_conta_id = 'a0000000-0000-4000-8000-000000000009'), null);

rollback;

\echo 'Saude das contas: todas as asserções passaram.'
