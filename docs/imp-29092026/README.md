# IMP 29092026 — Car Guy 2.2 "Kaidō" (街道): viajes, registro rápido, carga parcial, la app que responde

Third cycle on `github.com/XavielT/car-guy` (Expo SDK 57). v2.1.2 shipped 2026-09-29; the same day
Xaviel used it on his phone and wrote nineteen notes. This cycle fixes what real users hit (a
hotfix 2.1.3 first), then adds **Viajes** (automatic + manual drive tracking with live speed on
the cluster, Wheelz-style), makes registering a car fast (pickers, several photos, liters or
gallons, real statuses, oil picker), estimates fuel economy from partial fills, and gives the app a
voice: version history, a feedback inbox, an animated launch, "lo que me ha costado", a garage you
arrange yourself, and the APK downloadable from the web itself.

Written 2026-09-29. Every note is mapped in `00-context/01-project-brief.md` §1; nothing waits on
a decision (Xaviel's answers in §2, defaults in ADR-25…36).

## Read in this order

| Step | File | Purpose |
|---|---|---|
| 1 | `00-context/01-project-brief.md` | Note → prompt map, answers, goals, DoD |
| 2 | `00-context/02-state-of-the-repo.md` | What v2.1.2 is (schema v5, sync, eas.json gap, code map, portfolio repo) |
| 3 | `00-context/03-architecture-decisions.md` | ADR-25…36 — defaults Claude Code applies without asking |
| 4 | `00-context/04-conventions.md` | Additions (units, `lib/trips`, refdata files, no developer text) |
| 5 | `02-specs/01-data-model-v6.md` · `02-cloud-v3.md` · `03-screens.md` | Migration v6 SQL + domain · cloud 018–020 + sync gate · every screen |
| 6 | `01-research/` | 01 trip tracking on Expo 57 · 02 partial fills, units, make/model/colour/oil data · 03 photo bug, EAS env, changelog, feedback, APK, splash · 04 Wheelz observed |
| 7 | `03-prompts/PROMPT-00 … 07` | One per phase (05 has parts A and B), "paste to Claude Code" blocks |
| 8 | `04-tracking/ROADMAP.md`, `PROGRESS.md` | Order and the running log (with the note table) |
| 9 | `05-manual-checklist.md` | Only-Xaviel steps (rename, approvals, the real drive) |

## Running

```bash
mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy   # once, with no session open there (still pending from last cycle)
cd ~/dev2/car-guy && claude
```

PROMPT-00 copies this folder into the repo as `docs/imp-29092026/`. Rules as before: Expo 57 docs
first; apply ADR defaults and report; one branch per phase; web + Android every phase; the fuel
flow and the weekly check are the canaries; `x-core` is shared with Music Hub — additive only.

## Phases

| # | Prompt | Delivers | Notes closed |
|---|---|---|---|
| 0 | `PROMPT-00-kickoff` | package in repo, baseline, audit, **portfolio live check**, seed | 18 |
| 1 | `PROMPT-01-hotfix-2-1-3` | **v2.1.3**: photo bug fix (expo/expo#50217 workaround), Supabase vars in EAS builds + build guard, no developer text, schema gate, stable `car-guy.apk` | 12, 13 |
| 2 | `PROMPT-02-schema-v6` | migration v6 (trips, gauge, statuses, oil, gallery roles), **liters canonical** with per-vehicle unit, cloud `sql/018–019`, sync bridge, refdata JSON (makes/models, colours, body types, oil) | 15 (data) |
| 3 | `PROMPT-03-vehicle-forms` | vehicle form v2 (pickers with search, colour swatches, year wheel, body types, L/gal, price visible, nine statuses with note/since, photo strip with cover), oil picker, multi-photo on check issues shown in history | 3, 8, 10, 11, 15, 16 |
| 4 | `PROMPT-04-fuel-partial` | gauge E…F before/after + reserva, estimated/reconciled/measured points with bands, Cifras styles | 4 |
| 5 | `PROMPT-05-viajes` (A, B) | A: manual trips, cluster **speed mode**, trip list/detail with SVG route + replay + distribution, Cifras block, odometer suggestions. B: **automatic detection** in the background (expo-location task, state machine, MIUI checklist) | 1, 2, 19 |
| 6 | `PROMPT-06-garage-splash-versions-feedback-costs` | Garaje v2 (covers, three views, drag order, pin), animated launch overlay, Novedades y versiones, Enviar comentario + admin inbox (`sql/020`), "Lo que me ha costado" | 5, 6, 7, 8, 14 |
| 7 | `PROMPT-07-web-apk-release-2-2` | `/api/apk` + `/instalar` + Android-only button, portfolio verified/deployed, regression, upgrade test, **v2.2.0** | 9, 17 |

## Decisions I made for you (all in the ADRs)

- Hotfix before anything else; the 2.1.3 APK is the one to send to friends.
- Trips with Expo's own location + task manager, no paid SDK; a trip ends after **4 minutes**
  stopped (the Wheelz complaint) and short restarts merge; routes drawn as SVG (no map keys);
  GPS km only ever *suggest* an odometer reading.
- Volumes stored in liters from v6 on, shown in the unit each vehicle chooses; the cloud keeps
  both until every device is on 2.2 (schema gate shipped in 2.1.3).
- Partial fills: gauge eighths + reserva; only the explicit "Tanque lleno" is a full anchor.
- Feedback on x-core through a rate-limited RPC; you are the admin by email.
- Launch animation as a JS overlay on top of the static native splash.
- Stable `car-guy.apk` asset in every release; the web reads GitHub through a cached function.

## Honest notes

- Web search is still disabled for Claude in your org (HTTP 403 from the search proxy); the three
  research reports were built by fetching docs, GitHub issues, npm and the Play listing directly,
  and mark what could not be verified. Turning it on (Admin settings → Capabilities → Web search)
  is a one-time fix on your side.
- I could not open Wheelz on your phone (no bridge to it); `04-wheelz-observed.md` is from the
  Play listing and its screenshots, read through your Chrome. Your screenshots, if you send them,
  slot into its last section.
- The photo bug is an **open upstream bug** in expo-image-manipulator on Android; the fix here is a
  workaround (strong reference + retry). If it still reproduces after Phase 1, the fallback is a
  patch-package patch of the Kotlin file (research 03 §1.3) — the prompt says so.
- Automatic trip detection on MIUI depends on the user relaxing battery restrictions; the app
  can only explain, not force it. Part B's device test decides between two configurations.
- The portfolio repo already contains the Car Guy card on `main` (committed today); whether the
  live site shows it is checked in Phase 0 and fixed in Phase 7.
