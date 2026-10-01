-- 027_fuel_price_ref_role.shared.sql — the `--shared` half of 027: the importer's own Postgres role.
--
-- Roles are cluster-wide (not per schema), so this touches the shared x-core cluster: one new role,
-- `carguy_importer`, NOLOGIN, with no table privileges at all — it can only use schema carguy and
-- execute carguy.upsert_fuel_price_ref(jsonb). PostgREST switches to it when a request carries a JWT
-- whose `role` claim is `carguy_importer`, which needs the role granted to `authenticator`.
-- Music Hub's roles, schemas and policies are untouched.
--
-- Skip this file if you prefer the service-key fallback (Vercel env SUPABASE_SERVICE_ROLE_KEY for
-- api/precios.ts only); 027_fuel_price_ref.sql works without it.
--
-- Needs sql/027_fuel_price_ref.sql (the function) first, or re-run 027 after this file.
-- Apply: node tools/apply-sql.mjs sql/027_fuel_price_ref_role.shared.sql --shared
-- Then, once: mint a long-lived JWT { "role": "carguy_importer", "iss": "supabase" } with the project's
-- JWT secret (Supabase dashboard → Settings → API → JWT secret) and set it in Vercel as
-- CARGUY_IMPORTER_JWT (production). It is a writer key for one reference table: keep it out of git.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'carguy_importer') then
    create role carguy_importer nologin noinherit;
  end if;
end
$$;

grant carguy_importer to authenticator;
grant usage on schema carguy to carguy_importer;
grant execute on function carguy.upsert_fuel_price_ref(jsonb) to carguy_importer;

-- rollback (--shared):
-- revoke execute on function carguy.upsert_fuel_price_ref(jsonb) from carguy_importer;
-- revoke usage on schema carguy from carguy_importer;
-- revoke carguy_importer from authenticator;
-- drop role if exists carguy_importer;
--   (CARGUY_IMPORTER_JWT then authenticates as nothing: PostgREST answers 401/42501 — delete it from Vercel)
