# PROMPT-08 — Regression by note and release (runs twice: Release A mode, then final)

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, `COBERTURA-NOTAS.md`, `04-tracking/PROGRESS.md`, `docs/NEXT.md` (release recipe) and `tools/release-apk.sh`, `tools/ota-gate.cjs`. Nothing waits; log defaults.

## Modes
- **Release A mode** (after PROMPT-09, 10, 12, 11; AI work not started): verify only P5, P5a, P5b, P6, P6a, P6b, P7, P8 (+ their Y-items), skip the AI security/cost passes except the bundle guard, build the **APK** (trip-trigger native module changes the fingerprint), prepare the release as below with the next minor version from `package.json`. Record in `04-tracking/PROGRESS.md` that Release A shipped (or is ready).
- **Final mode**: everything below for every ID in `COBERTURA-NOTAS.md` (P1…P9). The version is the next one after Release A, if any; "2.7.0" in older text means "the real next number".

## Steps
1. **Note-by-note verification** → `docs/imp-03112026/VERIFICACION.md`: for each ID in `COBERTURA-NOTAS.md` (P1…P4a **and P5…P9** with their answers) give the evidence (file:line, test name, screenshot, deployed function, eval number). A row without evidence is a defect — fix it or write why it cannot be done here.
2. **Security pass**: gitleaks over the whole branch history range; bundle guard over `dist/` and the built APK; grep the repo for `sk-ant-`, `AIza`, `AZURE_SPEECH_KEY=` values; confirm secrets exist in x-core **by name**; confirm no `cg-*` function runs without the gateway (a test that lists `supabase/functions/cg-*/index.ts` and asserts each imports `gate`); confirm `ai_usage` cannot be written by a client (local-rls).
3. **Cost pass**: from `ai_usage` and the evals, write a one-page cost table (per function: calls in tests, average cost, projected monthly for N users) in `docs/imp-03112026/COSTS.md`; set final defaults for caps with the numbers.
4. **Regression**: full unit + local-rls + Playwright (mobile, desktop) + the permissions and round-trip suites; update `05-manual-checklist.md`.
5. **Docs**: `CHANGELOG.md` and in-app changelog (`tools/build-changelog.mjs`), ADR-65…70 written in full in `00-context/03-architecture-decisions.md`, `docs/NEXT.md` updated, Data-and-third-parties doc final.
6. **Release** (version resolved at the time): bump `package.json`/`app.json`; native fingerprint will change (trip-trigger module + permissions in A; audio module + permissions in B) so it is an **APK** (EAS cloud build per `docs/NEXT.md`, versionCode next), `releases/fingerprint.json` updated, `tools/check-bundle-env.mjs` on the APK, `tools/smoke-apk.mjs`. SQL 042/043 (and `sql/044` for calibration in Release A) applied to x-core, `types:gen`, `verify-x-core`. Functions deployed. **Do not push, publish the APK, or deploy Vercel production without telling Xaviel first**: prepare everything, then print the exact release steps and stop only at that final publish (each of the two releases has its own gate) (this is the one allowed stop, and it is a release gate, not a decision).
7. Merge-ready branch summary.

## Acceptance
`VERIFICACION.md` complete with evidence for every note in scope for the mode (Release A: P5–P8 and Y8–Y13; final: P1–P9); security pass clean; cost table written; checks green; release artefacts prepared.

## Final report
Per-note verdict table (short), security results, cost table headline, what Xaviel must do manually (see `05-manual-checklist.md`), release steps ready to run.
