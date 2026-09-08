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

**A Content-Security-Policy nao esta, e a ausencia e deliberada.** Ela precisaria
listar o host do Supabase, que muda por ambiente, e uma CSP com host errado nao
degrada: ela bloqueia a chamada de login e o produto para de funcionar em
producao com o console limpo para quem nao souber onde olhar. Ela entra quando
houver projeto Supabase definitivo, gerada no build a partir de
`VITE_SUPABASE_URL`. Registrado em `docs/09_BACKLOG`.

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
  uma configuracao explicita. Mitigado pelo passo no CI. E a CSP fica pendente,
  o que e uma protecao a menos ate o Supabase definitivo existir.
- O ADR-001 dizia "Deploy: Vercel". **Este ADR o supera nesse ponto**, e so
  nesse: o resto da stack continua valendo.

## Ligacoes
- `public/_headers`, `.node-version`
- `.github/workflows/verificacao.yml` — o passo que cobra o modo SPA
- `docs/12_CUSTO_E_PRECIFICACAO/README.md`, secao 2.2 — o comparativo
- `docs/11_SEGURANCA/app-review.md` — a cadeia que isto destrava
