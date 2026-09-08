# 07 — APIs

> O Kora Insights **não publica uma API**. As interfaces que existem são duas: a
> Graph API da Meta, que consumimos, e as Edge Functions, que o próprio produto
> chama. Este diretório documenta as duas.
> Última revisão: 2026-09-05.

## Os dois documentos

| Documento | O que traz |
|---|---|
| [`graph-api.md`](graph-api.md) | as chamadas que realmente fazemos, as permissões do ADR-002 e a tela que justifica cada uma, limite de taxa e classificação de erro |
| [`edge-functions.md`](edge-functions.md) | contrato de cada função: quem chama, o que aceita, o que devolve, que variável de ambiente exige |

## Onde mora o resto do contrato

| Pergunta | Documento |
|---|---|
| Assinatura das funções de `src/lib/` e formato do envelope | `docs/01_ARQUITETURA/contratos.md`, seção 1 e 4 |
| Códigos de erro estáveis e a frase pt-BR de cada um | `contratos.md`, seção 1, e `src/lib/erros.js` |
| Formato de `Historico`, `Achado` e `Diagnostico` | `contratos.md`, seção 3 |
| Rotas do front | `contratos.md`, seção 6 |
| Tabelas e RLS | `docs/04_MODELAGEM/esquema.md` |

## O envelope, e por que ele atravessa a fronteira

Toda função de `src/lib/` devolve `Promise<Envelope>` — `{ data, error, meta }`,
inclusive em sucesso. **As Edge Functions respondem no mesmo envelope**, e isso
não é simetria estética: é o que permite ao front distinguir `TOKEN_EXPIRADO` de
`LIMITE_DE_TAXA`, dois estados que só quem fala com a Graph API sabe nomear e
que virariam `FALHA_INESPERADA` se a função respondesse um erro cru.

```json
{
  "data": { "...": "..." },
  "error": null,
  "meta": { "carimbo": "2026-09-05T07:00:00.000Z", "versao": "1", "origem": "supabase" }
}
```

Em falha, `data` é `null` e `error` traz `{ codigo, mensagem }`. O `codigo` é
estável entre versões e é por ele que a tela decide; a `mensagem` é pt-BR e é o
que o cliente lê.

| Código | HTTP na Edge Function |
|---|---|
| `ENTRADA_INVALIDA` | 400 |
| `SEM_SESSAO` | 401 |
| `SEM_PERMISSAO` | 403 |
| `NAO_ENCONTRADO` | 404 |
| `TOKEN_EXPIRADO` | 409 |
| `SEM_DADO_SUFICIENTE` | 409 |
| `LIMITE_DE_TAXA` | 429 |
| `FALHA_INESPERADA` | 500 |
| `FALHA_DE_REDE` | 502 |

## Regras que valem para qualquer chamada, dos dois lados

- **Nenhum `select *`.** Campos explícitos, e as listas espelham o `grant` por
  coluna do schema.
- **Toda entrada é validada na borda**, antes de tocar o banco ou a rede.
- **Nenhuma mensagem crua do Postgres ou da Meta chega à tela**: ela nomeia
  tabela, coluna, id interno e formato de schema.
- **Nenhum log de payload.** O token viaja no cabeçalho `Authorization`, nunca na
  query — URL vai para log de proxy, histórico e relatório de erro.
- **Versão da API nunca é literal no código.** Ela vive dentro de
  `META_GRAPH_URL` (servidor) e de `VITE_META_OAUTH_URL` (front): no dia da
  próxima depreciação, quem troca é o ambiente.

## Ligações

- `docs/08_DECISOES/adr-002` — por que a variante com Facebook Login
- `docs/08_DECISOES/adr-003` — por que nenhum nome de métrica da Meta é persistido
- `docs/05_FLUXOS/` — a sequência em que estas chamadas acontecem
- `docs/11_SEGURANCA/app-review.md` — o que a Meta exige para liberar cada permissão
