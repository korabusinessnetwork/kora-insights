# Aprendizados — Kora Insights

> Observação real, com data e ação. Não é especulação nem lista de boas
> intenções: cada linha aqui aconteceu neste projeto.
> Quando um aprendizado consolida, ele migra para `patterns.md` ou vira ADR.
> Última revisão: 2026-09-07.

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
| 2026-09-07 | O token da Meta era lido do cofre e usado, e nunca renovado. Ele vive ~60 dias: toda conta conectada morreria no dia 60 — e num produto que exige 16 semanas contínuas, onde lacuna de 5 dias já custa a semana inteira, isso apaga meses de caminho andado em silêncio | Renovação a 15 dias dentro da coleta diária, aviso na tela a 7. Virou **ADR-009** |
| 2026-09-07 | Aviso que aparece antes de a automação ter chance vira ruído e deixa de ser lido. Renovar a 15 dias e avisar a 7 não são dois números arbitrários: a distância entre eles é o que faz o aviso significar "a automação já tentou por uma semana e falhou" | Os dois prazos moram no mesmo módulo puro, lido pela Edge Function e pela tela |
| 2026-09-07 | Comparar dado de fixture congelada com `new Date()` cria duas verdades na mesma tela, e a segunda passa a mentir sozinha com o tempo: em novembro a demonstração anunciaria "coleta parada" numa conta de exemplo | `agoraDoProduto()` na camada de serviços — o relógio entra junto com o dado que ele mede |
| 2026-09-07 | As migrations dependiam, sem dizer, dos grants padrão que o Supabase dá ao `service_role`: elas só concedem para `authenticated` e revogam de `anon`. A dependência só apareceu ao rodar num Postgres puro, com "permission denied for table tenants" | Reproduzida e documentada em `supabase/testes/00-ambiente-supabase.sql`. Dependência implícita de plataforma é dívida até estar escrita |
| 2026-09-07 | Ler o SQL como texto pega tabela sem política, mas não pega política **errada**: `using (true)` passa em qualquer verificação textual e vaza tudo | Teste de isolamento com Postgres de verdade, no CI. Verificado nos dois sentidos — sabotado, ele reprova |
| 2026-09-08 | Tabela semântica → primitiva escrita à mão só cobra o que alguém lembrou de listar: `--cor-grafico-eixo` nunca entrou nela, e o eixo ficou a 1,38:1 no escuro e 1,49:1 no papel — no DOM, invisível na tela, com a suíte verde | `lerSemanticas()` resolve as semânticas do próprio `tokens.css`; token de gráfico novo nasce coberto. Na primeira execução já achou `#161a18` cru onde havia token |
| 2026-09-08 | Item de grid nasce com `min-width: auto`, e `minmax(0, 1fr)` limita a **trilha**, não o item. O `min-width: 30rem` do gráfico esticava cartão e coluna, e o produto inteiro deslizava de lado no celular — em toda tela, nas três larguras testadas. O `overflow-x: auto` do gráfico nunca chegava a valer, porque quem estourava era o pai dele | `min-width: 0` em `.ki-cartao`, `.ki-grafico` e `.ki-tabela`. Conferido por medição de `scrollWidth` em 6 rotas × 3 larguras |
| 2026-09-08 | `position: absolute; width: 1px` não esconde uma `<table>`: layout de tabela ignora largura menor que o conteúdo mínimo. A tabela do leitor de tela ficava com ~397px e somava rolagem à página — um elemento que ninguém enxerga empurrando o produto de lado | A classe `.apenas-leitor` passa a envolver a tabela num `<div>`. Trocar o `display` resolveria a largura e custaria a semântica |
| 2026-09-08 | Conteúdo que cresce sem o layout acompanhar vira defeito visual: os limites eram 3 frases na identidade e viraram até 7, esticando a coluna 70% além da vizinha e abrindo um vão do tamanho da diferença | Viraram faixa de largura total, na tela e na folha. Recolher atrás de "ver mais" seria a saída errada — lacuna que some é o que o produto existe para não fazer |
| 2026-09-06 | Máscara de segredo aplicada **depois** do `JSON.stringify` não casa: em JSON o nome do campo vem entre aspas, e o padrão esperava `token:`. `client_secret` saía inteiro no log | Máscara passou a percorrer as chaves antes de serializar |

## Produto

