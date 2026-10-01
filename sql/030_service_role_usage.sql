-- 030_service_role_usage.sql — the server key can reach the carguy schema (IMP 30092026 Phase 6).
--
-- api/precios.ts (MICM importer, service-key path) calls carguy.upsert_fuel_price_ref with the
-- service_role; 027 granted it EXECUTE on the function but the schema itself was never granted to
-- service_role (only anon/authenticated, sql/002), so PostgREST answered 42501 "permission denied for
-- schema carguy". service_role already bypasses RLS; this only lets it see the schema. carguy only.
-- Apply: node tools/apply-sql.mjs sql/030_service_role_usage.sql

grant usage on schema carguy to service_role;

-- rollback:
-- revoke usage on schema carguy from service_role;
