-- 006_drop_tucombustible_probe.sql — OPTIONAL. Xaviel decides when.
--
-- `tucombustible` is the empty schema xaviel-web created in imp 11092026 to
-- prove a non-public schema could be exposed. It holds one probe table and no
-- data, and Car Guy uses `carguy` instead, so it has nothing left to do.
--
-- Run 000_inspect.sql query 5 first and confirm the only table is the probe.
-- Also remove `tucombustible` from Project Settings → API → Exposed schemas
-- afterwards, or PostgREST keeps advertising a schema that is gone.
--
-- This is the only `drop` in the whole phase, and it is on a schema no
-- application reads. Nothing in `public` is touched.

select table_name, table_type
from information_schema.tables
where table_schema = 'tucombustible';
-- ↑ check the output before running the line below.

-- drop schema tucombustible cascade;


-- rollback:
-- create schema tucombustible;
-- create table tucombustible.schema_check (id integer primary key, note text);
-- (the probe held no data; re-adding the schema to Exposed schemas is a
--  dashboard step)
