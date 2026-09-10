# ADR-010 — Hospedagem no Cloudflare Pages

**Status**: Aceito · **Data**: 2026-09-07 · **Decisores**: Matheus Bonato

## Contexto
O ADR-001 registrou "Vercel" como deploy e deixou a decisao comercial em aberto.
Ela venceu antes do previsto, e por um motivo diferente do que estava escrito.

`docs/12` dizia que o plano Hobby da Vercel so barrava "no momento em que voce
cobra do primeiro cliente". A definicao da propria Vercel e mais ampla:

> Commercial usage is defined as any Deployment that is used for the purpose of
> financial gain of **anyone** involved in **any part of the production** of the
> project, including a paid employee or consultant writing the code. Examples
> include […] **advertising the sale of a product or service**.
>
> — Vercel, *Fair Use Guidelines*, secao "Commercial usage"

O gatilho e o lancamento, nao a receita. E o lancamento e agora: o App Review da
Meta exige politica de privacidade e instrucoes de exclusao em URL publica
(`docs/11_SEGURANCA/app-review.md`), e essa publicacao ja fica sobre a linha.

O que a troca custa foi medido antes de decidir: **o build e estatico puro**.
`vite build` produz `index.html` e `assets/`, e nao ha funcao serverless no host
— as Edge Functions rodam no Supabase. O host so precisa servir arquivo. Nao ha
lock-in a desfazer, e nao havera se um dia for preciso trocar de novo.

## Decisao
**Cloudflare Pages**, no plano gratuito, que permite uso comercial.

> **No ar desde 2026-09-08** em https://kora-insights.pages.dev. A primeira
> publicacao falhou com `Authentication failed [code: 9106]` — token recusado, e
> nao configuracao errada. O workflow passou a sondar a credencial antes do build
> para que a proxima recusa diga o que corrigir.

| Opcao | Custo | Comercial no gratuito | Teto que importa aqui |
|---|---|---|---|
| Vercel Pro | US$ 20/mes | — (pago) | nenhum |
| **Cloudflare Pages** | R$ 0 | permitido | banda ilimitada; 500 builds/mes |
| Netlify Free | R$ 0 | permitido, exceto revender hospedagem | 100 GB de banda/mes |

Pesou, em ordem: e a unica das tres sem teto de banda — as outras duas trazem um
numero que um dia obriga a decidir de novo, e esta nao cria a segunda decisao;
custa R$ 0 e destrava a cadeia parada do App Review; e a regra de custo do
projeto manda adiar o pago por padrao, sendo que aqui o gratuito nao e um degrau
abaixo, e o mesmo servico para um site estatico. Vercel Pro custaria ~R$ 1.320 em
doze meses antes do primeiro real de receita.

### Como o deploy acontece: GitHub Actions, e nao a integracao Git do painel

**Emenda de 2026-09-08.** Este ADR previa conectar o repositorio pela integracao
Git no painel da Cloudflare. O que foi construido e `.github/workflows/publicar.yml`,
que faz o build e publica com `wrangler` a cada push na `main`.

As duas formas entregam a mesma coisa — deploy automatico a cada push — e a
escolha tem uma razao de projeto e uma pratica.

A de projeto: assim a configuracao de deploy e versionada, revisada em PR e
cobrada pelo mesmo CI que cobra o resto. Quem mudar como o produto vai ao ar
deixa rastro no repositorio, e nao numa tela que so o dono da conta ve.

A pratica: a integracao Git exige cliques no painel da Cloudflare, e o workflow
exige apenas dois segredos no GitHub. **O token nunca precisa passar por
conversa nenhuma** — vai direto para os segredos do repositorio, que o proprio
GitHub mascara em log.

> **As duas formas se somam, nao se substituem.** Se o repositorio TAMBEM for
> conectado pela integracao Git no painel, cada push publica duas vezes e as duas
> competem pelo mesmo endereco. Escolha uma.

