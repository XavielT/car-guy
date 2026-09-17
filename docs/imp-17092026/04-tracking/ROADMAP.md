# Roadmap — IMP 17092026 (Car Guy)

```
 0 kickoff
 └─ 1 rebrand + tokens + tests/lint
     └─ 2 SQLite schema v1 + importer + backup v2
         ├─ 3 garage + navigation
         │   └─ 4 maintenance / expenses / tasks / documents / Historial
         │       └─ 5 inspections + reminders engine + notifications
         │           └─ 6 identity pass on fuel + Más (alias removed)
         │               └─ 7 statistics + PDF + CSV ──────────────┐
         └─ 8 x-core schema carguy + trigger + account (needs 2; best after 7)
             └─ 9 sync ──────────────────────────────────────────┤
                                                                 └─ 10 release
```

## Sequencing notes

- 1 → 2 is strict: the theme alias and the test runner exist before the store rewrite.
- 3 → 4 → 5 is strict: reminders reset (4) needs records; the engine (5) needs readings (3).
- 6 waits for 5 so the identity pass covers every screen once.
- 8 only needs the schema (2) but is placed after 7 so the app is feature-complete before touching
  `x-core`; it may run in parallel with 6–7 in a separate session if Xaviel wants — different files,
  low conflict (`lib/cloud/*`, `sql/*`, `app/cuenta.tsx`).
- 10 can run after 7 for a local-first release; then 8–9 and a short re-release.

## Estimated size (Claude Code sessions)

| Phase | Size | Notes |
|---|---|---|
| 0 | S | mostly copying and checking |
| 1 | M | icons + tokens + moving math |
| 2 | L | the biggest: schema, repos, store, importer, backup, web verification |
| 3 | M–L | navigation + forms + media |
| 4 | L | many screens |
| 5 | L | engine + runner + notifications; the core of the product |
| 6 | M | mechanical restyle + strings |
| 7 | M | charts + report |
| 8 | M | SQL + the manual pause |
| 9 | L | sync + multi-device test |
| 10 | M | builds + accounts |

## Backlog after this cycle (from research; not scheduled)

- Fuel: station memory per vehicle, price-per-gallon trend vs MICM reference.
- Trips (odómetro inicio/fin, propósito) for Uber/InDrive/delivery users; `income` table.
- Parts inventory across vehicles; shop directory with phone/WhatsApp.
- Widgets / quick-add shortcut on Android.
- Look-alike vehicle merge; English locale; xaviel-web integration (imp 11092026 Phase 4/5 with Car Guy).
