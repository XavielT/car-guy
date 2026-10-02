#!/usr/bin/env bash
# The cloud SQL (sql/002…027) on a throwaway local PostgreSQL 16 with a Supabase
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
$P -f sql/017_track_layout.sql
$P -f sql/018_app_membership.sql
$P -f sql/019_schema_v3.sql
$P -f sql/020_rls_v3.sql
$P -f sql/021_feedback.sql
$P -f sql/021_feedback_storage.shared.sql
$P -f sql/022_dossier_status_costs.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/023_inventory_used_in_mod.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/024_roles_admin.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/024_roles_admin_storage.shared.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/025_schema_v4.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/026_rls_v4.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
# 025 and 026 are re-runnable: a second pass must change nothing and raise nothing.
$P -f sql/025_schema_v4.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/026_rls_v4.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
# 027: the table + RPC, then the --shared role file, then 027 again (re-runnable; grants to the role now exist).
$P -f sql/027_fuel_price_ref.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/027_fuel_price_ref_role.shared.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/027_fuel_price_ref.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
# 029: public_dossier without events (ADR-44); re-runnable.
$P -f sql/029_dossier_hito_only.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/029_dossier_hito_only.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/030_service_role_usage.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/031_avatars_readable.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/031_avatars_readable.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/032_public_memory.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/032_public_memory.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
# 028: delete_my_account + admin_pending_deletions (Phase 6); re-runnable. Its scenario runs last (it deletes A).
$P -f sql/028_delete_account.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
$P -f sql/028_delete_account.sql 2>&1 | grep -E 'ERROR' && exit 1 || true
# IMP 01102026 Phase 2 (after 028: 034 reads profiles.deletion_requested_at): gauge + app_config, profiles/social, juntes, then the --shared realtime policies; each twice (re-runnable).
for f in 033_gauge_app_config 034_profiles_social 035_juntes 036_realtime_policies.shared 037_social_lists 038_junte_invite_card; do
  $P -f "sql/$f.sql" 2>&1 | grep -E 'ERROR' && exit 1 || true
  $P -f "sql/$f.sql" 2>&1 | grep -E 'ERROR' && exit 1 || true
done
OUT=$($P -f tools/local-rls/scenario.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
OUT="$OUT
$($P -f tools/local-rls/scenario_027.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_029.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_032.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_031.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_034.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_035.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_037.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')
$($P -f tools/local-rls/scenario_028.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*')"
echo "$OUT"
echo "$OUT" | grep -q -E '^(FAIL|ERROR)' && exit 1
echo "all passed"