| Onde | O que |
|---|---|
| Segredo `CLOUDFLARE_API_TOKEN` | escopo **Account → Cloudflare Pages → Edit**, e nada alem |
| Segredo `CLOUDFLARE_ACCOUNT_ID` | o id da conta, visivel no painel |
| Build command | `npm run build` (no workflow) |
| Build output | `dist` |
| Node | `.node-version`, fixado em 22 — o Pages e o `setup-node` leem o mesmo arquivo |
| Nome do projeto | `kora-insights`, criado na primeira execucao |

### As variaveis do front moram no GitHub, nao no painel

Consequencia direta de o build acontecer no Actions: `VITE_*` e lida **no
build**, porque o Vite a inlineia no bundle. Configurada no painel da Cloudflare
ela nao teria efeito nenhum, ja que la nao ha build.

Ausentes, `estaEmModoDemonstracao()` devolve `true` e o produto sobe em modo de
demonstracao, com o aviso permanente (ADR-007). **Isso torna util publicar antes
de existir projeto Supabase**: `/privacidade` e `/dados` sao estaticas, nao
consultam banco, e sao exatamente as duas URLs que o App Review exige.

### O fallback de rota liga sozinho, e o gatilho e uma ausencia

Esta e a parte que quase saiu errada, e por isso esta escrita em detalhe.

A intuicao — e o primeiro rascunho deste ADR — mandava um `public/_redirects`
com `/* /index.html 200`, que e como se faz na Netlify. **No Cloudflare Pages
isso nao funciona**: o `_redirects` de la aceita apenas codigos de redirecionamento
(301, 302, 303, 307, 308), e nao reescrita com 200. O arquivo teria ficado inerte,
e o pior de um arquivo inerte e parecer que resolve.

O que o Pages faz e outra coisa: **se nao existe um `404.html` na raiz do build,
ele assume que o projeto e uma SPA** e responde qualquer caminho nao encontrado
com o `index.html`, em 200. O Vite nao gera `404.html`, entao o modo liga sem
configuracao nenhuma.

Regra que depende de um arquivo **nao** existir e fragil por natureza: o dia em
que alguem adicionar uma pagina 404 estatica, `/contas/<id>` aberto direto passa
a devolver 404 em producao, com a suite verde e sem erro nenhum no build. Por
isso o CI passou a conferir, depois do build, que `dist/404.html` nao existe.

### As fontes sao nossas, e nao do Google

**Emenda de 2026-09-10.** O `index.html` carregava Inter e Newsreader de
`fonts.googleapis.com`. Isso nao e uma escolha de performance com um efeito
colateral pequeno: **o navegador de todo visitante entregava o IP dele ao Google
antes de qualquer consentimento**, e o pedido saia igual em `/privacidade` e
`/dados` — as duas paginas publicas que falam de privacidade, e exatamente as
duas URLs que o App Review da Meta exige.

A politica de privacidade ja dizia, na secao "Com quem compartilhamos": *"Com
ninguem. Os dados ficam na infraestrutura que hospeda o produto e nao sao
repassados a terceiros"*. Enquanto a fonte viesse do Google, essa frase estava
errada em uma das poucas paginas que o cliente le com atencao. O consertado aqui
foi o codigo, e nao o texto: a politica estava certa e o produto e que nao a
cumpria.

As duas familias vivem em `public/fontes/`, com `@font-face` proprio em
`public/fontes.css`, e o `<link>` do Google saiu.

