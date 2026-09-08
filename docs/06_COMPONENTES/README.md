# 06 — Componentes

> O kit visual de `src/components/shared/`: o que existe, o que cada peça recebe
> e — o mais importante — **quando não usar**. Um catálogo que só lista props
> vira duplicata do JSDoc; este existe para evitar a segunda implementação da
> mesma ideia.
> Última revisão: 2026-09-05.

## O documento

| Documento | O que traz |
|---|---|
| [`catalogo.md`](catalogo.md) | os 14 componentes, com props, estados, tokens que cada um consome e quando **não** usar |

## As cinco regras do kit

1. **Cada componente é um par `Nome.jsx` + `Nome.css`.** Zero estilo no JSX: sem
   `style={{...}}`, sem cor em prop, sem classe utilitária solta.
2. **Estado visual entra por atributo de dado** — `data-severidade`, `data-tom`,
   `data-variante`, `data-tipo`, `data-elevacao` — e o CSS reage. Nenhum `if` de
   JavaScript escolhe cor.
3. **Nenhum componente conhece serviço, rota ou regra de negócio.** Ele recebe
   props e renderiza. Se um componente precisou importar de `src/lib`, a
   fronteira foi violada (`docs/01_ARQUITETURA/overview.md`).
4. **Convenção de classe `ki-<bloco>__<elemento>--<modificador>`**, prefixo `ki-`
   sempre. Sem `!important` fora de `impressao.css`.
5. **Componente não formata número nem calcula variação.** O valor chega
   formatado de quem exibe, e a variação é calculada sobre o valor exibido
   (ADR-008). Kit visual que arredonda por conta própria produz uma tabela que
   discorda dela mesma.

## Os quatro estados obrigatórios

Toda tela renderiza `carregando`, `vazio`, `erro` e `sucesso` (CLAUDE.md). Os
três primeiros passam por `Estado`; o sucesso é a própria tela.

**O vazio é conteúdo, não um encolher de ombros.** A tela sem conta conectada
explica os três passos até o primeiro diagnóstico e diz, com todas as letras,
que não há gráfico de exemplo ali de propósito
(`docs/02_DESIGN_SYSTEM/identidade/02-sem-conta-conectada.png`).

## Acessibilidade — o que o kit já garante

- Cor **nunca** é o único portador de significado: severidade vem com a palavra
  ("Atenção", "Estável"), variação vem com o valor anterior por escrito.
- `GraficoCadencia` publica uma tabela equivalente para leitor de tela — leitor
  de tela não lê SVG, lê tabela.
- `carregando` e `erro` são anunciados por `role` e `aria-live`; `vazio` não é
  anunciado, porque é conteúdo comum e anunciá-lo seria ruído.
- Botão em espera é **desabilitado de verdade**, não só rotulado: prevenir o
  duplo clique vale mais que avisar depois que ele aconteceu.
- Alvo de contraste: AA (4,5:1) para texto corrido, 3:1 para texto grande e
  elementos gráficos. `--kora-osso-600` é o limite inferior de tinta.

## O que NÃO vive aqui

- Tokens, paleta, tipografia e contraste → `docs/02_DESIGN_SYSTEM/TOKENS.md`
- Código dos componentes → `src/components/shared/`
- Quando mostrar cada bloco → `docs/03_REGRAS_DE_NEGOCIO/`
- A tabela de props como contrato entre camadas → `docs/01_ARQUITETURA/contratos.md`, seção 5

## Ligações

- `docs/02_DESIGN_SYSTEM/TOKENS.md` — as três camadas de token e por que
  componente nunca usa `--kora-*` direto
- `docs/02_DESIGN_SYSTEM/identidade/` — as três telas fechadas, fonte de verdade
  visual: quando o diretório e o código divergirem, o código está errado
- `src/styles/impressao.css` — o que `data-bloco` e `data-imprimir` fazem no papel
