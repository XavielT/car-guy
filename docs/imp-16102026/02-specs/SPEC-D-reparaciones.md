# SPEC-D — Registrar reparaciones (N7, X7)

## Qué encontré en el repo (2026-10-16)
La nota dice que no hay forma de registrar una reparación. En el código **ya existe** el registro, pero está casi invisible y le faltan piezas clave:

- `ServiceRecord` (`lib/db/types.ts`) con `kind: 'mantenimiento' | 'reparacion' | 'mejora'`, `costPartsDop`, `costLaborDop`, `totalDop`, `shop` (texto) + `contactId` (taller como contacto con llamar/WhatsApp), `warrantyUntilDate`, `warrantyUntilKm`, `sourceTaskId`, `sourceInspectionId`, lista de piezas (`PartDraft`) y **una** foto.
- Formulario en `app/servicio/nuevo.tsx` (643 líneas) y `app/servicio/[id].tsx`; el tipo es un selector entre las tres opciones dentro de un formulario pensado para mantenimiento.
- **Único camino**: Historial → botón "+" → hoja → "Registrar reparación" (`/servicio/nuevo?kind=reparacion`). No hay entrada desde Inicio, el vehículo, Herramientas ni los Pendientes.
- Los eventos (`Milestone`) ya tienen `pending` (texto de lo que falta), `resolvedAt` y `linkedServiceId`; se marcan resueltos a mano en el editor del evento. Las tarjetas "Pendiente: …" (Build, Inicio, `components/album/EventsTab.tsx`) no ofrecen resolverlas con una reparación.

Por eso **no se crea un modelo nuevo** (ADR-61). Se completa y se hace visible lo existente.

## Lo que falta (respuestas de Xaviel: quién + taller, costos, fotos y factura, garantía y vínculo con Pendiente)
| Pieza | Hoy | Falta |
|-------|-----|-------|
| Quién la hizo | solo `shop` / `contactId` | "Yo mismo / Un taller / Un amigo o mecánico / Otro" (`done_by`); si es "yo mismo" no se piden taller ni mano de obra |
| Taller | `ContactPicker` (contacto o texto) | se mantiene; mostrarlo solo si no es "yo mismo"; atajo "Agregar taller" desde el mismo selector |
| Costos | piezas + mano de obra + total editable | se mantienen; "Otros" opcional si Phase 0 ve que cabe sin migración |
| Fotos y factura | una sola foto (`photoMediaId`) | varias con rol: **Antes / Después / Factura / Otra** |
| Garantía | fecha y km, plegado detrás de un interruptor | selector rápido (Sin garantía / 30 días / 90 días / 6 meses / 1 año / Otra) y recordatorio al vencer (verificar si ya existe uno) |
| Vínculo con Pendiente | `sourceTaskId` (tareas del chequeo); en eventos `pending` / `linkedServiceId` a mano | cerrar un Pendiente de evento desde la reparación (y la tarea de chequeo si viene de una) con aviso y deshacer |
| Entradas | solo Historial "+" | Herramientas, atajos del vehículo, Inicio, tarjetas de Pendiente, pestaña Eventos |
| Vistas | Historial con filtro "Reparación" | pantalla "Reparaciones" del vehículo: lista, total gastado, por taller (veces, gasto, última visita) |

## Datos (aditivo; PROMPT-00 confirma contra el código y las migraciones reales)
- **Schema local v12** (v11 lo toma el fix pack de `oil_synthetic`; si v11 aún no existe al llegar a esta fase, usa el siguiente número libre) y **`sql/041_repairs_done_by_photos.sql`** (renumera si hace falta), siguiendo el patrón de `migrationV10.ts` y `sql/033–036`:
  - `service_record.done_by TEXT NOT NULL DEFAULT 'shop' CHECK (done_by IN ('self','shop','friend','other'))` + backfill: `'shop'` si hay `shop`/`contactId`, si no `'self'`.
  - Fotos con rol: primero **audita** cómo se vincula hoy la media a un servicio (`photoMediaId` y roles de `album`); si ya hay tabla de enlaces, agrega `role`; si no, tabla aditiva `service_media(id, service_record_id, media_id, role in ('before','after','invoice','other'), sort, deleted_at, …)` con RLS, sync y tombstones como las demás.
  - `milestone.linked_service_id` y `resolved_at` ya existen: no hay columnas nuevas para el vínculo, solo lógica.
