# Diretrizes de Desenvolvimento — Kora Insights

> Constituição do projeto. Substitua os `{{...}}` pelas respostas do intake
> (`respostas-intake.md`). Remova as seções que não se aplicam ao seu produto.

## Princípio nº 1 — INTUITIVIDADE (inegociável)

<!-- Se tem UI, o padrão é INTUITIVIDADE. Se é serviço/lib, pode ser
     CONFIABILIDADE ou CONTRATO ESTÁVEL. Defina o valor inegociável nº1. -->

O foco principal do sistema é **INTUITIVIDADE: a tela precisa ser compreensível sem treinamento, e todo diagnóstico deve caber numa frase que o cliente repetiria em voz alta**. Em qualquer decisão,
priorize este princípio acima de conveniência técnica. Regras práticas:

- Se uma tela não muda uma decisão do cliente, ela não entra no produto
- O que a API da Meta não entrega aparece como limite explícito na interface, nunca como lacuna silenciosa
- Estados sempre visíveis: carregando, erro, vazio e sucesso com feedback humano.
- Prevenção de erro > mensagem de erro.
- Consistência total com o design system (`docs/02_DESIGN_SYSTEM/`).

## Fonte de verdade (leia antes de qualquer mudança relevante)

- **`memory/`** — identidade, decisões, padrões, aprendizados e restrições.
  Consultar antes de decisões de produto/arquitetura.
- **`docs/`** — regras de negócio (`03_REGRAS_DE_NEGOCIO/`), design system
  (`02_DESIGN_SYSTEM/`), fluxos, modelagem, ADRs (`08_DECISOES/`) e o plano de
  segurança (`11_SEGURANCA/`).
- **ADR-001** define a stack vigente; ADRs em `docs/08_DECISOES/` registram as
  decisões de arquitetura.
- Schema do banco: `supabase/schema.sql`.
- Se doc e código conflitarem, a documentação prevalece — e deve ser corrigida
  quando estiver errada.
- **Produto = SaaS B2B multi-tenant, plano único pago.** Multi-tenant desde a linha 1: isolamento por RLS derivado de tenant_membros, nada de marca, cor ou regra de cliente no código. Todo código novo assume
  **múltiplos tenants** e é **adaptável por estabelecimento**: nada de marca,
  nome, cor, logo ou regra de cliente hardcodada — identidade vem do tenant.

## Processo de trabalho

<!-- Se usa orquestração multi-modelo, mantenha; senão, descreva seu fluxo. -->
1. **Planejar TUDO antes de executar** — escopo fechado, sem retrabalho.
2. Builds multi-parte → fan-out paralelo com **dono exclusivo por arquivo**
   (dois agentes nunca tocam o mesmo arquivo).
3. **Sintetizar e VALIDAR no fim** — revisar cada entrega, rodar testes e build.
4. Tarefa de peça única não ganha fan-out.

## Custo — priorizar o gratuito (Orcamento pequeno para infra)

Enquanto o projeto está em construção/pré-receita, **use sempre meios gratuitos**.
Toda implementação que exija investimento é **adiada por padrão**, salvo decisão
explícita do dono. Ao esbarrar em algo pago, apresente: custo aproximado,
alternativa gratuita, impacto, e recomendação (agora × depois) — o dono decide.
Detalhes em `memory/restrictions.md`.

## Segurança (obrigatório em todo código novo)

- **Nunca** hardcodar chaves, URLs de API, secrets ou senhas — usar `import.meta.env.VITE_`.
- **Nunca** `select *` em tabelas sensíveis — sempre campos explícitos.
- **Sempre** validar inputs do usuário antes de qualquer operação no banco.
- **Nunca** logar dados sensíveis (senhas, tokens, dados financeiros).
- **Sempre** verificar autenticação antes de renderizar rota protegida.
- Ao criar tabela/função nova, lembrar que **RLS** precisa ser configurada.
- Plano de segurança completo em `docs/11_SEGURANCA/` (base: guia da fundação).

## Padrões de código

- Componentes React em arquivos separados, CSS fora do JSX, acesso ao backend somente pela camada de serviços em src/lib <!-- ex: Componentes React em arquivos separados -->
- Variáveis/funções em português para nomes de domínio (`abrirCaixa`), inglês
  para padrões técnicos (`handleSubmit`).
- Sempre tratar erros de chamadas ao backend com `try/catch` ou checagem de `.error`.
- Logs de atividade fire-and-forget — nunca bloquear a operação principal.
- Rodar `npm test` antes de commitar; funções puras nascem com teste.
- **Separar CSS do JSX** — estilo desacoplado da marcação, para white-label.

## Stack

- **Front:** React + Vite, React Router
- **Backend:** Supabase (Auth, Postgres com RLS, Edge Functions, Cron)
- **Deploy:** Vercel (decisão pendente sobre plano comercial, ver docs/12)
- **Integração:** Instagram API with Facebook Login (ADR-002)
- **Regras:** ruleset versionado em src/rules (ADR-005)
<!-- ex:
- React + Vite
- Supabase (auth, database, realtime)
- React Router v6
- Context API (sem Redux)
- Deploy: Vercel
-->
