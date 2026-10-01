-- 027_fuel_price_ref.sql — the MICM weekly fuel prices (IMP 30092026 Phase 5, note 1, ADR-46,
-- 02-cloud-v4.md §027).
--
-- One reference table anyone may read (the app pulls it on launch with the anon key; it holds no
-- personal data: a week, a fuel, a price, the PDF's url and text) and one way to write it: the
-- security-definer RPC carguy.upsert_fuel_price_ref(rows jsonb), called only by the Vercel function
-- api/precios.ts. Nobody writes the table directly — not anon, not a signed-in user.
--
-- Who may call the RPC: the role `carguy_importer` (a JWT whose `role` claim is carguy_importer,
-- minted once from the project's JWT secret → Vercel env CARGUY_IMPORTER_JWT) and service_role (the
-- fallback, Vercel env SUPABASE_SERVICE_ROLE_KEY, ADR-38). The role itself and its grant to
-- `authenticator` are cluster-wide, so they live in 027_fuel_price_ref_role.shared.sql (--shared).
-- This file works with or without that role: the grants to it below run only when it exists, and the
-- shared file repeats them.
--
-- Everything in carguy; no --shared. Re-runnable.
-- Apply: node tools/apply-sql.mjs sql/027_fuel_price_ref.sql
--   then (optional, for the JWT path): node tools/apply-sql.mjs sql/027_fuel_price_ref_role.shared.sql --shared

create table if not exists carguy.fuel_price_ref (
  week_start  date not null,
  week_end    date not null,
  fuel_type   text not null,
  price       numeric not null,
  source      text not null default 'micm',
  pdf_url     text,
  raw_text    text,
  imported_at timestamptz not null default now(),
  stale       boolean not null default false,
  primary key (week_start, fuel_type),
  constraint fuel_price_ref_fuel check (fuel_type in ('premium', 'regular', 'gasoil_regular', 'gasoil_optimo', 'glp', 'gnv')),
  constraint fuel_price_ref_price check (price > 0 and price < 10000),
  constraint fuel_price_ref_week check (week_end >= week_start and week_end - week_start <= 8)
);

alter table carguy.fuel_price_ref enable row level security;

drop policy if exists fuel_price_ref_read on carguy.fuel_price_ref;
create policy fuel_price_ref_read on carguy.fuel_price_ref for select to anon, authenticated using (true);

-- Read-only for the app's roles, whatever the schema's default privileges hand out.
revoke all on carguy.fuel_price_ref from anon, authenticated;
grant select on carguy.fuel_price_ref to anon, authenticated;

-- ---------------------------------------------------------------------- the importer RPC ----
-- rows: [{week_start, week_end, fuel_type, price, source?, pdf_url?, raw_text?, stale?}, …]
-- Upserts on (week_start, fuel_type); keeps the stored raw_text when a row comes without one (the
-- importer's "mark stale" call); a fresh (non-stale) week clears the stale flag of older weeks.
-- Returns the number of rows written. Bad input raises 22023 and writes nothing.
create or replace function carguy.upsert_fuel_price_ref(rows jsonb) returns integer
language plpgsql security definer set search_path = carguy, pg_temp as $$
declare
  n integer;
  fresh date;
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
    raise exception 'rows must be a non-empty json array' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) > 64 then
    raise exception 'too many rows' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(rows) r
    where coalesce(r->>'source', 'micm') <> 'micm'
       or r->>'week_start' is null or r->>'week_end' is null or r->>'fuel_type' is null or r->>'price' is null
  ) then
    raise exception 'each row needs week_start, week_end, fuel_type, price (source micm)' using errcode = '22023';
  end if;

  insert into carguy.fuel_price_ref as t (week_start, week_end, fuel_type, price, source, pdf_url, raw_text, imported_at, stale)
  select (r->>'week_start')::date, (r->>'week_end')::date, r->>'fuel_type', (r->>'price')::numeric, 'micm',
         nullif(r->>'pdf_url', ''), nullif(r->>'raw_text', ''), now(), coalesce((r->>'stale')::boolean, false)
  from jsonb_array_elements(rows) r
  on conflict (week_start, fuel_type) do update set
    week_end    = excluded.week_end,
    price       = excluded.price,
    pdf_url     = coalesce(excluded.pdf_url, t.pdf_url),
    raw_text    = coalesce(excluded.raw_text, t.raw_text),
    imported_at = case when excluded.stale and not t.stale then t.imported_at else now() end,
    stale       = excluded.stale;
  get diagnostics n = row_count;

  select max((r->>'week_start')::date) into fresh
  from jsonb_array_elements(rows) r where not coalesce((r->>'stale')::boolean, false);
  if fresh is not null then
    update carguy.fuel_price_ref set stale = false where stale and week_start < fresh;
  end if;
  return n;
end $$;

revoke all on function carguy.upsert_fuel_price_ref(jsonb) from public;
revoke all on function carguy.upsert_fuel_price_ref(jsonb) from anon, authenticated;
grant execute on function carguy.upsert_fuel_price_ref(jsonb) to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'carguy_importer') then
    grant usage on schema carguy to carguy_importer;
    grant execute on function carguy.upsert_fuel_price_ref(jsonb) to carguy_importer;
  end if;
end
$$;

-- rollback (reference data only — the importer rebuilds it from MICM on its next run):
-- drop function if exists carguy.upsert_fuel_price_ref(jsonb);
-- drop table if exists carguy.fuel_price_ref;
--   (then, if the shared file was applied, its rollback block)
