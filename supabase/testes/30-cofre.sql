-- TESTE DO COFRE DO TOKEN.
--
-- As tres funcoes de `public` que tocam o Vault — `guardar_token`, `ler_token`,
-- `apagar_token` — nunca tinham rodado em teste nenhum. Elas sustentam duas
-- coisas que o produto ja faz e que, se falharem, falham em silencio:
--
--   1. A renovacao do token (ADR-009) grava o token novo com o MESMO nome e
--      conta receber a MESMA referencia de volta. Se `guardar_token` criasse um
--      segredo novo a cada chamada, `ig_contas.token_ref` passaria a apontar
--      para o segredo velho a cada renovacao, e a coleta leria um token vencido
--      achando que leu o novo — pior que nao renovar, porque parece que renovou.
--   2. A desconexao apaga o segredo e mantem a linha. Se `apagar_token` nao
--      apagasse, ficaria uma autorizacao viva para uma conta que o cliente
--      pediu para soltar.
--
-- Ler o SQL como texto nao pega nenhuma das duas: as duas funcoes "parecem"
-- certas na leitura, e e o comportamento que importa.
--
-- O ambiente e o stub de `00-ambiente-supabase.sql`, com as assinaturas do
-- Vault documentadas pelo Supabase. O que se prova aqui e a logica das nossas
-- funcoes, nao a criptografia do Supabase.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.conferir_texto(rotulo text, obtido text, esperado text)
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

create or replace function pg_temp.conferir_verdade(rotulo text, obtido boolean)
returns void
language plpgsql
as $$
begin
  if obtido is not true then
    raise exception 'FALHOU: %', rotulo;
  end if;
  raise notice 'ok: %', rotulo;
end
$$;

-- ── O ciclo que a renovacao percorre todo dia ───────────────────────────────
do $$
declare
  v_primeira uuid;
  v_segunda uuid;
  v_outra uuid;
begin
  v_primeira := public.guardar_token('ig_conta_17841400000000001', 'TOKEN-DIA-1');
  perform pg_temp.conferir_verdade('guardar_token devolve uma referencia',
    v_primeira is not null);
  perform pg_temp.conferir_texto('ler_token devolve o token gravado',
    public.ler_token(v_primeira), 'TOKEN-DIA-1');

  -- O coracao da ADR-009: renovar reescreve o segredo do MESMO nome, e a
  -- referencia guardada em `ig_contas.token_ref` continua valendo.
  v_segunda := public.guardar_token('ig_conta_17841400000000001', 'TOKEN-RENOVADO');
  perform pg_temp.conferir_verdade('renovar devolve a MESMA referencia',
    v_segunda = v_primeira);
  perform pg_temp.conferir_texto('e a referencia antiga passa a ler o token novo',
    public.ler_token(v_primeira), 'TOKEN-RENOVADO');

  -- Sem esta, um bug que ignorasse o nome passaria despercebido: as duas contas
  -- compartilhariam segredo e uma renovacao sobrescreveria o token da outra.
  v_outra := public.guardar_token('ig_conta_17841400000000002', 'TOKEN-DE-OUTRA-CONTA');
  perform pg_temp.conferir_verdade('nome diferente e segredo diferente',
    v_outra <> v_primeira);
  perform pg_temp.conferir_texto('e uma conta nao sobrescreve o token da outra',
    public.ler_token(v_primeira), 'TOKEN-RENOVADO');
end
$$;

-- ── O que a desconexao faz ──────────────────────────────────────────────────
do $$
declare
  v_ref uuid;
begin
  v_ref := public.guardar_token('ig_conta_para_desconectar', 'TOKEN-A-SOLTAR');

  perform pg_temp.conferir_verdade('apagar_token confirma que apagou',
    public.apagar_token(v_ref));
  perform pg_temp.conferir_texto('e o segredo nao volta a ser lido',
    public.ler_token(v_ref), null);

  -- Desconectar duas vezes nao pode explodir: a Edge Function trata repeticao
  -- como sucesso, e `false` aqui e o que diz "nao havia nada para apagar".
  perform pg_temp.conferir_verdade('apagar de novo devolve false, sem erro',
    public.apagar_token(v_ref) is false);
end
$$;

-- ── Referencia que nao existe ───────────────────────────────────────────────
do $$
begin
  -- A coleta trata `ler_token` nulo como conexao quebrada e pede reconexao. Se
  -- isto lancasse excecao em vez de devolver nulo, a varredura do dia morreria
  -- na primeira conta com cofre inconsistente e as outras perderiam o dia.
  perform pg_temp.conferir_texto('referencia inexistente devolve nulo, nao erro',
    public.ler_token('00000000-0000-4000-8000-000000000000'), null);
end
$$;

-- ── O cliente nao executa nenhuma das tres ──────────────────────────────────
--
-- `SECURITY DEFINER` sem revogar EXECUTE seria pior que nao ter cofre: qualquer
-- membro de qualquer tenant pediria o token de qualquer conta pelo PostgREST, e
-- a RLS nao teria como impedir — a funcao roda como dono.
do $$
begin
  perform pg_temp.conferir_verdade('authenticated nao executa ler_token',
    not has_function_privilege('authenticated', 'public.ler_token(uuid)', 'execute'));
  perform pg_temp.conferir_verdade('authenticated nao executa guardar_token',
    not has_function_privilege('authenticated', 'public.guardar_token(text, text)', 'execute'));
  perform pg_temp.conferir_verdade('authenticated nao executa apagar_token',
    not has_function_privilege('authenticated', 'public.apagar_token(uuid)', 'execute'));

  perform pg_temp.conferir_verdade('anon tambem nao executa ler_token',
    not has_function_privilege('anon', 'public.ler_token(uuid)', 'execute'));

  -- E o service_role executa: sem isso a coleta nao lê token nenhum, e o teste
  -- acima passaria de graca num banco onde ninguem pode nada.
  perform pg_temp.conferir_verdade('service_role executa ler_token',
    has_function_privilege('service_role', 'public.ler_token(uuid)', 'execute'));
  perform pg_temp.conferir_verdade('service_role executa guardar_token',
    has_function_privilege('service_role', 'public.guardar_token(text, text)', 'execute'));
  perform pg_temp.conferir_verdade('service_role executa apagar_token',
    has_function_privilege('service_role', 'public.apagar_token(uuid)', 'execute'));
end
$$;

\echo 'Cofre: todas as asserções passaram.'
