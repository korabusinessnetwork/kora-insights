# Contratos entre camadas

> O que atravessa fronteira de modulo. Mudar qualquer coisa aqui e mudanca
> combinada: quem muda, atualiza este documento no mesmo commit.
> Ultima revisao: 2026-09-05.

---

## 1. Envelope

Toda funcao de `src/lib/` devolve `Promise<Envelope>`. Sempre. Inclusive em
sucesso (`memory/patterns.md`).

```js
/** @typedef {{ data: unknown, error: ErroDeServico|null, meta: MetaEnvelope }} Envelope */
/** @typedef {{ codigo: string, mensagem: string, detalhe?: string }} ErroDeServico */
/** @typedef {{ carimbo: string, versao: '1', origem: 'supabase'|'demonstracao' }} MetaEnvelope */
```

`error.codigo` e estavel entre versoes; `error.mensagem` e pt-BR e vai para a
tela. Codigos em `src/lib/erros.js`:

| Codigo | Quando |
|---|---|
| `SEM_SESSAO` | nao ha usuario autenticado |
| `SEM_PERMISSAO` | RLS negou; usuario nao pertence ao tenant |
| `NAO_ENCONTRADO` | id valido, registro inexistente |
| `ENTRADA_INVALIDA` | validacao falhou antes de tocar o banco |
| `TOKEN_EXPIRADO` | conta precisa ser reconectada |
| `LIMITE_DE_TAXA` | Graph API recusou por rate limit |
| `SEM_DADO_SUFICIENTE` | historico curto demais para diagnosticar |
| `FALHA_DE_REDE` | nao foi possivel falar com o backend |
| `FALHA_INESPERADA` | qualquer outra |

---

## 2. Dicionario canonico de metricas (`src/metricas/`)

Nome da Meta nunca e persistido nem exibido (ADR-003). Codigos canonicos:

| Codigo | Rotulo na tela | Unidade | Escopo | Agregacao |
|---|---|---|---|---|
| `alcance` | Contas alcancadas | contas | conta, midia | soma |
| `visualizacoes` | Visualizacoes | eventos | conta, midia | soma |
| `interacoes` | Interacoes | eventos | conta, midia | soma |
| `curtidas` | Curtidas | eventos | midia | soma |
| `comentarios` | Comentarios | eventos | midia | soma |
| `salvamentos` | Salvamentos | eventos | midia | soma |
| `compartilhamentos` | Compartilhamentos | eventos | midia | soma |
| `seguidores` | Seguidores | contas | conta | ultimo |
| `visitas_ao_perfil` | Visitas ao perfil | eventos | conta | soma |
| `publicacoes` | Publicacoes | publicacoes | conta (derivada) | soma |

**`agregacao` nao e detalhe.** Seguidores e estoque: a semana vale o ultimo
saldo, nunca a soma dos dias. Alcance e fluxo e soma — e somar alcance semanal
conta duas vezes quem foi alcancado em duas semanas. Isso e limite de
plataforma, nao bug: a Meta nao devolve alcance unico de 8 semanas. Por isso
`alcance` carrega `limiteDeAgregacao`, e o motor **obriga** que esse limite
apareca na tela sempre que a metrica for somada por janela (ADR-003, e o valor
"honestidade de dado" em `memory/identity.md`).

`publicacoes` e derivada da contagem de midias publicadas no dia; nao vem da
Meta e por isso nao tem adaptador.

### Adaptador

```js
/** @typedef {{ metrica: string, valor: number, data: string }} LeituraCanonica */

/**
 * @param {object} payload resposta crua da Graph API
 * @param {'conta'|'midia'} escopo
 * @param {string} data ISO YYYY-MM-DD
 * @returns {{ leituras: LeituraCanonica[], ignoradas: string[] }}
 */
adaptar(payload, escopo, data)
```

Cada adaptador exporta `{ versao, apiVersion, adaptar }`. `versao` e semantica
(`'1.0.0'`) e vai gravada em cada snapshot junto de `apiVersion`. Metrica que a
Meta mandou e nao conhecemos entra em `ignoradas` — nunca vira coluna nova.

