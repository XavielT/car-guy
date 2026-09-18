-- 001_invite_trigger_app_aware.sql
--
-- ⚠️  INCOMPLETE — DO NOT RUN YET.
--
-- This is the ONE change Car Guy makes to shared code on `x-core` (ADR-06).
-- It adds four lines to the top of Music Hub's `enforce_invite_only()` so that
-- a signup carrying `raw_user_meta_data.app = 'carguy'` skips the invite check.
-- Everything after those lines must stay byte for byte identical to what is
-- running today, or Music Hub's invite rule changes along with it.
--
-- TO COMPLETE:
--   1. Run sql/000_inspect.sql and copy query 1's output.
--   2. Paste the body — everything between `begin` and `end` of the current
--      function — where the marker below says so.
--   3. Paste the WHOLE original definition into the rollback block at the end.
--   4. Check the `language`, `security definer` and `set search_path` clauses
--      below against the original and correct them if they differ. If the
--      original is `security definer` it must stay so, with search_path pinned.
--
-- Until step 2 is done this file would REPLACE the function with one that lets
-- everyone in, which is why it is left syntactically broken on purpose.

create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Car Guy, and any future app that sets raw_user_meta_data.app, has open
  -- signup. Everything below this block is Music Hub's, untouched.
  if coalesce(new.raw_user_meta_data->>'app', '') = 'carguy' then
    return new;
  end if;

  -- >>>>>>>>>> PASTE THE CURRENT BODY HERE, UNCHANGED <<<<<<<<<<
  -- (from `select pg_get_functiondef(...)` — the lines between begin and end)
  RAISE EXCEPTION 'sql/001 was run before its body was filled in - see the header';
  -- >>>>>>>>>> END OF PASTED BODY <<<<<<<<<<
end
$$;

-- The trigger itself is NOT recreated: `create or replace function` swaps the
-- body under the existing trigger, so Music Hub keeps the same trigger object
-- and the same name. Nothing is dropped.


-- rollback:
-- Restore the original by pasting the definition captured in step 3 and
-- running it. `create or replace function` is the whole rollback — there is no
-- other object to undo.
--
-- >>>>>>>>>> PASTE THE ORIGINAL pg_get_functiondef OUTPUT HERE <<<<<<<<<<
