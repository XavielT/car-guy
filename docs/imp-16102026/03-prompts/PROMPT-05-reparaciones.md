# PROMPT-05 — Registrar reparaciones (completar y hacer visible lo que ya existe)

Continúas el ciclo IMP 16102026. Lee `00-context/BRIEF.md` (reglas permanentes y "Lo que ya existe"), `00-context/NOTAS-ORIGINALES.md`, `02-specs/SPEC-D-reparaciones.md` y `repairs-audit.md` de la fase 0. Lee los docs versionados de Expo v57 antes de escribir código (`AGENTS.md`). **Nada espera una decisión**: default recomendado, registrarlo en `PROGRESS.md`, seguir. Cambios en `x-core` solo aditivos. Todas las selecciones usan `SelectField` (fase 3).

## Alcance (N7, X7)
Un usuario debe poder registrar una reparación que hizo él mismo o que le hizo un taller. Respuestas de Xaviel: **quién la hizo + taller**, **costos de piezas y mano de obra**, **fotos y factura**, **garantía y vínculo con un Pendiente**.

**Importante**: el repo ya tiene `ServiceRecord` con `kind='reparacion'`, costos de piezas y mano de obra, taller como contacto, garantía por fecha/km, lista de piezas y una foto, con formulario en `app/servicio/nuevo.tsx`; solo se llega desde Historial → "+" y no cierra Pendientes. **No crees un modelo paralelo** (ADR-61): completa y expón lo existente.

## Pasos
1. **Migración aditiva** (schema local siguiente libre —v12 si v11 es el de `oil_synthetic`— y `sql/041…`, patrón de `migrationV10.ts` y `sql/033–036`): `service_record.done_by` (`self|shop|friend|other`, con backfill: `shop` si hay `shop`/`contactId`, si no `self`) y fotos con rol (`before|after|invoice|other`): audita cómo se enlaza hoy la media a un servicio y agrega `role` o una tabla aditiva `service_media` con RLS, sync y tombstones. RLS como el resto de `carguy`; rollback al final del SQL, probado con `tools/local-rls`; aplicar con `tools/apply-sql.mjs` (si no puedes sin credenciales, deja el archivo listo e indícalo; no esperes); `npm run types:gen`; respeta el gate de esquema del sync.
2. **Modo reparación** del formulario de servicio (`?kind=reparacion`): tipo fijo; título y síntoma; sistema (`SelectField`); **quién la hizo** (`SelectField`: Yo mismo / Un taller / Un amigo o mecánico / Otro); taller con el `ContactPicker` existente (oculto si es "yo mismo", y mano de obra oculta); fecha y odómetro; piezas, costos y total (lo existente); garantía con selector rápido (Sin garantía / 30 d / 90 d / 6 m / 1 año / Otra + km); fotos en ranuras Antes / Después / Factura / otras; **Pendiente que resuelve** (`SelectField` con eventos con `pending` sin `resolvedAt` y tareas abiertas). Mantenimiento y mejora siguen igual.
3. **Cerrar Pendientes (X7)**: al guardar con un Pendiente elegido, se marca `resolvedAt` y `linkedServiceId` del evento (o se cierra la tarea de origen) y aparece "Pendiente resuelto · Deshacer" durante 10 s. Las tarjetas "Pendiente: …" (Inicio `pendingRow`, `components/album/EventsTab.tsx`, Build) ganan "Resolver con una reparación", que abre el modo reparación con título y Pendiente cargados.
4. **Puntos de entrada**: activa en el registro de funciones (fase 4) la función "Registrar reparación" (fila destacada de Herramientas y atajos del vehículo), acción en Inicio (`QuickActions`), pestaña Eventos ("+ Reparación"), detalle de un código OBD ("Registrar reparación"); mantén el FAB de Historial.
5. **Vistas**: detalle (`app/servicio/[id].tsx`) con costos desglosados, piezas, fotos con rol (comparador antes/después), factura, garantía con cuenta regresiva, taller con llamar/WhatsApp y Pendiente vinculado; pantalla "Reparaciones" del vehículo (registrada en el registro de funciones) con lista, filtros por sistema/taller/año, total gastado y resumen por taller.
6. **Costos y exportes**: verifica en `lib/domain/costs.ts`, "Lo que me ha costado", Cifras, libro del carro (`libro.tsx`) y exportar que las reparaciones se suman por separado y aparecen con taller, costos y garantía; corrige lo que no.
7. **Garantía por vencer**: recordatorio local (permiso `notifications` de la fase 2; sin permiso, distintivo en la app con botón para permitirlo). Verifica antes si ya existe algo y reutilízalo.
8. **Datos de prueba**: solo en `lib/dev/garage.ts`, sin datos reales.
9. **Pruebas**: migración local y SQL con rollback; backfill; sync ida y vuelta; formulario en modo reparación (propia vs taller, totales, garantía, fotos con rol, Pendiente resuelto y deshacer); RLS; i18n es/en; skeleton gemelo; capturas a 390 px de formulario, detalle y lista; `npm test`, lint, typecheck, `npm run build`.
10. **Docs y release**: ADR-61, `CHANGELOG.md`, `docs/NEXT.md`, `PROGRESS.md`; el SQL debe estar aplicado en `x-core` **antes** de publicar la app.

## Criterios de aceptación
Se puede registrar una reparación propia y una de taller con todos los campos pedidos; un Pendiente se cierra desde su tarjeta y se puede deshacer; aparece en historial, costos y la lista; funciona sin conexión y sincroniza; todas las entradas existen; rollback probado; no hay modelo paralelo.

## Reporte final
Qué ya existía y qué se agregó, archivos de migración/SQL, puntos de entrada, y si el SQL quedó aplicado o pendiente.
