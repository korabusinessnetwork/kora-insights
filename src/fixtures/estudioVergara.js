/**
 * Fixture do modo de demonstracao: a agencia Estudio Vergara e suas tres contas.
 *
 * Por que existe
 * --------------
 * 1. Dev e teste sem Supabase e sem app da Meta aprovado.
 * 2. A call de venda e o screencast do App Review precisam de tela cheia de
 *    dado antes de existir cliente (docs/13_VENDA).
 * 3. O diagnostico mostrado aqui **sai do motor de regras real** rodando sobre
 *    esta serie. Nao ha texto de veredito escrito a mao em lugar nenhum do
 *    produto (ADR-005).
 *
 * As tres contas cobrem, de proposito, os tres desfechos que a tela precisa
 * saber mostrar:
 *   - Casa Oliveira    causa nomeada (cadencia em queda) — o caso da identidade
 *   - Verdejar Plantas conta saudavel + lacuna de coleta (ADR-004)
 *   - Studio Nove      historico curto demais para diagnosticar
 *
 * Tudo e deterministico: nenhuma data de relogio, nenhum numero aleatorio.
 * Fixture que muda sozinha nao serve de base para teste.
 */

import { diasDaSemana, distribuir, somarDias } from './calendario.js'

/** Momento congelado da demonstracao. Igual ao rodape da identidade. */
export const AGORA = '2026-09-05T09:12:00.000Z'

/** Ultima semana ISO completa em AGORA. E a semana que o cabecalho anuncia. */
export const SEMANA_REFERENCIA = { inicio: '2026-08-24', fim: '2026-08-30' }

/** Segunda-feira da primeira das 16 semanas de historico. */
const PRIMEIRA_SEGUNDA = '2026-05-11'

const VERSAO_API = 'v23.0'
const VERSAO_ADAPTADOR = '1.0.0'

/**
 * Uma midia da semana, ja com as metricas canonicas derivadas do alcance.
 * As proporcoes (curtida, comentario, salvamento por mil alcancados) sao fixas
 * por semana para a serie ficar legivel — a variacao interessante do caso e o
 * volume, nao o ruido.
 *
 * @param {object} entrada
 * @param {number} entrada.alcance
 * @param {number} entrada.salvamentosPorMil
 * @param {string} entrada.tipo
 * @returns {Record<string, number>}
 */
function metricasDaMidia({ alcance, salvamentosPorMil, tipo }) {
  const salvamentos = Math.round((alcance * salvamentosPorMil) / 1000)
  const curtidas = Math.round(alcance * 0.062)
  const comentarios = Math.round(alcance * 0.006)
  const compartilhamentos = Math.round(alcance * 0.011)
  return {
    alcance,
    visualizacoes: Math.round(alcance * (tipo === 'reel' ? 2.1 : 1.5)),
    curtidas,
    comentarios,
    salvamentos,
    compartilhamentos,
    interacoes: curtidas + comentarios + salvamentos + compartilhamentos,
  }
}

/**
 * Expande um plano semanal em linhas de snapshot como as que a Edge Function
 * gravaria: uma por conta/dia/metrica e uma por midia/dia/metrica.
 *
 * Simplificacao consciente da fixture: a midia recebe **uma** leitura, no
 * ultimo dia coletado da semana em que foi publicada, em vez de uma por dia ate
 * estabilizar. A coleta real grava todo dia (ADR-004); aqui isso so inflaria a
 * fixture sem mudar nenhum numero de tela.
 *
 * @param {object} entrada
 * @param {string} entrada.contaId
 * @param {SemanaPlanejada[]} entrada.semanas
 * @param {string} entrada.primeiraSegunda segunda da primeira semana do plano
 * @param {string} entrada.ultimoDia nao existe linha depois deste dia
 * @param {string[]} [entrada.diasSemColeta] dias em que a coleta falhou
 * @returns {{ snapshotsConta: object[], snapshotsMidia: object[] }}
 */
