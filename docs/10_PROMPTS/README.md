# 10 — Prompts

> Última revisão: 2026-09-06.

## Antes de tudo: não há modelo de linguagem no caminho do diagnóstico

O veredito que o cliente lê **não é gerado por IA**. Ele sai de um motor de
regras determinístico e versionado (`src/rules/`, ADR-005), e essa é uma
decisão de produto, não uma limitação técnica a superar depois.

Três razões, e vale relê-las antes de qualquer proposta de "colocar IA aqui":

1. **Auditabilidade.** Todo diagnóstico grava a versão de regra que o gerou.
   Meses depois dá para responder se o veredito mudou porque a conta mudou ou
   porque o método mudou. Um modelo devolve texto diferente para a mesma
   entrada e essa pergunta deixa de ter resposta.
2. **É o ativo.** O que se vende é o método da Atmosfera Viral aplicado ao dado
   da marca. Método em regra versionada é ativo transferível; método delegado a
   um modelo de terceiro é aluguel.
3. **Confiabilidade da afirmação.** O produto diz "sua frequência caiu 40%" numa
   reunião. Um número alucinado custa o cliente e o cliente dele. Regra pura,
   testada contra série real, não inventa número.

Se um dia entrar modelo, entra **fora** do caminho do veredito — por exemplo
para reescrever a mesma conclusão em outro tom — e entra por ADR, com a
fronteira escrita.

## O que vive aqui, então

Os prompts que **constroem** o produto, não os que ele executa. São instruções
para o Claude Code trabalhar neste repositório sem quebrar o que a fundação
decidiu.

O prompt permanente já existe e é a própria `CLAUDE.md`: princípio nº 1,
fronteiras de camada, regras de segurança e padrões de código. Quem for pedir
código para uma IA neste projeto começa mandando ela ler `CLAUDE.md` e
`docs/01_ARQUITETURA/contratos.md`.

## Arquivos, quando existirem

- `revisao.md` — as lentes da revisão adversarial que já pegou 27 defeitos numa
  suíte verde: invariantes da fundação, segurança e isolamento, identidade e
  acessibilidade, corretude do motor. Registrar aqui quando forem reusadas.
- `construcao.md` — briefings por camada, com dono exclusivo por diretório.

## O que aprendemos usando IA para construir isto

Está em `memory/learnings.md`, seção Processo. Em uma linha: fan-out paralelo
funciona para construir e falha para integrar — cada agente valida a própria
peça e ninguém valida a junção. O passo "sintetizar e VALIDAR no fim" da
`CLAUDE.md` não é formalidade, e inclui rodar o app de verdade.

## Ligações

- `CLAUDE.md` — o prompt permanente do projeto
- `docs/08_DECISOES/adr-005-motor-de-regras-versionado.md` — por que regra e não modelo
- `memory/learnings.md` — o que a construção ensinou
