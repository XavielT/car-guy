-- 007_user_cascade.sql — deleting a user must delete their data.
--
-- Found by exercising the system: after the verification users were removed,
-- `carguy.setting` still held their rows with a `user_id` pointing at nothing.
-- Only `carguy.profiles` was written with `references auth.users(id) on delete
-- cascade`; every other table has a bare `user_id uuid`, so a deleted account
-- leaves its whole garage behind permanently.
--
-- That matters three ways: "borrar mi cuenta" would not actually delete
-- anything, the "Borrar datos en la nube" button Phase 9 owes would have to
-- reimplement the cascade by hand for eighteen tables, and the orphans are
-- unreachable — no session can ever match their `user_id` again, so RLS hides
-- them from everyone including their author.
--
-- 02-supabase-carguy.md §3 deliberately mirrors no foreign keys *between*
-- carguy tables: a client syncs one table at a time and a child can arrive
-- before its parent. This constraint is a different thing. The parent is the
-- user, and no row can exist before the user does — RLS requires
-- `user_id = auth.uid()`, which cannot be satisfied without a session.
--
-- Idempotent: each constraint is dropped by name before being added.

-- Orphans first: the constraint cannot be added while rows violate it.
do $$
declare
  t text;
  tables text[] := array[
    'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_type',
    'service_record', 'service_record_item', 'part', 'expense', 'reminder',
    'inspection_template', 'inspection_item', 'inspection', 'inspection_result',
    'task', 'document', 'media', 'setting'
  ];
begin
  foreach t in array tables
  loop
    execute format(
      'delete from carguy.%I where user_id not in (select id from auth.users)', t);
  end loop;

  foreach t in array tables
  loop
    execute format(
      'alter table carguy.%I drop constraint if exists %I',
      t, t || '_user_id_fkey');
    execute format(
      'alter table carguy.%I add constraint %I
         foreign key (user_id) references auth.users(id) on delete cascade',
      t, t || '_user_id_fkey');
  end loop;
end
$$;


-- rollback:
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'vehicle','vehicle_spec','odometer_reading','fuel_log','service_type',
--     'service_record','service_record_item','part','expense','reminder',
--     'inspection_template','inspection_item','inspection','inspection_result',
--     'task','document','media','setting'
--   ]
--   loop
--     execute format('alter table carguy.%I drop constraint if exists %I', t, t || '_user_id_fkey');
--   end loop;
-- end $$;
