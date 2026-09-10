import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A Content-Security-Policy nasce no build, e nao em `public/_headers`.
 *
 * O motivo esta no ADR-010: a unica diretiva que depende de ambiente e o
 * `connect-src`, que precisa do host do Supabase. Uma CSP com host errado nao
 * degrada — ela bloqueia a chamada de login e o produto para de funcionar em
 * producao com o console limpo para quem nao souber onde olhar. Fixar o host num
 * arquivo estatico seria escrever esse erro a mao a cada troca de ambiente.
 *
 * `public/_headers` nao aceita comentario (arquivo de configuracao que falha ao
 * parsear derruba os cabecalhos em silencio), entao o porque de cada diretiva
 * mora no ADR e o porque de cada decisao de codigo mora aqui.
 */

/**
 * Origem do backend a partir da variavel de ambiente, para o `connect-src`.
 *
 * Tres casos, e os tres sao deliberados:
 *
 * 1. **Ausente** — devolve `null`. E o caso de hoje: sem `VITE_SUPABASE_URL` o
 *    produto sobe em modo de demonstracao (ADR-007) e `obterCliente()` devolve
 *    `null`, entao nao existe UMA chamada ao Supabase para o `connect-src`
 *    liberar. A CSP sai assim mesmo, sem entrada de backend. Nao emiti-la seria
 *    deixar sem protecao justamente `/privacidade` e `/dados`, as duas URLs
 *    estaticas que o App Review da Meta precisa alcancar.
 * 2. **Presente e valida** — devolve a origem (esquema + host + porta). O
 *    caminho e o resto da URL ficam de fora porque CSP casa por origem.
 * 3. **Presente e quebrada** — LANCA, e o build inteiro para.
 *
 * O terceiro caso e o coracao disto. `supabase.co/projeto` sem esquema, um
 * espaco perdido, um `htps://` — cada um desses geraria uma CSP sintaticamente
 * valida apontando para lugar nenhum, e a falha apareceria so no primeiro login
 * em producao. Parar o build troca um bug silencioso de producao por uma
 * mensagem de erro no lugar onde da para consertar.
 *
 * @param {string|undefined} bruto valor de `VITE_SUPABASE_URL`
 * @returns {{ http: string, websocket: string }|null} `null` em modo de demonstracao
 * @throws {Error} se a variavel existir e nao for uma URL http(s) absoluta
 */
export function origemDoBackend(bruto) {
  const valor = String(bruto ?? '').trim()
  if (!valor) return null

  let url
  try {
    url = new URL(valor)
  } catch {
    throw new Error(
      `VITE_SUPABASE_URL nao e uma URL absoluta: ${JSON.stringify(valor)}. ` +
        'A CSP precisa dela para liberar a chamada de login; com o valor errado o ' +
        'login falha em producao sem erro visivel. Use a forma completa, com esquema ' +
        '(https://<projeto>.supabase.co).',
    )
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `VITE_SUPABASE_URL tem esquema ${url.protocol} e a CSP so sabe liberar http(s): ` +
        `${JSON.stringify(valor)}.`,
    )
  }

  // O esquema do websocket acompanha o do backend (`https:` → `wss:`), em vez de
  // ser fixado em `wss:`: um backend local em `http:` continua consistente.
  return { http: url.origin, websocket: url.origin.replace(/^http/, 'ws') }
}

/**
 * A politica, em uma linha, pronta para o valor do cabecalho.
 *
 * @param {{ http: string, websocket: string }|null} backend saida de `origemDoBackend`
 * @returns {string}
 */
export function montarCSP(backend) {
  // `'self'` sozinho basta em modo de demonstracao: a fixture mora no bundle.
  const conexoes = ["'self'"]
  if (backend) conexoes.push(backend.http, backend.websocket)

  return [
    // Tudo que nao tiver diretiva propria cai aqui, e o produto e servido de
    // uma origem so.
    "default-src 'self'",
    // O bundle do Vite e um arquivo com hash no nome, servido pela propria
    // origem. Sem `'unsafe-inline'` e sem `'unsafe-eval'`: nao ha script inline
    // no `index.html` nem avaliacao de string em producao, e e essa ausencia que
    // faz a CSP valer alguma coisa contra XSS.
    "script-src 'self'",
    // O CSS tambem sai em arquivo proprio, e nenhum componente escreve
    // `style={{...}}` no JSX (CLAUDE.md manda o estilo ficar fora da marcacao,
    // e aqui isso vira uma diretiva mais apertada de graca).
    "style-src 'self'",
    // Nenhuma tela carrega imagem externa hoje. `data:` fica porque o Vite
    // embute asset pequeno como data URI no proprio bundle.
    "img-src 'self' data:",
    // O ponto do PR: com Inter e Newsreader em `public/fontes/`, aqui nao
    // aparece `fonts.gstatic.com` — nenhuma fonte vem de fora.
    "font-src 'self'",
    // A unica diretiva que muda por ambiente.
    `connect-src ${conexoes.join(' ')}`,
    // Sem `<base>` injetado, todo caminho relativo continua apontando para casa.
    "base-uri 'none'",
    // Nao ha plugin, applet nem `<object>` no produto.
    "object-src 'none'",
    // Mesma protecao do `X-Frame-Options: DENY`, na versao que os navegadores
    // atuais leem. Os dois convivem: o cabecalho antigo cobre quem nao le CSP.
    "frame-ancestors 'none'",
    // O unico formulario do produto e o de entrar, que e tratado em JavaScript e
    // nao tem `action`. Sem isto, um XSS repontaria o envio para fora.
    "form-action 'self'",
  ].join('; ')
}

