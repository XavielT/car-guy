# PROMPT-05 — Prediction, anomalies and alerts (answer: "prediction and alerts")

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, ADR-67/68, **SPEC-E**, `lib/domain/{reminders,oilInterval,economy,partialEconomy,perFillEconomy,tireStats,costs,fuelPrices}.ts`, `lib/features/registry.ts` (telltales), and SGC's `docs/RENDIMIENTO-COMBUSTIBLE.md` (read-only). Nothing waits; log defaults.

## Steps
1. **`lib/domain/predict.ts`** (pure TS, **no React Native imports** — add an import-boundary test so it can also run in Deno) per SPEC-E §E1: `kmPerDay`, projected due dates, the 4-state fuel classification (port SGC's rules to Car Guy's partial-fill/gauge model; partial fills never anomalies; short distance = insufficient), cost facts, wear facts, `Fact` type with closed-list actions. Thorough unit tests including the SGC "10–11 km fill-up is never optimal" case, gaps in odometer data, stale odometer, a car with one reading, diesel vs gasoline vs motorcycle.
2. **Surfaces**: projection on km-based reminders and the Inicio telltales (amber before the date); fuel detail shows the 4-state badge with the reason; `mergeAttention`/Pendientes cards show act-level facts. Keep existing behaviour when `kmPerDay` confidence is `none`.
3. **`cg-ai-insights`**: input = facts; forced schema; ≤ 5 insights; each with fact ids and one closed-list action; **server validation that every number in the text matches the facts**, else template fallback; drop insights without facts; cache in `ai_insights` by `input_hash`; consent/caps from the gateway. Client: Inicio "Car Health" card, vehicle hub "Insights" section, dismiss/done persistence, actions open the normal flows (never silent writes).
4. **Weekly digest**: `api/insights-weekly.ts` (Vercel Cron, add to `vercel.json`) or Supabase cron — pick the one that fits the existing `api/precios.ts` pattern; users active in the last 30 days with a changed hash; push via the existing Expo-push path respecting `notificaciones.tsx`; per-user daily cap; kill switch honoured. The cron path computes facts server-side from cloud-synced data using the **same** `predict.ts` (bundled for the server).
5. **Admin triage** `cg-ai-triage` (SPEC-E §E4) in Admin → Comentarios, using `lib/feedback/redact.ts` before sending; draft reply for the admin to edit; never auto-sends.
6. Tests: the tamper-a-number test, hash-cache test, dismissal persistence, cron selection logic, redaction. Evals `evals/ai/insights.json` (10 fact sets). Deploy functions; log. es/en strings. Green checks. Commit.

## Acceptance
SPEC-E §E5.

## Final report
Which facts exist, how often the number-validation fallback fired in evals, digest dry-run output for Xaviel's own car (no push sent without telling him), cost per insight call.
