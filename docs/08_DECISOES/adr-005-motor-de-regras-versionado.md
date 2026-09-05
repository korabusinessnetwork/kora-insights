# ADR-005 — Motor de regras versionado (o metodo como codigo)

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
O diferencial do produto nao e o grafico, e a interpretacao: os padroes da
Atmosfera Viral aplicados ao dado da marca. Se essa logica ficar espalhada em
componentes de tela, ela nao e auditavel, nao evolui com seguranca e nao e o ativo
que se pretende que seja.

## Decisao
Os padroes vivem em um **ruleset versionado** (arquivos declarativos em
`src/rules/`, com versao semantica). O motor le o historico canonico, aplica o
ruleset e grava um registro em `diagnoses` com `ruleset_version`.

## Consequencias
- Positivas: e possivel responder "o diagnostico mudou porque a conta mudou ou
  porque a regra mudou?". Regras podem ser testadas contra historico real antes de
  ir ao ar. O metodo vira ativo transferivel, nao conhecimento tacito.
- Negativas: exige disciplina de versionamento e uma suite de testes com contas
  reais anonimizadas.
- Regra: nenhum diagnostico e calculado na tela. A tela le `diagnoses`.
- Regra: mudanca de ruleset nunca reescreve diagnostico passado.
