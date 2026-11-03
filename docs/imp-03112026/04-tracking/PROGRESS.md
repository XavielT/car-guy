# PROGRESS — IMP 03112026 (Car Guy 2.7 "Sensei")

Claude Code updates this file at the end of every phase. Never write a secret value here.

## Status
| Phase | Prompt | Status | Commit(s) | Notes |
|-------|--------|--------|-----------|-------|
| 0 | Kickoff + diagnosis | ✔ | (this commit) | docs only; zero product change; zero secret read. Numbers confirmed. |
| 1 | Keys + gateway | ◐ code done · SQL live · secrets/deploy/smoke pending | dc8cf6a, ec85dc4 + this commit | sql/042 applied and verified. Secrets, function deploys and smoke test not yet run (see below). |
| 2 | Photo + voice capture | ☐ | | |
| 3 | Documents + onboarding | ☐ | | |
| 4 | OBD + repairs | ☐ | | |
| 5 | Prediction + alerts | ☐ | | |
| 6 | Other workflows | ☐ | | |
| 7 | Desktop web | ☐ | | |
| 9 | Automatic trips | ☐ | | |
| 10 | Speed + route lines | ☐ | | |
| 11 | Recaps | ☐ | | |
| 12 | Easy to use | ☐ | | |
| 8a | Regression + Release A (after 9–12) | ☐ | | |
| 8 | Regression + final release | ☐ | | |

## Decisions taken (defaults applied without waiting)
| Date | Phase | Decision | Why |
|------|-------|----------|-----|
| 2026-11-03 | 0 | D-01 Package numbers (2.6.0 / v12 / sql 041 / ADR-64) confirmed; nothing renumbered | Matches repo |
| 2026-11-03 | 0 | D-02 STT default = SGC's `STT_*` secrets (OpenAI/Groq), not Azure; if absent, `cg-stt` → 503 `ai_not_configured`, voice degrades | SGC code: `_shared/stt.ts`; Azure only in tutorial scripts |
| 2026-11-03 | 0 | D-03 `CG_MODEL_VISION=claude-haiku-5-5`, `CG_MODEL_REASON=claude-sonnet-5-5`; fallbacks `claude-haiku-4-5-20251001` / `claude-sonnet-5`; price table in `models-and-prices.md` | Valid ids and prices from docs 2026-11-03; cheaper and newer |
| 2026-11-03 | 0 | D-04 `FEATURE_GOOGLE_PLACES` default **OFF**; if enabled later: list-only, no map on the screen, attribution, store `place_id` only | Places ToS §14.2 (no use with non-Google map) and no exemption for persisting name/phone/address (modified 2026-10-28) |
| 2026-11-03 | 0 | D-05 Tests/scripts run under Node 22.22.3 (nvm); build via bash form of the script; baseline reds recorded, not fixed | Machine default is Node 20; repo needs ≥ 22 |
| 2026-11-03 | 0 | D-06 Voice = `expo-audio ~57.0.5`, no background recording; `microphone` joins ADR-59 registry; `Permissions-Policy` → `microphone=(self)`; release is an APK | Expo 57 docs; fingerprint changes |
| 2026-11-03 | 0 | D-07 Screenshot baselines taken from dev server + `/dev/seed` (prod build cannot seed) | Realistic data needed for before/after |
| 2026-11-03 | 0 | D-09 SGC and Car Guy use maps differently (Google map vs MapLibre): do not port SGC's `reverse-geocode`, `routing-directions`, `snap-to-roads`, `resolve-maps-link`; trip naming via MapTiler Geocoding; any reused Google key restricted to Places API (New); SGC's browser key never copied | User reminder 2026-11-03; Google ToS "no use with a non-Google map" for Geocoding/Directions/Roads/Places |
| 2026-11-03 | 0 | D-10 Full review of `sgc-ai-reference.md` and `ai-workflow-map.md` done; fixed expense-category names, the media-role claim (media is polymorphic; it needs a role, not an owner link), the Haiku-4.5 default and the Azure row in the SGC reference | Review requested by Xaviel |
| 2026-11-03 | 1 | D-11 Supabase MCP in this session points at project bzhokbcvfkipqimifrrq, not x-core (nakgrkcqyuycadeuenuw): never used for Car Guy SQL/deploys | Wrong project; Car Guy uses its own tools (apply-sql, set-ai-secrets, deploy-edge) |
| 2026-11-03 | 1 | D-12 `tools/set-ai-secrets.mjs` writes ONLY with `--apply`; no flags prints usage (after a no-flag call would have written) | Safe by design; the classifier also blocked the unintended write |
| 2026-11-03 | 1 | D-13 Gateway order: JWT → admin (if needed) → kill switch → provider configured → consent → hour limit → user day cap → global day cap; `>=` so 0 stops everything; nothing recorded for refusals, one `ai_usage` row per provider call (incl. billed failures) | ADR-66; SGC counted only successes and cut the day in UTC |
| 2026-11-03 | 1 | D-14 Day cut in America/Santo_Domingo, not UTC | SGC lesson |
| 2026-11-03 | 1 | D-15 Forced tool_use for structured output, with ONE fallback retry on `tool_choice: auto` if the API rejects a forced tool (adaptive-thinking models); unverified against the live API until the deploy | Cannot call the API from here |
| 2026-11-03 | 1 | D-16 Privacy policy text now mentions AI / Anthropic / STT / Google but LEGAL_VERSION is NOT bumped (a bump re-asks every user); bump in PROMPT-08 with the first shipped AI action | Avoid re-consent for a feature that has no action yet |
| 2026-11-03 | 1 | D-17 Smoke test needs an admin Car Guy account (`cg-ai-ping` is admin-only; caps via `set_app_config`): `SMOKE_EMAIL`/`SMOKE_PASSWORD` | Documented in tools/smoke-ai.mjs |
| 2026-11-03 | 0 | D-08 Heavy reading delegated to 3 read-only subagents (SGC reference, workflow map, terms+models); Google clauses re-verified by me against the live page | Parallel, independent work |

