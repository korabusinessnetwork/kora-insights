# Conformidade — LGPD e Meta Platform Terms, em verificação

> Conformidade escrita em prosa não é verificável, e o que não é verificável não
> passa em auditoria nem em App Review. Este documento diz **qual dado existe**,
> **o que é proibido fazer com ele** e **como conferir**, em pseudocódigo com o
> nome real da tabela e da coluna.
> Fontes: `memory/restrictions.md`, `supabase/schema.sql`,
> `supabase/functions/`, ADR-002, ADR-004, ADR-006, `docs/12`, seção 1.3.
> Última revisão: 2026-09-05.

> **Aviso.** Este é um documento de engenharia, não parecer jurídico. As leituras
> legais abaixo precisam de confirmação com assessoria antes da submissão ao App
> Review (Fase 1). Onde a leitura ainda não foi confirmada, está escrito.

---

## 1. Que dado pessoal existe de verdade hoje

Inventário conferido contra o que as Edge Functions realmente gravam — não
contra o que o produto pretende gravar um dia.

| Dado | Onde | Natureza | Titular |
|---|---|---|---|
| E-mail do usuário do produto | `auth.users` | pessoal | quem usa o Kora Insights |
| Vínculo usuário ↔ tenant | `tenant_membros` | pessoal (associação) | idem |
| `ig_user_id`, `username`, `nome`, `fb_page_id` | `ig_contas` | identificadores de conta profissional | a marca conectada |
| Token de acesso da Meta | Supabase Vault (só a referência em `ig_contas.token_ref`) | **credencial**, o dado mais sensível do produto | a marca conectada |
| Métricas agregadas de conta e de mídia | `snapshots_conta`, `snapshots_midia` | dado de negócio da marca, agregado | a marca conectada |
| Diagnósticos | `diagnosticos` | derivado do acima | a marca conectada |
| Eventos de coleta | `coleta_eventos` | operacional | — |
| Protocolos de exclusão | `exclusoes_de_dados` | comprovante, com contagem e nunca conteúdo | quem pediu |

### O que o produto NÃO coleta, apesar de o plano antigo prever

`coleta-diaria` pede à Graph API exatamente estas métricas de conta —
`reach`, `views`, `total_interactions`, `profile_views`, `follower_count` — e
estas de mídia — `reach`, `views`, `saved`, `shares`, `total_interactions`,
`like_count`, `comments_count`.

**Nenhuma delas é demográfica. Nenhuma delas é individual.** O produto hoje não
guarda idade, gênero, cidade nem qualquer recorte de audiência, e não guarda
identificador de seguidor. A tabela de classificação de `docs/11_SEGURANCA`
lista "demografia agregada de audiência" como categoria prevista: ela descreve
uma intenção, não o estado atual.

Isso importa por três razões, e todas mudam de valor no dia em que a demografia
entrar:

1. a superfície LGPD hoje é **menor** do que o plano de segurança sugere;
2. a base legal e o texto da política de privacidade mudam;
3. o App Review passa a exigir justificativa e tela para um dado novo.

```
-- Verificacao: nenhuma metrica demografica entra sem decisao explicita.
PARA CADA metrica pedida em buscarInsightsDaConta e buscarMidias:
  metrica DEVE estar no dicionario canonico de src/metricas/
  E metrica NAO PODE ser recorte de audiencia
SENAO -> exige ADR novo, revisao da politica de privacidade e do App Review
```

---

## 2. Papéis — a leitura que o produto adota

Leitura de engenharia, **a confirmar com assessoria jurídica**:

- Sobre o **dado da audiência da marca**, quem decide a finalidade é a marca (ou
  a agência que a representa). O Kora Insights trata o dado a mando dela.
- Sobre o **dado do usuário do produto** (e-mail, sessão, vínculo com tenant),
  quem decide a finalidade somos nós.

