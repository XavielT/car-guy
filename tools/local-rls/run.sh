#!/usr/bin/env bash
# The cloud SQL (sql/002…014) on a throwaway local PostgreSQL 16 with a Supabase
# shim (auth.uid() from request.jwt.claims, anon/authenticated roles, storage
# tables), then the public-page + shared-garage scenario as two/three accounts.
# Touches nothing but a temp cluster. Found the 013 is_member NULL hole (sql/014).
#
#   bash tools/local-rls/run.sh      → PASS/FAIL lines, exit 1 on any FAIL
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d /tmp/carguy-rls.XXXX)
PORT=${PG_PORT:-55433}
"$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DIR/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null; rm -rf "$DIR"' EXIT
sleep 1
P="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -f tools/local-rls/shim.sql
for f in 002_schema_carguy 003_rls 004_storage 005_lww 007_user_cascade 008_catalog_per_user_keys 009_schema_v2 010_rls_v2 011_storage_v2 012_public_share; do $P -f "sql/$f.sql" 2>&1 | grep -E 'ERROR' && exit 1 || true; done
$P -f tools/local-rls/seed.sql
$P -f sql/013_members.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/014_is_member_null_fix.sql
$P -f sql/015_member_catalogues.sql
$P -f sql/016_member_service_types.sql
OUT=$($P -f tools/local-rls/scenario.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
echo "$OUT"
echo "$OUT" | grep -q -E '^(FAIL|ERROR)' && exit 1
echo "all passed"
