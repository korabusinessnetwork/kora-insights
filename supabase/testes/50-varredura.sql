-- TESTE DA VARREDURA DIARIA.
--
-- `contas_da_varredura` responde duas perguntas de uma vez: quem a coleta diaria
-- toca, e quem dentro dessa lista pode virar snapshot. As duas juntas sao o que
-- separa pausar de desconectar.
--
-- O defeito que esta view existe para nao ter de volta era silencioso, que e a
-- pior categoria neste produto: a renovacao do token mora dentro da coleta
-- (ADR-009) e a coleta so varria `ativa`, entao o token de uma conta `pausada`
-- envelhecia ate morrer. Uma pausa de mais de 60 dias virava desconexao de fato
-- — o cliente volta, precisa reconectar, e os meses que ele achava estar
-- guardando pararam de crescer sem ninguem dizer nada.
--
-- Nao ha Deno no CI, entao a Edge Function nao tem teste automatizado. O que da
-- para provar sobre ela e o que o banco lhe garante — e a lista que ela recebe e
-- exatamente isso. Uma view que devolva a conta errada aqui nao levanta erro
-- nenhum: ela coleta o que nao devia, ou deixa um token morrer em silencio.

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

create or replace function pg_temp.conferir_bool(rotulo text, obtido boolean, esperado boolean)
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

begin;
set local role service_role;

-- O cenario tem as quatro pontas do ciclo de vida de `ig_contas` ao mesmo tempo,
-- porque o que se cobra aqui e a fronteira: tres estados diferentes de "nao
-- coletar" que precisam de tres respostas diferentes.
--
-- A conta da Vergara continua `ativa`. A da Rival vira `pausada`, com o token
-- vencendo em dez dias — dentro dos quinze de DIAS_PARA_RENOVAR, que e o caso em
-- que a passagem pela conta pausada tem trabalho a fazer.
update public.ig_contas
   set status = 'pausada', token_expira_em = now() + interval '10 days'
 where id = 'b0000000-0000-4000-8000-000000000002';

insert into public.ig_contas (id, tenant_id, ig_user_id, username, nome, token_ref, status) values
  ('a0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '17841400000000003', 'saiu.de.vez', 'Saiu de Vez',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'desconectada'),
  ('a0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '17841400000000004', 'token.morto', 'Token Morto',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'token_expirado');

-- ── Quem entra na varredura ─────────────────────────────────────────────────

-- A contagem vem primeiro de proposito: sem ela, uma view que devolvesse
-- `ig_contas` inteira passaria em todas as asserções seguintes.
select pg_temp.conferir_num('a varredura tem exatamente as duas contas que renovam token',
  (select count(*) from public.contas_da_varredura), 2);

select pg_temp.conferir_num('a conta ativa entra',
  (select count(*) from public.contas_da_varredura
    where id = 'a0000000-0000-4000-8000-000000000001'), 1);

-- O caso que este arquivo existe para provar. Antes desta view a conta pausada
-- nao era varrida, e o token dela morria de velhice durante a pausa.
select pg_temp.conferir_num('a conta pausada entra — a pausa para a coleta, nao o token',
  (select count(*) from public.contas_da_varredura
    where id = 'b0000000-0000-4000-8000-000000000002'), 1);

-- `desconectar-conta` apaga o segredo do cofre antes de sair. Nao ha token para
-- trocar, e a tentativa gastaria chamada da Meta para falhar.
select pg_temp.conferir_num('a conta desconectada NAO entra: o cofre dela ja foi esvaziado',
  (select count(*) from public.contas_da_varredura
    where id = 'a0000000-0000-4000-8000-000000000003'), 0);

-- `fb_exchange_token` so aceita token longo DENTRO da validade: renovar o que ja
-- venceu e uma chamada para receber a mesma recusa. A saida dessa conta e a
-- reconexao, que a tela ja pede.
select pg_temp.conferir_num('a conta com token expirado NAO entra: nao ha o que trocar',
  (select count(*) from public.contas_da_varredura
    where id = 'a0000000-0000-4000-8000-000000000004'), 0);

-- ── E quem, dentro dela, pode virar snapshot ────────────────────────────────

select pg_temp.conferir_bool('a conta ativa entra para coletar',
  (select coletar from public.contas_da_varredura
    where id = 'a0000000-0000-4000-8000-000000000001'), true);

-- A outra metade da regra, e a que erra em silencio: coletar uma conta pausada
-- desfaria a decisao do cliente sem nenhum erro aparecer em lugar nenhum.
select pg_temp.conferir_bool('a conta pausada entra SO para renovar',
  (select coletar from public.contas_da_varredura
    where id = 'b0000000-0000-4000-8000-000000000002'), false);

-- ── E leva o que a renovacao precisa ────────────────────────────────────────
-- Uma lista certa sem a referencia do cofre ou sem o prazo do token deixaria a
-- funcao sem como ler o segredo ou sem como decidir se ja e hora de trocar — o
-- mesmo token morto, por outro caminho.

select pg_temp.conferir_num('a conta pausada leva a referencia do cofre junto',
  (select count(*) from public.contas_da_varredura
    where id = 'b0000000-0000-4000-8000-000000000002' and token_ref is not null), 1);

select pg_temp.conferir_num('e leva o prazo do token, que e quem decide a troca',
  (select (token_expira_em::date - current_date) from public.contas_da_varredura
    where id = 'b0000000-0000-4000-8000-000000000002'), 10);

rollback;

\echo 'Varredura da coleta: todas as asserções passaram.'
