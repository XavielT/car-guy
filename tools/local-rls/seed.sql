insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
 ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
 ('00000000-0000-0000-0000-00000000000c', 'c@example.com');
-- as A
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into carguy.vehicle (id, name, default_fuel_type, created_at, updated_at, plate, vin) values ('veh_a', 'Trueno AE85', 'premium', now(), now(), 'A700001', 'JT2AE850000000001');
insert into carguy.fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, is_full_tank, missed_previous, station, notes, created_at, updated_at)
  values ('f_a', 'veh_a', now(), 52000, 11.2, 322, 3606, 'premium', true, false, 'Shell', '', now(), now());
insert into carguy.venue (id, name, type, created_at, updated_at) values ('ven_a', 'Pista de Baní', 'drift', now(), now()), ('ven_private', 'Mi pista secreta', 'otro', now(), now());
insert into carguy.mod_category (id, name, created_at, updated_at) values ('cat_a', 'Aero', now(), now());
insert into carguy.mod (id, vehicle_id, category_id, name, cost_part_dop, created_at, updated_at) values ('mod_a', 'veh_a', 'cat_a', 'Swap 4A-GE', 14500, now(), now());
insert into carguy.track_event (id, vehicle_id, venue_id, occurred_at, discipline, created_at, updated_at) values ('ev_a', 'veh_a', 'ven_a', now(), 'drift', now(), now());
insert into carguy.track_session (id, event_id, seq, created_at, updated_at) values ('s_a', 'ev_a', 1, now(), now());
insert into carguy.media (id, owner_table, owner_id, kind, mime, created_at, updated_at, remote_path) values ('m_a', 'vehicle', 'veh_a', 'photo', 'image/jpeg', now(), now(), '00000000-0000-0000-0000-00000000000a/m_a.jpg');
insert into carguy.contact (id, name, kind, created_at, updated_at) values ('c_a', 'Taller de Tony', 'mecanico', now(), now());
insert into carguy.service_type (id, name, category, created_at, updated_at) values ('st_turbo', 'Revisar turbo', 'motor', now(), now()), ('st_private', 'Algo mío', 'otro', now(), now());
insert into carguy.service_type (id, name, category, is_seeded, created_at, updated_at) values ('aceite_motor', 'Aceite (A lo editó)', 'motor', true, now(), now());
insert into carguy.service_record_item (id, service_record_id, service_type_id, created_at, updated_at) values ('sri_a2', 'sr_a', 'aceite_motor', now(), now());
insert into carguy.service_record (id, vehicle_id, kind, occurred_at, title, created_at, updated_at) values ('sr_a', 'veh_a', 'mantenimiento', now(), 'Servicio', now(), now());
insert into carguy.service_record_item (id, service_record_id, service_type_id, created_at, updated_at) values ('sri_a', 'sr_a', 'st_turbo', now(), now());
insert into carguy.inspection_template (id, name, cadence, created_at, updated_at) values ('tpl_a', 'Antes de pista', 'manual', now(), now()), ('tpl_private', 'Mi lista', 'manual', now(), now());
insert into carguy.inspection (id, vehicle_id, template_id, occurred_at, status, created_at, updated_at) values ('ins_a', 'veh_a', 'tpl_a', now(), 'ok', now(), now());
commit;
-- as B, its own car
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into carguy.vehicle (id, name, default_fuel_type, created_at, updated_at) values ('veh_b', 'DS3', 'regular', now(), now());
commit;
-- a pre-013 object in A's old-layout folder
insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('carguy-media', '00000000-0000-0000-0000-00000000000a/m_a.jpg', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '{"size": 1000}');
