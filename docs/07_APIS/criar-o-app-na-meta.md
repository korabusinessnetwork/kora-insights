# Criar o app na Meta — passo a passo

> O que fazer no painel da Meta, e onde cada valor gerado por lá vai parar neste
> repositório. Escrito em 2026-09-08, conferido contra a documentação da Meta.
> As permissões e as chamadas estão em `graph-api.md`; aqui só o cadastro.

## Antes de começar: a ordem importa

Criar o app custa R$ 0 e não depende de CNPJ (ver `docs/11_SEGURANCA/app-review.md`).
Mas ele **não pode ser exercido sozinho**: `iniciarConexao` e `concluirConexao`
devolvem falha em modo de demonstração (`src/lib/conexaoMeta.js`), e o produto
está em demonstração porque não existe projeto Supabase.

A troca do código por token acontece na Edge Function `conectar-conta`, com o
`META_APP_SECRET` guardado no servidor — nunca no navegador. Sem Supabase não há
onde essa função rodar, nem onde o token ficar.

| Ordem | O quê | Por quê antes |
|---|---|---|
| 1 | Projeto Supabase (plano gratuito) | é onde a Edge Function roda e onde o token do cliente é guardado |
| 2 | App na Meta | precisa do domínio de produção no `redirect_uri`, e do secret indo direto para o Supabase |
| 3 | Conta profissional + Página, como *Instagram Tester* | é o que destrava o screencast do App Review |

Fazer o passo 2 antes do 1 não quebra nada — só não dá para testar até o 1
existir.

## Pré-requisitos do lado da conta

Três coisas, e todas são do dono da conta que será diagnosticada:

- **Conta do Instagram profissional** (Comercial ou Criador de conteúdo). Conta
  pessoal não serve: a API de insights não existe para ela.
- **Página do Facebook vinculada** a essa conta do Instagram. É por ela que a
  descoberta acontece (`GET /me/accounts`, `graph-api.md` §2.2).
- **Conta de desenvolvedor da Meta** com permissão de tarefa na Página.

## Passo a passo

### 1. Criar o app

Em https://developers.facebook.com/apps/, **Criar app**. O assistente pede, em
ordem: detalhes do app → casos de uso → portfólio empresarial → requisitos →
revisão.

- **Nome**: `Kora Insights` (aparece na tela de consentimento que o cliente lê —
  ele precisa reconhecer o nome).
- **Caso de uso**: procure a opção de acessar dados de conta profissional do
  Instagram. Se ela não aparecer com esse nome, escolha **Outro** e, na etapa
  seguinte, o tipo **Empresa (Business)** — é o caminho da *Instagram API with
  Facebook Login* (ADR-002).
- **Portfólio empresarial**: pode criar um novo. Aqui **não** é exigido CNPJ; o
  CNPJ só aparece na verificação de negócio, lá na frente.

> **Os rótulos do painel mudam com frequência.** Se o que você vê não bater com o
> que está escrito acima, o que decide é o resultado: você precisa terminar com
> um app que ofereça *Login do Facebook* e o produto *Instagram*.

### 2. Adicionar os produtos

No painel do app, adicione:

- **Login do Facebook** — em Configurações, preencha **URIs de redirecionamento
  do OAuth válidos** com o endereço abaixo. Não deixe em branco: nós montamos a
  URL de autorização à mão (`src/lib/conexaoMeta.js`), e não pelo SDK.

  ```
  https://kora-insights.pages.dev/conectar/retorno
  ```

  Para desenvolver na sua máquina, acrescente também
  `http://localhost:5173/conectar/retorno` — a Meta aceita mais de uma.

- **Instagram** — é o produto que expõe os insights.

### 3. As quatro permissões

São estas, e nenhuma a mais (`src/lib/conexaoMeta.js`, congelada de propósito —
permissão a mais é poder a mais sobre a conta do cliente, e mais um pedido a
justificar no App Review):

| Permissão | Para quê |
|---|---|
| `instagram_basic` | identificar a conta profissional |
| `instagram_manage_insights` | as métricas — é a razão do produto existir |
| `pages_show_list` | achar a Página vinculada |
| `pages_read_engagement` | **em teste**: ver `docs/11_SEGURANCA/app-review.md`. Se a descoberta da Página funcionar sem ela, ela sai do pedido |

Em modo de desenvolvimento não é preciso pedir nada: contas com papel no app já
concedem as quatro no próprio diálogo.

### 4. Adicionar a conta de teste

Em **Funções do app** → **Funções**, adicione a conta como **Testador do
Instagram**. O dono dela precisa aceitar o convite pelo próprio Instagram:
**Configurações → Aplicativos e sites → Convites de testador**.

Enquanto o app estiver em modo de desenvolvimento, só contas com papel conectam —
e conectam **de verdade**, com token real e coleta real.

## Onde cada valor vai parar

Três valores saem do painel. Eles têm destinos diferentes, e a diferença é de
segurança, não de arrumação.

| Valor | Onde fica | Observação |
|---|---|---|
| **App ID** | segredo do GitHub `VITE_META_APP_ID` | público por natureza — vai inlineado no bundle |
| **App Secret** | segredo do Supabase `META_APP_SECRET` | **nunca** no repositório, nunca em conversa, nunca com prefixo `VITE_` |
| **App ID** (de novo) | segredo do Supabase `META_APP_ID` | a Edge Function precisa dele para a troca do código e para a renovação (ADR-009) |

```sh
supabase secrets set META_APP_ID=... META_APP_SECRET=...
```

O `VITE_` é a linha divisória: tudo que tem esse prefixo é lido no build e vai
para dentro do JavaScript que qualquer visitante baixa. **Secret com `VITE_` é
secret publicado.**

## O que ainda vai quebrar se ninguém lembrar

Três variáveis passam a apontar para o lugar errado quando o domínio muda, e
**nenhuma falha no build** — todas falham em uso, depois (ADR-010):

| Variável | Onde | O que quebra |
|---|---|---|
| `VITE_META_REDIRECT_URI` | segredo do GitHub | a Meta recusa o `redirect_uri` e a conexão morre no diálogo |
| `KORA_REDIRECIONAMENTOS_PERMITIDOS` | Supabase | `conectar-conta` recusa com `ENTRADA_INVALIDA`, mesmo com a Meta aprovando |
| `KORA_ORIGENS_PERMITIDAS` | Supabase | o CORS não ecoa a origem e **toda** chamada às Edge Functions falha |

A terceira é a pior: não afeta uma tela, afeta todas, e a mensagem no console não
aponta para a causa.

## Ligações

- `graph-api.md` — as permissões justificadas e as chamadas que existem
- `docs/08_DECISOES/adr-002-variante-api-instagram.md` — por que esta variante
- `docs/11_SEGURANCA/app-review.md` — a fila até a submissão