Consequência prática, essa sim já fechada: **o consentimento é do dono da
conta**, dado por OAuth, e não há caminho oficial para insight de conta que não
autorizou o app (`memory/restrictions.md`, `docs/00_VISAO`). O produto não tem
uma segunda porta.

---

## 3. LGPD — obrigações e como conferir cada uma

### 3.1 Finalidade e base legal declaradas

```
A politica de privacidade publicada em /privacidade DEVE dizer:
  - que dado e coletado (a lista da secao 1, nao uma lista generica)
  - para que ele e usado (gerar diagnostico de crescimento da propria conta)
  - por quanto tempo e guardado           -- NAO DECIDIDO, ver 3.5
  - com quem e compartilhado              -- hoje: ninguem
  - como pedir exclusao                   -- /dados
```

Situação: a rota `/privacidade` existe no contrato de rotas (`contratos.md`,
seção 6) e o texto **ainda não foi escrito**. É item bloqueante da Fase 1
(`docs/09_BACKLOG`).

### 3.2 Exclusão a pedido

Implementada em `excluir-dados`, com comprovante. A verificação é:

```
DADO um pedido de exclusao concluido:
  NAO EXISTE linha em snapshots_conta   com ig_conta_id = conta
  NAO EXISTE linha em snapshots_midia   com ig_conta_id = conta
  NAO EXISTE linha em diagnosticos      com ig_conta_id = conta
  NAO EXISTE linha em coleta_eventos    com ig_conta_id = conta
  NAO EXISTE segredo no Vault em token_ref
  NAO EXISTE linha em ig_contas         com id = conta
  EXISTE linha em exclusoes_de_dados com protocolo, concluido_em e itens_apagados
  E itens_apagados contem CONTAGEM, nunca conteudo
```

O comprovante é gravado **antes** do apagamento começar. Se a função morrer no
meio, sobra o registro de que o pedido existiu, com `concluido_em` vazio — e é
assim que uma exclusão incompleta aparece para quem auditar, em vez de sumir.

### 3.3 Direito de acesso e portabilidade

