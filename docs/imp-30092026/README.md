# IMP 30092026 — Car Guy 2.4 "Tōge" (峠): mapa real, modo conducir, dos idiomas, la memoria del carro

Fourth cycle on `github.com/XavielT/car-guy` (Expo SDK 57). The third cycle shipped **2.2.0 → 2.3.0
in one day** (2026-09-30); Xaviel used it and wrote seventeen notes. This cycle fixes the daily flows
first (fill-up save → detail, no duplicates; Petronan and friends; reserve light; partials counted
"≈ por echada"; routes that keep their points — **2.3.1**), then makes the app bilingual with a
skeleton on every screen, puts the routes on a real **MapLibre** map with a full-screen **Modo
conducir** behind a centre button in the bar, gives the car a memory (events with proofs, "lo que
uso", tires burned with badges, fuel prices over time with the MICM weekly import), and adds people
things (profile + avatars, a welcome, the legal floor and account deletion) — **2.4.0**.

Written 2026-09-30. Every note is mapped in `00-context/01-project-brief.md` §1; his answers in §2;
defaults in ADR-37…47. Nothing waits on a decision.

## Read in this order

| Step | File | Purpose |
|---|---|---|
| 1 | `00-context/01-project-brief.md` | Note → prompt map, answers, goals, DoD |
| 2 | `00-context/02-state-of-the-repo.md` | What 2.3.0 is (schema v7, sql/024, trips code, prices as settings, tab bar) |
| 3 | `00-context/03-architecture-decisions.md` | ADR-37…47 |
| 4 | `00-context/04-conventions.md` | Strings through `t`, skeleton per screen, map isolation, legal as content, service keys |
| 5 | `02-specs/01-data-model-v8.md` · `02-cloud-v4.md` · `03-screens.md` | Migration v8 + domain · cloud 025–028 · every screen |
| 6 | `01-research/` | 01 MapLibre on Expo 57 + free tiles · 02 i18n, skeletons, onboarding, avatars, legal · 03 MICM prices first-hand, DR stations, Wheelz-over-adb protocol · 04-mockups (NavConducir, ModoConducir, Precios) |
| 7 | `03-prompts/PROMPT-00 … 06` | One per phase (03 has parts A/B) |
| 8 | `04-tracking/ROADMAP.md`, `PROGRESS.md` | Order and the running log with the note table |
| 9 | `05-manual-checklist.md` | Only-Xaviel steps (adb, the drive, approvals, the JWT, the legal read) |

## Running

```bash
mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy   # still pending
cd ~/dev2/car-guy && claude
```

PROMPT-00 copies this folder into the repo as `docs/imp-30092026/`. Rules as always: Expo 57 docs
first; ADR defaults applied and reported; one branch per phase; web + Android every phase; canaries
(fuel flow, weekly check); `x-core` additive only.

## Phases

| # | Prompt | Delivers | Notes |
|---|---|---|---|
| 0 | `PROMPT-00-kickoff-wheelz` | package in repo, baseline, audit incl. the **screen audit**, hidden GPS export action, **Wheelz first-hand over adb** (read-only) | 14 |
| 1 | `PROMPT-01-fixpack-2-3-1` | **v2.3.1**: fill-up detail + editor split, double-save guard, stations picker, "Solo la luz de reserva", "≈ por echada", route points kept (simplify 3 m, auto = manual recording), trip export audit | 7, 8, 9, 12, 16 |
| 2 | `PROMPT-02-schema-v8` | fuel_price (+ migrated settings), event columns, "what I buy" + vehicle_fact, legal_acceptance, avatar fields, show_tires, trip diagnostics; sql/025–026; domain stubs; seed | — |
| 3 | `PROMPT-03-i18n-skeletons` | A: typed `en.ts`, language store, catalogue translations, Intl, Más → Idioma. B: `<Skeleton>`, one twin per screen, audit test | 2, 4 |
| 4 | `PROMPT-04-map-drive-mode` | MapLibre native + web on OpenFreeMap dark, trip map, heatmap, **Modo conducir** full-screen, **centre CONDUCIR button** (Cifras → Más) | 13, 16, 17 |
| 5 | `PROMPT-05-events-memory-tires-prices` | Eventos with severity/proofs/pendiente, "Lo que uso" + facts, gomas quemadas (counters, badges, messages, share, public switch), precios with history + chart + **MICM import** (sql/027) | 1, 3, 5, 6 |
| 6 | `PROMPT-06-profile-onboarding-legal-release-2-4` | 16 JDM avatars + photo, welcome (6 slides) + tips, legal pages + acceptance + **Eliminar cuenta** (sql/028), regression, **v2.4.0** | 10, 11, 15 |

## Decisions I made for you (ADRs)

- Fix pack before schema; the fill-up flow lands on a detail screen and refuses a duplicate.
- Map: MapLibre v11 (native) + maplibre-gl 5 (web) on OpenFreeMap's dark style — no keys, no Google;
  MapTiler free key as a one-line fallback. Routes follow streets by keeping points (3 m), not by
  map matching.
- Drive mode is a module: centre disc in the bar, Cifras moves to Más.
- Language without a library: `en.ts` typed as `typeof es`; missing keys fail the build.
- Events = milestones with type/severity/cost/pending/proofs; tires stats derived, never stored.
- Prices: your rows + MICM reference rows; importer is a Vercel Cron reading the weekly PDF, with a
  dedicated Postgres role (or the service key if you prefer) — the first server-side secret.
- Legal: public pages + in-app acceptance record + in-app deletion; texts are drafts to be
  lawyer-reviewed before Play.

## Honest notes

- Web search is still off for Claude in your org; research went by direct URLs. Google Play
  policy pages and DiceBear licences **could not be fetched** (fetch approval timed out) — those
  parts of research 02 are from knowledge and marked; re-check before Play Store.
- MICM prices are weekly **PDFs** (verified through your Chrome); the importer depends on them
  being text-based — PROMPT-05 checks first and falls back to manual entry with the date picker.
- The straight-line route: recording is already 1 s / 3 m, so the loss is downstream (8 m
  simplification, auto-mode intervals, the excursion filter, or the mosaic zoom). PROMPT-01 exports
  your real trip before touching constants.
- Wheelz first-hand needs the phone on adb during PROMPT-00; read-only.
- The tire badges' names and the message thresholds are my proposal; they live in one file to tune.
