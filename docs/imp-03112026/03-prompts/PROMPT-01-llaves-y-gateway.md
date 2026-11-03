# PROMPT-01 — Keys and the AI gateway (P1, P1a, P2b, P3)

Claude Code, Car Guy repo, branch `imp-03112026` (continue from PROMPT-00). Read `BRIEF.md`, ADR-65/66, **SPEC-A** and `docs/imp-03112026/sgc-ai-reference.md`. Nothing waits on a decision; log defaults in PROGRESS. Secrets are never printed or committed (BRIEF rules).

## Steps
1. **`docs/KEYS-INVENTORY.md`** from SPEC-A §A1: names, verdicts and reasons only (no values). Re-check the sources by **name** (`.env.example`, `Deno.env.get` greps in `C:\dev\SGC\supabase\functions`, csd-app) and add anything new, each with a verdict. This resolves note P1a ("etc.").
2. **Guards first**: `.gitleaks.toml` (model on csd-app's), `.gitignore` additions, extend `tools/check-bundle-env.mjs` with the forbidden-pattern pass, wire it into the web build and `release-apk.sh`, add a test that plants a fake `sk-ant-` string in a temp bundle and expects failure.
3. **`sql/042_ai_gateway.sql`** (SPEC-A §A4) additive + rollback block; `tools/local-rls` scenario `scenario_042.sql`; apply with `tools/apply-sql.mjs`; `npm run types:gen`; `node tools/verify-x-core.mjs`.
4. **`tools/set-ai-secrets.mjs`** (SPEC-A §A2) with `--dry-run`, `--check`. Run `--dry-run`, then the real run. It reads `C:\dev\SGC\ANTHROPIC_API_KEY.env`, `C:\dev\SGC\maps_platform_api_key.env` and the Azure vars from SGC's `.env.local`, validates shape, sets x-core secrets `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `CG_MODEL_VISION`, `CG_MODEL_REASON` (and `STT_*` if SGC has them — names via `supabase secrets list` on the csd-core ref, **read-only**). It must never echo a value. If you are not allowed to read those files, stop only this step, set everything else up, and put this in the report for Xaviel: `node tools/set-ai-secrets.mjs` from a normal terminal.
5. **`supabase/functions/_shared/`** (SPEC-A §A3) + `supabase/functions/cg-ai-status` and a minimal `cg-ai-ping` (calls the model with a 5-token prompt; admin only) to prove the key works end to end; unit tests (Deno test) for `gate.ts` order, caps, error codes, cost maths; CORS allow-list = the Vercel origin(s) + localhost dev + native (no origin).
6. **Deploy** `cg-ai-status` and `cg-ai-ping` to x-core (new names only), log in PROGRESS. Smoke test with a test account: no consent → 403 code; consent → ok; cap lowered to 0 → 429; kill switch → `ai_disabled`.
7. **App side** (SPEC-A §A5): `lib/ai/client.ts`, `useAiStatus.ts`, consent sheet + Cuenta → Privacidad toggle, Admin → Uso y costos AI section (spend by function/user, caps, kill switch), es/en strings. Update `content/legal` and create `docs/DATA-AND-THIRD-PARTIES.md`.
8. Tests: unit (client mapping of error codes → messages), local-rls, bundle guard. Typecheck/lint/tests/web build green. Commit.

## Acceptance
SPEC-A §A6, plus: `docs/KEYS-INVENTORY.md` exists with a verdict for every credential name found; the diff of this phase contains no key value (run gitleaks on the diff and report); the three reusable key families are in x-core as secrets (or the one-line command is in the report if reading was refused).

## Final report
Secrets set by **name** (never value), what was refused if anything, smoke-test results, the cap defaults, the exact commit list, and a reminder line: "rotating the two company keys is recommended (they were printed in the session that wrote this package); code needs no change".
