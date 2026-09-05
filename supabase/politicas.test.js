/**
 * Teste de contrato sobre o SQL, lido como texto.
 *
 * Por que um teste que nao sobe banco
 * -----------------------------------
 * Os erros de RLS que mais doem nao sao sutis, sao esquecimentos — tabela nova
 * sem `enable row level security`, RLS ligada e sem nenhuma politica (que nega
 * tudo em silencio), politica de escrita sobrando para `authenticated` numa
 * tabela de coleta. Todos aparecem no proprio texto do SQL, e um teste que roda
 * em milissegundos pega os tres a cada `npm test`.
 *
 * Ele NAO substitui o teste de isolamento entre tenants com banco de verdade —
 * aquele que cria dois tenants, autentica um e prova que ele nao ve a linha do
 * outro. Esse continua no backlog e esta descrito em `supabase/README.md`.
 * Nenhuma assercao aqui prova que a politica FILTRA certo; elas provam que a
 * politica EXISTE e que nao ha porta escancarada.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PASTA = dirname(fileURLToPath(import.meta.url))

/** Tabelas em que so o servidor escreve (contratos.md, secao 7). */
const TABELAS_DE_COLETA = [
  'snapshots_conta',
  'snapshots_midia',
  'diagnosticos',
  'coleta_eventos',
]

/**
 * @param {string} caminho relativo a `supabase/`
 * @returns {string} conteudo do arquivo
 */
function ler(caminho) {
  return readFileSync(join(PASTA, caminho), 'utf8')
}

/**
 * Todos os arquivos versionados desta pasta, recursivamente.
 *
 * @param {string} raiz caminho absoluto
 * @returns {string[]} caminhos absolutos
 */
function listarArquivos(raiz) {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(raiz, entrada.name)
    if (entrada.isDirectory()) return listarArquivos(caminho)
    return [caminho]
  })
}

/**
 * Remove comentario de linha e de bloco de um arquivo TypeScript.
 *
 * @param {string} codigo conteudo do arquivo
 * @returns {string} o mesmo codigo, sem comentario
 */
function semComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

const schema = ler('schema.sql')
const migrationDoEsquema = ler('migrations/20260905120000_esquema_inicial.sql')
const migrationDasPoliticas = ler('migrations/20260905120100_politicas_rls.sql')

/**
 * Nomes de tabela criadas no SQL.
 *
 * @param {string} sql
 * @returns {string[]}
 */
function tabelasCriadas(sql) {
  const encontradas = [...sql.matchAll(/create table (?:if not exists )?public\.([a-z0-9_]+)/gi)]
  return encontradas.map((achado) => achado[1])
}

/**
 * Nomes de tabela com RLS habilitada.
 *
 * @param {string} sql
 * @returns {string[]}
 */
function tabelasComRls(sql) {
  const encontradas = [
    ...sql.matchAll(/alter table public\.([a-z0-9_]+)\s+enable row level security/gi),
  ]
  return encontradas.map((achado) => achado[1])
}

/**
 * @typedef {object} Politica
 * @property {string} nome
 * @property {string} tabela
 * @property {string} comando `select`, `insert`, `update`, `delete` ou `all`
 * @property {string[]} papeis papeis listados no `to`
 */

/**
 * Politicas declaradas no SQL.
 *
 * O cabecalho da politica e lido ate o `using` ou o `with check`, que e onde
 * comeca a expressao. A expressao em si nao e analisada: dizer se ela filtra
 * certo exige banco, e e por isso que o teste de isolamento continua no backlog.
 *
 * @param {string} sql
 * @returns {Politica[]}
 */
function politicasDeclaradas(sql) {
  const padrao =
    /create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)([\s\S]*?)(?:\busing\b|\bwith\s+check\b)/gi
  return [...sql.matchAll(padrao)].map((achado) => {
    const cabecalho = achado[3]
    const comando = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(cabecalho)
    const papeis = /\bto\s+([a-z0-9_,\s]+)/i.exec(cabecalho)
    return {
      nome: achado[1],
      tabela: achado[2],
      comando: (comando?.[1] ?? 'all').toLowerCase(),
      papeis: (papeis?.[1] ?? '')
        .split(',')
        .map((papel) => papel.trim())
        .filter((papel) => papel.length > 0),
    }
  })
}

