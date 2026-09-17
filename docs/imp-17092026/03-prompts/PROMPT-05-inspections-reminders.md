# PROMPT 05 — Inspections (chequeos) + reminders engine + notifications

**Depends on:** Phase 4 · **Branch:** `imp-17092026/phase-5-chequeos-recordatorios` · **ADRs:** 07, 08
**Goal:** G3 and G4 — **the reason this app exists** (note 4: "se me pasó revisarle los fluidos …
por no tener esa costumbre diaria").

> **Before running:** an Android device or emulator with Expo Go (local notifications work in Expo
> Go). If `npx eas whoami` is logged in, the prompt ends by building a `preview` APK for a
> real-device notification test; otherwise that step is recorded as manual.
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 5 of IMP 17092026: the inspection checklists that build the daily/weekly habit, the reminders
engine with predicted due dates and four urgency states, DR legal reminders, and local notifications.

Read first:
- CLAUDE.md → AGENTS.md; then READ https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ in
  full (Expo Go note, Android channels, SchedulableTriggerInputTypes, permissions).
- docs/imp-17092026/02-specs/01-data-model.md §3.1–3.3, §3.5, §3.7  ← the algorithms; authoritative
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-07, ADR-08)
- docs/imp-17092026/02-specs/03-screens-ia.md (Chequeo tab, chequeo/*, recordatorios/*, "Weekly check"
  and "Marbete" flows)
- docs/imp-17092026/01-research/02-maintenance-checklists-dr.md §A (checklists, overheating module),
  §C (DR obligations), §D (prediction and thresholds)
- docs/imp-17092026/01-research/03-expo57-technical.md §2 (notifications: limits, exact alarms, web)
- docs/imp-17092026/00-context/05-design-identity.md (GaugeRing, StatusPill, voice)

Branch: imp-17092026/phase-5-chequeos-recordatorios

Requirements:

1. REMINDERS ENGINE — lib/domain/reminders.ts (pure TS, ADR-07, spec §3.2)
   evaluate(reminder, ctx{today, currentKm, kmPerDay, confidence}) → ReminderStatus exactly as the
   spec (status ok|proximo|urgente|vencido|sin_datos, triggeredBy, dueDays, dueKm, predictedDueDate,
   confidence); default thresholds incl. legal_kind overrides; snooze; complete(); the reset and
   completeLegal functions from Phase 4 move/merge here (keep their tests). Tests
   __tests__/domain/reminders.test.ts: date-only (ok/proximo/urgente/vencido boundaries), km-only
   with prediction (35 km/day fallback, confidence propagation), both (worse wins, triggeredBy),
   sin_datos, snooze, fixed vs rolling reset, legal thresholds 45/14, interval_days path.
   repos.reminders.evaluated(vehicleId) returns rows + status sorted vencido → urgente → proximo →
   sin_datos → ok, then by predicted date.

2. DR LEGAL CALENDAR — lib/domain/legal-dr.ts (spec §3.7): nextMarbeteDeadline(today), marbete
   nudge dates, tier estimate by model year, texts. Marbete reminder: due next 31 Jan, fixed, plus
   "informational" nudges rendered as banners on Inicio during the window (15 Oct → 31 Jan) and as
   notifications on 15 Oct, opening (~21 Oct), 5/12/18/25/31 Jan. Licencia: 60/30 days, note about
   multas with the PGR URL (research §C.3). Revisión técnica: disabled reminder + vida útil badge in
   the vehicle profile (Ley 63-17 art. 41 table). Tests for nextMarbeteDeadline across the year
   boundary and the tier rule.

3. RECORDATORIOS UI — app/recordatorios/index.tsx (grouped by status with StatusPill; each row:
   title, "faltan 320 km · ~12 oct (estimado)" or "vence 31 ene", actions: Hecho / Posponer 7 días
   / Editar), app/recordatorio/nuevo.tsx + [id].tsx (form per screens spec: title, catálogo optional,
   metric segmented Fecha · Km · Ambos, due, recurring + intervals (months/days/km), fixed interval
   toggle with explanation, advanced thresholds, notes, enable/disable). "Hecho" → sheet: date +
   odometer + "¿Registrar como mantenimiento?" (→ servicio/nuevo prefilled with the service type)
   or just complete. Home telltale row now uses the engine (top 4 by severity; "Todo al día").
   Home banner for marbete window. Más → Mantenimiento → Recordatorios and Catálogo de servicios
   (list/edit service_type intervals; changing a seeded interval updates that vehicle's reminder if
   it still has the default).

4. INSPECTIONS — templates, runner, results, tasks (ADR-08, spec §3.5, screens spec)
   - app/(tabs)/chequeo.tsx: "Hoy" card(s): each enabled template whose cadence is due (daily: no
     run today; weekly: no run in the last 7 days; monthly: none this month; antes_de_viaje: manual)
     with a big "Empezar" and the last run date; streak GaugeRing ("3 semanas seguidas") computed
     from weekly runs; list of templates with enable/edit; recent runs (status pills); link
     "Qué revisar y cómo" → chequeo/guia.tsx.
   - Runner app/chequeo/[templateId]/run.tsx: top banner if any item requires_cold_engine
     ("Hazlo con el motor frío…"); items grouped by group_name; each item shows label, `how`
     (collapsible "¿Cómo?"), and a full-width segmented OK · Falla · N/A; Falla expands: nota
     (required), foto (optional), "Al terminar: Crear tarea / Crear recordatorio / Nada" (default
     from on_fail); progress in a GaugeRing header; odometer prompt at the end (prefilled current);
     cannot submit with unanswered items (button disabled + count "faltan 3"); timer for
     duration_sec. Save: inspection + results + odometer reading (source 'inspection') + tasks
     (priority crítica for refrigerante/aceite_motor/liquido_frenos/frenos, normal otherwise) or
     reminders per choice. Result screen: GaugeRing animation (Reanimated), "Todo al día" or the
     list of fallas with links to the created tasks, streak line, haptic success (native only).
   - Template editor app/chequeo/plantillas/[id].tsx: reorder (up/down buttons are fine), enable/
     disable items, add custom item (label, how, group, on_fail), change cadence; editing a seeded
     global template creates a vehicle-scoped copy (vehicle_id set) so other vehicles keep defaults.
   - Templates seeded per vehicle type on vehicle creation: carro/jeepeta/camioneta gasolina →
     carro_diario + carro_semanal + carro_mensual; diesel (fuel gasoil_*) → diesel_semanal instead
     of carro_semanal; motor → motor_prerodaje (daily) + motor semanal (fluids/chain). Verify the
     seed from Phase 2 does this; fix if not.
   - Guide app/chequeo/guia.tsx: static content from research §A.2 (table as cards), §A.3
     "Sobrecalentamiento: cómo evitarlo y qué hacer" (cold engine, 50/50 coolant not water, warning
     signs, what to do), §A.4 motor, §A.5 diésel. Spanish, DR vocabulary, no medical-style
     disclaimers; cite "Fuente: manual del fabricante / RAC / NHTSA" at the bottom.
   - app/inspeccion/[id].tsx past run detail (results, notes, photos, created tasks).

5. NOTIFICATIONS (ADR-07) — lib/notifications/*
   - npx expo install expo-notifications. Handler + Android channel 'mantenimiento' (importance
     DEFAULT) created at startup; permission requested lazily the first time the user enables
     "Notificaciones" in Más (default ON after the first inspection is completed — ask then, with
     copy "Te aviso cuando toque un chequeo o un mantenimiento").
   - lib/notifications/scheduler.ts: `resync()` computes the next N ≤ 30 notification instants:
     per enabled reminder: predicted due date at 09:00 local and the day it becomes proximo (if in
     the future); per inspection template: the next due day at 09:00 (daily → every day at 09:00
     via DAILY trigger; weekly → WEEKLY trigger on the user's chosen weekday, default Sunday;
     monthly → the 1st via MONTHLY); marbete nudges. Identifiers deterministic
     (`reminder:<id>:<kind>`, `template:<id>`, `marbete:<date>`) so re-scheduling replaces.
     Cancel everything not in the new set. Never request exact alarms. Call resync() after every
     reminder/inspection/odometer write (debounced) and on AppState → active.
   - Tapping a notification deep-links: reminder → recordatorio/[id]; template → chequeo/[templateId]/run.
   - Web: no scheduling; the same due computation feeds the in-app banners (Inicio telltales +
     Chequeo "Hoy" cards). Guard every expo-notifications call with Platform.OS !== 'web'.
   - Settings: Más → Notificaciones: master toggle, hour (default 09:00), weekly check weekday,
     "Probar notificación" (fires in 5 s — TIME_INTERVAL).
   - Tests: scheduler planning is pure — extract `planNotifications(state, now)` and test it
     (≤ 30, deterministic ids, ordering, weekly/daily mapping); the Expo calls are a thin adapter.

6. VERIFY (web + Android Expo Go): new vehicle → templates seeded → run the weekly check, mark
   Refrigerante Falla → task crítica created → Inicio telltale red; complete it via task → record →
   reminder ok. Oil reminder shows predicted date; add an odometer reading → prediction moves.
   Marbete banner logic (temporarily set device date or inject `today` in dev to Oct 16 and Jan 20 —
   add a dev-only "fecha simulada" in app/dev/tokens.tsx). Notifications: "Probar notificación"
   arrives on Android; scheduled list (getAllScheduledNotificationsAsync) ≤ 30 and matches the plan;
   tap opens the deep link. Web: banners show, no errors in console. Screenshots docs/qa/phase-5-*.
   tsc/lint/test/build green.

7. If EAS is logged in: `npx eas build --platform android --profile preview` (APK) and record the
   build URL so I can install it and check notifications outside Expo Go (launcher name/icon become
   visible here too). If not logged in, record the command in 05-manual-checklist.md.

8. Report, merge, push.
```

---

## Acceptance criteria

- [ ] `lib/domain/reminders.ts` implements the spec (four states, triggeredBy, prediction, confidence, snooze, fixed/rolling reset, legal thresholds) with tests for every branch.
- [ ] `lib/domain/legal-dr.ts` (marbete deadline/nudges/tier, licencia, revisión técnica badge) with tests.
- [ ] Recordatorios list/form/complete/snooze; home telltales from the engine; marbete banner in window.
- [ ] Chequeo tab with due-today cards, streak ring, templates, recent runs, guide.
- [ ] Runner: grouped items, how-text, OK/Falla/N/A, cold-engine banner, falla → note/photo/task or reminder, cannot submit incomplete, odometer prompt, result screen with animation.
- [ ] Failed critical items create *crítica* tasks; completing a task can create the repair record (Phase 4 flow).
- [ ] Templates seeded per vehicle type; editing a seeded template scopes a copy to the vehicle.
- [ ] Notifications: channel, lazy permission, ≤ 30 scheduled, deterministic ids, resync on writes/foreground, deep links, test button, settings; nothing on web; no exact-alarm permission.
- [ ] Guide screen with the overheating section.
- [ ] Verified on Android (Expo Go) + web; preview APK built or command recorded; lint/tsc/test/build green.

## Watch for

- Android 13+ shows the permission prompt only after a channel exists — create the channel first.
- `DATE` triggers in the past fire immediately — filter `> now` when planning.
- iOS limit is 64 pending; Android AlarmManager ~500 — the ≤ 30 cap keeps both safe and makes the plan readable.
- The streak must not break when the weekly check is done on day 8 by a few hours — define a week as the 7-day window since the last run, not calendar weeks, and document it.
- `requires_cold_engine` copy is the incident's lesson — make it visible, not a tooltip.
- Do not let `evaluate` touch the DB; it is pure and tested. Repos call it.
