# Aprendizados — Kora Insights

> Observação real, com data e ação. Não é especulação nem lista de boas
> intenções: cada linha aqui aconteceu neste projeto.
> Quando um aprendizado consolida, ele migra para `patterns.md` ou vira ADR.
> Última revisão: 2026-09-06.

## Regras deste documento

- Aprendizado vem de código, de revisão ou de uso — nunca de teoria.
- Data e contexto são obrigatórios.
- Toda linha termina em ação: implementar agora, pesquisar, ou descartar.
- Aprendizado de segurança entra na hora, mesmo com o trabalho em curso.

---

## Técnicos

| Data | Aprendizado | Ação |
|---|---|---|
| 2026-09-06 | Suíte verde não prova produto de pé. Três features (autenticação, conexão, relatório) tinham teste próprio passando e nunca foram ligadas às rotas: não estavam no bundle, e com Supabase configurado não havia como entrar no produto | Composição saiu para `src/app/telas.jsx` com teste de junção. **Promovido para `patterns.md`** |
| 2026-09-06 | Proteção contra semana incompleta operava por dia coletado, mas a Graph API falha **por métrica**: semana com os 7 dias e sem `alcance` passava pelo filtro, e somar as que sobraram fabricava "25% abaixo" com o alcance real idêntico | `valorDaJanela` passou a exigir a métrica em todas as semanas do bloco quando a agregação é soma |
| 2026-09-06 | Normalizar a linha do gráfico pelo próprio mínimo e máximo transforma 4% de oscilação em escalada de altura total — o desenho contradizendo a frase logo abaixo dele | Faixa da linha ganhou amplitude mínima relativa à média da série |
| 2026-09-06 | Tabela de contraste escrita à mão envelhece na primeira troca de paleta: a nossa afirmava 4,6:1 para um par que media 4,27:1 | `src/styles/contraste.test.js` lê a paleta do CSS e reprova a suite. Números do `TOKENS.md` saem dele |
| 2026-09-06 | `calendario.js` — a fronteira de semana do produto inteiro — nasceu dentro de `src/fixtures/`. Motor, serviços e demonstração importavam de um diretório de dado de exemplo | Movido para `src/calendario/`, com teste próprio |
| 2026-09-07 | As migrations dependiam, sem dizer, dos grants padrão que o Supabase dá ao `service_role`: elas só concedem para `authenticated` e revogam de `anon`. A dependência só apareceu ao rodar num Postgres puro, com "permission denied for table tenants" | Reproduzida e documentada em `supabase/testes/00-ambiente-supabase.sql`. Dependência implícita de plataforma é dívida até estar escrita |
| 2026-09-07 | Ler o SQL como texto pega tabela sem política, mas não pega política **errada**: `using (true)` passa em qualquer verificação textual e vaza tudo | Teste de isolamento com Postgres de verdade, no CI. Verificado nos dois sentidos — sabotado, ele reprova |
| 2026-09-06 | Máscara de segredo aplicada **depois** do `JSON.stringify` não casa: em JSON o nome do campo vem entre aspas, e o padrão esperava `token:`. `client_secret` saía inteiro no log | Máscara passou a percorrer as chaves antes de serializar |

## Produto

| Data | Aprendizado | Ação |
|---|---|---|
| 2026-09-06 | A regra de cadência disparava sem conferir que o alcance total caiu. Publicar 33% menos e alcançar o mesmo (posts melhores) virava "causa nomeada" e a ação mandava desfazer a melhora | Três desfechos na regra; sem queda de alcance a severidade é `ok`. O produto perde a chance de acusar um problema inexistente, que é exatamente o que se quer |
| 2026-09-06 | Cinco dias sem coleta custam a **semana inteira** de comparação. Uma conta com 4 meses de histórico caiu abaixo do piso do ruleset por causa disso | Comportamento mantido (está certo), mas a fixture ganhou histórico para a demonstração não perder o desfecho "conta saudável". Avaliar avisar o cliente quando uma falha de coleta ameaçar o próximo diagnóstico |
| 2026-09-06 | O mesmo diagnóstico era anunciado com três janelas diferentes — 16 semanas no cabeçalho, 8 na evidência, 1 no relatório | `formatarJanelaComparada()` virou fonte única. **Promovido para `patterns.md`** |
| 2026-09-05 | Variação calculada sobre o valor cru contradiz a tabela que a própria tela mostra: 1,8 contra 3,0 dá 40% para quem confere, e 42% para quem calcula sobre 1,75 | Virou **ADR-008** |

## Negócio

| Data | Aprendizado | Ação |
|---|---|---|
| 2026-09-06 | O ruleset 0.3.0 precisa de 16 semanas para nomear uma causa, e a identidade promete 8. São ~4 meses até o valor central, contra uma venda que promete diagnóstico ao vivo numa call de 20 minutos | Decisão do dono, com três saídas escritas em `docs/09_BACKLOG`. Enquanto não vier, o produto promete 16 e entrega 16 |
| 2026-09-05 | O teto da Fase 0 não é comercial nem de infraestrutura: é o Development mode da Meta, que só atende testers adicionados à mão | A escassez comunicada na venda é real e pode ser dita sem inventar nada (`docs/13_VENDA`, seção 7) |
| 2026-09-05 | Armazenamento não é o gargalo: ~12 KB por conta por dia cabe folgado no plano gratuito. O gargalo é a fila do App Review | Tratar o review como caminho crítico, não como etapa final (`docs/12`, seção 1.3) |

## Processo

| Data | Aprendizado | Ação |
|---|---|---|
| 2026-09-06 | Fan-out paralelo com dono exclusivo por diretório funciona para construir, e não funciona para integrar: cada agente validou a própria peça e ninguém validou a junção | O passo 3 do processo em `CLAUDE.md` ("sintetizar e VALIDAR no fim") não é formalidade. Rodar o app de verdade faz parte dele |
| 2026-09-06 | Revisão adversarial por lentes distintas (invariantes, segurança, identidade e acessibilidade, corretude) achou 27 defeitos que a suite verde escondia — 5 deles bloqueantes | Manter a revisão por lentes como etapa antes de considerar qualquer build pronto |
| 2026-09-06 | Três defeitos só apareceram com o app rodando no navegador sobre o build de produção; nenhum teste os pegaria | Screenshot das telas principais faz parte do encerramento, não é extra |
| 2026-09-06 | Conflito reconhecido em comentário e publicado assim continua sendo o produto mentindo. Dois arquivos anotavam o conflito das 8 contra 16 semanas e nenhum resolvia | Conflito entre documento e código vira decisão registrada ou correção no mesmo commit — nunca um `ATENÇÃO` no JSDoc |

---

## Promovidos → padrão

| Aprendizado | Data | Padrão |
|---|---|---|
| Teste de peça não pega defeito de junção | 2026-09-06 | "Teste que prova o que importa" |
| Um número que aparece em dois lugares vem de um módulo só | 2026-09-06 | "Um número, uma fonte" |

## Promovidos → decisão

| Aprendizado | Data | ADR |
|---|---|---|
| Demonstração precisa sair do motor real, nunca de texto fixo | 2026-09-05 | ADR-007 |
| A tabela da tela tem que fechar com ela mesma | 2026-09-05 | ADR-008 |
