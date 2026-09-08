-- SAUDE DAS CONTAS: como saber, do nosso lado, que a rotina parou.
--
-- Falha da coleta vira linha em `coleta_eventos`, e falha do motor vira log.
-- Nenhum dos dois avisa ninguem: o operador precisaria abrir o painel de logs
-- todo dia e saber o que procurar. A tela ja cobre o CLIENTE — ela declara a
-- idade do diagnostico e pede reconexao quando o token esta vencendo — mas isso
-- chega por ele, e dias depois. Num produto onde dia sem coleta nao volta, essa
-- e a diferenca entre perder um dia e perder um mes.
--
-- Esta view responde "esta tudo coletando?" numa consulta so.
--
-- **Ela nao julga.** Devolve contagem de dias e nada mais: nenhum limiar, nenhum
-- rotulo de "problema". Os prazos do produto vivem em `src/token/validade.js` e
-- `src/motor/frescor.js`, e repeti-los aqui criaria uma segunda verdade que
-- envelheceria sozinha no primeiro ajuste (memory/patterns.md, "Um numero, uma
-- fonte"). O que olhar esta escrito em `supabase/README.md`.

create or replace view public.saude_das_contas
with (security_invoker = true)
as
select
  c.id                as ig_conta_id,
  c.tenant_id,
  c.username,
  c.status,
  c.conectada_em,

  -- Ultima coleta que deu certo. `ok` e nao "ultimo evento": uma conta que falha
  -- todo dia tem evento recente e coleta parada ha semanas, e e a segunda coisa
  -- que interessa saber.
  ultima_ok.em        as ultima_coleta_ok,
  case
    when ultima_ok.em is null then null
    else (current_date - ultima_ok.em::date)
  end                 as dias_sem_coleta,

  ultima_falha.em     as ultima_falha,
  ultima_falha.status as motivo_da_ultima_falha,

  ultimo_diag.em      as ultimo_diagnostico,
  case
    when ultimo_diag.em is null then null
    else (current_date - ultimo_diag.em::date)
  end                 as dias_sem_diagnostico,

  c.token_expira_em,
  case
    when c.token_expira_em is null then null
    else (c.token_expira_em::date - current_date)
  end                 as dias_ate_o_token_vencer

from public.ig_contas c

left join lateral (
  select e.ocorrido_em as em
    from public.coleta_eventos e
   where e.ig_conta_id = c.id and e.status = 'ok'
   order by e.ocorrido_em desc
   limit 1
) ultima_ok on true

left join lateral (
  select e.ocorrido_em as em, e.status
    from public.coleta_eventos e
   where e.ig_conta_id = c.id and e.status <> 'ok'
   order by e.ocorrido_em desc
   limit 1
) ultima_falha on true

left join lateral (
  select d.gerado_em as em
    from public.diagnosticos d
   where d.ig_conta_id = c.id
   order by d.gerado_em desc
   limit 1
) ultimo_diag on true;

comment on view public.saude_das_contas is
  'Operacao: dias desde a ultima coleta ok, a ultima falha e o ultimo diagnostico. Sem limiar: quem julga e quem le.';

-- O cliente nao alcanca esta view. Ela cruza contas de TODOS os tenants, que e
-- exatamente o que ela precisa fazer para servir de painel — e exatamente o que
-- nao pode chegar ao navegador. `security_invoker` faz a RLS das tabelas de
-- baixo valer para quem consultar; a revogacao de GRANT e a trava que nao
-- depende de eu ter acertado a primeira. Duas travas, como em `token_ref`.
revoke all on public.saude_das_contas from public, anon, authenticated;
grant select on public.saude_das_contas to service_role;
