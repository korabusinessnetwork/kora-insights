#!/usr/bin/env bash
# Teste de isolamento entre tenants, com Postgres de verdade.
#
# Sobe um cluster efemero, aplica as migrations REAIS de producao sobre um stub
# minimo do Supabase, semeia duas agencias que nao se conhecem e verifica que
# nenhuma alcanca o dado da outra.
#
#   ./scripts/testar-isolamento.sh
#
# Requisitos: postgresql-16 (ou compativel) no PATH. Sem Docker, sem Supabase CLI
# e sem custo — a regra de custo do projeto vale tambem para teste.
set -euo pipefail

# initdb recusa rodar como root (e faz bem: o cluster ficaria com dono errado).
# Em ambiente de CI e container, onde root e o padrao, reexecuta como `postgres`.
if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then
    exec su postgres -s /bin/bash -c "$(printf '%q ' "$0" "$@")"
  fi
  echo "erro: rode como usuário não-root, ou tenha o usuário 'postgres' disponível" >&2
  exit 1
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER="${TMPDIR:-/tmp}/kora-isolamento-$$"
PORTA="${PORTA_DE_TESTE:-55432}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)"
[ -n "$BIN" ] && PATH="$BIN:$PATH"

limpar() {
  pg_ctl -D "$CLUSTER" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$CLUSTER"
}
trap limpar EXIT

echo "→ subindo cluster efêmero em $CLUSTER"
initdb -D "$CLUSTER" -U postgres --auth=trust >/dev/null
pg_ctl -D "$CLUSTER" -o "-p $PORTA -k $CLUSTER -c listen_addresses=''" -l "$CLUSTER/log" -w start >/dev/null

export PGHOST="$CLUSTER" PGPORT="$PORTA" PGUSER=postgres PGDATABASE=postgres

# As migrations rodam palavra por palavra, com UMA excecao declarada: as linhas
# `create extension` de pgcrypto e supabase_vault. As duas extensoes sao do
# Supabase e nao existem num Postgres puro; o stub cria os objetos que elas
# criariam. Comentar a linha e mais honesto do que manter uma copia editada das
# migrations, que sairia de sincronia no primeiro commit.
aplicar() {
  echo "→ $(basename "$1")"
  sed -E 's/^create extension /-- [local] create extension /' "$1" | psql -v ON_ERROR_STOP=1 -q
}

aplicar "$RAIZ/supabase/testes/00-ambiente-supabase.sql"
for migration in "$RAIZ"/supabase/migrations/*.sql; do
  # O agendamento depende de pg_cron e pg_net, que sao extensoes do Supabase e
  # nao tem o que dizer sobre isolamento. Pular aqui e escolha declarada, nao
  # esquecimento: `politicas.test.js` continua conferindo o conteudo dele.
  case "$(basename "$migration")" in
    *agendamento*) echo "→ $(basename "$migration") (pulada: pg_cron/pg_net)"; continue ;;
  esac
  aplicar "$migration"
done
aplicar "$RAIZ/supabase/testes/10-semear.sql"

echo "→ asserções de isolamento"
psql -v ON_ERROR_STOP=1 -q -f "$RAIZ/supabase/testes/20-isolamento.sql"

echo "→ asserções do cofre do token"
psql -v ON_ERROR_STOP=1 -q -f "$RAIZ/supabase/testes/30-cofre.sql"
