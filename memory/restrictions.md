# Restricoes — Kora Insights

## Restricoes de plataforma (Meta) — as mais duras do projeto
- Insights so existem para contas profissionais que autorizaram o app por OAuth.
  Nao ha caminho oficial para insights de terceiros. O produto so funciona com
  consentimento explicito do dono da conta.
- Dados demograficos de audiencia retornam apenas para a conta autenticada.
- App Review obrigatorio para atender qualquer usuario fora da lista de testers:
  verificacao de negocio com documento, screencast por permissao, politica de
  privacidade e instrucoes de exclusao de dados. Fila tipica de 2 a 4 semanas,
  reiniciada a cada pedido de correcao.
- Em Development mode so operam testers adicionados manualmente no painel Meta
  (ordem de algumas dezenas de contas). Esse e o teto real da Fase 0.
- Toda permissao pedida precisa ter uma tela visivel que a justifique. Pedir
  permissao sem tela correspondente e causa comum de reprovacao.
- Conta precisa ser profissional e vinculada a uma Pagina do Facebook (ADR-002).
- Limite de taxa: 200 chamadas por hora por usuario no `business_discovery`.
- `business_discovery` nao retorna dados de contas com restricao de idade nem de
  contas privadas ou pessoais.
- Metricas mudam sem aviso util. Precedente: junho de 2026, remocao de impressoes
  unicas e alcance do Facebook em todas as versoes da Graph API.

## Restricoes legais
- LGPD: tratamos dado pessoal de terceiros (audiencia dos clientes). Exige base
  legal declarada, politica de privacidade publicada e exclusao de dados a pedido,
  o que a Meta ja exige de qualquer forma no review.
- Meta Platform Terms: proibido revender dado bruto da plataforma. Vendemos a
  interpretacao, nunca o dado cru de terceiros.
- Token de terceiro nunca no front, nunca em log, nunca em URL.

## Restricoes de custo (fase bootstrap)
- Tudo em tier gratuito ate haver receita. Supabase Pro e Vercel Pro adiados.
- Vercel Hobby veda uso comercial: bloqueante antes da primeira cobranca.
- Pagos ja aprovados: dominio e gateway de pagamento.

## Restricoes de produto
- Nenhum diagnostico calculado na tela (ADR-005).
- Nenhuma metrica gravada com o nome da Meta (ADR-003).
- Limite de dado sempre explicito na interface. O que a API nao entrega, a tela diz.