function expandirPlano({ contaId, semanas, primeiraSegunda, ultimoDia, diasSemColeta = [] }) {
  const semColeta = new Set(diasSemColeta)
  const snapshotsConta = []
  const snapshotsMidia = []

  semanas.forEach((semana, indiceDaSemana) => {
    const segunda = somarDias(primeiraSegunda, indiceDaSemana * 7)
    const dias = diasDaSemana(segunda)
    // A semana corrente esta pela metade e a coleta pode ter falhado em dias
    // avulsos. Nos dois casos o dia simplesmente nao tem linha — e a ausencia,
    // nao um zero, e o que deixa a lacuna visivel para o motor (ADR-004).
    const diasComColeta = dias.filter((dia) => dia <= ultimoDia && !semColeta.has(dia))
    if (diasComColeta.length === 0) return

    const diaDaLeitura = diasComColeta[diasComColeta.length - 1]

    const fluxos = {
      alcance: semana.alcance,
      visualizacoes: Math.round(semana.alcance * 1.6),
      visitas_ao_perfil: semana.visitasAoPerfil,
      publicacoes: semana.midias.length,
    }

    for (const [metrica, total] of Object.entries(fluxos)) {
      const porDia = distribuir(total, diasComColeta.length)
      diasComColeta.forEach((dia, i) => {
        snapshotsConta.push({
          ig_conta_id: contaId,
          data: dia,
          metrica,
          valor: porDia[i],
          api_version: VERSAO_API,
          adapter_version: VERSAO_ADAPTADOR,
        })
      })
    }

    // Seguidores e estoque, nao fluxo: cada dia carrega o saldo daquele dia.
    const anterior = indiceDaSemana === 0 ? semana.seguidores : semanas[indiceDaSemana - 1].seguidores
    const passo = (semana.seguidores - anterior) / 7
    diasComColeta.forEach((dia) => {
      const posicao = dias.indexOf(dia) + 1
      snapshotsConta.push({
        ig_conta_id: contaId,
        data: dia,
        metrica: 'seguidores',
        valor: Math.round(anterior + passo * posicao),
        api_version: VERSAO_API,
        adapter_version: VERSAO_ADAPTADOR,
      })
    })

    // Publicacoes espalhadas na semana: segunda, quarta, sexta, sabado.
    const diasDePublicacao = [0, 2, 4, 5]
    semana.midias.forEach((midia, indiceDaMidia) => {
      const diaDaPublicacao = somarDias(segunda, diasDePublicacao[indiceDaMidia % 4])
      if (diaDaPublicacao > ultimoDia) return
      const metricas = metricasDaMidia({ ...midia, salvamentosPorMil: semana.salvamentosPorMil })
      const idDaMidia = `${contaId}-m${String(indiceDaSemana).padStart(2, '0')}${indiceDaMidia}`

      for (const [metrica, valor] of Object.entries(metricas)) {
        snapshotsMidia.push({
          ig_conta_id: contaId,
          ig_media_id: idDaMidia,
          data: diaDaLeitura,
          tipo: midia.tipo,
          publicada_em: `${diaDaPublicacao}T12:00:00.000Z`,
          metrica,
          valor,
          api_version: VERSAO_API,
          adapter_version: VERSAO_ADAPTADOR,
        })
      }
    })
  })

  return { snapshotsConta, snapshotsMidia }
}

/**
 * @typedef {object} SemanaPlanejada
 * @property {number} alcance         contas alcancadas na semana
 * @property {number} seguidores      saldo no fim da semana
 * @property {number} visitasAoPerfil
 * @property {number} salvamentosPorMil
 * @property {{ alcance: number, tipo: string }[]} midias
 */

/**
 * Monta as 16 semanas a partir de listas paralelas. Listas paralelas sao mais
 * faceis de conferir contra a identidade do que 16 objetos escritos a mao.
 *
 * @param {object} entrada
 * @param {number[]} entrada.alcance
 * @param {number[]} entrada.seguidores
 * @param {number[]} entrada.visitasAoPerfil
 * @param {number[]} entrada.salvamentosPorMil
 * @param {number[][]} entrada.alcanceDasMidias
 * @param {string[][]} entrada.tiposDasMidias
 * @returns {SemanaPlanejada[]}
 */
function montarSemanas({
  alcance,
  seguidores,
  visitasAoPerfil,
  salvamentosPorMil,
  alcanceDasMidias,
  tiposDasMidias,
}) {
  return alcance.map((valorDeAlcance, i) => ({
    alcance: valorDeAlcance,
    seguidores: seguidores[i],
    visitasAoPerfil: visitasAoPerfil[i],
    salvamentosPorMil: salvamentosPorMil[i],
    midias: alcanceDasMidias[i].map((valor, j) => ({
      alcance: valor,
      tipo: tiposDasMidias[i][j],
    })),
  }))
}

/* ────────────────────────────────────────────────────────────────────────────
   Casa Oliveira — o caso da identidade visual.

   Oito semanas de cadencia firme (3 publicacoes por semana) seguidas de oito
   semanas de queda ate 1,8. O alcance por publicacao nao se mexe: 2.290 antes,
   2.240 depois. O alcance total desaba com o volume: 41.200 → 26.900.

   E o diagnostico que o motor precisa saber nomear:
   "Seu alcance nao caiu. Sua frequencia caiu 40% e o alcance seguiu junto."
   ──────────────────────────────────────────────────────────────────────────── */

