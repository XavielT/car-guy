# PROMPT-04 — OBD diagnosis and repairs (answer: "OBD diagnosis and repairs")

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, ADR-66/67/68, **SPEC-D**, ADR-61 (repair = completed ServiceRecord), `app/obd/*`, `lib/domain/dtc.ts`, `repairs.ts`, `app/servicio/*`, `lib/db/serviceOps.ts`, `diyQueries`. Nothing waits; log defaults.

## Steps
1. **`sql/043_ai_insights.sql`** (additive + rollback): `carguy.ai_insights` per SPEC-E §E2 (also used here as the cache for OBD explanations, key = vehicle + code set + history hash). RLS owner + garage members (reuse `is_member`), local-rls scenario `scenario_043.sql`, apply, `types:gen`, `verify-x-core`.
2. **`cg-ai-obd`** (SPEC-D §D1): input validation (codes via `normalizeCode`), vehicle facts + history digest assembled **client-side** (so offline-first data is the source) and sent minimal; forced tool schema `{can_drive, can_drive_reason, causes[], first_checks[], diy_or_shop, cost_range_rd, stop_and_tow_when, related_codes[]}`; system prompt with the honesty/safety rules (safety systems default conservative; RD$ only; "estimate" label; cites history when present; Dominican Spanish, plain words). Server-side post-validation: schema, no USD, safety-system override (a table of code ranges that cannot return `can_drive:'yes'`).
3. **OBD screens**: on `obd/[code]`, "Explain for my car" with cache + "Refresh"; bundled lookup stays as the offline answer. Actions from the closed list: create repair pre-filled (top suspect title, suspected parts as pending items), add task, remind to re-scan.
4. **Dashboard-light photo** (`dash_lights` kind) → recognised telltales mapped to registry ids → open the right feature; **scanner screenshot / pasted text → codes** (+ freeze-frame values) → `VehicleDtcEvent` drafts for confirmation, explained together. Entry in the Herramientas hub and the CHECK telltale.
5. **Repairs workflow** (SPEC-D §D4): invoice photo → repair (builds on PROMPT-02's invoice kind: `done_by='shop'`, shop contact, items split, warranty months/km parsed by a deterministic function with tests), **price-vs-own-history** comparison (pure, tested; no market figures invented), **warranty watcher** (banner + reminder suggestion in `lib/domain/repairs.ts`), and **closing the loop** (saving a repair from an OBD code offers a re-scan reminder and resolves the matching `VehicleDtcEvent`).
6. **Evals** `evals/ai/obd.json` (25 cases, SPEC-D §D6) with assertions; run against the deployed function; record results. Unit tests for warranty parsing, price comparison, safety override table.
7. Deploy `cg-ai-obd` and updated `cg-ai-read`; log. es/en strings. Playwright check on mobile + desktop viewports. Green checks. Commit.

## Acceptance
SPEC-D §D5.

## Final report
Eval pass rate and the failures; the safety-override table contents; observed cost per explanation; what you would tune next.
