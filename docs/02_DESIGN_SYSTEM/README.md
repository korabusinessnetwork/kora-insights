# 02 — Design system

> Índice. Fonte única de verdade visual do produto.
> Última revisão: 2026-09-06.

| Arquivo | O que responde |
|---|---|
| `TOKENS.md` | Paleta, contraste medido, tipografia, espaçamento, movimento e white-label |
| `identidade/` | As três telas fechadas entregues pelo dono, e o PDF original |

Implementação: `src/styles/tokens.css` (três camadas), `base.css` (reset, foco,
acessibilidade) e `impressao.css` (a folha A4 do relatório).

## Duas regras que valem acima de gosto

1. **Componente nunca usa primitiva `--kora-*` direto.** Se precisou, falta uma
   semântica — e a falta é o defeito, não a exceção.
2. **A tabela de contraste não é escrita à mão.** `src/styles/contraste.test.js`
   lê a paleta do CSS e reprova a suíte quando um par cai abaixo de AA.

Quando `identidade/` e o código divergirem, o código está errado — com uma
exceção registrada em `TOKENS.md`: onde a identidade fica abaixo do mínimo de
contraste, a acessibilidade vence e a divergência fica anotada.

## Fora daqui

- Código dos componentes → `src/components/shared/`
- Catálogo do kit, com props e quando não usar → `../06_COMPONENTES/catalogo.md`
- Fluxos de interação → `../05_FLUXOS/`