| Data | Aprendizado | Ação |
|---|---|---|
| 2026-09-07 | A tabela de estados dizia que conta `desconectada` gera diagnóstico, e o trecho de SQL **três linhas abaixo, no mesmo documento** dizia que não — o código concordava com o SQL. Documento longo se contradiz sozinho, e a contradição sobrevive porque as duas metades nunca são lidas juntas | Tabela corrigida. Quando um documento repete a mesma regra em dois formatos, conferir os dois no mesmo commit |
| 2026-09-07 | Duas causas diferentes produzem o mesmo sintoma, e tratá-las igual faz o produto mentir: diagnóstico que parou por falha nossa e diagnóstico que parou porque o cliente desconectou a conta chegam à tela como o mesmo `gerado_em` velho. A frase que eu tinha escrito assumia a culpa nos dois casos, mandando o cliente procurar defeito onde não havia | Três estados em vez de dois. Assumir culpa é honesto quando é nossa, e é ruído quando não é |
| 2026-09-07 | Três defeitos de tela que a suíte verde não pegou, todos vistos no navegador sobre o build: o botão da ação mais destrutiva do produto estava com a variante `texto`, sublinhado como link e mais apagado que "Cancelar"; o nome mais longo quebrava a linha e jogava as ações para a esquerda, deixando três linhas da mesma lista com três alinhamentos; e parágrafo depois de lista nascia colado, porque `p + p` não alcança `ul + p` | Corrigidos. Rodar o app continua sendo a única forma de achar esta classe |
| 2026-09-07 | "Leitura de 5 de setembro" ao lado de "8 semanas até 30 de agosto" convida a ler a data da geração como o fim do período dos dados. O relatório já dizia "Gerado em" — duas palavras para o mesmo conceito, e a mais ambígua na tela mais lida | Uma palavra só, a do relatório. Um conceito, uma palavra, como um número tem uma fonte |
| 2026-09-07 | Configuração de plataforma copiada por analogia falha calada: escrevi `_redirects` com `/* /index.html 200` porque é assim na Netlify, e o Cloudflare Pages **não** aceita reescrita 200 — o arquivo teria ficado inerte parecendo resolver. O fallback de SPA de lá liga sozinho, e o gatilho é a **ausência** de `404.html` | Conferir na fonte antes de escrever config de fornecedor. E regra que depende de um arquivo não existir ganhou passo no CI: ausência não se defende sozinha |
| 2026-09-07 | O documento de custo dizia que o Hobby da Vercel só barrava "no momento em que você cobra do primeiro cliente". A definição da Vercel é bem mais ampla: alcança qualquer deploy com fim de ganho financeiro de **qualquer** envolvido, incluindo quem é pago para escrever o código, e cita explicitamente "anunciar a venda de um produto". O gatilho é o lançamento, não a receita | Corrigido com a citação verbatim. Restrição de fornecedor resumida de memória vira decisão tomada com o prazo errado |
| 2026-09-07 | View comum roda com os privilégios do dono, então ela atravessa a RLS das tabelas de baixo: uma view sobre `ig_contas` exposta a `authenticated` devolveria conta de todos os tenants, e nenhuma política impediria — o filtro por linha nem chega a ser consultado | `security_invoker` **e** GRANT revogado, as duas travas cobradas para TODA view do repositório, não só a que existe hoje |
| 2026-09-07 | "Última coleta OK" e "último evento de coleta" parecem a mesma coluna e são o oposto: uma conta que falha todo dia tem evento de hoje e está parada há semanas. Um painel que olhasse o evento mais recente diria que está tudo bem justamente na conta que quebrou | O teste do painel cobra os dois casos, e reprova a versão sabotada que olha o último evento |
| 2026-09-07 | O stub do Supabase tinha a tabela e a view do Vault, mas não as funções — então `guardar_token`, `ler_token` e `apagar_token` nunca rodaram em teste nenhum, e a renovação do token foi construída sobre uma leitura minha do SQL. Stub incompleto não avisa que é incompleto: ele só faz o teste não alcançar aquele caminho | Funções do Vault no stub com as assinaturas documentadas, e `30-cofre.sql` com 17 asserções. Sabotada para ignorar o nome, `guardar_token` reprova o teste |
| 2026-09-07 | Decisão correta cobra preço em outro lugar: não marcar falha do motor como evento de coleta evita lacuna inventada — e deixava a tela mostrando veredito antigo como leitura de hoje. O relatório carimbava a data, o histórico datava cada linha, e só a tela principal era calada | A tela declara a data da leitura e avisa depois de dois dias. A frase não desmente o veredito: ele vale para o período que comparou, o que falta é o que veio depois |
| 2026-09-07 | A tela `/dados` oferecia só a saída irreversível. Quem queria apenas parar a coleta — contrato encerrado, conta em reforma — precisava apagar meses de histórico para conseguir. A função reversível estava prevista em quatro documentos e não existia | `desconectar-conta` escrita, e as duas saídas lado a lado, com a reversível primeiro na leitura e na tabulação |
| 2026-09-07 | Confirmação que guarda só o id da conta, e não a ação, abre as duas saídas ao mesmo tempo: a pessoa clica em "Confirmar" sem saber qual das duas, e uma delas não tem volta | A confirmação carrega `{ contaId, acao }`, e o teste cobra que abrir uma não abre a outra |
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
| 2026-09-07 | Pendência escrita em quatro lugares parece resolvida por estar bem documentada. `desconectar-conta` tinha nota em `supabase/README.md`, `src/lib/README.md`, `modulo-conexao.md` e `fluxo-conexao.md` — e nenhuma linha de código | Documentar a falta não é sinal de saúde; é a mesma dívida, quatro vezes. Ao encontrar uma nota dessas, ou se escreve o código ou se marca prazo |
| 2026-09-07 | Citação com fonte errada envelhece pior que texto sem fonte: `modulo-conexao.md` atribuía a `docs/11_SEGURANCA/plano.md`, entre aspas, uma promessa que o plano nunca fez. Quem for conferir acha o documento certo dizendo outra coisa e passa a duvidar dos dois | Conferir a fonte antes de citar entre aspas. O README dos ADRs tinha o mesmo defeito por outro caminho: ainda era o texto de template da fundação, listando arquivos que não existem |
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
| Token que ninguém renova mata a conta no dia 60, em silêncio | 2026-09-07 | ADR-009 |
