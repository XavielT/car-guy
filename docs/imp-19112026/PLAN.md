# IMP 19112026 — Car Guy 2.8: make what exists real, make it fluid

Written 2026-11-19 after auditing 2.7.0. Branch: `imp-19112026-real-and-fluid`.

## Decisions (Xaviel, 2026-11-19)
- **Focus:** make what exists real (verify trips + AI + cold start) before adding features.
- **Store:** incremental fix, same `useStore()` API (no screen changes).
- **iPhone:** stays a PWA (ADR-48).
- **New features wanted (Phase 3):** receipts + voice-to-record polish, nearby/cheapest fuel + price alerts, Android widget, Bluetooth OBD-II live data, shop quotes/receipts.

## Audit baseline (2026-11-19, before this cycle)
tsc clean · lint 0 errors / 2 warnings · jest 3591 pass, 7 fail in 4 suites · 113 routes · 42 features.
Store: one context, 98 consumers, full reload of 5 tables after every write/sync.
Lists: `ScrollView` in 111 files vs `FlatList` in 8. `memo` 13 uses. Not yet profiled on a device.

## Phase 0 — Safety and baseline
| Item | Status |
|---|---|
| Fix the 4 red suites (CRLF in generated-file tests, legal generator now LF whatever the checkout, `skeletons` Windows pathspec, `track` fixed clock) | **done** — 217/217 suites, 3665 tests |
| Rotate: GitHub token in `sgc-agente-escriba.env` (printed in a session on 2026-11-19), Supabase service-role key (carried since 2026-09-30), company keys (printed 2026-11-03) | **Xaviel** |
| Profiling: render counts + cold-start time on the Redmi | open (needs the phone) |

## Phase 1 — Make it real
1. **Automatic trips:** one real drive with `/viajes/estado` open; export diagnostics. Questions to answer: does `vehicle-enter` arrive, does the recorder start, how long does Google take. Then tune thresholds; decide on Bluetooth/geofence triggers. *Needs Xaviel + the phone.*
2. **AI against real models:** test admin account + STT key + a spend cap, then `tools/smoke-ai.mjs` and `evals/ai/run.mjs`. Measure accuracy and real cost per function (photo, voice, OBD, receipts); tune prompts and caps. *Needs Xaviel's account/keys.*
3. **Cold-start test** with 3 people (`docs/imp-03112026/COLD-START-TEST.md`); fix tasks that fail in ≥ 2.
4. Unrun checks: `local-rls` (WSL), `verify-x-core` (needs `.env.local`), `gitleaks`, second-phone speed calibration (`docs/CALIBRATION-DRIVE.md`), iPhone shortcut on a real iPhone.

## Phase 2 — Fluidity (incremental)
| Step | Status |
|---|---|
| 1. Structural sharing in the store (`lib/structuralShare.ts`): an unchanged reload is a no-op, an edit changes only its row; stops needless re-renders, `useMemo` recomputes and notification re-plans | **done**, 7 tests |
| 2. Reload only for the 8 tables `load()` reads (`lib/storeTables.ts`; trip points, AI queue, photos no longer trigger a reload) | **done**, tests pin the list |
| 3. Split the context into slices + selector hooks (`useVehicles`, `useFillups`…) | next |
| 4. Single-flight `load()` (`lib/singleFlight.ts`): a write and its change event cost one extra read, not two parallel full reads | **done**, 4 tests |
| 5. Virtualize the long lists the profiler flags; memoize rows | needs profiling |
| 6. Animations to the UI thread (`useNativeDriver` appears only twice); startup + bundle size | needs profiling |

Success = Phase 0's numbers, before vs after.

## Phase 3 — New features (each behind a flag; 2.9)
1. Voice + receipts polish: multi-item voice, receipt → service record, shop comparison over time. (Already built: `cg-ai-read`, `cg-ai-intent`, `cg-stt`, Fuel Express — verification is Phase 1.2.)
2. Fuel: MICM change alerts, station price history, cheapest-nearby suggestion.
3. Android widget (native module → APK).
4. Bluetooth OBD-II / ELM327 (native module → APK; Android only).

## Open questions
1. Should voice also answer questions ("how much did I spend on gas this month?") or only create records?
2. ELM327 adapter: classic Bluetooth or BLE? Does Xaviel own one to test with?
3. `FEATURE_LEGAL = false` (lib/flagsV8.ts): intentional?

## Release rule
Every release ships a `VERIFICACION.md` where each claim has evidence; nothing is published without Xaviel's OK.
