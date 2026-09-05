# 03 — Regras de negócio

> O que o produto **precisa** fazer, o que ele **nunca** pode fazer e o que ele é
> **obrigado a declarar** que não sabe. Regra escrita aqui prevalece sobre código
> (CLAUDE.md); código que discorda é bug, e documento que discorda da realidade é
> dívida — os dois se corrigem, nesta ordem.
> Última revisão: 2026-09-05.

## Os quatro documentos

| Documento | O que decide |
|---|---|
| [`modulo-diagnostico.md`](modulo-diagnostico.md) | quando um diagnóstico pode existir, o que a semana incompleta faz, o que a tela é obrigada a declarar |
| [`modulo-conexao.md`](modulo-conexao.md) | ciclo de vida da conta conectada, do consentimento à exclusão |
| [`modulo-assinatura.md`](modulo-assinatura.md) | plano, cobrança, o teto real da Fase 0 e o que acontece ao cancelar |
| [`conformidade.md`](conformidade.md) | LGPD e Meta Platform Terms em verificação, não em prosa |

## Como uma regra é escrita aqui

Em pseudocódigo verificável, com o nome real do campo, do status e da função.
Uma regra que não dá para conferir contra o banco ou contra `src/rules/` é
opinião, e opinião não prevalece sobre nada.

```
SE conta.status <> 'ativa' ENTAO
  a coleta do dia NAO roda para esta conta
FIM
```

Número não é escolhido aqui: ele vem de `src/rules/0.3.0/`, de
`supabase/schema.sql` ou de `docs/12_CUSTO_E_PRECIFICACAO`, e cada um cita a
origem. Onde a decisão ainda não foi tomada, está escrito **"não decidido"** e
onde ela vai morar.

## O que NÃO vive aqui

- Assinatura de função e formato de objeto → `docs/01_ARQUITETURA/contratos.md`
- Tabelas, colunas e RLS → `docs/04_MODELAGEM/`
- Sequência de chamadas → `docs/05_FLUXOS/`
- Props e estados de componente → `docs/06_COMPONENTES/`
- Justificativa de uma decisão de arquitetura → `docs/08_DECISOES/`

## As três regras que atravessam todos os módulos

1. **Nenhum diagnóstico é calculado na tela.** A tela lê `diagnosticos`
   (ADR-005). Número que aparece na interface e não existe no registro gravado é
   número que ninguém consegue auditar depois.
2. **Nenhuma métrica é gravada ou exibida com o nome da Meta** (ADR-003). O
   vocabulário do produto é o dicionário canônico de `src/metricas/`.
3. **Lacuna de dado nunca some da tela.** O que a API não entrega vira limite
   explícito (`memory/identity.md`, valor "honestidade de dado").

## Ligações

- `docs/00_VISAO/` — a fronteira do produto ("o que o produto NÃO faz")
- `docs/08_DECISOES/` — ADR-002 a ADR-008, as decisões que estas regras aplicam
- `memory/restrictions.md` — os limites de plataforma, legais e de custo
- `src/rules/README.md` — como uma regra nova nasce em código
