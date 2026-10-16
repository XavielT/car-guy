# Auditoría de reparaciones (N7, X7) — Fase 0, 2026-10-16

Conclusión corta: el registro de reparaciones **ya existe** (`ServiceRecord` con `kind='reparacion'`) y funciona, pero (1) se llega por un solo camino de 3 toques, (2) le faltan "quién la hizo", varias fotos con rol y cerrar un Pendiente, y (3) la garantía no avisa. ADR-61 se confirma: no se crea un modelo paralelo.

## 1. Modelo y flujo actuales

### Datos (`lib/db/types.ts:170-211`, tabla `service_record` en `lib/db/migrations.ts:103-120`)
`ServiceRecord`: `vehicleId`, `kind` (`mantenimiento|reparacion|mejora`), `occurredAt`, `odometerKm`, `title`, `description`, `costPartsDop`, `costLaborDop`, `totalDop`, `shop` (texto), `contactId` (v2, `migrationV2.ts:211`), `warrantyUntilDate`, `warrantyUntilKm`, `sourceInspectionId`, `sourceTaskId`. Hijos: `service_record_item` (renglones del catálogo; solo en `mantenimiento`) y `part` (nombre, #parte, marca, cantidad, costo unitario). No hay `done_by`, ni "otros costos".

### Guardado (`lib/db/serviceOps.ts:68-153` `saveServiceRecord`, una sola transacción)
Escribe el registro; **reemplaza** ítems y partes (soft-delete + upsert); si trae `sourceTaskId` marca la tarea `hecha` con `doneRecordId` (:121-123); si hay ítems del catálogo reinicia los recordatorios (`resetForServiceItems`). Para `kind='reparacion'`: `serviceTypeIds: kind === 'mantenimiento' ? selected : []` (`app/servicio/nuevo.tsx:295`) → **una reparación nunca reinicia recordatorios** (correcto) y su título lo escribe la persona (el autotítulo solo sale de los ítems).

### Formulario (`app/servicio/nuevo.tsx`, 643 líneas; `[id].tsx` 342 líneas para ver/editar)
Orden actual: tipo (3 chips a mano, :345; "mejora" redirige a `/mod/nuevo` cuando `FEATURE_BUILD`, :351-356) → fecha (:374) → odómetro (:376) → [solo mantenimiento: ítems del catálogo + buscador (:391-445) y bloque de aceite] → título (:451) → descripción (:459) → costos: piezas, mano de obra, total (auto o manual) (:462-477) → taller: `ContactPicker` (contacto o texto libre, :480-490) + sugerencias de talleres usados (`shopSuggestions`, `serviceOps.ts:215`) → garantía **plegada** (fecha + km, :511-525) → piezas **plegadas** (:532) → fotos: **un solo** `PhotoPicker` (:561-570).
Todo el formulario es el de mantenimiento; "reparación" solo cambia que se esconden los ítems del catálogo.

### Camino de entrada
Único: Historial → FAB "+" → hoja → "Registrar reparación" (`app/(tabs)/historial.tsx:217` → `/servicio/nuevo?kind=reparacion`); 3 toques desde Inicio. Caminos indirectos: OBD (`components/diy/DtcPieces.tsx:99-145`, `lib/db/diyQueries.ts:172-196`: `repairsFor` lista las reparaciones del vehículo para **vincular** un código, `createRepairForDtc` crea una `reparacion` con título `t.obd.repairTitle(code)`, costos en 0 y `linkDtcRepair` enlaza `vehicle_dtc_event.repair_record_id`) y las tareas `kind='reparacion'` que crea un chequeo con fallas (`lib/db/inspectionOps.ts:177`) → "Registrar" en `app/tarea/[id].tsx` → `/servicio/nuevo?taskId=`. No hay entrada desde Inicio, el vehículo, Herramientas, Eventos ni las tarjetas de Pendiente.

## 2. Fotos y factura: cómo se enlaza la media a un servicio
- La tabla `media` es **polimórfica**: `owner_table` + `owner_id` (`migrations.ts:246-258`, índice `idx_media_owner`). Una foto de servicio es un `media` con `owner_table='service_record'` y `owner_id=<id del registro>`, creada **al elegir la foto**, antes de guardar (`PhotoPicker` → `storePhoto(candidate,{ownerTable, ownerId, vehicleId})`).
- `nuevo.tsx:163,202` lee `mediaRepo.listWhere({ownerTable:'service_record', ownerId})` y se queda con **`photos[0]`** → la UI muestra y edita una sola; si hubiera más filas, el resto queda invisible. No hay roles.
- No existe tabla de enlaces para servicios. Sí existe para mods: `mod_media(id, mod_id, media_id, role default 'foto', …)` (`migrationV2.ts:113-119`, nube `sql/009_schema_v2.sql:167-179`), con roles `despues|antes|instalacion|recibo|dyno|foto` (`components/build/ModForm.tsx:39`). Es el patrón a seguir.
- Rutas que ya consideran estas fotos: borrado en cascada (`vehicleOps.ts:228` cláusula `owner_table='service_record'`), `mediaVehicleId` (`syncOps.ts:405`), Storage por `media`.

## 3. Pendientes y cómo se resuelven hoy
- **Evento con pendiente** (`Milestone`): `pending` (texto), `resolvedAt`, `linkedServiceId`, `linkedModId`, `linkedInspectionId` (`lib/db/types.ts:433-440`; la verdad de "abierto" es `isPending(m)` = `pending` no vacío y sin `resolvedAt`, `lib/domain/events.ts:108-110`). Se resuelve **a mano** en el editor del evento: interruptor "resuelto" que pone `resolvedAt = now` y un selector de vínculos (`components/album/EventForm.tsx:78-79,122-126,178-179,287-297`); nada lo conecta a crear una reparación. Las tarjetas "Pendiente: …" (`components/album/EventsTab.tsx:55-58`, Inicio, Build) no ofrecen "resolver con una reparación".
- **Tarea** (`task`): al guardar un servicio con `sourceTaskId` se cierra sola (`serviceOps.ts:121-123`). Las tareas vienen de un chequeo con fallas, de Más → Tareas y del botón de las tarjetas de Inicio (`/tarea/[id]`).
- Los "Pendientes" del Build de las capturas (X7: "Desabollar y pintar", "Cambiar el agua … por coolant") son **eventos con `pending`** o **tareas**; el flujo nuevo debe cubrir **ambos** (SPEC-D: selector con eventos abiertos + tareas abiertas).

## 4. Garantía
- Se guarda `warrantyUntilDate`/`warrantyUntilKm` y el detalle la muestra (`app/servicio/[id].tsx:207-212`), pero **nada genera un recordatorio ni un aviso**: `git grep -i warranty` solo toca el formulario, el detalle, `serviceOps` y el tipo. Los recordatorios locales (`lib/notifications/plan.ts`) salen de `Reminder` (`legalKind`: marbete, seguro, licencia, revisión técnica; no hay garantía). El tipo de documento "garantía" (`app/documento/nuevo.tsx:21`) tampoco programa nada.
- Selector rápido (30 días / 90 días / 6 meses / 1 año / Otra) **no existe**; solo una fecha libre y un km.

## 5. Costos
- **"Lo que me ha costado"** (`lib/domain/costs.ts:30-42`): 5 cubetas `mods|mantenimiento|combustible|pista|otros`; `reparacion` y `mantenimiento` van **juntas** en `mantenimiento` (`costs.ts:40-41`); `mejora` y los mods en `mods`. Las piezas están dentro del servicio (no se suman dos veces).
- **Cifras** (`lib/domain/stats.ts:28-37`, `lib/db/statsQueries.ts:83`) sí separa `reparacion` como categoría propia (gráfica apilada `components/charts/StackedBars.tsx`).
- Conclusión: las reparaciones ya se suman aparte de combustible y de mods; **no** se distinguen de mantenimiento en la tarjeta "Lo que me ha costado" (SPEC-D pedía "separadas" solo de combustible y mods: ✔; se propone un renglón "de ellas, reparaciones" sin cambiar las cubetas).
- `mano de obra` en una reparación "yo mismo" hoy se puede dejar en 0; no hay validación ni sugerencia.

## 6. Libro y exportar
- **Libro del carro** (`lib/book/index.ts` → `publicDossier`, `lib/share/dossier.ts:300-308`; datos de `lib/db/shareQueries.ts:182-190`): solo con la bandera `flags.maintenance`; incluye `kind IN ('mantenimiento','reparacion','mejora')` pero el dossier reduce a `count`, `last`, `total` y las 8 más recientes `{title, date, cost}`: **sin taller, sin garantía, sin desglose piezas/mano de obra, sin distinguir reparación**.
- **Exportar CSV** (`lib/export/csv.ts:62` línea de tiempo unificada desde `history_feed`, `migrations.ts:263`): una fila por registro con tipo, fecha, título, subtítulo (el taller), odómetro y monto. Incluye reparaciones; no incluye `done_by`, garantía ni partes.
- Para la fase 5: añadir al libro una sección "Reparaciones" (fecha, qué, taller, costo, garantía) y al CSV las columnas `quien`, `garantia_hasta`.

## 7. Migración aditiva concreta de SPEC-D (con el código y las migraciones reales)

**Numeración**: el schema local actual es **v10**; **v11** = `vehicle.oil_synthetic` (fase 1, N5); **v12** = reparaciones (esta). En la nube: `sql/040_vehicle_oil_synthetic.sql` (fase 1) y **`sql/041_repairs_done_by_media.sql`** (fase 5).

### Local — `lib/db/migrationV12.ts` + entrada `{ version: 12, up: migrationV12() }` en `lib/db/migrations.ts` (patrón de `migrationV10.ts`)
```sql
ALTER TABLE service_record ADD COLUMN done_by TEXT NOT NULL DEFAULT 'shop'
  CHECK (done_by IN ('self','shop','friend','other'));
UPDATE service_record SET done_by = CASE
  WHEN COALESCE(contact_id, '') <> '' OR TRIM(shop) <> '' THEN 'shop' ELSE 'self' END;

CREATE TABLE service_media (
  id TEXT PRIMARY KEY NOT NULL,
  service_record_id TEXT NOT NULL REFERENCES service_record(id),
  media_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'other' CHECK (role IN ('before','after','invoice','other')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX service_media_record ON service_media(service_record_id);

-- Las fotos que ya existen (una por registro) pasan a ser un enlace; id derivado para que
-- un teléfono que migra y otro que sincroniza converjan (como `own_<vehicle>` en v2).
INSERT INTO service_media (id, service_record_id, media_id, role, sort, created_at, updated_at)
SELECT 'sm_' || m.id, m.owner_id, m.id, 'other', 0, m.created_at, m.updated_at
  FROM media m JOIN service_record sr ON sr.id = m.owner_id
 WHERE m.owner_table = 'service_record' AND m.kind = 'photo' AND m.deleted_at IS NULL;
```
`ALTER … ADD COLUMN` con `NOT NULL DEFAULT` y `CHECK` es válido en SQLite; el `UPDATE` de respaldo deja `self` solo a lo que no tiene taller ni contacto.
**No** se añade una columna `role` a `media` (compartida por vehículo, mods, gastos, chequeos, perfil): una tabla de enlaces deja `media` y a las apps viejas intactas (las 2.5.x ignoran una tabla que no conocen), igual que `mod_media`.

### Código que toca el cambio
| Pieza | Dónde |
|-------|-------|
| Tipo `ServiceRecord.doneBy`, `ServiceMedia` | `lib/db/types.ts:172` (+ `ServiceMediaRole`) |
| Repo `serviceMedia = makeRepo<ServiceMedia>({ table: 'service_media' })` y su entrada en la lista de tablas | `lib/db/repos/index.ts:97` (mod_media) y la lista de `:494-520` |
| Sync (hijo de `service_record`, después de `part`) | `lib/sync/tables.ts` (bloque "Children of service_record and inspection") y `lib/sync/members.ts:62-64` |
| Borrado en cascada del vehículo | `lib/db/vehicleOps.ts:238` junto a `service_record_item`/`part`: `['service_media', 'service_record_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3)']` y la cláusula de `media` con `id IN (SELECT media_id FROM service_media …)` |
| Guardado | `lib/db/serviceOps.ts:24-153`: `ServiceDraft.doneBy`, `media: { mediaId, role, sort }[]`; reemplazo de enlaces como `parts` |
| Formulario en modo reparación | `app/servicio/nuevo.tsx` (SPEC-D §"Formulario") |
| Detalle | `app/servicio/[id].tsx` |
| Datos de desarrollo | `lib/dev/garage.ts` (una reparación propia y una de taller, sin datos reales) |
| Schema gate | `SCHEMA_HINT = 'v6'` en `lib/sync/merge.ts:224`: **no hace falta subirlo** — `applyRemoteRows` descarta las columnas que el teléfono no conoce (`lib/db/syncOps.ts:108-133`), así que una app 2.5.x que baje un `done_by` lo ignora, y al subir un registro sin `done_by` Supabase conserva el existente (el upsert solo actualiza las columnas enviadas) |

### Nube — `sql/041_repairs_done_by_media.sql` (solo `carguy`, sin `--shared`, patrón de `sql/009`/`010`/`013`/`033–036`)
```sql
alter table carguy.service_record add column if not exists done_by text not null default 'shop'
  check (done_by in ('self','shop','friend','other'));
create table if not exists carguy.service_media (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  service_record_id text not null,
  media_id text not null,
  role text not null default 'other' check (role in ('before','after','invoice','other')),
  sort integer not null default 0,
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
  updated_by uuid, server_updated_at timestamptz not null default now()
);
-- RLS dueño + miembros (como mod_media): carguy.vehicle_of('service_record', service_record_id)
-- + trigger LWW/updated_by (sql/005) + política de miembros (sql/013:195-215) + realtime no.
-- rollback al final del archivo: drop table carguy.service_media; alter table … drop column done_by;
```
Pruebas: `tools/local-rls`, `tools/verify-x-core.mjs`, `npm run types:gen`; aplicar con `node tools/apply-sql.mjs sql/041_… [--dry-run]` **antes** de publicar la app (si la nube no tiene la tabla, el push de `service_media` falla).
`x-core` es de Music Hub: la migración es **solo aditiva** (una columna con default y una tabla nueva dentro de `carguy`); el `rollback` es manual al final del archivo.

## 8. Plan para el modo reparación (resumen de SPEC-D contra el código)
1. `app/servicio/nuevo.tsx`: con `kind==='reparacion'` (parámetro o edición) el tipo queda fijo (se quita el `Pressable` de tipo, :345) y los campos se reordenan: qué se reparó + síntoma → sistema afectado (`SelectField`, reutiliza `service_type.category`) → **quién la hizo** (`SelectField`: yo / taller / amigo o mecánico / otro) → taller (`ContactPicker` existente, oculto si "yo mismo") → fecha y odómetro → piezas, costo de piezas, mano de obra (oculta si "yo mismo"), total → **garantía** (`SelectField` + km, con recordatorio local `warranty_expiry`) → **fotos** (antes/después/factura/otras, desde `service_media`) → **Pendiente que resuelve** (eventos con `isPending` + tareas abiertas de `taskRepo`, prellenado desde una tarjeta).
2. `saveServiceRecord`: tras el upsert, si hay `resolvePendingId`: `milestoneRepo.upsert({id, resolvedAt: now, linkedServiceId: recordId})` o `taskRepo.upsert({id, status:'hecha', doneRecordId})`, devolviendo lo necesario para el aviso "Pendiente resuelto · Deshacer" (10 s) que restaura `resolvedAt = null`/`linkedServiceId = null` (o `status` anterior).
3. Recordatorio de garantía: `lib/notifications/plan.ts` (nuevo origen "garantía") — requiere el permiso `notifications` de SPEC-A; badge dentro de la app aunque no haya permiso.
4. Pantalla "Reparaciones" (lista, total gastado, por taller: veces, gasto, última visita) y entrada en el registro de funciones; botón "Registrar reparación" desde OBD (`DtcPieces.tsx:145` ya tiene `createRepairForDtc`), Pendientes, Eventos, Inicio, Herramientas y atajos del vehículo (ver `feature-map.md`).
5. Libro y CSV: sección y columnas nuevas (ver §6). Cifras: sin cambios.

## 9. No verificado
- La conducta real de `PhotoPicker` al reemplazar una foto (si borra el `media` anterior) — leer `lib/media` en la fase 5 antes de pasar a varias fotos.
- Que `CHECK` en `ALTER TABLE … ADD COLUMN` se comporte igual en `expo-sqlite` nativo y en el wasm de la web: probar `migrate-v12.test.ts` en `node:sqlite` **y** en un build web antes de publicar.
