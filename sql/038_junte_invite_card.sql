-- 038_junte_invite_card.sql — IMP 01102026 Phase 6 (ADR-57): what an invite link shows before joining.
--
--   · junte_invite_card(code) → title, start, end, meeting label, status, the owner's @handle and display name,
--     how many are going. The code is the invite (whoever has the link may see the card, like a car's /c/ link);
--     never ids, never the meeting coordinates, never members' names. Anon allowed: the web page /j/<code> and
--     link previews read it. Ended juntes still answer (the page says so); a code that does not exist → null.
--
-- carguy only, no --shared. Re-runnable. Apply after 035.
-- Apply: node tools/apply-sql.mjs sql/038_junte_invite_card.sql

create or replace function carguy.junte_invite_card(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'title', j.title, 'starts_at', j.starts_at, 'ends_at', j.ends_at, 'meet_label', j.meet_label, 'status', j.status,
           'owner_handle', p.handle, 'owner_name', p.display_name,
           'going', (select count(*) from carguy.junte_member m where m.junte_id = j.id and m.status in ('going', 'live')))
    from carguy.junte j
    left join carguy.profiles p on p.user_id = j.owner_id
   where j.code = lower(trim(p_code)) and p_code ~* '^[a-z0-9]{8}$'
     and not (auth.uid() is not null and carguy.social_blocked(auth.uid(), j.owner_id));
$$;
revoke all on function carguy.junte_invite_card(text) from public;
grant execute on function carguy.junte_invite_card(text) to anon, authenticated;

-- rollback:
-- drop function if exists carguy.junte_invite_card(text);
