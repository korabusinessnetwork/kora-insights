# 11 — Segurança

> O produto guarda a credencial de acesso à conta de outra empresa. Isso é o dado
> mais sensível que ele toca, e é a partir daí que todo o resto foi desenhado.
> Última revisão: 2026-09-05.

## Os dois documentos

| Documento | O que traz |
|---|---|
| [`plano.md`](plano.md) | superfície de ataque, onde vive cada segredo, o que nunca pode ser logado e o checklist de PR |
| [`app-review.md`](app-review.md) | o que a Meta exige para liberar o app, o roteiro do screencast e o prazo realista |

## Classificação do dado

| Dado | Sensibilidade | Tratamento |
|---|---|---|
| Token OAuth da Meta | **Crítico** | Supabase Vault. Nunca no front, em log ou URL. A tabela guarda só a referência, e `token_ref` está fora de todo `grant` para `authenticated` |
| E-mail do usuário do produto | Pessoal (LGPD) | `auth.users`, gerido pelo Supabase Auth. Login por link mágico: não há senha para vazar |
| Métricas da conta do cliente | Confidencial | isolado por RLS derivada de `tenant_membros` |
| Diagnóstico gerado | Confidencial | isolado por RLS |
| Protocolo de exclusão | Confidencial | guarda contagem, **nunca conteúdo** |

**Nota de correção.** A versão anterior deste documento listava "demografia
agregada de audiência" como dado tratado. Hoje o produto **não coleta nenhum dado
demográfico**: as métricas pedidas à Graph API são alcance, visualizações,
interações, visitas ao perfil, seguidores, salvamentos, compartilhamentos,
curtidas e comentários — todas agregadas, nenhuma individual. Se a demografia
entrar um dia, mudam a base legal, o texto da política de privacidade e o pedido
do App Review (`docs/03_REGRAS_DE_NEGOCIO/conformidade.md`, seção 1).

## As três fronteiras que sustentam tudo

1. **O token nunca cruza para cima.** Ele vive no Vault e só é lido pela Edge
   Function com `service_role`.
2. **O diagnóstico nunca é calculado embaixo do usuário.** O motor roda no
   servidor e grava com `ruleset_version`; a tela lê.
3. **O nome da Meta morre na porta de entrada.** O adaptador traduz antes de
   qualquer gravação.

As três são de `docs/01_ARQUITETURA/overview.md`, e as três também são controles
de segurança: elas reduzem o que o front tem poder de fazer.

## Ligações

- `docs/04_MODELAGEM/esquema.md` — a estratégia de RLS e de `grant` por coluna
- `docs/07_APIS/edge-functions.md` — autorização de cada função
- `docs/03_REGRAS_DE_NEGOCIO/conformidade.md` — LGPD e Meta Platform Terms
- `supabase/README.md` — o roteiro manual de teste de isolamento entre tenants
- `memory/restrictions.md` — os limites que não são negociáveis
