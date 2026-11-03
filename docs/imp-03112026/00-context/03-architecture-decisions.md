# Architecture decisions — IMP 03112026 (ADR-65 … ADR-75, proposed; each phase writes its own in full)

## ADR-65 — Keys live in the server, one gateway, one door
All third-party calls (Anthropic, speech-to-text, Google) go through Edge Functions `cg-*` in x-core. Secrets: `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `STT_API_KEY`/`STT_PROVIDER`/`STT_MODEL` (SGC's STT is OpenAI/Groq, not Azure — PROMPT-00 correction; `AZURE_SPEECH_*` only if Xaviel adds them), models in `CG_MODEL_VISION` (default `claude-haiku-5-5`, fallback `claude-haiku-4-5-20251001`) and `CG_MODEL_REASON` (default `claude-sonnet-5-5`, fallback `claude-sonnet-5`) — PROMPT-00 verified against the docs. The client never sees a third-party key; bundle guard + gitleaks enforce it. Changing a key or a model is a secret change, not a code change.

## ADR-66 — AI gateway: JWT, consent, limits, cost, kill switch — in that order
Every `cg-*` function runs the same `_shared/gate.ts`: (1) valid user JWT, (2) `app_config.ai_enabled`, (3) `ai_consent` true (403 `sin_consentimiento_ia`), (4) per-user hour limit, per-user daily cost cap, global daily cost cap (429 with a human message), (5) call, (6) one `ai_usage` row (function, model, tokens, cost, ok). Errors carry a stable `error_code` the app translates; no provider text reaches the person.

## ADR-67 — AI proposes, the person disposes
AI output pre-fills the existing form/screen with a per-field confidence (< 0.6 highlighted), keeps the source photo as the record's media (`role='invoice'` or document photo), and saves nothing until the person taps the normal Save. Insights offer **typed actions from a closed list** (`create_reminder`, `open_obd`, `log_fuel`, `open_service`, `open_document`, `add_task`); the model cannot invent a new action (same idea as SGC's closed agent-action list).

## ADR-68 — Deterministic first, AI second
Predictions, anomalies and costs are computed by pure functions (`lib/domain/predict.ts`, ported rules from SGC's 4-state fuel classification) and passed to the model as facts. The model explains, prioritises and phrases in Dominican Spanish; it never computes. An insight with no facts behind it is dropped.

## ADR-69 — Google only server-side, lists only, with attribution — pending the terms check
`cg-places` (Places API New text search) feeds *lists* (find a gomera/taller/gasolinera → pre-fills a Contact) with Google attribution and an "Open in Google Maps" link. Nothing from Google is drawn on MapLibre. PROMPT-00 records the current terms verdict; if it forbids even this, `FEATURE_GOOGLE_PLACES=false` and the alternative (MapTiler geocoding / OSM Overpass) is documented.

## ADR-70 — Desktop is a layout, not a fork
One codebase. `useLayout()` returns `compact | regular | wide` from width (≥ 1024 = wide). Wide gets a side rail instead of the tab bar, max-width content, two-pane master/detail, multi-column charts, keyboard shortcuts, drag-and-drop and paste for photos/PDFs. Compact is byte-for-byte today's phone layout (no regression allowed; Playwright at 390×844 must match). PWA manifest becomes desktop-installable.

## ADR-71 — The OS starts the recording; one state machine decides (round 2, P5)
Automatic trips fail today because the foreground service is armed only while the app is in front (Android 12+ rule) and a swiped/killed app is never restarted. Fix: a local native module `modules/trip-trigger` registers triggers the OS delivers to a dead app — Activity Recognition `IN_VEHICLE` transitions, the car's Bluetooth connect/disconnect (also maps device → vehicle), a geofence exit around the parking spot, `BOOT_COMPLETED` — and hands them to the **same** `engine.feed()` state machine (start/stop/merge/discard rules stay the single brain; a trigger counts as a start vote, not a recording by itself). Automático becomes the Android default after a verifying wizard; a health card shows when it regresses; evidence first (a local "why didn't it record" timeline + `ApplicationExitInfo`). iPhone PWA cannot detect trips (ADR-48 stands): **assisted start** via a deep link run by an iOS Shortcuts automation, with the limits stated in the app. Native module ⇒ APK. Alternative rejected: only loosening thresholds (does not fix "app closed").

## ADR-72 — One SpeedEngine for every speed number (round 2, P6)
Live needle, saved max/average, route colours and recaps all read the output of one pure module `lib/trips/speed.ts`: input gating, Kalman fusion of Doppler and displacement speed (windowed regression where Doppler is missing), stop hysteresis, **top speed = highest fused value sustained ≥ 2 s** (identical live and saved), separate moving/total averages. GPS is the truth; per-vehicle `speed_factor` and `odo_factor` only change *display* and odometer estimates ("Mostrar velocidad: GPS real / como mi tablero"). Proven by a replay harness with ground-truth synthetic drives and an old-vs-new table, not asserted. Same ADR covers the route language: the blob heatmap is replaced by thin route-frequency lines (P6a).

## ADR-73 — Progressive disclosure: the person's own feature set, nothing unreachable (round 2, P8)
Hoy shows one next step and ≤ 4 big actions; navigation is by task (≤ 5 tabs); forms show the minimum first. Which sections are prominent is chosen by the person ("¿Para qué usas Car Guy?"), pre-filled from usage, reversible, stored with existing preferences. Hidden ≠ deleted: search, "Todas las funciones" and deep links always reach every registry feature. A selector never filters valid options for convenience. The registry (ADR-62) gains `group` and `level`; it stays the single source.

## ADR-74 — Recaps are computed, local and shareable by default-private (round 2, P7)
`buildRecap(period, scope)` is a pure function over existing data (no table, no AI; templated copy). Viewer = story cards; share = images rendered from the same card components, with privacy defaults (no plate/VIN/odometer/exact places; spend and names opt-in). Nothing is uploaded by the feature. Local notifications announce a closed month/year.

## ADR-75 — Fuel Express: one call, one confirmation, an offline queue (round 2, P9)
Two photos (dashboard + receipt) go in **one** `cg-ai-read` call (`fuel_express`) that classifies each image and returns one merged, confidence-scored object. The person sees one confirmation card; deterministic checks (odometer, arithmetic, units, duplicate) decide whether anything else needs their attention. Nothing saves without the Confirm tap (ADR-67 unchanged). Offline photos wait in a local `ai_queue` and a local notification brings the person back to the confirmation. Alternative rejected: auto-saving when confidence is high (a wrong fuel record silently corrupts efficiency stats; one tap is the cost of trust).
