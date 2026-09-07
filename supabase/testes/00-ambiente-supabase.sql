-- Ambiente minimo do Supabase, para as migrations de producao rodarem sem
-- alteracao num Postgres puro.
--
-- Isto NAO e uma reimplementacao do Supabase: e o contorno exato do que as
-- nossas migrations tocam — o schema `auth` com `users` e `uid()`, o schema
-- `vault`, e os tres papeis. Se uma migration passar a depender de outra coisa
-- do Supabase, este arquivo quebra, e quebrar aqui e melhor do que descobrir em
-- producao.
--
-- `auth.uid()` e reproduzido do jeito que o Supabase o define: ele le o claim
-- `sub` do JWT a partir de `request.jwt.claims`. O teste de isolamento troca de
-- usuario mexendo nessa mesma configuracao, entao exercita o mecanismo real e
-- nao um atalho.

create schema if not exists auth;
create schema if not exists vault;
create schema if not exists extensions;

-- `gen_random_uuid()` vem do pgcrypto, que no Supabase mora em `extensions`.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- O Supabase concede, por padrao, acesso amplo ao `service_role` em `public`, e
-- as nossas migrations contam com isso: elas so escrevem `grant` para
-- `authenticated`, e revogam de `anon` e `authenticated` sem nunca conceder
-- nada ao papel de servico. Essa dependencia estava implicita ate este teste
-- rodar num Postgres puro e a semeadura falhar com "permission denied for table
-- tenants". Fica reproduzida aqui, e agora esta escrita em algum lugar.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text unique
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- O Vault do Supabase guarda segredo cifrado. `supabase_vault` nao existe fora
-- do Supabase, entao o stub cria as duas coisas que as nossas migrations tocam:
-- a tabela e a view de leitura. O teste nao valida criptografia — valida quem
-- alcanca o que, e que o token NAO seja alcancavel pelo cliente e uma das
-- asserções.
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text,
  secret text
);

create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret from vault.secrets;

-- As duas funcoes que `guardar_token` chama. As assinaturas sao as documentadas
-- pelo Supabase — `create_secret(secret, name, description)` devolvendo o id, e
-- `update_secret(id, secret, name, description)` devolvendo void — e essa
-- fidelidade e o ponto: e ela que faz o teste dizer alguma coisa sobre o codigo
-- de producao em vez de sobre o stub.
--
-- O que o stub NAO reproduz e a criptografia. Ele guarda o segredo em texto,
-- porque o que esta sob prova aqui e a logica de `guardar_token` (achar pelo
-- nome, criar ou atualizar, devolver a MESMA referencia) e quem alcanca o que.
-- Cifrar em teste provaria que o Postgres sabe cifrar, que ninguem duvida.
create or replace function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default ''
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into vault.secrets (name, secret) values (new_name, new_secret)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function vault.update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null
)
returns void
language plpgsql
as $$
begin
  update vault.secrets
     set secret = coalesce(new_secret, secret),
         name = coalesce(new_name, name)
   where id = secret_id;
end
$$;