describe('schema: RLS em toda tabela', () => {
  it('toda tabela criada tem enable row level security', () => {
    const criadas = tabelasCriadas(schema)
    const comRls = new Set(tabelasComRls(schema))
    expect(criadas.length).toBeGreaterThan(0)
    expect(criadas.filter((tabela) => !comRls.has(tabela))).toEqual([])
  })

  it('toda tabela com RLS tem politica de leitura para authenticated', () => {
    const politicas = politicasDeclaradas(schema)
    const semLeitura = tabelasComRls(schema).filter(
      (tabela) =>
        !politicas.some(
          (politica) =>
            politica.tabela === tabela &&
            (politica.comando === 'select' || politica.comando === 'all') &&
            politica.papeis.includes('authenticated'),
        ),
    )
    // A politica precisa ser para `authenticated`, e nao qualquer uma: as
    // tabelas tambem tem politica `for all to service_role`, e `service_role`
    // ignora RLS de qualquer jeito. Contar essa como leitura deixaria passar o
    // caso exato que este teste existe para pegar — RLS ligada, o servidor
    // escrevendo normalmente e o cliente vendo tela vazia, sem erro nenhum.
    expect(semLeitura).toEqual([])
  })

  it('toda politica declara os papeis a que se aplica', () => {
    const semPapel = politicasDeclaradas(schema).filter((politica) => politica.papeis.length === 0)
    // Politica sem `to` vale para PUBLIC, o que inclui `anon`. Escrever o papel
    // e a diferenca entre "o dono le" e "a internet le".
    expect(semPapel.map((politica) => politica.nome)).toEqual([])
  })
})

describe('schema: o cliente nao escreve linha de coleta', () => {
  it.each(TABELAS_DE_COLETA)('%s nao tem politica de escrita para authenticated', (tabela) => {
    const escritas = politicasDeclaradas(schema).filter(
      (politica) =>
        politica.tabela === tabela &&
        politica.papeis.includes('authenticated') &&
        politica.comando !== 'select',
    )
    // Snapshot e diagnostico sao gravados pela Edge Function com service_role.
    // Cliente que pudesse inserir linha de coleta poderia inventar a propria
    // serie — e o diagnostico deixaria de ser sobre o que aconteceu.
    expect(escritas.map((politica) => politica.nome)).toEqual([])
  })

  it.each(TABELAS_DE_COLETA)('%s so concede select a authenticated', (tabela) => {
    const padrao = new RegExp(`grant\\s+([a-z ,()a-z_]+?)\\s+on\\s+public\\.${tabela}\\b`, 'gi')
    const concessoes = [...schema.matchAll(padrao)].map((achado) => achado[1].trim().toLowerCase())
    expect(concessoes.length).toBeGreaterThan(0)
    expect(concessoes.every((concessao) => concessao === 'select')).toBe(true)
  })
})

describe('schema: token_ref nao sai do banco', () => {
  it('nenhum grant de coluna inclui token_ref', () => {
    const grants = [...schema.matchAll(/grant\s+select\s*\(([^)]*)\)/gi)].map((achado) => achado[1])
    expect(grants.length).toBeGreaterThan(0)
    expect(grants.some((colunas) => colunas.includes('token_ref'))).toBe(false)
  })

  it('ig_contas revoga o acesso amplo antes de conceder colunas', () => {
    // Sem o revoke, o grant padrao do Supabase (`all on all tables`) continua
    // valendo e o privilegio de coluna nao tira nada de ninguem.
    expect(schema).toMatch(/revoke all on all tables in schema public from anon, authenticated/i)
    expect(schema).toMatch(/grant select \([^)]*\)\s*\n?\s*on public\.ig_contas to authenticated/i)
  })

  it('as funcoes de cofre nao sao executaveis pelo usuario logado', () => {
    for (const funcao of ['guardar_token', 'ler_token', 'apagar_token']) {
      const revoke = new RegExp(
        `revoke all on function public\\.${funcao}\\([^)]*\\) from public, anon, authenticated`,
        'i',
      )
      expect(schema).toMatch(revoke)
    }
  })
})