| Decisao | Por que |
|---|---|
| Os mesmos bytes que o Google servia (woff2, subsets `latin` e `latin-ext`) | fidelidade de renderizacao sem discussao: se a face fosse re-gerada, "esta diferente" viraria uma investigacao sem fim |
| Quatro arquivos, e nao dez | as duas familias sao **variaveis**: um arquivo por subset cobre a faixa de peso inteira. O proprio Google servia o mesmo arquivo para 400, 500 e 600 |
| `font-weight: 400 600` (Inter) e `400 500` (Newsreader) | e a faixa que o design system usa (`docs/02_DESIGN_SYSTEM/TOKENS.md`). Fora dela o navegador limita em vez de sintetizar negrito falso — o mesmo que o link do Google fazia |
| `font-display: swap` | o texto aparece na primeira pintura com a fonte de sistema e troca depois. Nenhuma tela nasce em branco esperando fonte |
| `latin` **e** `latin-ext`, separados por `unicode-range` | o produto e pt-BR e a acentuacao inteira cabe em `latin` (U+00C0-00FF). `latin-ext` fica para o resto e **so e baixado se um caractere dele aparecer**: medido, uma pagina carrega 2 arquivos, nao 4 |
| `-v20` / `-v26` no nome do arquivo | e a versao da familia no upstream. Trocar a face troca o nome, e so por isso `/fontes/*` pode ser `immutable` sem risco de segurar arquivo velho |
| `public/fontes.css` fora de `/fontes/` | a folha **nao** tem versao no nome. Dentro do diretorio `immutable` ela ficaria presa por um ano, e mudar um `@font-face` nao chegaria a ninguem |
| `<link rel="preload">` das duas faces `latin`, com `crossorigin` | sem ele o navegador so descobre a fonte depois de baixar e parsear o CSS, o que serializa duas idas. `crossorigin` e obrigatorio mesmo na propria origem: fonte e sempre buscada em modo CORS, e sem o atributo o preload nao casa com o pedido real e o arquivo vem duas vezes |
| Licenca ao lado (`OFL-inter.txt`, `OFL-newsreader.txt`) | a SIL OFL pede que a licenca acompanhe os arquivos. Hospedar por conta propria transfere essa obrigacao do Google para nos |

O custo: 180 KB no primeiro carregamento (as duas faces `latin`), servidos pela
mesma conexao que ja esta aberta para o HTML. O que se ganha, alem da
privacidade, e o caminho critico: sumiram um DNS, um handshake TLS e duas idas a
`fonts.googleapis.com` e `fonts.gstatic.com` — e some tambem o dia em que o
Google mudar a URL do CSS e a tipografia do produto trocar sozinha.

### Cabecalhos de resposta

`public/_headers` (o Vite copia `public/` inteira para `dist/`, e o Pages le o
arquivo de la). Sem comentario dentro dele de proposito: arquivo de configuracao
que falha ao parsear derruba os cabecalhos em silencio, e o motivo de cada linha
cabe aqui.

| Cabecalho | Por que |
|---|---|
| `X-Frame-Options: DENY` | o produto nunca e legitimamente exibido em iframe. Sem isto, uma pagina de terceiro sobrepoe a nossa e captura o clique do cliente autenticado — inclusive o de excluir dados, que nao tem volta |
| `X-Content-Type-Options: nosniff` | adivinhacao de tipo transforma conteudo em script |
| `Referrer-Policy: strict-origin-when-cross-origin` | o caminho carrega o id da conta; sem isto ele viaja no `Referer` para todo host externo aberto a partir daqui |
| `Permissions-Policy` negando camera, microfone e localizacao | nenhuma tela pede. Negar por padrao e mais barato que auditar depois quem passou a pedir |
| `Cache-Control: immutable` em `/assets/*` | o bundle tem hash no nome, entao deploy novo gera nome novo. Sem isto o cliente segura JS velho contra banco novo, que e a forma mais confusa de bug de producao |
| `Cache-Control: immutable` em `/fontes/*` | mesma logica, por outro caminho: a versao no nome do arquivo (`-v20`, `-v26`) faz o papel do hash. `public/fontes.css` fica **fora** desse diretorio de proposito, porque nao tem versao no nome e precisa continuar sendo revalidado |

**A Content-Security-Policy entrou, e ela e gerada no build.**

**Emenda de 2026-09-10.** Este ADR registrava a ausencia dela como deliberada: a
CSP precisa listar o host do Supabase, que muda por ambiente, e **uma CSP com
host errado nao degrada — ela bloqueia a chamada de login e o produto para de
funcionar em producao com o console limpo para quem nao souber onde olhar.** Esse
risco continua real. O que mudou foi como ele e tratado.

