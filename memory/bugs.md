# Registro de Bugs — Kora Insights

> Bugs que chegaram a **produção**. Hoje não há nenhum, porque não há produção:
> o produto está na Fase 0, sem cliente conectado. Este arquivo já existe com a
> forma final para que o primeiro bug seja registrado do jeito certo, e não
> improvisado numa mensagem que se perde.
> Última revisão: 2026-09-06.

## O que entra aqui

- Bug em código que afeta uso real. Erro de operação do usuário, não.
- Defeito achado em revisão, antes de existir cliente, **não entra aqui**: ele
  vira correção no mesmo commit e, quando ensina algo, linha em `learnings.md`.
  Foi o caso dos 27 achados da revisão de 2026-09-06.

## Severidade

| Nível | Critério | Resposta |
|---|---|---|
| CRÍTICA | perda de dado, vazamento entre tenants, o produto afirmando algo falso ao cliente | 1h para analisar, 4h para corrigir |
| ALTA | operação travada com contorno possível | 1 dia / 2 dias |
| MÉDIA | impacto limitado ou raro | 1 semana |
| BAIXA | cosmético | backlog, sem prazo |

**"O produto afirmando algo falso ao cliente" é CRÍTICA neste produto**, não
ALTA. Um diagnóstico errado lido em voz alta numa reunião custa o cliente e o
cliente dele. É a única categoria de bug que ameaça a tese inteira.

## Estados

`aberto` → `em_analise` → `em_correcao` → `corrigido` → (`reaberto`)
`wontfix` exige motivo escrito e aprovação do dono.

---

## CRÍTICA

_Nenhum registro._

## ALTA

_Nenhum registro._

## MÉDIA

_Nenhum registro._

## BAIXA

_Nenhum registro._

---

## Template de report

```markdown
## BUG-NNN: <título em uma linha>

**Severidade**: CRÍTICA / ALTA / MÉDIA / BAIXA
**Módulo**: motor / métricas / serviços / coleta / tela X

**O que acontece** / **o que deveria acontecer**

**Como reproduzir**
1. …

**Impacto**: quantas contas, qual operação, o diagnóstico saiu errado?

**Contexto**: navegador, data e hora, conta afetada (id, nunca o token)

**Contorno**, se existe
```

## Post-mortem

Obrigatório para toda CRÍTICA. Três campos e nenhuma busca por culpado: causa
raiz, o que a deixou passar, e a mudança que impede a repetição — de preferência
um teste, porque teste é a única prevenção que não depende de memória.

| Bug | Data | Causa raiz | Prevenção | ADR |
|---|---|---|---|---|
| _nenhum_ | | | | |
