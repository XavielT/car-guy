# Car Guy on the laptop

How to open and work on the project from a new Windows, macOS or Linux machine. (IMP 03112026 SPEC-F §F5.)

## 1. What you need
| Tool | Version | Notes |
|---|---|---|
| Node.js | **22 or newer** | The repo needs ≥ 22 (`--experimental-strip-types` tests, Expo 57). On Windows use nvm-windows: `nvm install 22 && nvm use 22`. Node 20 is the machine default on some setups and will fail jest/tsc. |
| Git | any | Git Bash on Windows (needed for `tools/ota-gate.cjs` and the POSIX build script). |
| WSL (Windows only) | Ubuntu 24.04 + PostgreSQL 16 | Only for `tools/local-rls` (the local RLS scenarios). |
| Chrome or Edge | current | For the desktop PWA and the Playwright checks. |

## 2. Get the code
```bash
git clone https://github.com/XavielT/car-guy.git
cd car-guy
git checkout imp-03112026      # or main
npm ci
```

## 3. Environment: public values only
```bash
cp .env.example .env.local     # fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```
Both values are public (the anon key identifies the project; row level security does the protecting). **Never** put a service-role key, `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY` or an `STT_*` key on the laptop: the AI keys live only as Edge Function secrets on the `x-core` project, and the app reaches them through the `cg-*` functions with the person's own session. Laptop development needs nothing else.

With the two values unset the app runs fully local (no account, no sync, no AI): a supported state.

## 4. Run the web app
```bash
npx expo start --web           # http://localhost:8081
npm run web:desktop            # same, plus a 1440×900 browser window (needs playwright-core, or CHROMIUM_PATH)
```
The layout classes are `compact` < 768, `regular` 768–1023 and `wide` ≥ 1024 (`lib/theme/layout.ts`). The side rail, the two-column Inicio, the 3-up Garaje and the Historial master/detail only appear at `wide`; below 768 the app is the phone layout, unchanged.

Keyboard on the desktop layout: `/` or `Ctrl/Cmd+K` search · `g` then `i g c h t m` go to Inicio / Garaje / Conducir / Historial / Herramientas / Más · `n` new fill-up · `?` the cheat-sheet · `Esc` closes.

## 5. Checks
```bash
npx tsc --noEmit
npm run lint
npx jest                       # three suites are red on Windows before this cycle (changelog/parse, ui/skeletons, db/track); see findings.md
```
Browser checks (mocked network, no real model call): see `evals/ai/README.md` → "Browser check". Point `PLAYWRIGHT_CORE` at an install of `playwright-core` and `CHROMIUM_PATH` at Chrome/Edge. Desktop screenshots are taken at 1440×900, 1024×768 and 390×844.

## 6. Database and Edge Functions (only if you change them)
- `tools/apply-sql.mjs sql/NNN_name.sql` reads `ACCESS_TOKEN` from **`.env.supabase`** (gitignored; the Supabase management token, not an AI key). It applies to the `carguy` schema of `x-core`.
- `tools/deploy-edge.mjs cg-… --yes` deploys functions named `cg-*` only. `tools/set-ai-secrets.mjs --apply` sets the AI secrets on x-core, run by the owner, never in CI.
- `bash tools/local-rls/run.sh` (inside WSL) runs the RLS scenarios on a throw-away local PostgreSQL. If the file has CRLF endings, strip them first (`tr -d '\r'`).
- A production action (SQL, deploy, secrets) is always the owner's call.

## 7. Mobile builds
`eas login`, then the scripts in `tools/` (`release-apk.sh`, `build-test-apk.sh`) from Git Bash. EAS does not read `.env.local`; the public values come from `eas.json`.

## 8. Installing the desktop PWA
In Chrome or Edge open the deployed site and use the install icon at the right of the address bar. It opens in its own window, with the side rail, the shortcuts and three launcher shortcuts (new fill-up, dictate, scan a receipt). `/instalar` explains it in the app.
