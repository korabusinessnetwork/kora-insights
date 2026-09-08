# ADR-007 — Modo de demonstracao com fixture deterministica

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
Na Fase 0 nao existe app da Meta aprovado, nao existe cliente conectado e o
Development mode so atende testers adicionados a mao. Ao mesmo tempo, tres coisas
precisam de tela cheia de dado **antes** do primeiro cliente: o desenvolvimento
diario, a call de venda de 20 minutos (`docs/13_VENDA`) e o screencast exigido
pelo App Review.

A saida obvia — telas com numero chumbado no componente — envenena o produto:
cria um segundo caminho de renderizacao que ninguem mantem, e principalmente
permite que um veredito exista sem ter saido do motor, o que contraria o ADR-005.

## Decisao
Sem `VITE_SUPABASE_URL` configurada, `src/lib` serve um repositorio local de
fixtures (`src/lib/demonstracao/`) **atras do mesmo contrato** da camada de
servicos. Quem consome nao sabe em qual dos dois esta; so `meta.origem` diz.

Duas regras fecham a decisao:

1. **O diagnostico da demonstracao sai do motor real.** A fixture entrega serie de
   snapshot, nao veredito. A frase vem de `gerarDiagnostico` sobre `src/rules`,
   igual em producao. Nao existe texto de veredito escrito a mao no produto.
2. **A tela diz que e demonstracao**, de forma permanente e visivel. Dado de
   exemplo apresentado como dado do cliente e exatamente a desonestidade que
   `memory/identity.md` proibe.

A fixture e deterministica: sem `Math.random`, sem relogio. Fixture que muda
sozinha nao serve de base para teste.

## Alternativas
- **Seed em Supabase local:** exige Docker e um banco de pe para abrir a tela.
  Perde o uso em call de venda, que e o cenario mais importante. Descartada.
- **Numero chumbado no componente:** rapido, e cria a mentira acima. Descartada.

## Consequencias
- Positivas: o app roda com `npm run dev` e nada mais. A mesma fixture vira teste
  de regressao da identidade visual: os numeros da Casa Oliveira (1,8 contra 3,0
  publicacoes; 26.900 contra 41.200 de alcance; 2.240 contra 2.290 por publicacao)
  estao travados em teste, e quebra-los quebra a suite.
- Negativas: uma segunda implementacao do repositorio para manter em sincronia
  com o contrato. Mitigacao: as duas vivem em `src/lib`, e o contrato esta escrito
  em `docs/01_ARQUITETURA/contratos.md`.
- Regra: fixture nunca cobre so o caminho feliz. As tres contas existem para
  cobrir os tres desfechos — causa nomeada, conta saudavel com lacuna de coleta,
  e historico curto demais para opinar.
