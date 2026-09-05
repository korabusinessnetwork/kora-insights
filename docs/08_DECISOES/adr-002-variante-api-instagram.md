# ADR-002 — Instagram API with Facebook Login (e nao Instagram Login)

**Status**: Aceito · **Data**: 2026-09-05 · **Decisores**: Matheus Bonato

## Contexto
A Meta oferece duas variantes de acesso a conta profissional: Instagram API with
Facebook Login e Instagram API with Instagram Login. A segunda tem onboarding mais
simples, pois dispensa a Pagina do Facebook. Mas o endpoint `business_discovery`,
que permite consultar dados publicos de outras contas profissionais e viabiliza a
comparacao com concorrentes do roadmap (Fase 2), existe apenas na variante com
Facebook Login.

## Decisao
Adotar **Instagram API with Facebook Login**. Toda conta conectada precisa ser
profissional (Business ou Creator) e estar vinculada a uma Pagina do Facebook.

## Alternativas
- **Instagram Login puro:** onboarding mais curto, mas fecha a porta da Fase 2 e
  exigiria migracao com re-consentimento de todos os clientes depois. Descartada.
- **API paga de terceiro para dados publicos:** custo recorrente e area cinzenta
  frente aos termos da Meta. Descartada.

## Consequencias
- Positivas: um unico fluxo de consentimento cobre Fase 0 e Fase 2.
- Negativas: a exigencia de Pagina do Facebook vinculada e fricao real no
  onboarding. Mitigacao obrigatoria: a tela de conexao deve explicar o requisito
  antes do clique, com passo a passo, e o suporte deve medir quantos clientes
  travam nesse ponto. Se a fricao for alta, reavaliar o escopo da Fase 2.

## Permissoes envolvidas (Advanced Access, todas sujeitas a review)
`instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
`pages_read_engagement`. Nao pedir `instagram_content_publish` nem
`instagram_manage_comments`: nao ha tela que as justifique, e permissao sem tela
correspondente e motivo classico de reprovacao.