describe('migrations refletem o schema', () => {
  it('as tabelas do schema sao criadas na migration inicial', () => {
    expect(tabelasCriadas(migrationDoEsquema).sort()).toEqual(tabelasCriadas(schema).sort())
  })

  it('as politicas do schema estao na migration de RLS', () => {
    const noSchema = politicasDeclaradas(schema).map((politica) => politica.nome).sort()
    const naMigration = politicasDeclaradas(migrationDasPoliticas)
      .map((politica) => politica.nome)
      .sort()
    // Schema e migration divergindo e a forma classica de a politica existir no
    // arquivo que se le em review e faltar no banco que roda.
    expect(naMigration).toEqual(noSchema)
  })
})

describe('nenhum segredo literal em supabase/', () => {
  /** Formatos de segredo, e nao palavras: `token` num comentario e legitimo. */
  const PADROES = [
    { nome: 'JWT (anon ou service_role)', padrao: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./ },
    { nome: 'token de longa duracao da Meta', padrao: /\bEA[A-Za-z0-9]{40,}\b/ },
    { nome: 'chave de gateway', padrao: /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{12,}\b/ },
    { nome: 'chave privada PEM', padrao: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    {
      nome: 'segredo atribuido a uma constante',
      padrao:
        /\b(password|senha|secret|app_secret|api[_-]?key|service[_-]?role[_-]?key)\b\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i,
    },
  ]

  const arquivos = listarArquivos(PASTA).filter((caminho) => /\.(sql|ts|js|md)$/.test(caminho))

  it('ha arquivos para inspecionar', () => {
    expect(arquivos.length).toBeGreaterThan(5)
  })

  it.each(PADROES)('nenhum arquivo contem $nome', ({ padrao }) => {
    const suspeitos = arquivos.filter((caminho) => padrao.test(readFileSync(caminho, 'utf8')))
    expect(suspeitos.map((caminho) => caminho.slice(PASTA.length + 1))).toEqual([])
  })
})

describe('Edge Functions: o que reprova sozinho', () => {
  const funcoes = listarArquivos(join(PASTA, 'functions')).filter((caminho) =>
    caminho.endsWith('.ts'),
  )

  it('ha funcoes para inspecionar', () => {
    expect(funcoes.length).toBeGreaterThan(3)
  })

  it('nenhuma funcao usa select *', () => {
    // O comentario e removido antes da busca: "nenhum select *" aparece escrito
    // justamente nos arquivos que seguem a regra, e um teste que acusa a propria
    // documentacao da regra vira teste que se desliga.
    const suspeitos = funcoes.filter((caminho) => {
      const codigo = semComentarios(readFileSync(caminho, 'utf8'))
      return /\.select\(\s*(?:['"`]\s*\*|\))/.test(codigo) || /['"`]\s*select\s+\*/i.test(codigo)
    })
    expect(suspeitos.map((caminho) => caminho.slice(PASTA.length + 1))).toEqual([])
  })

  it('nenhuma funcao le variavel com prefixo VITE_', () => {
    // `VITE_` significa "vai para o bundle do navegador". Segredo de servidor com
    // esse prefixo e segredo publicado (CLAUDE.md, Seguranca).
    const suspeitos = funcoes.filter((caminho) => /VITE_/.test(readFileSync(caminho, 'utf8')))
    expect(suspeitos.map((caminho) => caminho.slice(PASTA.length + 1))).toEqual([])
  })

  it('nenhuma funcao coloca o token na query string', () => {
    const suspeitos = funcoes.filter((caminho) =>
      /searchParams\.(set|append)\(\s*['"`]access_token/.test(readFileSync(caminho, 'utf8')),
    )
    expect(suspeitos.map((caminho) => caminho.slice(PASTA.length + 1))).toEqual([])
  })
})
