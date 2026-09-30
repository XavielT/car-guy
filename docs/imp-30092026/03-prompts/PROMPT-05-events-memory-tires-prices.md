# PROMPT 05 — Eventos, "Mi carro, de memoria", gomas quemadas, precios con historial + MICM

**Depends on:** Phase 2 (+ 3 for strings) · **Branch:** `imp-30092026/phase-5-memory` · **ADRs:** 44, 45, 46 · **Size:** L
**Goal:** G4.

> **Before running:** approve `sql/027_fuel_price_ref.sql` (read it: a read-only reference table
> + an importer RPC + a dedicated Postgres role; the `--shared` statements are the `create role`
> and `grant … to authenticator`; if you prefer not to create a role, say "service key" and the
> prompt's fallback applies). Then, once, mint the importer JWT (manual checklist) and set it in
> Vercel as `CARGUY_IMPORTER_JWT` (or `SUPABASE_SERVICE_ROLE_KEY` for the fallback) — the prompt
> stops at that step and tells you what it needs. Download check: the four latest MICM PDFs must be
> text-based (the prompt checks with pdftotext first).
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 5 of IMP 30092026: events with proofs, the car's memory, tires burned, fuel prices with
history and the MICM import. Notes 1, 3, 5, 6.

Read first:
- docs/imp-30092026/02-specs/01-data-model-v8.md §1.1–1.3, §2; 02-cloud-v4.md §027; 03-screens.md
  "Phase 5"; ADR-44, 45, 46
- docs/imp-30092026/01-research/03-micm-prices-stations-wheelz-adb.md §A (the notices page, PDF
  links, importer design, validation, fallback)
- lib/domain/{events,carMemory,tireStats,fuelPrices}.ts stubs from Phase 2; app/hito/*, components/
  album/MilestoneForm.tsx, app/vehiculo/[id]/ficha.tsx, components/diy/FichaTab.tsx, lib/domain/tires.ts,
  components/build/InventoryForms.tsx (tire rows), app/precios.tsx, components/PriceBoard.tsx,
  app/(tabs)/cifras.tsx (or app/cifras.tsx after Phase 4), lib/share/dossier.ts + api/c/[slug].ts,
  api/apk.ts (function pattern), vercel.json (crons)

Branch: imp-30092026/phase-5-memory

1. EVENTOS (note 5): app/evento/nuevo|[id] (replaces hito/*; old routes redirect): type chips
   with icons, severity segmented (hidden for hito), date/km, story, cost, Pendiente + Resuelto,
   proofs strip (photos + "Adjuntar PDF" via the existing pdf media kind; album_item role 'evento'),
   links to a service/mod/check (pickers), location label. Hub tab "Eventos" (timeline, severity
   markers, pending banner); Historial 'evento' rows; album timeline shows events; book PDF chapter
   "Eventos"; Cifras "Lo que me ha costado" adds event costs (not double-counted when linked to a
   service). Seeded events render. Tests: events domain (pending list, cost merge rule).
2. MI CARRO, DE MEMORIA (note 6): Ficha → tab "Lo que uso" per 03-screens.md; specsheet "what I
   buy" fields + vehicle_fact CRUD grouped; search; Copiar; the service form's oil block and the
   check runner's fluid card show "Igual que siempre: …" from carMemory.suggestionsFor(); the
   public page and the book PDF include "Lo que uso" only when the owner enables the existing
   ficha switch. Tests: suggestions, search fold.
3. GOMAS QUEMADAS (note 3, ADR-45): tireStats + badges + messages per the spec (thresholds 4 · 10 ·
   25 · 50 · 100; names: "Primer juego", "Quemagomas", "Fabricante de humo", "Cliente frecuente
   del gomero", "Leyenda de lao'" — Spanish + English); Build → Gomas header card; Cifras block
   with the year line; heat-cycle warning on a mounted tire (threshold in settings, default 8);
   share card (view-shot, no plate); public page block behind show_tires (sql/025 column; the
   dossier SQL from Phase 2). Tests: counting rules (montado→vendido/quemada, consumables),
   pace/ETA, badge dates, messages pick.
4. PRECIOS (note 1, ADR-46): screens per 03-screens.md (board with source + date; history; new
   entry with DateField, source chips, station picker when estación/recibo); Cifras "Precios"
   chart per fuel (user + MICM series, 12 months, dataviz rules from the theme); the fill-up form
   pre-fills the price per unit from the board (with the source in the hint). IMPORTER: first run
   `pdftotext` (poppler; install if missing) on the four current MICM PDFs and paste the relevant
   lines into PROGRESS.md; if text-based → api/precios.ts (GET: fetch the notices page → newest
   PDF → parse → validate ±20 % vs last stored → RPC upsert_fuel_price_ref via CARGUY_IMPORTER_JWT
   (or the service key fallback) → JSON; Cache-Control s-maxage 3600; `vercel.json` crons: Saturday
   12:00 UTC (08:00 AST) — note Hobby plan cron limits; if the cron is refused, the app's launch
   fetch triggers the import when the newest ref week is older than 8 days). App: refreshFuelPriceRef()
   on launch + "Importar MICM ahora" button; board shows "MICM · semana del 25 sep" chip; a manual
   row for the same week wins. If the PDFs are images → write the function to return {stale:true,
   reason:'pdf-not-text'} and leave the manual flow as the path; say so in the report and the
   changelog. Apply sql/027 (after local-rls checks), verify-x-core additions.
5. Flags FEATURE_EVENTS → true. Strings in both languages. Tests as listed + parseWeekLabel edge
   cases + importer parser on the four fixture texts (saved under docs/imp-30092026/fixtures/micm/).

VERIFY web + Android: create the "espejo" event with a photo and a pendiente → hub banner, Historial,
album; add a fact and see it in search; the Trueno's tire card shows "14 gomas" and a badge; prices:
add a manual entry with the date picker, import MICM (if text) → board + chart; a fill-up pre-fills
the price. Screenshots docs/qa/imp-30092026-phase-5-*.png. Report block; Notes closed: 1, 3, 5, 6.
```
