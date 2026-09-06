# 01 — Arquitetura

> Índice. O conteúdo está nos dois arquivos abaixo.
> Última revisão: 2026-09-06.

| Arquivo | O que responde |
|---|---|
| `overview.md` | Stack, fronteiras, o caminho do dado ponta a ponta, ambientes |
| `contratos.md` | O que atravessa fronteira de módulo: envelope, dicionário de métricas, formato do achado, assinaturas da camada de serviços, kit visual, rotas e banco |

`contratos.md` é o documento que **muda junto com o código**: quem alterar uma
assinatura que atravessa camada atualiza os dois no mesmo commit.

## Fora daqui

- Decisão formalizada e o porquê dela → `../08_DECISOES/` (ADRs)
- Regra de negócio → `../03_REGRAS_DE_NEGOCIO/`
- Schema e RLS em detalhe → `../04_MODELAGEM/`
- Cor, tipografia e contraste → `../02_DESIGN_SYSTEM/`
