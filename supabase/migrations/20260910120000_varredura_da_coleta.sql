-- A VARREDURA DIARIA: quem ela toca, e quem ela pode coletar.
--
-- Ate aqui a coleta perguntava `where status = 'ativa'`, e a renovacao do token
-- morava dentro dela (ADR-009). As duas coisas juntas produziam uma perda
-- silenciosa: conta `pausada` nao era varrida, entao o token dela envelhecia ate
-- morrer. Uma pausa de mais de 60 dias virava desconexao de fato — o cliente
-- volta, precisa reconectar, e os meses que ele achava estar guardando pararam
-- de crescer sem ninguem dizer nada. Num produto que exige 16 semanas continuas
-- para nomear uma causa, isso e o dano central (ADR-004).
--
-- Pausar e o cliente decidindo parar a COLETA. Nao e ele soltando a conexao —
-- para isso existe `desconectar-conta`, que apaga o segredo do cofre. Entao a
-- pausa entra na varredura, e entra sem coletar: o token continua sendo trocado,
-- e a porta fica destrancada para quando ele voltar.
--
-- Por que uma view, e nao um `in (...)` dentro da Edge Function:
--
--   1. A regra passou a ter duas partes ("quem e varrido" e "quem pode ser
--      coletado") e elas se contradizem em silencio se cada uma morar num lugar.
--   2. Nao ha Deno no CI, entao Edge Function nao tem teste automatizado
--      (`supabase/testes/README.md`). O que da para provar sobre elas e o que o
--      banco lhes garante — e agora a lista que a varredura recebe e uma dessas
--      coisas, com asserção em Postgres de verdade (`50-varredura.sql`).
--
-- Quem fica de fora, e por que:
--
--   `desconectada`   o cliente desligou, e `desconectar-conta` ja apagou o
--                    segredo do cofre. Nao ha token para trocar; a tentativa
--                    gastaria chamada para falhar.
--   `token_expirado` o token ja morreu, e `fb_exchange_token` so aceita token
--                    longo DENTRO da validade. A saida dessa conta e a
--                    reconexao, que a tela ja pede.

create or replace view public.contas_da_varredura
with (security_invoker = true)
as
select
  c.id,
  c.tenant_id,
  c.ig_user_id,
  c.token_ref,
  c.status,
  c.token_expira_em,
  c.conectada_em,

  -- A segunda metade da regra. `pausada` aparece na lista com `false`: a
  -- varredura passa por ela para manter o token vivo e nao grava snapshot
  -- nenhum. Coletar uma conta pausada desfaria a decisao do cliente.
  (c.status = 'ativa') as coletar

from public.ig_contas c
where c.status in ('ativa', 'pausada');

comment on view public.contas_da_varredura is
  'A lista que a coleta diaria varre: ativa para coletar, pausada so para renovar o token (ADR-009).';

-- Esta view carrega `token_ref`, que e a coluna que o schema tira do alcance do
-- cliente com `grant` por coluna. View comum roda com os privilegios do dono e
-- devolveria a referencia do cofre de TODOS os tenants a quem consultasse.
-- Duas travas, como em `saude_das_contas`: `security_invoker` faz a RLS das
-- tabelas de baixo valer para quem consulta, e o `revoke` e a que nao depende de
-- eu ter acertado a primeira.
revoke all on public.contas_da_varredura from public, anon, authenticated;
grant select on public.contas_da_varredura to service_role;
