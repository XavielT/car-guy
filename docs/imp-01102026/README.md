# IMP 01102026 — Car Guy 2.5 "Nakama" (仲間): la verdad en cada dispositivo, el medidor de tu carro, la app se actualiza sola, y la gente

Fifth cycle on `github.com/XavielT/car-guy` (Expo SDK 57). Cycle 4 shipped **2.3.1 → 2.4.2** in one
day; Xaviel used 2.4.x on his **iPhone (PWA)** and on the Redmi (APK) and wrote eighteen notes. The
drive that was not recorded happened on the iPhone, where Safari forbids background location — so
this cycle starts by telling the truth per platform and proving the Android service on his phone
(**2.4.3**), then gives the fuel gauge his car's language (squares, learned liters, range), makes
the app update itself (EAS Update + in-app APK), adds a voluntary "Apoyar Car Guy" with a cost
meter instead of ads, and brings people in: public profiles by @handle, follow/friends, privacy by
default, shared (trimmed) trips, and **juntes** with a live map — **2.5.0**, proven by an OTA 2.5.1.

Written 2026-10-01. Every note is mapped in `00-context/01-project-brief.md` §1; answers in §2;
defaults in ADR-48…58. Nothing waits on a decision.

## Read in this order

| Step | File | Purpose |
|---|---|---|
| 1 | `00-context/01-project-brief.md` | §0 the iPhone finding; note → prompt map; answers; goals; DoD |
| 2 | `00-context/02-state-of-the-repo.md` | 2.4.2: schema v9, sql/032, gauge today, SW, header seal, mods entry, profiles |
| 3 | `00-context/03-architecture-decisions.md` | ADR-48…58 |
| 4 | `00-context/04-conventions.md` | platform truth, cloud-only social tables, no stored positions, topic-scoped realtime, OTA discipline |
| 5 | `02-specs/01-data-model-v10.md` · `02-screens.md` | migration v10 + cloud 033–036 · every screen |
| 6 | `01-research/` | 01 iOS PWA · updates · ads · costs · 02 follows · live location · juntes (SQL) · 03 segment-gauge calibration (PAV, worked example) · 04-mockups |
| 7 | `03-prompts/PROMPT-00 … 06` | one per phase |
| 8 | `04-tracking/ROADMAP.md`, `PROGRESS.md` | order and the running log with the note table |
| 9 | `05-manual-checklist.md` | only-Xaviel steps (the Redmi drive, approvals, the PayPal test, two accounts) |

## Running

```bash
mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy   # still pending
cd ~/dev2/car-guy && claude
```

PROMPT-00 copies this folder into the repo as `docs/imp-01102026/`. Rules as always.

## Phases

| # | Prompt | Delivers | Notes |
|---|---|---|---|
| 0 | `PROMPT-00-kickoff-diagnostics` | package in repo, baseline, audit, **Redmi auto-trip diagnostics** (logcat, permissions, MIUI, service, fixes) + a diagnostics export action | 7 |
| 1 | `PROMPT-01-fixpack-2-4-3` | **v2.4.3**: iPhone PWA truth (banner, SW network-first), fresh-location rule + avatar dot, Android auto-trip fix from the finding, header avatar instead of 改, sync time, garage labels, "+ Mod" everywhere + Accesorios/Estética + RD$ first, Carrocería y pintura, odometer welcome slide | 2, 5, 7, 8, 9, 10, 15, 16, 17, 18 |
| 2 | `PROMPT-02-schema-v10` | gauge columns + calibration, trip_share/privacy_zone, profiles handle/bio/switches, follow/block/report, juntes, app_config, realtime policies (`--shared`) | — |
| 3 | `PROMPT-03-gauge-segments` | per-vehicle gauge type, squares picker, **learned squares → liters** (PAV), "≈ 22 L ≈ 390 km" in form/hub/cluster | 1, 3 |
| 4 | `PROMPT-04-updates-support-usage` | **EAS Update** OTA + **in-app APK updater**, release script `--ota` gate, **Apoyar Car Guy**, admin **Uso y costos** | 4, 6 |
| 5 | `PROMPT-05-profiles-follows-privacy` | @handle, public profile + `/u/<handle>`, follow/requests/friends/block/report, privacy switches + zones, shared trimmed trips | 11, 12, 14, 16 |
| 6 | `PROMPT-06-juntes-release-2-5` | juntes (invite, live map via Realtime, after-view, event), chat built but **off**, regression, **v2.5.0** + OTA 2.5.1 | 13 |

## Decisions I made for you (ADRs)

- iOS stays a PWA and says what it can't do; no dead iOS project.
- A fix is drawable only when fresh (≤ 15 s, ≤ 50 m); auto detection never starts on a cached fix.
- Gauge readings become fractions + raw; the mapping squares → liters is learned per car with a
  monotone fit and always shown with a band.
- OTA for JS, APK prompt for native; the release script decides which.
- No ads (AdMob needs a store; cents/month at 30 users; safety); "Apoyar" + a real cost meter.
- Other users' profile data only through security-definer functions; trips never public by
  default; shared routes trimmed 300–500 m + privacy zones; no speeds of others, ever.
- Juntes on Realtime Broadcast + Presence, positions never stored, policies scoped to `carguy:`
  topics because the project is shared with Music Hub.

## Honest notes

- The unrecorded drive on the iPhone is **not fixable**: it is Safari's rule. Automatic trips
  need the Android app (or, later, a native iOS app with an Apple Developer account).
- Several research items could not be fetched (PayPal/Ko-fi/Stripe availability in DR, some
  Android install details, Realtime message accounting): marked; the PayPal test payment is in
  your checklist for that reason.
- The social cycle is the largest surface the app has had; chat ships off until push
  notifications exist. The Free tier's 100 msg/s Realtime limit caps a live junte at ~20 cars at
  4 s — the adaptive interval handles it.
- Service-role key rotation is still pending from cycle 4 — it is in the checklist again.
