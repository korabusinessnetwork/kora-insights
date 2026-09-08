# Kora Insights

Conecta o Instagram da marca e transforma insight bruto em **diagnóstico de
crescimento acionável**. Não entrega gráfico: entrega a causa nomeada.

> "Seu alcance não caiu. Sua frequência caiu 40% e o alcance seguiu junto."

Essa frase não está escrita em lugar nenhum do código. Ela sai do motor de
regras aplicado ao histórico da conta — e é esse motor, e não o gráfico, que é o
produto (ADR-005).

---

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # suíte completa
npm run lint
npm run build
```

**Sem configurar nada**, o app sobe em **modo de demonstração**: a camada de
serviços serve a agência fictícia Estúdio Vergara e suas três contas
(`src/fixtures/`), e a tela avisa que o dado é de demonstração. O diagnóstico
exibido continua saindo do motor real sobre série real de fixture.

Para apontar para um Supabase de verdade, copie `.env.example` para `.env` e
preencha. A presença de `VITE_SUPABASE_URL` é o que desliga a demonstração.

## As três contas da demonstração

Existem para cobrir os três desfechos que a tela precisa saber mostrar:

| Conta | Desfecho |
|---|---|
| Casa Oliveira | causa nomeada — é o caso desenhado na identidade visual |
| Verdejar Plantas | conta saudável, com cinco dias sem coleta visíveis na tela |
| Studio Nove | histórico curto demais: o motor diz que não sabe, e não chuta |

## Estrutura

```
docs/          documentação document-first, 00 a 13 (a fonte de verdade)
memory/        identidade, decisões, padrões, restrições
src/
  metricas/    dicionário canônico + adaptadores por versão da API (ADR-003)
  rules/       o método da Atmosfera Viral como ruleset versionado (ADR-005)
  motor/       histórico, janelas e geração do diagnóstico — tudo puro
  lib/         única porta para o backend, sempre com envelope
  components/  kit visual, sem regra de negócio
  features/    telas: diagnóstico, relatório, conexão, autenticação
  styles/      tokens em três camadas + folha de impressão
  tema/        identidade visual por tenant (white-label)
  fixtures/    a demonstração, determinística
supabase/      schema, RLS, migrations e Edge Functions
```

## As regras que valem mais que qualquer preferência

Estão em `CLAUDE.md` e em `docs/01_ARQUITETURA/contratos.md`. As que reprovam um
PR sozinhas:

1. Diagnóstico nunca é calculado na tela — a tela lê `diagnosticos`.
2. Nenhuma métrica é gravada ou exibida com o nome que a Meta dá a ela.
3. Nada de chave, marca, cor ou regra de cliente no código.
4. RLS com política em toda tabela; token de terceiro nunca chega ao front.
5. Lacuna de dado nunca some da tela.

## Onde o projeto está

**Fase 0** — Development mode da Meta, com clientes-teste adicionados
manualmente no painel. O teto é de algumas dezenas de contas, e ele é técnico,
não comercial (`memory/restrictions.md`).

Pendências bloqueantes antes da primeira cobrança estão em
`docs/09_BACKLOG/README.md` e em `docs/12_CUSTO_E_PRECIFICACAO` (hospedagem
definitiva, gateway de pagamento, App Review).

## Licença

Propriedade da Kora Business Network. Todos os direitos reservados.