/**
 * Insere um cabecalho no bloco `/*` de um arquivo `_headers`.
 *
 * O bloco vai do rotulo ate a primeira linha nao indentada, que e a regra de
 * formato do Cloudflare Pages. Escrever o cabecalho no fim do bloco preserva o
 * arquivo de origem como ele foi revisado, em vez de reescreve-lo.
 *
 * Lanca se o arquivo ja trouxer uma CSP: duas linhas iguais fariam o navegador
 * aplicar a INTERSECAO das duas politicas, que e o modo mais confuso possivel de
 * bloquear uma chamada legitima.
 *
 * @param {string} conteudo texto de `public/_headers`
 * @param {string} cabecalho linha ja formatada, `Nome: valor`
 * @returns {string}
 */
export function comCabecalhoNoBlocoRaiz(conteudo, cabecalho) {
  const nome = cabecalho.slice(0, cabecalho.indexOf(':')).trim().toLowerCase()
  const linhas = conteudo.split('\n')

  if (linhas.some((linha) => linha.trim().toLowerCase().startsWith(`${nome}:`))) {
    throw new Error(
      `public/_headers ja declara ${nome}, e o build tambem gera esse cabecalho. ` +
        'Duas politicas no mesmo response valem pela intersecao das duas. ' +
        'Remova a linha do arquivo: quem gera e o build (ADR-010).',
    )
  }

  const inicio = linhas.findIndex((linha) => linha.trim() === '/*')
  if (inicio === -1) {
    throw new Error('public/_headers nao tem o bloco `/*`, entao nao ha onde aplicar a CSP.')
  }

  let fim = inicio + 1
  while (fim < linhas.length && /^[ \t]/.test(linhas[fim])) fim += 1

  linhas.splice(fim, 0, `  ${cabecalho}`)
  return linhas.join('\n')
}

/**
 * Plugin de build: le `public/_headers`, acrescenta a CSP e grava `dist/_headers`.
 *
 * Roda em `closeBundle` porque e depois dali que o Vite terminou de copiar
 * `public/` para `dist/` — gravar antes seria ter o arquivo sobrescrito pela
 * copia, em silencio.
 *
 * @param {string|undefined} urlDoBackend valor de `VITE_SUPABASE_URL`
 */
function cabecalhosDeResposta(urlDoBackend) {
  let raiz = process.cwd()
  let saida = 'dist'
  let diretorioPublico = 'public'

  return {
    name: 'kora-cabecalhos-de-resposta',
    // So no build: em `vite dev` e em teste nao existe `dist/`, e o servidor de
    // desenvolvimento nao le `_headers`.
    apply: 'build',

    configResolved(config) {
      raiz = config.root
      saida = config.build.outDir
      diretorioPublico = config.publicDir
    },

    closeBundle() {
      const origem = resolve(diretorioPublico, '_headers')
      const destino = resolve(raiz, saida, '_headers')

      // A leitura falha alto de proposito. `_headers` sumindo e o deploy indo ao
      // ar sem cabecalho de seguranca nenhum, que e uma regressao que ninguem ve.
      const conteudo = readFileSync(origem, 'utf8')
      const csp = montarCSP(origemDoBackend(urlDoBackend))

      writeFileSync(destino, comCabecalhoNoBlocoRaiz(conteudo, `Content-Security-Policy: ${csp}`))
    },
  }
}

// Vite + Vitest. Sem alias magico: caminho relativo mantem a origem do import obvia
// em review de codigo (patterns.md, estrutura por-feature).
export default defineConfig(({ mode }) => {
  // `loadEnv` cobre os arquivos `.env*`; `process.env` cobre a variavel injetada
  // pelo GitHub Actions, que e como ela chega em producao (ADR-010).
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const urlDoBackend = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL

  return {
    plugins: [react(), cabecalhosDeResposta(urlDoBackend)],
    build: { outDir: 'dist', sourcemap: true },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.js'],
      // O terceiro padrao cobre o teste dos cabecalhos gerados aqui neste
      // arquivo: eles nao cabem em `src/`, que e codigo de produto.
      include: ['src/**/*.test.{js,jsx}', 'supabase/**/*.test.js', '*.test.js'],
      coverage: { reporter: ['text', 'html'], include: ['src/**'] },
    },
  }
})
