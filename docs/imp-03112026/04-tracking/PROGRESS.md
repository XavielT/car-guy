# PROGRESS — IMP 03112026 (Car Guy 2.7 "Sensei")

Claude Code updates this file at the end of every phase. Never write a secret value here.

## Status
| Phase | Prompt | Status | Commit(s) | Notes |
|-------|--------|--------|-----------|-------|
| 0 | Kickoff + diagnosis | ✔ | (this commit) | docs only; zero product change; zero secret read. Numbers confirmed. |
| 1 | Keys + gateway | ☐ | | |
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
| 2026-11-03 | 0 | D-08 Heavy reading delegated to 3 read-only subagents (SGC reference, workflow map, terms+models); Google clauses re-verified by me against the live page | Parallel, independent work |

## Edge Functions / SQL deployed to x-core
| Date | Item | Name | Result |
|------|------|------|--------|

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
