# PLAN — IMP 03112026 (Car Guy 2.7 "Sensei")

## Order (one prompt per Claude Code session; each ends with commit + PROGRESS + report)
| # | Prompt | Output | Depends on |
|---|--------|--------|-----------|
| 00 | Kickoff + diagnosis | Real state, SGC AI reference, AI workflow map, Google terms verdict, desktop baselines | — |
| 01 | Keys + gateway | Guards, `sql/042`, secrets in x-core, `_shared`, consent, caps, admin cost screen | 00 |
| 02 | Photo + voice capture | `cg-ai-read`, `cg-stt`, `cg-ai-intent`, capture UI, mic permission | 01 |
| 03 | Documents + onboarding | Document kinds, wrong-car guard, matrícula/VIN → vehicle | 02 |
| 04 | OBD + repairs | `sql/043`, `cg-ai-obd`, dash-light photo, invoice→repair, price/warranty | 02 |
| 05 | Prediction + alerts | `predict.ts`, `cg-ai-insights`, Car Health, digest, triage | 01 (04 for the cache table) |
| 06 | Other workflows | Smart search, Places, album, fuel price assist, checklist photos, accident, sale summary | 02–05 |
| 07 | Desktop web | `useLayout`, side rail, master/detail, shortcuts, drop/paste, PWA, `LAPTOP.md` | 02–03 (capture components) |
| 09 | Trips that start by themselves | Diagnosis, `modules/trip-trigger`, wizard, health card, replay-tuned thresholds, iPhone assisted start | 00 |
| 10 | Speed + route lines | SpeedEngine, calibration (`sql/044`), replay table, thin route-frequency lines | 00 |
| 11 | Monthly + yearly recaps | `buildRecap`, story viewer, share images, notifications | 10 |
| 12 | Easy to use | Audit, Hoy, nav by task, feature set, minimum-first forms, cold-start kit | 00 (09/11 hooks optional) |
| 08 | Regression + release | `VERIFICACION.md`, security + cost passes, release artefacts — **runs twice**: *Release A mode* after 09–12, *final* after the AI/desktop work | A: 09–12 · final: all |

**Round-2 order (default, logged):** `00 → 09 → 10 → 12 → 11 → 08 (Release A mode) → 01 → 02 (incl. Fuel Express) → 03 → 04 → 05 → 06 → 07 → 08 (final)`. Rationale: trips and speed are his daily pain and need no keys; 12 changes Hoy before AI buttons land on it; 11 needs 10's numbers. If you prefer one big release, skip the Release A pass.

Original (round-1) advice: run 00 → 01 → 02 in order; 03, 04, 05 can follow in any order; 07 may run in parallel with 05/06 on its own branch if you want the laptop sooner (it only needs 02's capture components).

## Files this cycle touches (expected)
`supabase/functions/**` (new) · `sql/042…043` · `lib/ai/**` (new) · `lib/domain/predict.ts` (new), `reminders.ts`, `repairs.ts` · `components/ai/**` (new) · `app/carga|servicio|gasto|documento|vehiculo|obd|odometro|admin/uso|admin/comentarios` · `lib/permissions/*` (microphone) · `app.json` · `vercel.json` · `api/insights-weekly.ts` · `lib/theme/useLayout.ts`, tab bar → side rail · `lib/trips/{speed,auto,machine,diagnostics}.ts`, `modules/trip-trigger/**`, `components/map/HeatMap*.tsx`, `lib/domain/{recap,nextStep}.ts`, `lib/nav/model.ts`, `app/resumen/**`, `app/carga/express.tsx`, Inicio/tabs/Herramientas, schema v13 + `sql/044` · `tools/set-ai-secrets.mjs`, `tools/check-bundle-env.mjs` · `docs/**`. **Not touched**: `C:\dev\SGC`, `C:\dev2\csd-app` (read-only references).

## Pending decisions
**None block anything.** Defaults applied (and where they are recorded): company keys reused with caps/kill switch (BRIEF 2) · Edge Functions in x-core (ADR-66) · Google lists-only, flag per terms verdict (ADR-69) · album AI opt-in per person (G2) · AI requires account + connection (BRIEF 5) · 2.7.0 as APK (BRIEF 7). The only stop in the whole plan is the release gate in PROMPT-08 (publishing is yours).

## What only Xaviel can do (also in `05-manual-checklist.md`)
Rotate the two company keys when convenient · real photos for the evals (receipts, matrícula, odometer) · test voice on the Redmi and the iPhone PWA · test the desktop install in Chrome/Edge · approve and publish the 2.7.0 APK · optional: create a Car Guy–named Anthropic key to separate spend.

## Round-2 cost note
Rounds P5–P8 add **no recurring cost** (all on-device). Fuel Express ≈ US$0.01 per use (two images, vision model).

## Cost expectation (from SGC's own numbers, to be replaced by PROMPT-08's measurements)
Receipt read ≈ US$0.004 · document read ≈ US$0.06 · OBD explanation and insights are Sonnet calls (cents). Default caps: US$0.50/user/day, US$5/day global, 30 calls/user/hour.
