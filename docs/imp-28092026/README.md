# IMP 28092026 — Car Guy 2.1 "Hachi-Gō": look JDM + features de car guy

Second cycle on `github.com/XavielT/car-guy` (Expo SDK 57). v2.0.0 shipped 2026-09-25 with the
whole car-care core. This cycle makes the app **look like a car-guy app** ("Cluster JDM 90s") and
adds what a car guy who modifies, wrenches, drifts and collects wants: an album that survives phone
changes (the Jetta lesson), a build log with derived specs, a DIY ficha, track logging, and sharing.

Written 2026-09-28. Every point of Xaviel's note is mapped in `00-context/01-project-brief.md`.
The mockups are the Design artifact **"Car Guy — JDM Cluster"** (six artboards); their sources are
in `01-research/04-mockups/` so Claude Code can read the layouts.

## Read in this order

| Step | File | Purpose |
|---|---|---|
| 1 | `00-context/01-project-brief.md` | Note → prompts map, Xaviel's answers, real garage, goals, DoD |
| 2 | `00-context/02-state-of-the-repo.md` | What v2.0.0 is (tables, sync, theme, screens, backlog) |
| 3 | `00-context/03-architecture-decisions.md` | ADR-16…24 — defaults Claude Code applies without asking |
| 4 | `00-context/04-conventions.md` | Additions to the standing rules |
| 5 | `00-context/05-design-jdm.md` | Tokens, type, components, screens, icon, voice |
| 6 | `02-specs/01-data-model-v2.md` · `02-cloud-v2.md` · `03-screens.md` | Migration v2 SQL + domain rules · cloud/sync/public/members · every screen |
| 7 | `01-research/` | JDM design language · build/track/community/reference-data · Expo 57 photos/storage/sharing · mockup sources |
| 8 | `03-prompts/PROMPT-00 … 08` | One per phase, "paste to Claude Code" blocks |
| 9 | `04-tracking/ROADMAP.md`, `PROGRESS.md` | Order and the running log |
| 10 | `05-manual-checklist.md` | Only-Xaviel steps |

## Running

```bash
mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy   # once, with no session open there
cd ~/dev2/car-guy && claude
```

PROMPT-00 copies this folder into the repo as `docs/imp-28092026/`. Rules: Expo 57 docs first;
apply ADR defaults and report; one branch per phase; web + Android every phase; fuel flow and
weekly check are the canaries; `x-core` is shared with Music Hub — additive only.

## Phases (Xaviel's priority A → C → B → D → E → F)

| # | Prompt | Block | Delivers |
|---|---|---|---|
| 0 | `PROMPT-00-kickoff` | — | folder rename note, package in repo, baseline, dev seed with the real garage (AE85 · DS3 · C3 · Jetta) |
| 1 | `PROMPT-01-schema-v2-tokens` | A+foundation | **migration v2** (all tables of the cycle) + cloud `sql/009–010` + sync; JDM tokens, fonts, ClusterHero/TelltaleRow/LcdDigits/Badge/Hazard/Carbon/Hanko/CornerGrid/Timeline; icon |
| 2 | `PROMPT-02-jdm-screens` | A | identity on every screen; tabs Inicio · **Garaje** · Historial · Cifras · Más; vehicle hub with in-page tabs; status/Ex/sale sheet |
| 3 | `PROMPT-03-album-memory` | C | album grid/timeline, import old photos by month with real dates (Android media-library, web EXIF), thumbs + quota + meter, viewer, milestones, "así estaba", Ex vehicles |
| 4 | `PROMPT-04-build-log` | B | mods by system with lifecycle + FX/customs, STOCK → ACTUAL derived specs, wishlist → mod, inventario, wheel sets, tires with DOT age |
| 5 | `PROMPT-05-diy` | D | ficha técnica with honest presets + vPIC, fluids guide with your photos in the checklist, OBD codes (bundled ES table), contactos with WhatsApp |
| 6 | `PROMPT-06-track` | E | events (track/drift/drag/junte), sessions, copy-forward setup sheets with CornerGrid, timing, consumables, day summary |
| 7 | `PROMPT-07-share` | F | public dossier `/c/<slug>` with OG preview (Vercel function), car-book PDF (pdf-lib), shared garage (members, RLS `is_member`, sync changes) |
| 8 | `PROMPT-08-release-2-1` | — | regression, backlog pass, v2.1.0 APK/AAB, release, web, hand-off |

Phase 7 can be postponed and 8 run after 6; the schema for sharing already exists from Phase 1.

## Decisions I made for you (all in the ADRs)

- One migration (v2) for the whole cycle so sync/parity are touched once; v3 only for the OBD feed.
- Album = `media` with `taken_at` + `album_item`; "así estaba" is computed; Ex = ownership period +
  status `vendido`.
- Mods carry `spec_effects`; "actual" specs are derived from installed mods, never hand-kept.
- Presets are honest (nulls + "verifica con tu manual"); DTC list MIT-bundled with Spanish text.
- Public page = Vercel serverless function for OG tags; repo stays static.
- Shared garage = `vehicle_member` + `is_member()` RLS; sync pulls by cursor and re-pulls on grant.
- Storage: compressed + thumbs, 300 MB per user quota with a meter.

## Honest notes

- The three research agents could not use web search (org policy) — they fetched docs and
  registries directly; product claims about Wheelwell/RaceChrono/BaT are from knowledge and are
  marked as such. The Expo 57 and Supabase facts were read from the versioned docs and sources.
- Phase 7's RLS swap is the riskiest step of the cycle; its prompt runs a before/after row count
  for your account inside the same script and keeps a rollback.
- Block E and F are large; if a session runs out, the prompts allow part A/B splits.