- RLS igual que el resto de `carguy`; solo cambios aditivos en `x-core` (compartido con Music Hub); rollback al final del archivo SQL (probado con `tools/local-rls`); aplicar con `tools/apply-sql.mjs` antes de publicar la app; actualizar `lib/cloud/database.types.ts` con `npm run types:gen`.
- Sync: respetar el "gate de esquema" ya existente (una versión vieja de la app no debe romperse con columnas nuevas).

## Formulario "Registrar reparación" (modo del formulario de servicio, no pantalla duplicada)
`/servicio/nuevo?kind=reparacion` pasa a un **modo reparación**: el tipo queda fijo (sin selector de tipo) y los campos se reordenan:
1. Qué se reparó (título; sugerencias por sistema) y qué falló / síntoma (descripción).
2. Sistema afectado (`SelectField`, reutilizando la lista de categorías/tipos de servicio existente).
3. **Quién la hizo** (`SelectField`: Yo mismo / Un taller / Un amigo o mecánico / Otro).
4. Taller (si aplica): el `ContactPicker` existente.
5. Fecha y odómetro (lo actual).
6. Piezas (lista existente), costo de piezas, mano de obra (oculta si es "yo mismo"), total.
7. Garantía (`SelectField` + km opcional).
8. Fotos: ranuras Antes / Después / Factura + otras.
9. **Pendiente que resuelve** (`SelectField` con los Pendientes abiertos del vehículo: eventos con `pending` sin `resolvedAt` y tareas abiertas). Prellenado si se llega desde una tarjeta de Pendiente.
10. Guardar → detalle de la reparación (`/servicio/[id]`) con aviso "Pendiente resuelto · Deshacer" durante 10 s si cerró uno.
Mantenimiento y mejora siguen usando el formulario actual (sin cambios de comportamiento).

## Puntos de entrada (todos deben existir)
- Atajo "+ Reparación" en el vehículo, fila destacada de Herramientas (SPEC-C), acción en Inicio (`QuickActions`), pestaña Eventos ("+ Reparación"), FAB de Historial (ya existe; mantenerlo).
- Tarjetas "Pendiente: …" (Inicio `pendingRow`, `EventsTab`, Build): botón "Resolver con una reparación" que abre el modo reparación con título y Pendiente cargados.
- Testigos y OBD: desde el detalle de un código OBD, "Registrar reparación".

## Vistas
- **Detalle** (`app/servicio/[id].tsx`): resumen, costos desglosados, piezas, fotos con rol (antes/después en comparador), factura, garantía con cuenta regresiva, taller con llamar/WhatsApp, Pendiente vinculado.
- **Reparaciones** (nueva pantalla bajo el vehículo, registrada en el registro de funciones de SPEC-C): lista con filtro por sistema, taller y año; total gastado; resumen por taller.
- Costos: confirmar en `lib/domain/costs.ts` y "Lo que me ha costado" que las reparaciones se suman separadas de combustible y mods; corregir si no.
- Libro del carro (`app/vehiculo/[id]/libro.tsx`) y exportar: incluir reparaciones con taller, costos y garantía (verificar si ya lo hacen).
- Garantía por vencer: recordatorio local (permiso de notificaciones de SPEC-A) y distintivo dentro de la app.

## Datos de prueba
Sin datos reales: taller ficticio "Taller de ejemplo" sin teléfono; una reparación propia y una de taller en `lib/dev/garage.ts` (solo desarrollo).

## Pruebas
Migración local y SQL (con rollback), backfill de `done_by`, sync ida y vuelta (`__tests__/`), formulario en modo reparación (propia vs taller, totales, garantía, fotos con rol, Pendiente resuelto y deshacer), costos reflejados, RLS (`tools/local-rls`), i18n es/en, skeleton gemelo, capturas a 390 px.
