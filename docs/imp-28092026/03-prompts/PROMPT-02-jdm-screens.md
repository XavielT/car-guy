# PROMPT 02 — Block A: the JDM identity on every screen + Garaje tab + vehicle hub

**Depends on:** Phase 1 · **Branch:** `imp-28092026/phase-2-jdm-screens` · **ADRs:** 16, 18 (status/ownership UI) · **Size:** L
**Goal:** G1. The app looks like the artboards. Navigation moves to Inicio · Garaje · Historial ·
Cifras · Más. The vehicle profile becomes the hub with in-page tabs (Álbum/Build/Ficha/Pista
placeholders behind flags).

> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 2 of IMP 28092026: apply the "Cluster JDM 90s" identity to every screen and restructure the
navigation around the Garaje.

Read first:
- docs/imp-28092026/00-context/05-design-jdm.md (Screens section) — and open the Design artifact
  artboards I will paste as screenshots if you ask: Inicio · Cluster, Garaje, Álbum, Build, Pista,
  Tokens. Their HTML sources are in docs/imp-28092026/01-research/04-mockups/*.dc.html — use them
  as the layout reference (spacing, hierarchy, copy).
- docs/imp-28092026/02-specs/03-screens.md (Tabs, Vehicle profile)
- docs/imp-28092026/04-tracking/PROGRESS.md (Phase 1 notes: component APIs)
- docs/imp-17092026/00-context/05-design-identity.md ("What stays" list still applies)

Branch: imp-28092026/phase-2-jdm-screens

1. NAVIGATION: tabs = Inicio · Garaje · Historial · Cifras · Más (icons: gauge, garage, clock,
   stats, dots as in Main.dc.html). Remove the Chequeo tab; its content moves to app/chequeo/index
   (stack) reachable from Inicio QuickActions "CHEQUEO", from the telltale, from Más → Chequeos and
   from notifications (fix deep links). Keep `unstable_settings.anchor`.
2. INICIO per Main.dc.html: header (CAR GUY 車 · TABLERO · Hanko avatar → Cuenta), vehicle chips
   (active amber with katakana nick if set; `· PROYECTO` orange suffix when status=proyecto),
   ClusterHero wired to the reminders engine (progress toward the nearest km-based due; wedge =
   urgente band; caption PRÓX. SERVICIO <km> · ~<fecha>), TelltaleRow driven by the top 6 telltale
   sources (aceite, refrigerante, gomas, batería, marbete/seguro, chequeo semanal) with states from
   reminders/inspections, Pendientes top-2 rows (Badge + mono countdown), QuickActions GASOLINA ·
   CHEQUEO · BUILD · PISTA (BUILD/PISTA visible only when their flags are on; until then show
   MANTENIMIENTO · GASTO in those slots), "ESTE MES 記録" strip, marbete banner, economy insight.
   Launch sweep on cold start.
3. GARAJE tab per Garaje.dc.html: filters ACTIVOS · PROYECTO · EX; hero card of the active vehicle
   (cover = hero_media_id or first favourite photo or vehicle photo; badges derived: engine_code
   → red badge, discipline from tags/track flag → amber badge, status → DAILY/PROYECTO/STOCK);
   2-up cards; EX section with dashed cards ("<acquired year> → vendido <year> · N fotos", 記憶);
   "+ Agregar vehículo". Archived (v2.0) vehicles = status guardado.
4. VEHICLE HUB app/vehiculo/[id]: header per spec (hero, name + nick + badges, status pill,
   LcdDigits odometer, ownership line), segmented in-page tabs Resumen · Álbum · Build · Ficha ·
   Pista · Docs — Resumen and Docs work now; the others render an EmptyState "Próximamente" unless
   their flag is on. Actions: Editar, Cambiar estado (sheet: activo/proyecto/guardado/vendido;
   vendido opens the sale sheet: fecha, km, precio, a quién, razón → closes vehicle_ownership,
   sets status vendido, prompts "Escribe la historia del carro" → story field), Compartir/Libro
   hidden until FEATURE_SHARE. VehicleForm gains nickname, chassis_code, chassis_number,
   engine_code, transmission, drivetrain, origin, imported_year, story (multiline), status.
5. IDENTITY PASS on the rest: Historial (RecordRow with new category colours; month header in
   Saira 800 with subtotal in mono; FAB amber square 56 px), Cifras (KPI tiles in mono; chart
   colours from tokens), Más (sections per 03-screens.md with eyebrow headers), Chequeo screens
   (runner uses BoostRing for progress; result screen sweep; "Todo al día" telltale green), fuel
   screens (PriceBoard as a dark "instrument" with LCD prices), reminders, tasks, documents,
   onboarding (mark + hanko + copy), cuenta, precios, notificaciones, reporte, exportar,
   +not-found, BootError. Every screen: eyebrow labels in Saira 400 tracked, titles Saira 800
   uppercase, body Rajdhani, numbers JetBrains Mono; carbon only on card headers/bezels; one
   HazardDivider max per screen.
6. LIGHT MODE pass with the light tokens; PriceBoard and ClusterHero stay dark panels.
7. Strings: new copy from 05-design-jdm.md "Voice additions" into lib/i18n/es.ts.
8. a11y: TelltaleRow lamps have labels; segmented tabs have roles; contrast list in the report.
9. PDF report (lib/report/html.ts) restyled to the identity (dark header, Saira, badges) — text
   pages stay printable on white.

VERIFY web + Android: screenshots of all five tabs + vehicle hub + chequeo runner in dark and
light into docs/qa/phase-2-*.png; sweep runs once; fuel flow + weekly check; notifications deep
link into the moved chequeo route; tsc/lint/test/build green. Report with Design check per
artboard, merge, push.
```

---

## Acceptance criteria

- [ ] Five tabs as specified; Chequeo reachable from all four entry points; deep links fixed.
- [ ] Inicio matches Main.dc.html structurally (header, chips, ClusterHero, TelltaleRow, Pendientes, QuickActions, month strip).
- [ ] Garaje tab with hero card, 2-up cards, EX section; Jetta seed shows as Ex.
- [ ] Vehicle hub with in-page tabs, status change incl. the sale sheet → ownership closed, story prompt.
- [ ] Every legacy screen restyled; light mode verified; contrast list reported.
- [ ] Sweep once per cold start; reduced motion respected.
- [ ] Fuel flow + weekly check verified on web + Android; screenshots saved.

## Watch for

- Moving a tab route breaks typed routes and notification `data.route` values — grep for `/(tabs)/chequeo`.
- `status` vs `is_archived`: keep both consistent (guardado ⇔ archived) until v3 drops `is_archived`.
- Badges are derived; do not add a "badge" column.
