# PROMPT 04 — Maintenance, repairs, upgrades, expenses, tasks + unified Historial

**Depends on:** Phase 3 · **Branch:** `imp-17092026/phase-4-maintenance` · **ADRs:** 09, 10, 14
**Goal:** G2, G6 (timeline). Notes 3, 6, 7, 8: *llevar los mantenimientos*, *mejoras hechas*,
*arreglos*, *historial de su o de sus vehículos*.

> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 4 of IMP 17092026: service records (mantenimiento / reparación / mejora), expenses, tasks,
documents, and the unified Historial.

Read first:
- CLAUDE.md → AGENTS.md
- docs/imp-17092026/02-specs/01-data-model.md §1 (service_record, service_record_item, part, expense,
  task, document, history_feed), §3.2 "Auto-completion from a service record", §3.4, §3.6
- docs/imp-17092026/02-specs/03-screens-ia.md (Historial tab, servicio/*, gasto/*, tareas/*, documentos/*)
- docs/imp-17092026/00-context/05-design-identity.md (RecordRow, category colours)
- docs/imp-17092026/01-research/01-competitive-analysis.md §2.1 (LubeLogger record shape), §2.7 (UX
  worth copying), §3.1–3.3
- docs/imp-17092026/04-tracking/PROGRESS.md (Phase 2–3 notes)

Branch: imp-17092026/phase-4-maintenance

Requirements:

1. SERVICE RECORDS
   - app/servicio/nuevo.tsx (?kind=mantenimiento|reparacion|mejora, default mantenimiento):
     segmented kind at the top (labels Mantenimiento · Reparación · Mejora with the category colour
     dot); DateField (today), odometer (current, DateField/odometer rules from Phase 3), title
     (for mantenimiento auto-filled from the selected items, e.g. "Aceite de motor y filtro +
     Filtro de aire", editable), catalog items multi-select (mantenimiento only; searchable chips
     grouped by category from service_type; "+ Otro" creates a user service_type), description,
     costs: partes + mano de obra → total (auto, editable override), taller (free text with
     suggestions from previous records), garantía (fecha y/o km, collapsible), partes (collapsible
     list: nombre, número, marca, cantidad, costo), fotos (PhotoPicker → media owner
     service_record), notas.
   - On save (repo transaction): insert record + items + parts + odometer reading; then run
     lib/domain/reminders.resetForServiceItems(vehicleId, serviceTypeIds, {date, km}) — THIS PHASE
     implements the reset rule from 01-data-model.md §3.2 on the reminder rows (next due km/date,
     last_completed_*), even though the status engine arrives in Phase 5. Show a summary sheet:
     "Guardado. Se actualizaron: Aceite de motor → 57 000 km / 15 mar 2027; Filtro de aire → …".
   - app/servicio/[id].tsx: detail (all fields, photos grid, items, parts), Editar, Reclasificar
     (change kind — keeps id), Borrar (soft, confirm). Editing odometer/date re-validates.
   - Repair records created from a task or inspection carry source_task_id /
     source_inspection_id and show "Origen: chequeo del 12 sep" with a link.

2. EXPENSES (replace app/gastos.tsx)
   - app/gasto/nuevo.tsx and app/gasto/[id].tsx: category chips (01-data-model.md §3.6 with Spanish
     labels and the legal ones first: Seguro, Marbete, …), amount, date, odometer (optional),
     description, proveedor, photo (receipt). Saving a `marbete` or `seguro` expense completes the
     matching legal reminder (legal_kind) — implement via lib/domain/reminders.completeLegal(...)
     (fixed-interval re-arm per §3.2; Phase 5 finishes the engine but this rule lives here).
   - Delete app/gastos.tsx and its route; Más → "Gastos y mantenimiento" button becomes two entries:
     Mantenimiento (→ historial filtered) and Gastos (→ gasto/nuevo).

3. TASKS (01-data-model.md task) — app/tareas/index.tsx (three columns as segmented filter:
   Pendiente · En progreso · Hecha), app/tarea/[id].tsx and "Nueva tarea" (title, kind, priority,
   estimated cost, notes). "Marcar hecha" → sheet "¿Registrar como mantenimiento/reparación/mejora
   ahora?" → prefilled servicio/nuevo with source_task_id; done_record_id stored. Home "Pendientes"
   list (from Phase 3) now includes open tasks sorted by priority.

4. DOCUMENTS — app/documentos/index.tsx, documento/nuevo.tsx, documento/[id].tsx: kind (Seguro,
   Marbete, Matrícula, Licencia, Factura, Garantía, Otro), title, issued/expires (DateField), file
   (PhotoPicker or expo-document-picker PDF → media kind 'pdf'), notes. When expires_at is set and
   kind ∈ {seguro, marbete, licencia}: upsert the vehicle's legal reminder of that kind with
   due_date = expires_at (document.reminder_id). Viewer: image inline; PDF → open with
   expo-sharing/openURL on Android, new tab on web.

5. HISTORIAL (app/(tabs)/historial.tsx) — rebuild on history_feed
   - repos.history.feed(vehicleId, {kinds, from, to, q}) → list grouped by month header ("Septiembre
     2026 · RD$ 12,340"), RecordRow per item (category icon/colour: combustible, mantenimiento,
     reparacion, mejora, gasto, chequeo), tap → the kind's detail route. Filter chips: Todo ·
     Combustible · Mantenimiento · Reparaciones · Mejoras · Chequeos · Gastos; search box (title,
     shop, notes — extend the view or filter in SQL with LIKE). Keep the fuel rows' km/gal tag
     (economyById) as today.
   - FAB "+" → kind picker sheet (Combustible, Mantenimiento, Reparación, Mejora, Gasto, Chequeo,
     Lectura de odómetro).
   - Empty state copy from 05-design-identity.md.
   - Performance: paginate the feed (50 per page, "Cargar más") — a year of daily records must
     scroll smoothly on a mid-range Android.

6. STRINGS through lib/i18n/es.ts; DR vocabulary (taller, gomas, marbete…).

7. TESTS: __tests__/domain/reminders-reset.test.ts (reset from service items: km and date both,
   fixed_interval for legal, non-recurring disables, unrelated reminders untouched; completeLegal).
   Manual: create an oil change with two items → both reminders re-armed → Historial shows the
   record under this month → reclassify to reparación → filter works → expense Marbete → marbete
   reminder re-armed to next 31 Jan → task → done → record created with source. Web + Android.
   Screenshots docs/qa/phase-4-*. tsc/lint/test/build green. Report, merge, push.
```

---

## Acceptance criteria

- [ ] Service record create/edit/detail/reclassify/soft-delete for the three kinds; items, parts, photos, warranty, shop suggestions.
- [ ] Saving items resets the matching reminders (rule §3.2) and the summary sheet lists them.
- [ ] Expenses with the new category set; `marbete`/`seguro` expenses complete the legal reminder; `gastos.tsx` removed.
- [ ] Tasks board with done → record flow; home Pendientes includes tasks.
- [ ] Documents with expiry → legal reminder link; PDF/photo viewing on both platforms.
- [ ] Historial on `history_feed`: month groups with totals, filters, search, FAB kind picker, pagination.
- [ ] Legacy imported maintenance/repair expenses appear as service records in Historial.
- [ ] Tests for reset/completeLegal; lint/tsc/test/build green; fuel flow verified.

## Watch for

- The `history_feed` view unions different column sets — keep the 8-column contract; if you need more (e.g. `kind_detail`), recreate the view in a **migration v2**, never edit v1.
- `total_dop` explicit override: once the user edits total, stop recomputing from parts+labor for that record.
- Soft-deleted records must disappear from feed, totals, and reminder resets.
- Search with `LIKE` needs `COLLATE NOCASE` and accent handling is out of scope (note it).
