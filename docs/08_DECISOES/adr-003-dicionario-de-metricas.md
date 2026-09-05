# ADR-003 — Dicionario de metricas proprio com adaptadores por versao

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
As metricas da Meta sao instaveis. Em junho de 2026 a Meta removeu as metricas de
impressoes unicas e alcance do Facebook em todas as versoes da Graph API,
orientando migracao para `mediaView`. O Instagram vinha na mesma direcao, com
`views` substituindo `impressions`. Um produto que grave metrica com o nome que a
Meta usa quebra schema, dashboard e regras de diagnostico de uma vez a cada
depreciacao.

## Decisao
Nenhuma metrica e persistida com o nome da Meta. Definimos um **dicionario canonico
interno** (`alcance`, `visualizacoes`, `interacoes`, `salvamentos`, `seguidores`,
...) e uma camada de **adaptadores por versao da API** que traduz o payload da Meta
para o canonico na entrada.

## Consequencias
- Positivas: uma depreciacao vira troca de adaptador, nao migracao de schema.
  Historico permanece comparavel ao longo do tempo.
- Negativas: uma camada a mais de indirecao e a obrigacao de versionar adaptadores.
- Regra: todo snapshot grava a versao da API e a versao do adaptador usados. Sem
  isso, nao ha como saber se uma quebra de serie e mudanca de comportamento da
  conta ou mudanca de definicao da Meta.
- Quando uma metrica deixa de existir, a serie **nao e apagada nem recalculada**.
  Ela e encerrada com data e o dashboard mostra a descontinuidade explicitamente.
