-- 20260905120200 — agendamento diario da coleta e do motor.
--
-- Duas coisas acontecem aqui, e a segunda quase ninguem lembra de anotar:
--   1. o snapshot diario do ADR-004 — historico que nao for coletado hoje nao
--      existe amanha, porque a Graph API nao devolve o passado de antes da
--      conexao;
--   2. o cron mantem o projeto vivo. O Supabase Free pausa um projeto ocioso
--      por 7 dias (doc 12, secao 1.1), e projeto pausado nao coleta — a pausa
--      apagaria justamente a serie que o produto vende. O job diario e, de
--      quebra, o batimento cardiaco do ambiente gratuito.
--
-- Horario: 04:00 em America/Sao_Paulo. O pg_cron avalia a expressao no fuso do
-- servidor, que no Supabase e UTC, entao 04:00 BRT vira 07:00 UTC (UTC-3). O
-- Brasil nao tem horario de verao desde 2019; se voltar a ter, ESTA LINHA
-- PRECISA MUDAR — o cron nao descobre sozinho.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── Como o cron chama uma Edge Function sem guardar segredo no SQL ──────────
--
-- Nem a URL das functions nem a chave de servico aparecem neste arquivo: as
-- duas vivem no Vault e sao lidas em tempo de execucao. Migration entra no git,
-- e segredo em git e segredo vazado (CLAUDE.md, Seguranca).
--
-- Cadastre os dois segredos uma vez, no ambiente, antes de habilitar o job:
--   select vault.create_secret('https://SEU-PROJETO.functions.supabase.co',
--                              'kora_url_das_functions');
--   select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'kora_chave_de_servico');

create or replace function public.disparar_funcao_agendada(p_funcao text)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions, pg_temp
as $$
declare
  v_base text;
  v_chave text;
  v_requisicao bigint;
begin
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'kora_url_das_functions';
  select decrypted_secret into v_chave
    from vault.decrypted_secrets where name = 'kora_chave_de_servico';

  -- Sem segredo cadastrado o job nao pode "seguir em frente": ele registra a
  -- falha e para. Cron que erra em silencio produz lacuna sem motivo, que e
  -- exatamente o que o ADR-004 proibe.
  if v_base is null or v_chave is null then
    insert into public.coleta_eventos (ig_conta_id, status, detalhe)
    values (null, 'falha_inesperada',
            'Agendamento sem segredos no Vault: kora_url_das_functions ou kora_chave_de_servico.');
    return null;
  end if;

  select net.http_post(
    url := v_base || '/' || p_funcao,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_chave
    ),
    body := jsonb_build_object('origem', 'cron'),
    timeout_milliseconds := 120000
  ) into v_requisicao;

  return v_requisicao;
end;
$$;

comment on function public.disparar_funcao_agendada(text) is
  'Chama uma Edge Function pelo pg_net lendo URL e chave do Vault. So o cron usa.';

revoke all on function public.disparar_funcao_agendada(text) from public, anon, authenticated;
grant execute on function public.disparar_funcao_agendada(text) to service_role;

-- ── Os dois jobs ────────────────────────────────────────────────────────────
--
-- `unschedule` antes de `schedule` porque `cron.schedule` com o mesmo nome
-- atualiza, mas reaplicar a migration num banco onde o nome nao existe erraria
-- na hora de remover. O `where exists` cobre os dois casos.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kora-coleta-diaria') then
    perform cron.unschedule('kora-coleta-diaria');
  end if;
  if exists (select 1 from cron.job where jobname = 'kora-gerar-diagnostico') then
    perform cron.unschedule('kora-gerar-diagnostico');
  end if;
end;
$$;

-- 04:00 America/Sao_Paulo.
select cron.schedule(
  'kora-coleta-diaria',
  '0 7 * * *',
  $$select public.disparar_funcao_agendada('coleta-diaria')$$
);

-- 04:40 America/Sao_Paulo. O motor le o que a coleta gravou, entao ele corre
-- depois — e com folga: a coleta percorre todas as contas ativas respeitando o
-- limite de 200 chamadas por hora por usuario, e apertar a janela faria o
-- diagnostico do dia nascer sobre uma serie incompleta.
select cron.schedule(
  'kora-gerar-diagnostico',
  '40 7 * * *',
  $$select public.disparar_funcao_agendada('gerar-diagnostico')$$
);
