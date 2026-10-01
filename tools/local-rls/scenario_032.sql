\set ON_ERROR_STOP 1
-- sql/032: "Lo que uso" on the public page. After scenario_029: share_veh_a is live with slug ae85hchg.
reset role;
update carguy.vehicle_share set show_memory = false,
  memory_summary = '[{"section":"aceite","title":"Aceite","label":"Aceite que compro","value":"Motul 8100 5W-30","source":"ficha"},{"section":"papeles","title":"Papeles","label":"Póliza","value":"POL-123456","source":"ficha"},{"section":"electrico","title":"Eléctrico","label":"Código de radio","value":"4821","source":"dato"}]'
 where id = 'share_veh_a';
select t_as('anon');
select t_ok('32a. switch off: no memory on the page even with a summary stored',
  carguy.public_dossier('ae85hchg')->'memory' is null and (carguy.public_dossier('ae85hchg')->'show'->>'memory') = 'false');
reset role;
update carguy.vehicle_share set show_memory = true where id = 'share_veh_a';
select t_as('anon');
select t_ok('32b. switch on: the oil row is on the page',
  carguy.public_dossier('ae85hchg')->'memory' @> '[{"section":"aceite","value":"Motul 8100 5W-30"}]');
select t_ok('32c. … the Papeles row never is, whatever the phone sent',
  carguy.public_dossier('ae85hchg')::text not like '%POL-123456%');
select t_ok('32c2. … nor a free fact (the radio code)',
  carguy.public_dossier('ae85hchg')::text not like '%4821%');
reset role;
update carguy.vehicle_share set memory_summary = 'not json' where id = 'share_veh_a';
select t_as('anon');
select t_ok('32d. a malformed summary is left out, the page still answers',
  carguy.public_dossier('ae85hchg') is not null and carguy.public_dossier('ae85hchg')->'memory' is null);
reset role;
update carguy.vehicle_share set memory_summary = '{"section":"aceite"}' where id = 'share_veh_a';
select t_as('anon');
select t_ok('32e. a non-array summary is ignored', carguy.public_dossier('ae85hchg')->'memory' is null);
select t_as('b');
select t_ok('32f. someone else cannot switch it on for A''s car',
  t_rows($q$update carguy.vehicle_share set show_memory = true where id = 'share_veh_a'$q$) = 0);
reset role;
update carguy.vehicle_share set show_memory = false, memory_summary = null where id = 'share_veh_a';
