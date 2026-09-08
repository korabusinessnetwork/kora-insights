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
- [x] **Hospedagem decidida: Cloudflare Pages** (ADR-010). Gratuito com uso
      comercial permitido, sem teto de banda. Configuracao no repositorio:
      `public/_headers`, `.node-version` e o passo de CI que cobra o modo SPA
- [ ] **Content-Security-Policy.** Ficou de fora do `_headers` de proposito: ela
      precisa do host do Supabase, que muda por ambiente, e uma CSP com host
      errado bloqueia o login em producao sem erro visivel. Entra gerada no build
      a partir de `VITE_SUPABASE_URL`, quando houver projeto definitivo
- [x] **Deploy automatizado**: `.github/workflows/publicar.yml` publica no
      Cloudflare Pages a cada push na `main`, cria o projeto na primeira
      execucao e repete a conferencia de modo SPA sobre o artefato que vai ao ar
- [ ] **Dois segredos no GitHub para o deploy ligar**: `CLOUDFLARE_API_TOKEN`
      (escopo Account → Cloudflare Pages → Edit) e `CLOUDFLARE_ACCOUNT_ID`. Sem
      eles o workflow avisa e passa, em vez de reprovar a main
- [ ] Depois do primeiro deploy, apontar `VITE_META_REDIRECT_URI` (segredo do
      GitHub), `KORA_REDIRECIONAMENTOS_PERMITIDOS` e `KORA_ORIGENS_PERMITIDAS`
      (secrets do Supabase) para o dominio novo — as tres falham em uso, nunca
      no build
- [ ] Escolher gateway e definir se aceita Pix
- [ ] Criar app no painel Meta, converter conta de teste para profissional e
      vincular Pagina do Facebook

### Fundacao
- [x] Projeto Vite + Supabase, schema inicial aplicado
- [x] RLS em toda tabela **com politica** (o esqueleto tinha RLS ligada e zero
      politica, o que nega tudo em silencio)
- [x] Teste das funcoes do cofre (`guardar_token`, `ler_token`, `apagar_token`)
      no mesmo Postgres efemero. Elas nunca tinham rodado em teste nenhum, e a
      renovacao do token (ADR-009) depende de `guardar_token` devolver a MESMA
      referencia para o mesmo nome — se criasse uma nova, `token_ref` apontaria
      para o segredo velho a cada renovacao e a coleta leria um token vencido
      achando que leu o novo. Sabotado, o teste reprova com codigo 3
- [x] Teste de isolamento entre tenants **com banco de verdade**
      (`./scripts/testar-isolamento.sh`, tambem no CI). Sobe um Postgres
      efemero, aplica as migrations reais sobre um stub minimo do Supabase e
      faz 22 asserções contando linha com o papel `authenticated` e a
      identidade trocada pelo mesmo `request.jwt.claims` que o Supabase usa.
      Verificado nos dois sentidos: com uma politica sabotada para
      `using (true)`, ele reprova com "esperado 1, obtido 2"
- [x] Auth por link magico e onboarding de tenant

### Integracao Meta
- [x] Fluxo OAuth (Instagram API with Facebook Login), com estado de uso unico e
      `redirect_uri` conferida contra lista do ambiente
- [x] Tela de conexao explicando o requisito da Pagina do Facebook ANTES do clique
- [x] Token no Vault, **refresh antes do vencimento** e aviso de reconexao. A
      coleta troca o token a 15 dias do prazo e a tela pede reconexao a 7
      (ADR-009). O aviso e o ultimo recurso: se ele aparece, a renovacao ja teve
      mais de uma semana de tentativas
- [x] Dicionario de metricas canonicas + primeiro adaptador (ADR-003)
- [x] Desconectar sem excluir: `desconectar-conta` escrita e as duas saidas
      lado a lado em `/dados`. Antes, so a exclusao era oferecida — quem queria
      parar a coleta tinha de apagar meses de historico
- [ ] **Conta `pausada` nao renova token.** A renovacao vive dentro da coleta, e
      a coleta so varre `ativa`. Uma pausa de mais de 60 dias mata o token e a
      pausa vira desconexao de fato. Divida aberta por ADR-009; a saida provavel
      e varrer tambem `pausada` so para renovar

### Coleta e historico
- [x] Edge Function de snapshot diario (ADR-004)
- [x] Registro de falha de coleta e sinalizacao de lacuna na tela
- [ ] Avisar o cliente quando uma falha de coleta ameacar o proximo diagnostico.
      Hoje a lacuna aparece depois; cinco dias perdidos ja custam a semana inteira

### Operacao e confianca no dado
- [x] A tela declara quando a leitura foi feita, e avisa depois de dois dias sem
      atualizacao. Falha de `gerar-diagnostico` so vai para o log de proposito —
      marca-la como evento de coleta pintaria lacuna que nao existe — e o preco
      era o cliente ler veredito velho como se fosse de hoje
- [x] **Painel de saude da operacao.** `public.saude_das_contas` responde numa
      consulta so: dias desde a ultima coleta OK, o motivo da ultima falha, dias
      sem diagnostico e o prazo do token. Ela nao julga — devolve contagem, e o
      que olhar esta em `supabase/README.md`, porque repetir os limiares em SQL
      criaria uma segunda verdade. Inalcancavel pelo cliente por duas travas
      (`security_invoker` e GRANT revogado), cobradas para TODA view do
      repositorio em `politicas.test.js` e provadas no banco em `20-isolamento`
- [ ] **Falta o alerta: alguem precisa olhar.** A consulta existe e ninguem e
      avisado. Notificacao por servico externo e decisao de custo e fica adiada
      por padrao (`memory/restrictions.md`). Saida gratuita a avaliar: job de
      `pg_cron` que grava um resumo diario numa tabela, ou e-mail pelo proprio
      Supabase quando houver plano definido

### Motor de regras
- [x] Estrutura do ruleset versionado (ADR-005)
- [x] Primeiras regras do metodo Atmosfera Viral, com teste sobre historico real
- [x] Persistencia em `diagnosticos` com `ruleset_version`

### Produto
- [x] Tela de diagnostico (o aha: causa nomeada, nao serie)
- [x] Export de relatorio a partir do mesmo diagnostico
- [ ] Cobranca e ciclo de assinatura

### Preparacao do App Review (roda em paralelo, nao no fim)
- [x] Politica de privacidade escrita e em rota publica (`/privacidade`), fora da
      area autenticada — a Meta precisa alcancar a URL sem login
- [x] Endpoint e fluxo de exclusao de dados (`/dados` + Edge Function
      `excluir-dados`, com protocolo em `exclusoes_de_dados`)
- [ ] Publicar as duas URLs de verdade — depende da decisao de hospedagem
- [ ] Preencher CNPJ, razao social, endereco e e-mail do encarregado na politica.
      Sao tres pendencias marcadas na propria pagina, e a Meta exige controlador
      identificavel: sem elas a verificacao de negocio nao se sustenta
- [ ] Conferir se `pages_read_engagement` e mesmo necessaria. A verificacao e
      barata e ninguem fez: uma conexao de teste SEM a permissao responde se a
      descoberta da Pagina falha. Permissao sem tela e causa classica de reprovacao
- [ ] Screencast por permissao, gravado com cliente-teste real
- [ ] Verificacao de negocio no Meta Business Manager (exige CNPJ)

## Fase 1
- [ ] Submissao ao App Review e abertura publica

## Fase 2
- [ ] Comparacao com concorrentes via business_discovery, com limites explicitos na tela

## Fase 3
- [ ] White-label para agencias
