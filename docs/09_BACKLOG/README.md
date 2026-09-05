# 09 — Backlog

## Fase 0 — Development mode com clientes-teste

### Bloqueantes antes de escrever codigo de feature
- [ ] Confirmar ADR-006 (comparacao na Fase 2) com o Matheus
- [ ] Decidir hospedagem: Vercel Pro pago ou alternativa com free tier comercial
- [ ] Escolher gateway e definir se aceita Pix
- [ ] Criar app no painel Meta, converter conta de teste para profissional e
      vincular Pagina do Facebook

### Fundacao
- [ ] Projeto Vite + Supabase, schema inicial aplicado
- [ ] RLS em toda tabela + teste de isolamento entre tenants
- [ ] Auth e onboarding de tenant

### Integracao Meta
- [ ] Fluxo OAuth (Instagram API with Facebook Login)
- [ ] Tela de conexao explicando o requisito da Pagina do Facebook ANTES do clique
- [ ] Token no Vault, refresh antes do vencimento, aviso de reconexao
- [ ] Dicionario de metricas canonicas + primeiro adaptador (ADR-003)

### Coleta e historico
- [ ] Edge Function de snapshot diario (ADR-004)
- [ ] Registro de falha de coleta e sinalizacao de lacuna na tela

### Motor de regras
- [ ] Estrutura do ruleset versionado (ADR-005)
- [ ] Primeiras regras do metodo Atmosfera Viral, com teste sobre historico real
- [ ] Persistencia em `diagnosticos` com `ruleset_version`

### Produto
- [ ] Tela de diagnostico (o aha: causa nomeada, nao serie)
- [ ] Export de relatorio a partir do mesmo diagnostico
- [ ] Cobranca e ciclo de assinatura

### Preparacao do App Review (roda em paralelo, nao no fim)
- [ ] Politica de privacidade publicada
- [ ] Endpoint e fluxo de exclusao de dados
- [ ] Screencast por permissao, gravado com cliente-teste real
- [ ] Verificacao de negocio no Meta Business Manager (exige CNPJ)

## Fase 1
- [ ] Submissao ao App Review e abertura publica

## Fase 2
- [ ] Comparacao com concorrentes via business_discovery, com limites explicitos na tela

## Fase 3
- [ ] White-label para agencias
