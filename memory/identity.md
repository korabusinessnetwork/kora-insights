# Identidade do Produto — Kora Insights

## Objetivo
- Documentar a identidade, visao e diferencial do produto
- Guiar decisoes de produto, design e comunicacao
- Manter coerencia em todos os pontos de contato com o usuario

## Contexto
- Mercado/vertical: analytics e relatorio de redes sociais (Instagram)
- Estagio: ideacao, entrando em Fase 0 (Development mode com clientes-teste)
- Competidores diretos: mLabs, Reportei, Etus, Metricool
- Dono do produto: Matheus Bonato ([[profile]]), sob a Kora Business Network

## Proposito Central

### Visao
Ser a camada de interpretacao que falta entre o dado bruto do Instagram e a decisao de conteudo, comecando por Instagram e expandindo para os canais onde a marca publica.

### Proposito
- **Problema que resolve:** marcas e agencias tem acesso as metricas do Instagram, mas nao sabem ler o proprio dado. O painel nativo mostra numero, nao causa. O resultado e conteudo decidido por intuicao e relatorio feito na mao.
- **Como resolvemos:** conectamos a conta profissional por OAuth, guardamos historico proprio desde o dia 1 e aplicamos um motor de regras versionado, o metodo da Atmosfera Viral codificado em software, que nomeia o que esta travando o crescimento.
- **Impacto esperado:** a marca sai da tela sabendo o que fazer na proxima semana, nao apenas quanto alcancou.

## Publico-Alvo

| Segmento | Perfil | Contexto | Necessidade |
|---|---|---|---|
| Agencia pequena de social media | 1 a 10 pessoas, atende 3 a 15 marcas | Monta relatorio manual em slide todo mes | Parar de perder horas em print e ter argumento para defender a estrategia na reuniao |
| Marca com social media interno | Social media sozinho, sem analista de dados | Posta com constancia mas nao sabe por que uns posts vao e outros nao | Entender a causa, nao so ver o grafico |

## Posicionamento

**Para** marcas e agencias que ja postam com constancia / **que** tem metrica sobrando e leitura faltando / **Kora Insights** e uma plataforma de diagnostico de crescimento no Instagram / **que** nomeia a causa do travamento e sugere a proxima acao / **Diferente de** ferramentas de relatorio como mLabs e Reportei, que entregam grafico bonito e deixam a interpretacao com o cliente / **entrega** o metodo da Atmosfera Viral aplicado automaticamente ao dado da marca.

**Inimigo comum:** o relatorio bonito que ninguem sabe usar. Dashboard nao e resposta, e pergunta em forma de grafico.

## Valores
- Diagnostico acima de dashboard: se a tela nao muda uma decisao, ela nao existe
- Honestidade de dado: o que a API nao entrega, a tela diz que nao entrega
- Historico e do cliente: exportavel, sem lock-in
- Intuitividade (principio n1): compreensivel sem treinamento

## Tom de Voz
- ✅ "Seu alcance nao caiu. Sua frequencia caiu 40% e o alcance seguiu junto."
- ❌ "Analise multivariada de performance de conteudo com metricas consolidadas."

Direto, tecnico sem jargao, disposto a dar a noticia ruim.

## Personas

### Camila, dona de agencia pequena
- **Contexto:** 8 clientes, entrega relatorio mensal em slide montado na mao
- **Dores:** perde 4 a 6 horas por mes por cliente montando relatorio; nao consegue provar o proprio trabalho quando o resultado cai
- **Objetivos:** relatorio pronto em minutos e um argumento defensavel na reuniao
- **Sucesso:** deixa de montar slide e passa a discutir estrategia

### Rafa, social media interno de uma marca
- **Contexto:** cuida sozinho do perfil, sem analista
- **Dores:** nao sabe se o problema e alcance, formato ou frequencia; testa no escuro
- **Objetivos:** saber onde mexer primeiro
- **Sucesso:** para de trocar tudo ao mesmo tempo e passa a testar uma variavel por vez

## Principios do Produto
- O diagnostico e o produto; o grafico e so a prova dele
- Nenhuma metrica e gravada com o nome que a Meta da a ela (ver ADR-003)
- Toda avaliacao guarda a versao da regra que a gerou (ver ADR-005)
- O que a API nao entrega aparece na tela como limite explicito, nunca como lacuna silenciosa

## Identidade Visual
- Herda a linha Kora, a definir. Tom escuro, denso em dado, sobrio.

## Roadmap
- **Fase 0 (atual):** Development mode, clientes-teste pagantes adicionados manualmente no painel Meta. Valida o motor de regras e gera o screencast do App Review.
- **Fase 1:** submissao ao Meta App Review, verificacao de negocio, abertura a qualquer marca.
- **Fase 2:** comparacao com concorrentes via business_discovery (ver ADR-006).
- **Fase 3:** white-label para agencias colocarem a propria marca no relatorio.
- **Fase 4:** outros canais (TikTok, YouTube) sob o mesmo motor de regras.

## Criterios de Aceite
- [ ] Proposito central testado com 3+ usuarios reais
- [x] Personas documentadas
- [x] Tom de voz com exemplos
- [x] Roadmap definido ate Fase 4