## Edge Functions / SQL deployed to x-core
| Date | Item | Name | Result |
|------|------|------|--------|
| 2026-11-03 | SQL | sql/042_ai_gateway.sql | **Applied to x-core** (HTTP 201, carguy only, no --shared) after Xaviel's explicit go-ahead. Local: local-rls scenario_042 (31 checks) + whole suite. Live: `node tools/verify-ai-gateway.mjs` 8/8 PASS (5 RPCs and 2 tables exist, anon refused). `lib/cloud/database.types.ts` regenerated from the live schema (additive). |
| 2026-11-03 | Secrets | ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, CG_MODEL_VISION, CG_MODEL_REASON | **Not set.** `--dry-run` OK: both key files found and valid (lengths 108 / 39), names + lengths only. Run `node tools/set-ai-secrets.mjs --apply` |
| 2026-11-03 | Edge Functions | cg-ai-status, cg-ai-ping | **Not deployed.** Wrapper dry-run OK. Run `node tools/deploy-edge.mjs cg-ai-status cg-ai-ping` |

## Round-2 evidence tables (Claude Code fills)
### Speed replay — old vs new
| Case | Metric | Old | New | Target |
|------|--------|-----|-----|--------|

### UX audit — before vs after
| Task / screen | Taps before | Taps after | Target |
|---|---|---|---|

## Findings
(D-n desktop defects live in `findings.md`: D-1…D-9. Do not confuse with decisions D-01…D-08 above.)
Phase 0 key findings: SPEC-E's kmPerDay/due-date prediction already exists in code; `media` has no role column (v13 owner link needed for odometer photo); 24 workflows missed by the BRIEF and 7 new AI touchpoints (N1–N7) in `ai-workflow-map.md`; SGC has no kill switch or price table (we build both); `supabase/` folder does not exist in the repo.