Duas coisas destravaram a decisao. Com as fontes hospedadas por nos, a politica
ficou muito mais curta: sumiram `fonts.googleapis.com` de `style-src` e
`fonts.gstatic.com` de `font-src`, e sobrou **uma** diretiva que depende de
ambiente. E essa uma passou a ser escrita por quem sabe o valor certo — o build —
em vez de copiada a mao para um arquivo estatico a cada troca de ambiente.

`vite.config.js` le `VITE_SUPABASE_URL`, monta a politica e grava `dist/_headers`
a partir de `public/_headers`. As funcoes puras que fazem isso tem teste em
`cabecalhos.test.js`, porque erro nelas nao aparece em teste de tela nem no
build: aparece no primeiro login em producao.

| Diretiva | Por que |
|---|---|
| `default-src 'self'` | o que nao tiver diretiva propria cai aqui, e o produto e servido de uma origem so |
| `script-src 'self'` | sem `'unsafe-inline'` e sem `'unsafe-eval'`: nao ha script inline no `index.html` nem avaliacao de string em producao, e e essa ausencia que faz a CSP valer alguma coisa contra XSS |
| `style-src 'self'` | o CSS sai em arquivo proprio e nenhum componente escreve `style={{...}}` no JSX. A regra do CLAUDE.md de manter estilo fora da marcacao vira aqui uma diretiva mais apertada, de graca |
| `img-src 'self' data:` | nenhuma tela carrega imagem externa. `data:` fica porque o Vite embute asset pequeno como data URI |
| `font-src 'self'` | o resultado da emenda acima: nenhuma fonte pode vir de fora, nem por engano num PR futuro |
| `connect-src 'self' <supabase> wss://<supabase>` | a unica que muda por ambiente. O `wss:` acompanha por antecipacao: no dia em que uma tela usar Realtime, a falha seria um socket que nao abre, sem erro de rede — o tipo de bug que custa uma tarde |
| `base-uri 'none'` | sem `<base>` injetado, todo caminho relativo continua apontando para casa |
| `object-src 'none'` | nao ha plugin, applet nem `<object>` no produto |
| `frame-ancestors 'none'` | mesma protecao do `X-Frame-Options: DENY`, na versao que os navegadores atuais leem. Os dois convivem: o cabecalho antigo cobre quem nao le CSP |
| `form-action 'self'` | o unico formulario e o de entrar, tratado em JavaScript e sem `action`. Sem isto, um XSS repontaria o envio para fora |

A Meta **nao** aparece na politica, e isso nao e esquecimento: o dialogo de OAuth
e alcancado por `window.location.assign`, que e navegacao de primeiro nivel.
Nenhuma diretiva de CSP implementada pelos navegadores governa isso — `navigate-to`
nunca saiu do rascunho. Adicionar o host da Meta aqui seria ruido que da falsa
impressao de estar protegendo alguma coisa.

#### O caso da variavel ausente, que e o caso de hoje

Esta e a decisao que o resto desta secao existe para justificar, porque errar
nela derruba justamente as URLs que o App Review precisa alcancar.

Sem `VITE_SUPABASE_URL`, o produto sobe em modo de demonstracao (ADR-007) e
`obterCliente()` devolve `null`. **Nao existe uma unica chamada ao Supabase para
o `connect-src` liberar** — a fixture mora no bundle. Entao a escolha e:

> **A CSP e emitida do mesmo jeito, sem entrada de backend no `connect-src`.**

A alternativa — nao emitir a politica quando a variavel falta — foi descartada
por deixar sem protecao exatamente o modo que esta no ar hoje. `/privacidade` e
`/dados` sao as duas paginas publicas do produto, sao as que o App Review visita,
e sao as que falam de privacidade. Publicar essas duas com um cabecalho a menos
para evitar um risco que naquele modo **nao existe** seria pagar caro por nada.

O risco que sobra e o outro: a variavel **presente e errada**. `supabase.co/projeto`
sem esquema, um espaco perdido, um `htps://` — cada um gera uma CSP
sintaticamente valida que nao libera nada, e a falha so aparece no primeiro
login. Por isso o build **para**, com o nome da variavel e a forma esperada na
mensagem. Um erro de build e barato; um login que falha em producao com o console
limpo e o cenario que este ADR vem tentando evitar desde a primeira versao.

