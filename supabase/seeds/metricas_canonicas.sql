-- Seed do dicionario canonico de metricas (ADR-003).
--
-- Por que existe uma copia no banco
-- ---------------------------------
-- A definicao viva e `src/metricas/dicionario.js`: e ela que regra, motor e tela
-- leem. Esta tabela existe por um motivo so, e vale a duplicacao: `metrica` em
-- `snapshots_conta` e `snapshots_midia` tem chave estrangeira para ca. Sem a
-- linha, o banco recusa gravar a leitura — e um codigo da Meta vazando para
-- dentro (`reach` em vez de `alcance`) morre no INSERT, no dia em que aconteceu,
-- em vez de virar serie fantasma descoberta meses depois.
--
-- Em caso de divergencia, o arquivo JS vence e este seed e corrigido. Rode-o de
-- novo depois de qualquer mudanca no dicionario: ele e idempotente.
--
--   psql "$DATABASE_URL" -f supabase/seeds/metricas_canonicas.sql
--
-- `descontinuada_em` continua nulo em todas: quando a Meta encerrar uma metrica,
-- a data entra aqui e a serie **nao e apagada nem recalculada** (ADR-003).

insert into public.metricas_canonicas
  (codigo, rotulo, unidade, agregacao, limite_de_agregacao, descontinuada_em)
values
  -- Alcance e a unica com limite de agregacao, porque e a unica em que somar a
  -- janela mente por natureza: a Meta so devolve alcance unico dentro do periodo
  -- pedido, e periodo longo ela nao devolve. A frase e a mesma de
  -- `src/metricas/dicionario.js` — o motor obriga a tela a mostra-la sempre que
  -- somar alcance por janela.
  ('alcance', 'Contas alcançadas', 'contas', 'soma',
   'Somar o alcance de várias semanas conta mais de uma vez quem foi alcançado em ' ||
   'semanas diferentes: a Meta não devolve alcance único de período longo.', null),
  ('visualizacoes', 'Visualizações', 'eventos', 'soma', null, null),
  ('interacoes', 'Interações', 'eventos', 'soma', null, null),
  ('curtidas', 'Curtidas', 'eventos', 'soma', null, null),
  ('comentarios', 'Comentários', 'eventos', 'soma', null, null),
  ('salvamentos', 'Salvamentos', 'eventos', 'soma', null, null),
  ('compartilhamentos', 'Compartilhamentos', 'eventos', 'soma', null, null),
  -- Estoque, nao fluxo: a semana vale o ultimo saldo. Somar sete dias de
  -- seguidores daria sete vezes a conta (contratos.md, secao 2).
  ('seguidores', 'Seguidores', 'contas', 'ultimo', null, null),
  ('visitas_ao_perfil', 'Visitas ao perfil', 'eventos', 'soma', null, null),
  -- Derivada da contagem de midias publicadas no dia: nao vem da Meta e por isso
  -- nenhum adaptador a produz.
  ('publicacoes', 'Publicações', 'publicacoes', 'soma', null, null)
on conflict (codigo) do update set
  rotulo = excluded.rotulo,
  unidade = excluded.unidade,
  agregacao = excluded.agregacao,
  limite_de_agregacao = excluded.limite_de_agregacao,
  descontinuada_em = excluded.descontinuada_em;
