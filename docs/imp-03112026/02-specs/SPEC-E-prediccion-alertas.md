# SPEC-E — Prediction, anomalies and alerts (answer "prediction and alerts") — ADR-68

## E1. Deterministic engine: `lib/domain/predict.ts` (pure TS, fully unit-tested)
Inputs come from existing local data (odometer readings, fill-ups, services, reminders, tires, expenses) — no new tables on the device.
- **Usage rate** (`kmPerDay`): robust median over the last 60–90 days of odometer readings (ignore outliers, handle gaps and a stale odometer); confidence level `high|medium|low|none`.
- **Projected due dates**: every km-based or "both" reminder (`reminders.ts`: `metric 'km'|'both'`) gets `projectedDueAt = today + (dueKm − currentKm)/kmPerDay`. Shown on the reminder as "≈ 12 Dec (at your pace)", and on the Inicio telltales so "oil" turns amber *before* the date. Oil interval uses `oilInterval.ts` with the synthetic/mineral flag (ADR-63).
- **Fuel anomaly classification** — port the 4-state rule from SGC `docs/RENDIMIENTO-COMBUSTIBLE.md` (insufficient data / optimal / low / abnormal; floor/ceiling plausibility, baseline = own plausible average, minimum distance, full-to-full) **on top of Car Guy's gauge and partial-fill logic** (`partialEconomy.ts`, `perFillEconomy.ts`): partial fills must never be called anomalies; a short distance is `insufficient`, never "optimal". Thresholds as constants in one file, tested, same defaults as SGC (`dist_min` 50 km, ±20 % low, ±40 % abnormal, ≥ 3 plausible fill-ups).
- **Cost facts**: cost per km (30/90/365 d), monthly spend by category vs previous months, fuel price paid vs MICM reference (`fuelPriceRef`), biggest single expense, projected monthly.
- **Wear facts**: tire age/DOT and km on set (`tireStats`), time since last rotation/alignment, battery age, brake service gap, timing-belt/coolant intervals from the catalogue.
- Output type `Fact { id, kind, vehicleId, severity: 'info'|'watch'|'act', data, actions[] }` with `actions` from the **closed list** (ADR-67).

## E2. AI layer: `cg-ai-insights`
- Input = the list of `Fact`s (+ vehicle label, language, tone). The model returns ≤ 5 insights ordered by what matters: a one-line headline, a 1–2 sentence "why" in es-DO, the fact ids it relies on (anything with no fact id is discarded server-side), and one action from the closed list. It **may not** introduce numbers that are not in the facts (server validates numbers in the text against the facts; on mismatch it falls back to a template sentence).
- Cached in `carguy.ai_insights` (`sql/043`): `id, user_id, vehicle_id, kind, input_hash, payload jsonb, status ('new'|'seen'|'dismissed'|'done'), created_at`. Same `input_hash` → no new call. RLS owner-only; garage members with at least viewer role can read their vehicle's insights (reuse `is_member`).
- Surfaces: Inicio "Car Health" card (top 1–3), vehicle hub "Insights" section, OBD/reminder/fuel screens show only the insight tied to them. Dismiss = `dismissed` (never returns for the same hash). Tapping the action runs the normal flow (creates a reminder draft, opens OBD…), never writes silently.
- **Weekly digest**: Vercel Cron (or Supabase cron) → `api/insights-weekly.ts` / `cg-ai-insights` for users active in the last 30 days with a changed hash; sends a push through the existing Expo-push route (respect `notificaciones.tsx` preferences and quiet hours; iPhone PWA gets none — ADR-48 — and sees it on open). Daily cap per user; kill switch honoured.
- Computation location: facts are computed **on the device** and sent (so offline-first data is the source of truth); the cron path can only use cloud-synced data, so it computes facts server-side with the same TS module bundled for Deno (shared pure file, `lib/domain/predict.ts` has no RN imports — keep it that way, add an import-boundary test).

## E3. Alerts on the surfaces that already exist
Telltales (`TelltaleRow`) read `Fact`s; "Pendientes" cards (`mergeAttention`) show act-level facts; reminders show the projection; fuel detail shows the 4-state badge with the reason (SGC style tooltip = why).

## E4. Admin feedback triage (`cg-ai-triage`, Admin → Comentarios)
For each new comment/report: category (bug, idea, question, praise), severity, affected feature (registry id), duplicate group with similar open ones, a one-line summary, and a **draft reply** the admin can edit and send. Admin-only; PII redacted by the existing `lib/feedback/redact.ts` before it is sent. Never auto-replies.

## E5. Acceptance
Pure-logic tests for every fact (including the partial-fill and short-distance cases that bit SGC); projection appears on km-based reminders; a user with changing data gets a digest only when facts changed; numbers in AI text always match facts (test that tampers a number and expects the fallback); dismissals persist; kill switch silences the cron; admin triage works and redacts.