| `VITE_SUPABASE_URL` | O que o build faz |
|---|---|
| ausente ou vazia | emite a CSP com `connect-src 'self'`. Modo de demonstracao nao chama backend |
| URL http(s) valida | emite `connect-src 'self' <origem> <origem em ws>` |
| qualquer outra coisa | **falha**, e diz qual variavel e qual forma se espera |

Conferido no navegador, sobre o `dist/` servido com os cabecalhos reais: o host
configurado passa, um host qualquer e recusado com `Refused to connect`, e uma
fonte de `fonts.gstatic.com` e recusada com `Refused to load the font`.

### O que o dominio novo quebra se ninguem lembrar

Tres variaveis passam a apontar para o lugar errado no momento em que o endereco
muda, e **nenhuma delas falha no build** — todas falham em uso, depois:

| Variavel | Onde | O que quebra se ficar velha |
|---|---|---|
| `VITE_META_REDIRECT_URI` | segredo do GitHub, lido no build | a Meta recusa o `redirect_uri` e a conexao morre no dialogo |
| `KORA_REDIRECIONAMENTOS_PERMITIDOS` | Supabase | `conectar-conta` recusa com `ENTRADA_INVALIDA`, mesmo com a Meta aprovando |
| `KORA_ORIGENS_PERMITIDAS` | Supabase | o CORS nao ecoa a origem nova e **toda** chamada do navegador as Edge Functions falha |

A terceira e a pior: ela nao afeta uma tela, afeta todas, e a mensagem que chega
ao console nao aponta para a causa.

## Alternativas
- **Vercel Pro (US$ 20/mes).** Resolve com dinheiro o que R$ 0 resolvem igual num
  site estatico. Descartada pela regra de custo do projeto.
- **Netlify Free.** Tambem permite uso comercial e tem o `_redirects` com 200 que
  a intuicao esperava. Perde pelo teto de 100 GB de banda, que recria a decisao
  la na frente. Fica como segunda opcao se a experiencia do Pages decepcionar.
- **Continuar na Vercel Hobby.** E violar os termos do fornecedor a partir da
  primeira pagina que anuncia o produto. Descartada.

## Consequencias
- Positivas: R$ 0, sem teto de banda, e a cadeia do App Review destrava — URLs
  publicaveis, verificacao de negocio, screencast, submissao.
- Negativas: o fallback de SPA depende de uma ausencia, que e mais fragil do que
  uma configuracao explicita. Mitigado pelo passo no CI. E hospedar as fontes
  transfere para o repositorio uma manutencao que era do Google: atualizar uma
  familia agora e baixar o arquivo, renomear com a versao nova e conferir o
  `unicode-range`. E pouco, e acontece raramente, mas nao acontece sozinho.
- **Emenda de 2026-09-10**: a CSP deixou de ser pendencia e as fontes deixaram de
  sair da maquina do visitante para o Google. As duas mudancas se sustentam:
  hospedar as fontes e o que tornou a politica curta o bastante para ser gerada
  com seguranca.
- O ADR-001 dizia "Deploy: Vercel". **Este ADR o supera nesse ponto**, e so
  nesse: o resto da stack continua valendo.

## Ligacoes
- `public/_headers`, `.node-version`
- `vite.config.js` — gera a CSP a partir de `VITE_SUPABASE_URL`; `cabecalhos.test.js` cobre as tres funcoes puras
- `public/fontes/` e `public/fontes.css` — as duas familias e o `@font-face` proprio
- `docs/02_DESIGN_SYSTEM/TOKENS.md`, secao "Tipografia" — de onde vem a lista de pesos
- `.github/workflows/verificacao.yml` — o passo que cobra o modo SPA
- `docs/12_CUSTO_E_PRECIFICACAO/README.md`, secao 2.2 — o comparativo
- `docs/11_SEGURANCA/app-review.md` — a cadeia que isto destrava
