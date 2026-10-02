-- 038_junte_invite_card.sql — IMP 01102026 Phase 6 (ADR-57): what an invite link shows before joining.
--
--   · junte_invite_card(code) → title, start, end, meeting label, status, the owner's @handle and display name,
--     how many are going. The code is the invite (whoever has the link may see the card, like a car's /c/ link);
--     never ids, never the meeting coordinates, never members' names.
--   · junte_detail gains 'meet_label' (the name can exist without a pin). Anon allowed: the web page /j/<code> and
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

-- junte_detail re-issued (from 037) with 'meet_label' on its own: a place named without a pin still shows.
create or replace function carguy.junte_detail(p_junte uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); j carguy.junte%rowtype;
begin
  select * into j from carguy.junte where id = p_junte;
  if not found or not (j.owner_id = me or carguy.junte_is_member(p_junte, me)) then return null; end if;
  return jsonb_build_object(
    'id', j.id, 'title', j.title, 'starts_at', j.starts_at, 'ends_at', j.ends_at,
    'meet', case when j.meet_lat is not null then jsonb_build_object('lat', j.meet_lat, 'lng', j.meet_lng, 'label', j.meet_label) end,
    'meet_label', j.meet_label,
    'visibility', j.visibility, 'status', j.status, 'is_owner', j.owner_id = me,
    'code', case when j.owner_id = me or carguy.junte_is_member(p_junte, me) then j.code end,
    'live_window', carguy.junte_live_window(j),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'handle', p.handle, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
               'photo', case when p.photo_public then p.photo_public_jpeg end,
               'role', m.role, 'status', m.status, 'is_me', m.user_id = me,
               'route', (select jsonb_build_object('polyline', s.polyline_trimmed, 'distance_m', s.distance_m)
                           from carguy.trip_share s where s.id = m.trip_share_id and s.user_id = m.user_id and s.deleted_at is null))
             order by m.role desc, m.joined_at)
        from carguy.junte_member m join carguy.profiles p on p.user_id = m.user_id
       where m.junte_id = p_junte and m.status in ('invited', 'going', 'live')
         and not carguy.social_blocked(me, m.user_id)), '[]'::jsonb),
    'photos', (select count(*) from carguy.junte_photo ph where ph.junte_id = p_junte));
end $$;
revoke all on function carguy.junte_detail(uuid) from public, anon;
grant execute on function carguy.junte_detail(uuid) to authenticated;

-- rollback:
-- drop function if exists carguy.junte_invite_card(text);  (re-run 037 to restore junte_detail without meet_label)
