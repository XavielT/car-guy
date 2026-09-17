# Spec — Information architecture and screens

Target navigation for Car Guy. Built progressively: PROMPT-03 introduces the new tab set and the
Garage; PROMPT-04/05/07 add sections; PROMPT-06 finishes restyling. Until PROMPT-03 the current
five tabs stay as they are (PROMPT-01/02 change nothing visible except the brand).

## Tabs (5)

| Tab | Route | Icon | Content |
|---|---|---|---|
| **Inicio** | `app/(tabs)/index.tsx` | speedometer | Vehicle switcher (chips, + "Agregar") · `OdometerHero` (current km + telltales) · `QuickActions` 2×2: Combustible / Chequeo / Mantenimiento / Gasto · "Pendientes" list (top 5 reminders + open tasks by urgency) · "Este mes" strip (gasto total, cargas, km) · last economy insight card (existing logic) |
| **Chequeo** | `app/(tabs)/chequeo.tsx` | clipboard | Today's due checklist(s) with big "Empezar" · streak `GaugeRing` · templates list (diaria/semanal/mensual/antes de viaje) · recent inspections with status pills · link "Qué revisar y cómo" (guide screen with the overheating section) |
| **Historial** | `app/(tabs)/historial.tsx` | time | Unified `history_feed` for the active vehicle, newest first, grouped by month · filter chips: Todo / Combustible / Mantenimiento / Reparaciones / Mejoras / Chequeos / Gastos · search · tap → detail/edit route of that kind · FAB "+" opens a kind picker |
| **Cifras** | `app/(tabs)/cifras.tsx` | stats-chart | Period selector (mes / 3 meses / año / todo) · KPI tiles: gasto total, RD$/km, km recorridos, rendimiento medio · charts: gasto mensual apilado por categoría, rendimiento km/gal por tanque, gasto por categoría (donut) · TCO card when purchase price exists · "Reporte PDF" and "Exportar CSV" buttons |
| **Más** | `app/(tabs)/mas.tsx` | ellipsis | Garaje (vehicles, archive) · Mantenimiento: catálogo de servicios, recordatorios · Combustible: precios MICM de referencia · Documentos · Cuenta (sign in / sync) · Datos (respaldo JSON, importar Tu Combustible RD, borrar) · Apariencia (sistema/oscuro/claro) · Notificaciones · Acerca de (versión, build) |

## Stack routes (outside tabs)

```
app/
  onboarding.tsx              welcome → (Importar respaldo de Tu Combustible RD | Crear primer vehículo) → optional account card
  vehiculo/nuevo.tsx          VehicleForm (rich)            [replaces vehiculo.tsx]
  vehiculo/[id].tsx           vehicle profile: header photo, specs, odometer, stats summary, tabs-in-page (Resumen · Mantenimiento · Documentos), edit/archive
  vehiculo/[id]/editar.tsx
  odometro.tsx                quick odometer reading (sheet)
  carga/nueva.tsx             FillUpForm (moved from (tabs)/cargar.tsx; the tab is gone, QuickActions opens it)
  carga/[id].tsx              edit fill-up (exists)
  servicio/nuevo.tsx?kind=    service record form: kind segmented (Mantenimiento/Reparación/Mejora), date, odometer (prefilled), title, catalog items multi-select (mantenimiento), parts (collapsible), costs (partes + mano de obra = total, editable), taller, garantía, fotos, notes → on save: reminders reset summary
  servicio/[id].tsx           detail + edit + delete (soft) + "Reclasificar"
  gasto/nuevo.tsx, gasto/[id].tsx
  recordatorios/index.tsx     all reminders of the vehicle grouped by status (vencido → urgente → próximo → ok → sin datos); "Nuevo recordatorio"
  recordatorio/nuevo.tsx, recordatorio/[id].tsx   form: title, catálogo (optional), metric (fecha/km/ambos), due, recurring + intervals, fixed interval, thresholds (advanced), notes; actions: Marcar hecho (→ optional service record), Posponer, Desactivar
  chequeo/[templateId]/run.tsx   the inspection runner: grouped items, each OK / Falla / N/A; "cómo" text under each; cold-engine banner at the top if any item requires it; falla → note + photo + "crear tarea/recordatorio"; can't submit with unanswered; odometer prompt; result screen with GaugeRing + streak
  chequeo/plantillas/[id].tsx    edit template (reorder, enable/disable items, add custom)
  chequeo/guia.tsx               static guide: fluids, tires, lights; "Sobrecalentamiento: qué hacer y cómo evitarlo"
  inspeccion/[id].tsx            past run detail
  tareas/index.tsx, tarea/[id].tsx   tasks board (pendiente / en progreso / hecha); "Hecha" asks to create the service record
  documentos/index.tsx, documento/nuevo.tsx, documento/[id].tsx   kind, title, dates, file/photo; expiry → reminder
  precios.tsx                 exists (MICM reference prices)
  cuenta.tsx                  sign in / sign up / status / sync (PROMPT-08/09)
  reporte.tsx                 PDF report preview + share (PROMPT-07)
  +html.tsx, +not-found.tsx
```

`app/_layout.tsx` keeps one `Stack` with per-screen titles (they become browser tab titles).
`experiments.typedRoutes` stays on — use `Href` types; regenerate with `npx expo start` once.

## Key flows

**Quick fill-up (unchanged in spirit):** Inicio → Combustible → form prefilled with vehicle,
today, last odometer → save → review alert (existing `reviewFillUp`) → back to Inicio with the
telltales updated (odometer reading written).

**Weekly check:** notification "Chequeo semanal · hoy" 09:00 → tap → runner → all OK → result
"Todo al día · 3 semanas seguidas" (haptic success) → Inicio telltale turns green. With a fail →
"Refrigerante marcado como falla" → "Crear tarea" → task appears in Pendientes with priority
*crítica* when the item is `refrigerante`, `aceite_motor`, `frenos` or `liquido_frenos`.

**Oil change:** Inicio → Mantenimiento → kind Mantenimiento → items [Aceite de motor y filtro,
Filtro de aire] → costs → save → "Se actualizaron 2 recordatorios" → Historial shows the record;
Recordatorios shows Aceite in green with the new due.

**Marbete:** Oct 15 nudge → user pays at the bank → *Gasto → Marbete RD$1,500* → the marbete
reminder is completed automatically (expense category `marbete` completes `legal_kind='marbete'`)
and re-armed to next 31 Jan.

**Reinstall:** new phone → onboarding → "Ya tengo cuenta" → sign in → pull → garage appears →
photos load lazily.

## Accessibility and ergonomics

- Touch targets ≥ 44 px; inspection answer buttons are full-width segmented controls (thumb-only
  use in a parking lot).
- Every number has its unit; every status pill has text (never colour alone).
- `accessibilityLabel` on icon-only buttons (the FAB, the kind picker).
- Forms: `keyboardShouldPersistTaps="handled"`, numeric keyboards for numbers, the odometer field
  shows the last value as placeholder and hint (existing pattern).