Metrica descontinuada **nao apaga serie**: ganha `descontinuada_em` no
dicionario e a tela mostra a descontinuidade (ADR-003).

---

## 3. Motor de regras (`src/rules/` e `src/motor/`)

### Entrada

```js
/**
 * @typedef {object} Midia
 * @property {string} id
 * @property {string} tipo             'carrossel' | 'imagem' | 'reel' | 'story'
 * @property {string} publicadaEm      ISO
 * @property {Record<string, number>} metricas   codigos canonicos
 */

/**
 * @typedef {object} Janela
 * @property {string} inicio           segunda-feira
 * @property {string} fim              domingo
 * @property {Record<string, number>} valores    metricas de conta, ja agregadas
 * @property {Midia[]} midias          publicadas nesta semana
 * @property {number} diasComColeta    0 a 7
 * @property {boolean} completa        7 dias coletados
 */

/**
 * @typedef {object} Historico
 * @property {string} contaId
 * @property {Janela[]} semanas   ordenadas da mais antiga para a mais recente
 * @property {{ inicio: string, fim: string, motivo: string }[]} lacunas
 * @property {string|null} primeiroDado
 * @property {{ temTrafegoPago: boolean, temConcorrentes: boolean }} recursos
 */
```

`valores` usa codigo canonico. Metrica ausente na semana e ausente do objeto —
nunca `0`, porque ausencia e lacuna, nao zero.

**Semana incompleta nao entra em janela de comparacao.** A semana corrente esta
pela metade e a semana com falha de coleta tem menos dias; qualquer uma das
duas, somada com as outras, produz uma queda que nao aconteceu. `montarHistorico`
marca `completa: false` e o motor descarta — e a lacuna vai para a tela.

### Regra

Arquivo declarativo em `src/rules/<versao>/<nome>.js`:

```js
export default {
  codigo: 'cadencia-em-queda',
  versao: '0.3.0',
  peso: 90,                       // maior peso vira o veredito da tela
  minimoDeSemanas: 8,
  /** @param {Historico} historico @returns {Achado|null} */
  avaliar(historico) { /* pura: sem rede, sem DOM, sem Date.now() */ },
}
```

`src/rules/index.js` exporta `{ versao: '0.3.0', regras: [...] }`.

### Achado

```js
/**
 * @typedef {object} Achado
 * @property {string} regra            codigo da regra
 * @property {string} versaoRegra
 * @property {'ok'|'atencao'|'critico'|'indeterminado'} severidade
 * @property {string} rotulo           ex: 'Frequencia de publicacao, causa nomeada'
 * @property {string} frase            O VEREDITO. Uma frase, dita em voz alta.
 * @property {string} apoio            paragrafo curto que sustenta a frase
 * @property {string} acao             uma acao imperativa e concreta
 * @property {string} confirmacao      como saber, depois, se a causa estava certa
 * @property {Evidencia[]} evidencias
 * @property {Serie|null} serie
 * @property {string[]} limites        o que ESTA regra nao sabe
 * @property {number} peso
 */

/**
 * @typedef {object} Evidencia
 * @property {string} rotulo
 * @property {string} metrica          codigo canonico
 * @property {number} valor
 * @property {number|null} anterior
 * @property {number|null} variacao    fracao: -0.4 = 40% abaixo
 * @property {number} casas            casas decimais com que valor e exibido
 * @property {'bom'|'ruim'|'neutro'} tom
 * @property {string} nota             ex: '40% abaixo, era 3,0'
 */

/**
 * @typedef {object} Serie
 * @property {string} rotuloBarra
 * @property {string} rotuloLinha
 * @property {{ rotulo: string, barra: number|null, linha: number|null }[]} pontos
 */
```

`tom` e decisao da regra, nunca do CSS: cair nem sempre e ruim.