Prometido em ADR-004 ("o cliente pode exportar o próprio histórico a qualquer
momento") e vendido em `docs/13_VENDA`, seção 8.

**Não existe código de exportação.** Enquanto não existir, o direito é atendido
só por pedido manual ao suporte, e a frase de venda não pode ser dita.

### 3.4 Desconexão interrompe o tratamento

```
QUANDO a conta e desconectada:
  token apagado do Vault
  conta.status = 'desconectada'
  coleta-diaria deixa de incluir a conta (so roda em 'ativa')
```

**A função `desconectar-conta` não existe** (`modulo-conexao.md`, seção 7). Hoje
a única forma de interromper o tratamento e apagar o token é a exclusão completa
— que apaga também o histórico, o que é mais do que o titular pediu.

### 3.5 Retenção

```
retencaoAposCancelamento = ???   -- NAO DECIDIDO
retencaoDeColetaEventos   = ???   -- NAO DECIDIDO
retencaoDeExclusoesDeDados = ???  -- comprovante: precisa sobreviver ao dado
```

O checklist de `docs/11_SEGURANCA` já lista "retenção definida" como item em
aberto. Sem prazo declarado não há como escrever a política de privacidade da
seção 3.1, e sem política não há App Review. **Este é o item mais atrasado da
conformidade.**

**Onde a decisão mora:** ADR novo, refletido em `/privacidade` e em um job de
expurgo que ainda não existe.

---

## 4. Meta Platform Terms — o que é proibido

Restrições de `memory/restrictions.md` e `docs/00_VISAO`, transformadas em
verificação:

```
-- 1. Nada de dado bruto revendido.
O produto vende INTERPRETACAO. Nenhuma tela, export ou API entrega
dado cru de plataforma de terceiro como produto.
Verificar: nao existe endpoint que devolva payload da Graph API sem passar
pelo adaptador e pelo motor.

-- 2. Nada de conta sem consentimento.
Toda leitura usa o token daquela conta, guardado no Vault com referencia em
ig_contas.token_ref, obtido por OAuth.
Verificar: chamarGraph SEMPRE recebe token de parametro; nao existe chamada
com token de aplicacao para ler conta de terceiro.

-- 3. Nada de raspagem.
Nao existe leitura de pagina publica, nao existe HTML parseado, nao existe
API paga de terceiro para dado publico (ADR-002 descartou essa alternativa).

-- 4. Token nunca em log, nunca em URL, nunca no front.
Verificar: chamarGraph poe o token no cabecalho Authorization;
registrar() mascara padroes de token; token_ref nao esta em nenhum grant
de coluna para authenticated (schema.sql).

-- 5. Permissao so com tela.
Verificar: as 4 permissoes de PERMISSOES tem tela correspondente em
docs/07_APIS/graph-api.md. Permissao sem tela nao entra.

-- 6. Comparacao com concorrente (Fase 2) nunca promete mais que o publico.
business_discovery devolve metadado publico e engajamento visivel — sem
alcance, salvamento nem demografia. A tela e obrigada a dizer isso (ADR-006).
```

### Uma tensão a resolver antes da submissão

Desconectar preserva o histórico já coletado (`modulo-conexao.md`, seção 7).
Isso é bom para o cliente e coerente com ADR-004 — e precisa ser conferido
contra o texto vigente dos Platform Terms sobre retenção de dado de plataforma
após revogação de acesso.

Não temos leitura confirmada. **Item bloqueante de App Review**: ou se confirma
que a retenção é permitida com base legal própria, ou o histórico passa a ser
apagado (ou anonimizado) na desconexão. Decidir isso depois da submissão é
convidar uma reprovação evitável.

---

## 5. Instabilidade de plataforma como risco de conformidade

Métricas da Meta mudam sem aviso útil. Precedente citado em ADR-003: em junho de
2026 a Meta removeu impressões únicas e alcance do Facebook em todas as versões
da Graph API.

A defesa arquitetural já existe — dicionário canônico e adaptadores por versão
(ADR-003) — e ela tem um efeito de conformidade que vale registrar: **quando uma
métrica é descontinuada, a série não é apagada nem recalculada.** Ela é
encerrada com data (`metricas_canonicas.descontinuada_em`) e a tela mostra a
descontinuidade. Apagar série histórica para "limpar" um schema seria destruir
dado do cliente sem pedido dele.

---

## 6. Checklist de conformidade — estado real

| Item | Estado | Onde |
|---|---|---|
| Consentimento por OAuth, sem caminho alternativo | **feito** | `conectar-conta` |
| Token fora do front, fora de log, fora de URL | **feito** | Vault + `grant` por coluna + máscara em `registrar` |
| Isolamento entre tenants por RLS | **feito no schema**; teste com banco real pendente | `supabase/politicas.test.js`, `docs/09_BACKLOG` |
| Exclusão a pedido, com comprovante | **feito** | `excluir-dados` |
| Política de privacidade publicada | **não escrita** | rota `/privacidade` |
| Instruções de exclusão públicas | **rota prevista, texto não escrito** | rota `/dados` |
| Exportação do histórico pelo cliente | **não existe** | dívida de promessa (ADR-004, doc 13) |
| Desconexão sem exclusão | **não existe** | `desconectar-conta` |
| Prazo de retenção declarado | **não decidido** | ADR novo |
| Renovação de token e aviso ao cliente | **não existe** | ADR novo |
| Verificação de negócio no Meta (exige CNPJ) | **não iniciada** | `docs/11_SEGURANCA/app-review.md` |

Sete dos onze itens estão em aberto. Nenhum é difícil isoladamente; juntos, são
o caminho crítico da Fase 1, e a fila do App Review reinicia a cada pedido de
correção (doc 12, seção 1.3).
