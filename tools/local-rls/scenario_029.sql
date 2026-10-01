\set ON_ERROR_STOP 1
-- sql/029: the public page lists plain milestones only, never events (ADR-44). After scenario.sql's
-- helpers and data: veh_a has ms_buy (hito) and ms_crash (backfilled to accidente by 025).
update carguy.vehicle_share set revoked_at = null, slug = 'ae85hchg', published_at = coalesce(published_at, now()), show_story = true
 where id = 'share_veh_a';
select t_ok('29a. story on: the purchase milestone is on the public page',
  carguy.public_dossier('ae85hchg')::text like '%Lo compré%');
select t_ok('29b. story on: the accident (an event) is not',
  carguy.public_dossier('ae85hchg')::text not like '%Choque en la 27%');
select t_ok('29c. the accident is still an event row in the table (only the page filters it)',
  exists (select 1 from carguy.milestone where id = 'ms_crash' and event_type = 'accidente'));