**A variacao e calculada sobre os valores como sao exibidos**, nao sobre os
valores crus. Publicacoes por semana caiu de 3,0 para 1,8: quem conferir a
tabela na reuniao vai dividir 1,8 por 3,0 e obter 40%. Se a tela dissesse 42%
(a conta sobre 1,75 e 3,00) o cliente concluiria que a ferramenta erra —
e ele estaria certo em desconfiar. Numero da tela tem que fechar com a
propria tela. `casas` guarda a precisao usada, para a conta ser auditavel.

### Saida do motor

```js
/**
 * @typedef {object} Diagnostico
 * @property {string} id
 * @property {string} contaId
 * @property {string} geradoEm            ISO
 * @property {{ inicio: string, fim: string }} periodo
 * @property {string} rulesetVersion
 * @property {Achado[]} achados           ordenados por peso desc
 * @property {{ codigo: string, texto: string }[]} limites   limites da CONTA
 * @property {Cobertura} cobertura
 */

/**
 * @typedef {object} Cobertura
 * @property {number} semanas
 * @property {string|null} primeiroDado
 * @property {{ inicio: string, fim: string, motivo: string }[]} lacunas
 * @property {boolean} suficiente
 */
```

```js
/**
 * @param {Historico} historico
 * @param {{ versao: string, regras: object[] }} ruleset
 * @param {{ agora: string }} contexto   relogio injetado: motor puro nao le Date.now()
 * @returns {Diagnostico}
 */
gerarDiagnostico(historico, ruleset, contexto)
```

Sem semanas suficientes, o motor devolve `cobertura.suficiente = false` e um
achado `indeterminado` que diz isso na cara — nunca um veredito inventado.

---

## 4. Camada de servicos (`src/lib/`)

| Modulo | Funcoes |
|---|---|
| `supabase.js` | `obterCliente()`, `estaEmModoDemonstracao()` |
| `envelope.js` | `ok(data, meta?)`, `falha(codigo, mensagem, detalhe?)` |
| `erros.js` | `CODIGOS`, `mensagemDoErro(erroDoSupabase)` |
| `autenticacao.js` | `sessaoAtual()`, `entrarComEmail(email)`, `sair()`, `aoMudarSessao(cb)` |
| `tenants.js` | `listarTenantsDoUsuario()`, `obterTenant(tenantId)` |
| `contas.js` | `listarContasConectadas(tenantId)`, `obterConta(contaId)` |
| `diagnosticos.js` | `obterDiagnosticoMaisRecente(contaId)`, `listarDiagnosticos(contaId, opcoes)` |
| `snapshots.js` | `listarSerieSemanal(contaId, opcoes)` |
| `coleta.js` | `listarEventosDeColeta(contaId, opcoes)` |
| `conexaoMeta.js` | `urlDeConsentimento(estado)`, `concluirConexao(codigo, estado)`, `desconectarConta(contaId)`, `solicitarExclusaoDeDados(contaId)` |

Regras invioláveis desta camada:

- Nenhum `select *`. Campos explicitos, sempre (CLAUDE.md).
- Nenhuma leitura de token. `token_ref` nunca sai do banco para o front.
- Toda funcao valida entrada antes de tocar o banco.
- Nenhum `console.log` de payload: log sem dado sensivel.
- Erro do Supabase e traduzido para `CODIGOS`; nunca vaza mensagem crua.

O modo de demonstracao (`src/lib/demonstracao/`) implementa exatamente estas
assinaturas sobre a fixture de `src/fixtures/` — a agencia Estudio Vergara e
suas tres contas. Quem consome nao sabe em qual dos dois esta; so `meta.origem`
diz, e a tela mostra um aviso permanente de demonstracao.

As tres contas da fixture existem para cobrir os tres desfechos da tela:

| Conta | Desfecho | Exercita |
|---|---|---|
| Casa Oliveira | causa nomeada, `atencao` | o caso da identidade visual |
| Verdejar Plantas | saudavel, `ok`, com 5 dias sem coleta | `AvisoDeLacuna` (ADR-004) |
| Studio Nove | 3 semanas de historico | `indeterminado` / `SEM_DADO_SUFICIENTE` |

