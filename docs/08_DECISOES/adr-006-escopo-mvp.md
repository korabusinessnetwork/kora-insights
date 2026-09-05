# ADR-006 — Comparacao com concorrentes fica para a Fase 2

**Status**: Proposto (assumido no intake, confirmar com Matheus) · **Data**: 2026-09-05

## Contexto
O intake elegeu tres entregas de valor: diagnostico, comparacao com concorrentes e
relatorio para o cliente. A comparacao depende de `business_discovery`, que traz
custo proprio: limite de 200 chamadas por hora por usuario, necessidade de cache,
job separado, tela nova, e uma expectativa perigosa, porque o endpoint devolve
apenas metadado publico e engajamento visivel, sem alcance, salvamento ou
demografia do concorrente.

## Decisao
MVP entrega **diagnostico e relatorio**. Comparacao entra na Fase 2, ja viabilizada
pela escolha de ADR-002.

## Consequencias
- Positivas: MVP menor, App Review com menos permissoes para justificar, foco no
  que e diferencial.
- Negativas: perde um argumento de venda forte no primeiro contato.
- Regra para quando entrar: a tela precisa dizer com todas as letras o que nao e
  possivel saber do concorrente. Prometer comparacao completa e quebrar promessa.
