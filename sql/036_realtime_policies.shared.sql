-- 036_realtime_policies.shared.sql — IMP 01102026 Phase 2: who may use the Realtime topic of a junte (ADR-57).
--
-- ** --shared **: `realtime.messages` is one table for the whole x-core project — Music Hub's channels live there too.
-- So these policies touch ONLY topics that start with `carguy:`, and the check is on the prefix before anything else:
--
--   1. carguy_junte_read / carguy_junte_write (PERMISSIVE): a member of the junte with status going/live, inside the
--      live window (start − 30 min → end or start + 6 h), may receive and send Broadcast/Presence on
--      `carguy:junte:<uuid>`. Everything is decided by carguy.junte_topic_allowed (035), which returns false for any
--      other topic without casting it.
--   2. carguy_topics_guard (RESTRICTIVE): any topic starting with `carguy:` must pass the same check. A restrictive
--      policy is ANDed with every permissive one, so even a broad permissive policy elsewhere (say, Music Hub's)
--      cannot open a Car Guy channel. For every topic NOT starting with `carguy:` the guard is simply true — Music
--      Hub's topics are untouched — and so is any access with no topic at all (realtime.topic() NULL outside a channel):
--      the coalesce keeps a NULL from turning the guard into a denial for every other app.
--
-- Not changed: the Realtime "Allow public access" project setting; RLS on realtime.messages (Supabase enables it);
-- any existing policy. Positions are never written to any table: Broadcast messages on private channels are
-- authorised by these policies, not stored by us.
--
-- Apply AFTER 035: node tools/apply-sql.mjs sql/036_realtime_policies.shared.sql --shared

drop policy if exists carguy_junte_read on realtime.messages;
create policy carguy_junte_read on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) like 'carguy:junte:%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and (select carguy.junte_topic_allowed((select realtime.topic())))
  );

drop policy if exists carguy_junte_write on realtime.messages;
create policy carguy_junte_write on realtime.messages for insert to authenticated
  with check (
    (select realtime.topic()) like 'carguy:junte:%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and (select carguy.junte_topic_allowed((select realtime.topic())))
  );

drop policy if exists carguy_topics_guard on realtime.messages;
create policy carguy_topics_guard on realtime.messages as restrictive for all to authenticated
  using (coalesce((select realtime.topic()), '') not like 'carguy:%' or (select carguy.junte_topic_allowed((select realtime.topic()))))
  with check (coalesce((select realtime.topic()), '') not like 'carguy:%' or (select carguy.junte_topic_allowed((select realtime.topic()))));

-- rollback:
-- drop policy if exists carguy_topics_guard on realtime.messages;
-- drop policy if exists carguy_junte_write on realtime.messages;
-- drop policy if exists carguy_junte_read on realtime.messages;