const CASA_OLIVEIRA = montarSemanas({
  alcance: [
    5400, 5300, 5200, 5100, 5100, 5000, 5100, 5000, // 8 anteriores: soma 41.200
    5200, 4400, 4100, 3900, 3500, 2200, 1900, 1700, // ultimas 8:    soma 26.900
    1650, // semana corrente, incompleta: fica fora de toda comparacao
  ],
  seguidores: [
    6108, 6116, 6125, 6133, 6140, 6148, 6155, 6162, //
    6168, 6172, 6175, 6177, 6178, 6178, 6177, 6176,
    6175,
  ],
  visitasAoPerfil: [
    540, 530, 520, 510, 510, 500, 510, 500, //
    520, 440, 410, 390, 350, 220, 190, 170,
    165,
  ],
  // O conteudo que saiu ficou melhor, nao pior: salvamento por mil sobe.
  salvamentosPorMil: [
    23.2, 23.2, 23.2, 23.2, 23.2, 23.2, 23.2, 23.2, //
    26.0, 26.4, 27.0, 27.4, 27.8, 28.1, 28.1, 28.1,
    28.1,
  ],
  alcanceDasMidias: [
    [2400, 2290, 2180], // cada semana anterior soma 6.870 → media 2.290
    [2350, 2300, 2220],
    [2420, 2270, 2180],
    [2380, 2290, 2200],
    [2340, 2300, 2230],
    [2410, 2280, 2180],
    [2360, 2290, 2220],
    [2390, 2270, 2210],
    [2600, 2450, 2300], // ultimas 8: 14 publicacoes somando 31.360 → media 2.240
    [2380, 2210],
    [2300, 2150],
    [2260, 2120],
    [2200, 2090],
    [2180],
    [2070],
    [2050],
    [2040],
  ],
  tiposDasMidias: [
    ['carrossel', 'reel', 'imagem'],
    ['reel', 'carrossel', 'imagem'],
    ['carrossel', 'imagem', 'reel'],
    ['carrossel', 'reel', 'imagem'],
    ['reel', 'carrossel', 'imagem'],
    ['carrossel', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel'],
    ['reel', 'carrossel', 'imagem'],
    ['carrossel', 'reel', 'imagem'],
    ['carrossel', 'reel'],
    ['carrossel', 'imagem'],
    ['carrossel', 'reel'],
    ['carrossel', 'imagem'],
    ['carrossel'],
    ['carrossel'],
    ['carrossel'],
    ['carrossel'],
  ],
})

/* ────────────────────────────────────────────────────────────────────────────
   Verdejar Plantas — conta saudavel, com uma lacuna real de coleta.
   Cinco dias sem coleta em agosto (token expirado e renovado). A tela precisa
   dizer que faltou dado ali, e nao desenhar a queda como se fosse do perfil.
   ──────────────────────────────────────────────────────────────────────────── */

const VERDEJAR = montarSemanas({
  alcance: [
    7600, 7500, 7400, 7500, 7600, 7400, 7500, 7500, //
    7700, 7600, 7700, 7600, 7700, 7700, 7700, 7800,
    7750,
  ],
  seguidores: [
    8296, 8309, 8321, 8332, 8344, 8355, 8366, 8378, //
    8384, 8390, 8395, 8399, 8403, 8406, 8409, 8412,
    8418,
  ],
  visitasAoPerfil: [
    760, 750, 740, 750, 760, 740, 750, 750, //
    770, 760, 770, 760, 770, 770, 770, 780,
    775,
  ],
  salvamentosPorMil: Array.from({ length: 17 }, () => 32.0),
  alcanceDasMidias: [
    ...Array.from({ length: 8 }, () => [2050, 1980, 1900, 1870]),
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
    [2080, 1990, 1900],
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
    [2100, 2020, 1930, 1890],
  ],
  tiposDasMidias: [
    ...Array.from({ length: 8 }, () => ['carrossel', 'imagem', 'reel', 'imagem']),
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
    ['carrossel', 'imagem', 'reel', 'imagem'],
  ],
})

/** Cinco dias sem coleta: o token expirou numa segunda e so foi renovado na sexta. */
const LACUNA_VERDEJAR = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']

/* ────────────────────────────────────────────────────────────────────────────
   Studio Nove — conectada ha pouco. Duas semanas completas de historico.
   O motor precisa dizer "ainda nao sei", e nao chutar um veredito. Esta e a
   fixture que impede o produto de virar gerador de frase bonita.
   ──────────────────────────────────────────────────────────────────────────── */

const STUDIO_NOVE = montarSemanas({
  alcance: [3100, 2950, 3050],
  seguidores: [2140, 2151, 2163],
  visitasAoPerfil: [310, 295, 305],
  salvamentosPorMil: [18.0, 18.4, 18.9],
  alcanceDasMidias: [
    [1400, 1310],
    [1350, 1290],
    [1380, 1300],
  ],
  tiposDasMidias: [
    ['imagem', 'reel'],
    ['imagem', 'reel'],
    ['imagem', 'reel'],
  ],
})

/* ── Registros ─────────────────────────────────────────────────────────────── */

export const TENANT = {
  id: 'tenant-estudio-vergara',
  nome: 'Estúdio Vergara',
  plan: 'unico',
  status: 'ativo',
  criado_em: '2026-05-04T13:00:00.000Z',
  /** Sem identidade propria: usa a paleta Kora. White-label so na Fase 3. */
  identidade: null,
}

export const CONTAS = [
  {
    id: 'conta-casa-oliveira',
    tenant_id: TENANT.id,
    ig_user_id: '17841400000000001',
    username: 'casa.oliveira',
    nome: 'Casa Oliveira',
    fb_page_id: '102000000000001',
    conectada_em: '2026-05-11T10:00:00.000Z',
    token_expira_em: '2026-11-08T10:00:00.000Z',
    tem_trafego_pago: false,
  },
  {
    id: 'conta-verdejar',
    tenant_id: TENANT.id,
    ig_user_id: '17841400000000002',
    username: 'verdejarplantas',
    nome: 'Verdejar Plantas',
    fb_page_id: '102000000000002',
    conectada_em: '2026-05-11T10:00:00.000Z',
    token_expira_em: '2026-12-01T10:00:00.000Z',
    tem_trafego_pago: false,
  },
  {
    id: 'conta-studio-nove',
    tenant_id: TENANT.id,
    ig_user_id: '17841400000000003',
    username: 'studionove.br',
    nome: 'Studio Nove',
    fb_page_id: '102000000000003',
    // Conectada ha tres semanas: historico curto de proposito.
    conectada_em: '2026-08-17T09:30:00.000Z',
    token_expira_em: '2026-12-15T09:30:00.000Z',
    tem_trafego_pago: false,
  },
]

/** Ultimo dia com coleta possivel: o dia de AGORA. Nada existe depois disso. */
const ULTIMO_DIA = AGORA.slice(0, 10)

/** Studio Nove conectou 14 semanas depois das outras duas. */
const PRIMEIRA_SEGUNDA_STUDIO_NOVE = somarDias(PRIMEIRA_SEGUNDA, 14 * 7)

const casaOliveira = expandirPlano({
  contaId: CONTAS[0].id,
  semanas: CASA_OLIVEIRA,
  primeiraSegunda: PRIMEIRA_SEGUNDA,
  ultimoDia: ULTIMO_DIA,
})

const verdejar = expandirPlano({
  contaId: CONTAS[1].id,
  semanas: VERDEJAR,
  primeiraSegunda: PRIMEIRA_SEGUNDA,
  ultimoDia: ULTIMO_DIA,
  diasSemColeta: LACUNA_VERDEJAR,
})

const studioNove = expandirPlano({
  contaId: CONTAS[2].id,
  semanas: STUDIO_NOVE,
  primeiraSegunda: PRIMEIRA_SEGUNDA_STUDIO_NOVE,
  ultimoDia: ULTIMO_DIA,
})

export const SNAPSHOTS_CONTA = [
  ...casaOliveira.snapshotsConta,
  ...verdejar.snapshotsConta,
  ...studioNove.snapshotsConta,
]

export const SNAPSHOTS_MIDIA = [
  ...casaOliveira.snapshotsMidia,
  ...verdejar.snapshotsMidia,
  ...studioNove.snapshotsMidia,
]

/**
 * Eventos de coleta. A lacuna do Verdejar aparece aqui como falha registrada:
 * serie com buraco nunca invisibiliza o buraco (ADR-004).
 */
export const EVENTOS_DE_COLETA = [
  ...LACUNA_VERDEJAR.map((dia) => ({
    ig_conta_id: CONTAS[1].id,
    ocorrido_em: `${dia}T04:07:00.000Z`,
    status: 'token_expirado',
    detalhe: 'Token de acesso expirado. Coleta do dia nao realizada.',
  })),
  {
    ig_conta_id: CONTAS[1].id,
    ocorrido_em: '2026-08-15T04:06:00.000Z',
    status: 'ok',
    detalhe: 'Token renovado pelo tenant. Coleta normalizada.',
  },
  {
    ig_conta_id: CONTAS[0].id,
    ocorrido_em: '2026-09-05T04:07:00.000Z',
    status: 'ok',
    detalhe: null,
  },
  {
    ig_conta_id: CONTAS[2].id,
    ocorrido_em: '2026-09-05T04:08:00.000Z',
    status: 'ok',
    detalhe: null,
  },
]