Numeros da Casa Oliveira sao os da identidade e valem como teste de regressao:
publicacoes por semana 1,8 contra 3,0; contas alcancadas 26.900 contra 41.200;
alcance por publicacao 2.240 contra 2.290 (estavel).

---

## 5. Kit visual (`src/components/shared/`)

Cada componente e um par `Nome.jsx` + `Nome.css`. Zero estilo no JSX: sem
`style={{...}}`, sem cor em prop. Estado visual entra por atributo de dado
(`data-severidade`, `data-tom`, `data-variante`) e o CSS reage.

| Componente | Props |
|---|---|
| `Marca` | `{ nome?, sufixo?, como? }` |
| `Botao` | `{ variante='secundario'|'primario'|'texto', tipo='button', aoClicar, carregando, desabilitado, children }` |
| `Cartao` | `{ como='section', alta=false, children, ...resto }` |
| `TituloDeSecao` | `{ children, apoio? }` |
| `SeloDeSeveridade` | `{ severidade, children }` |
| `Veredito` | `{ severidade, rotulo, frase, apoio?, como? }` |
| `Indicador` | `{ rotulo, valor, nota?, tom='neutro' }` |
| `GraficoCadencia` | `{ pontos, rotuloBarra, rotuloLinha, descricao }` |
| `Tabela` | `{ colunas, linhas, legenda }` |
| `ListaDeLimites` | `{ titulo, limites }` |
| `AvisoDeLacuna` | `{ lacunas }` |
| `Estado` | `{ tipo='carregando'|'vazio'|'erro', titulo, descricao?, children? }` |

Convencao de classe: `ki-<bloco>__<elemento>--<modificador>`, prefixo `ki-`
sempre. Sem utilitario solto, sem `!important` fora de `impressao.css`.

Toda tela renderiza os quatro estados: `carregando`, `vazio`, `erro`, `sucesso`
(CLAUDE.md).

---

## 6. Rotas (`src/app/`)

| Rota | Tela | Protegida |
|---|---|---|
| `/` | redireciona | — |
| `/entrar` | autenticacao | nao |
| `/conectar` | explica o requisito da Pagina do Facebook ANTES do clique (ADR-002) | sim |
| `/conectar/retorno` | callback do OAuth | sim |
| `/contas` | vazio, ou vai para a primeira conta | sim |
| `/contas/:contaId` | diagnostico | sim |
| `/contas/:contaId/relatorio` | relatorio | sim |
| `/contas/:contaId/historico` | diagnosticos anteriores | sim |
| `/privacidade` | politica de privacidade (App Review) | nao |
| `/dados` | exclusao de dados (App Review) | nao |

Rota protegida verifica sessao **antes** de renderizar (CLAUDE.md).

---

## 7. Banco (`supabase/`)

Fonte de verdade: `supabase/schema.sql`. Migrations em `supabase/migrations/`.

- RLS habilitada e **com politica** em toda tabela. Habilitar sem politica nega
  tudo e passa despercebido em review — ambos os erros contam como falha.
- Todo acesso de leitura passa por `tenant_membros` do usuario autenticado.
- Escrita em `snapshots_*`, `diagnosticos` e `coleta_eventos`: somente
  `service_role` (Edge Function).
- `definition of done` de tabela nova inclui teste de isolamento entre tenants.

Nome de tabela em portugues: `diagnosticos` (ADR-005 cita `diagnoses`; a grafia
correta e a do schema — ver nota de correcao no proprio ADR).

---

## 8. O que nenhum modulo pode fazer

Lista curta, tirada de CLAUDE.md e `memory/restrictions.md`. Violar qualquer
item e motivo de reprovar o PR sozinho:

- Calcular diagnostico na tela
- Persistir ou exibir metrica com o nome da Meta
- Hardcodar chave, secret, URL de API, marca, cor ou regra de cliente
- `select *` em tabela sensivel
- Logar token, senha ou payload de terceiro
- Deixar tabela com RLS desligada
- Esconder lacuna de dado da tela
