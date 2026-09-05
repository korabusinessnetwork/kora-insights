# 09 — Backlog

## Fase 0 — Development mode com clientes-teste

### Decisao do dono, levantada pela construcao

- [ ] **Prazo ate o primeiro diagnostico: 16 semanas.** A identidade (pagina 2)
      promete 8 semanas para nomear uma causa; o ruleset 0.3.0 compara 8 semanas
      contra 8 e portanto exige 16. O codigo hoje diz a verdade do motor — o
      numero vem de `src/rules/requisitos.js` e a tela le de la, entao promessa
      e motor nao tem mais como divergir. Mas quatro meses de espera ate o valor
      central contradiz o funil de `docs/13_VENDA`, que faz o diagnostico ao
      vivo numa call de 20 minutos. Tres saidas, e a escolha e do dono:
      1. Aceitar 16 semanas e mudar o discurso de venda: a call vende o metodo e
         o historico proprio, nao o veredito imediato.
      2. Criar uma regra de janela curta (4 contra 4) para os primeiros meses,
         com severidade e confianca menores e a limitacao dita na tela. Vira
         ruleset 0.4.0 com ADR proprio (ADR-005 proibe troca silenciosa).
      3. Investigar quanto historico a Graph API devolve na conexao. Se der para
         retroagir semanas, o prazo cai sem mexer no rigor da regra.
      Enquanto nao decidir, o produto promete 16 e entrega 16.

- [ ] **Usuario em mais de um tenant.** `TenantContexto` pega o primeiro tenant
      da lista e o segundo espaco de trabalho some da interface sem aviso.
      `concluirConexao` ja manda o tenant em foco, entao a conexao funciona; o
      que falta e o seletor de espaco de trabalho. Decidir se a Fase 0 assume um
      tenant por usuario (e declarar isso em contratos.md) ou se o seletor entra.

### Bloqueantes antes de escrever codigo de feature
- [ ] Confirmar ADR-006 (comparacao na Fase 2) com o Matheus
- [ ] Decidir hospedagem: Vercel Pro pago ou alternativa com free tier comercial
- [ ] Escolher gateway e definir se aceita Pix
- [ ] Criar app no painel Meta, converter conta de teste para profissional e
      vincular Pagina do Facebook

### Fundacao
- [x] Projeto Vite + Supabase, schema inicial aplicado
- [x] RLS em toda tabela **com politica** (o esqueleto tinha RLS ligada e zero
      politica, o que nega tudo em silencio)
- [ ] Teste de isolamento entre tenants **com banco de verdade**. O que existe
      hoje (`supabase/politicas.test.js`) le o SQL como texto e cobre o que da
      para cobrir sem subir Postgres; nao substitui o teste de vazamento
- [x] Auth por link magico e onboarding de tenant

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
