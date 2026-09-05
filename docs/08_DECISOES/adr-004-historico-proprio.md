# ADR-004 — Snapshot diario e historico proprio desde o dia 1

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
A Graph API tem janelas curtas de retencao para varias metricas e nao devolve o
passado de antes da conexao. Quem nao guarda desde o inicio nunca recupera.

## Decisao
Edge Function agendada faz snapshot diario por conta conectada, gravando estado da
conta e das midias ativas em tabelas append-only.

## Consequencias
- Positivas: o historico e o ativo de retencao do produto. Quanto mais tempo o
  cliente fica, mais caro fica sair. E a base de qualquer diagnostico de tendencia.
- Negativas: crescimento continuo de dados (estimado em ~12 KB por conta por dia,
  ver doc 12) e dependencia de um job que nao pode falhar em silencio.
- Regra: falha de coleta gera registro visivel e o dashboard sinaliza lacuna de
  dado. Serie com buraco nao invisibiliza o buraco.
- O cliente pode exportar o proprio historico a qualquer momento (valor: sem lock-in).
