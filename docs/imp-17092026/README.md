# IMP 17092026 — Tu Combustible RD → **Car Guy**

Planning package for the cycle that transforms `/home/xaviel/dev2/tu-gasolina-rd` (Expo SDK 57,
"Tu Combustible RD", a DR fuel log) into **Car Guy**: multi-vehicle care — maintenance, repairs,
upgrades, daily/weekly inspections, fuel, documents, reminders that predict, history, statistics,
and an optional account that syncs to Supabase `x-core` (schema `carguy`).

Written 2026-09-17, the day the coolant ran low. Every one of Xaviel's notes is mapped in
`00-context/01-project-brief.md` → "Xaviel's notes → where each one lands".

## How to use this package

Read in this order once; then run the prompts in order.

| Step | File | Purpose |
|---|---|---|
| 1 | `00-context/01-project-brief.md` | Notes → prompts map, decisions D1–D6, goals, non-goals, definition of done |
| 2 | `00-context/02-repo-audit.md` | What the repo is today (verified from the code) |
| 3 | `00-context/03-architecture-decisions.md` | ADR-01…15 — the defaults Claude Code applies without asking |
| 4 | `00-context/04-conventions.md` | Standing rules, verification, report format |
| 5 | `00-context/05-design-identity.md` | The new identity, "Tablero nocturno" |
| 6 | `02-specs/*` | Data model + domain rules · cloud schema/sync · screens & navigation |
| 7 | `01-research/*` | The three research reports (apps, DR maintenance/legal, Expo 57 tech) — reference material the prompts cite by section |
| 8 | `03-prompts/PROMPT-00 … 10` | One prompt per phase; each has a "paste to Claude Code" block |
| 9 | `04-tracking/ROADMAP.md`, `PROGRESS.md` | Order/dependencies; the running log Claude Code fills |
| 10 | `05-manual-checklist.md` | The few things only Xaviel can do (logins, dashboard toggles, running SQL) |

### Running a phase

```bash
cd /home/xaviel/dev2/tu-gasolina-rd
claude
```

Paste the block from the prompt file. **PROMPT-00 copies this folder into the repo as
`docs/imp-17092026/`**; from then on prompts reference `docs/imp-17092026/…` so Claude Code reads
them directly. This folder in `~/improvements` remains the master copy for hand edits; if both
differ, the newer wins (PROMPT-00 says so).

### Rules that apply to every prompt (short version)

- `CLAUDE.md → AGENTS.md`: read the **Expo SDK 57** versioned docs before touching an Expo module.
- Apply the ADR defaults, build, report. Do not stop to ask — except the one documented pause in
  PROMPT-08 (copying the live trigger body) and anything destructive on `x-core`.
- One branch per phase (`imp-17092026/phase-<n>-<slug>`), report in `04-tracking/PROGRESS.md`,
  merge to `main`.
- The fuel flow is the regression canary. Web **and** Android in every phase.

## Phases

| # | Prompt | Delivers | Depends on |
|---|---|---|---|
| 0 | `PROMPT-00-kickoff` | Package into repo, audit check, baseline, backup fixture | — |
| 1 | `PROMPT-01-rebrand-foundation` | Car Guy identity (name, package `com.xaviel.carguy`, icons, manifest), design tokens + base components, `lib/domain/economy` + tests, lint | 0 |
| 2 | `PROMPT-02-sqlite-data-layer` | SQLite schema v1 (all tables), repos, store rewire, catalog seeding, **Tu Combustible RD importer**, backup v2 (web too) | 1 |
| 3 | `PROMPT-03-garage-navigation` | New tabs, home (OdometerHero, QuickActions), rich vehicle profile, photos, DateField, odometer + km/day | 2 |
| 4 | `PROMPT-04-maintenance-history` | Service/repair/upgrade records, expenses, tasks, documents, unified Historial, reminder reset on service | 3 |
| 5 | `PROMPT-05-inspections-reminders` | Checklists (daily/weekly/monthly, DR/diesel/moto), runner, guide (overheating), reminders engine (4 states, prediction), DR legal (marbete/seguro/licencia), local notifications | 4 |
| 6 | `PROMPT-06-fuel-restyle-polish` | Fuel screens on the new identity, `missed_previous`, Más reorganised, alias removed, strings centralised, light mode, a11y | 5 |
| 7 | `PROMPT-07-statistics-reports` | Stats domain, charts, Cifras, PDF report, CSV export | 6 |
| 8 | `PROMPT-08-supabase-auth` | `x-core` schema `carguy` + RLS + Storage, app-aware invite trigger, optional account UI | 2 (7 recommended) |
| 9 | `PROMPT-09-cloud-sync` | Push/pull LWW sync, tombstones, media upload, multi-device verification | 8 |
| 10 | `PROMPT-10-release` | Android APK/AAB, GitHub release, new Vercel project `car-guy`, repo rename, hand-off | 9 (or 7) |

Phases 8–9 can be postponed without blocking 10 (release local-first first, ship sync later) — if
so, run 10 after 7 and re-run a short release pass after 9.

## What I decided for you (defaults, all in the ADRs)

- Storage: `expo-sqlite` async API, no ORM, migrations under `PRAGMA user_version`.
- Records: one `service_record` table for mantenimiento/reparación/mejora; `expense` for
  non-odometer costs; unified `history_feed` view.
- Reminders: date/km/both, recurring reset-on-completion, **predicted due date from median km/day**,
  states ok/próximo/urgente/vencido, legal items fixed-interval; notifications ≤ 30, no exact alarms.
- Inspections: seeded templates (carro diario/semanal/mensual, diésel, motor T-CLOCS), falla → task.
- Cloud: `x-core`, schema `carguy`, `text` ids, `updated_at` LWW, `deleted_at` tombstones, Storage
  bucket `carguy-media`; the Music Hub invite trigger gets one `IF` for `app = 'carguy'`.
- Identity: dark-first "Tablero nocturno", cyan accent, four status colours, Space Grotesk / Inter /
  JetBrains Mono.
- Spanish only, strings centralised.

## Open items (not blocking)

- Look-alike vehicle merge after first sign-in (hint only, PROMPT-09).
- English UI (structure ready, no work planned).
- Integration into xaviel-web (`imp 11092026` Phase 4) — hand-off note produced by PROMPT-10.
- iOS native build — PWA covers iPhone.
