# SPEC-A — Keys inventory and the AI gateway (P1, P1a, P2b, P3)

## A1. Credential inventory (judged by name only — values are never read into a doc)
Source: key **names** in `C:\dev\SGC\.env.local`, the two loose key files in `C:\dev\SGC\`, `C:\dev2\csd-app\.env.example` and `COMPA-API-KEY.md`, and the secret names SGC's edge functions read.

| Credential (name) | Where it lives | Verdict for Car Guy | Why |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `C:\dev\SGC\ANTHROPIC_API_KEY.env` (raw value in file, no `NAME=`), SGC edge secret | **Reuse** → x-core secret `ANTHROPIC_API_KEY` | Xaviel's decision; used only by `cg-*` |
| Google Maps **server** key | `C:\dev\SGC\maps_platform_api_key.env` (raw), SGC edge secret `GOOGLE_MAPS_API_KEY` | **Reuse** → x-core secret `GOOGLE_MAPS_API_KEY` (server use only, `cg-places`) | See ADR-69; browser key is irrelevant (Car Guy renders with MapLibre) |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | **not an SGC runtime secret** (PROMPT-00: only in tutorial-video scripts) | **Skip unless present** → x-core secrets, used by `cg-stt` (es-DO) | Anthropic has no speech-to-text |
| `STT_API_KEY` / `STT_PROVIDER` / `STT_MODEL` | SGC Supabase secrets (not in `.env.local`) | **Reuse if present** (`supabase secrets list --project-ref <csd-core>` shows names only) | Accepts every browser audio container; **primary STT path** (SGC uses OpenAI/Groq via `_shared/stt.ts`) |
| `ASSISTANT_MODEL_PROD`, `LEER_RECIBO_MODEL` | config | **Copy the model name** only → `CG_MODEL_*` | Not a secret |
| `VAPID_*` | SGC `.env.local` | **Do not reuse** | Car Guy pushes through Expo push (`api/junte-push.ts`); iPhone PWA has no push (ADR-48) |
| `SUPABASE_*_PROD/_DEV` (url, anon, service role, db password, ref) | SGC `.env.local`, csd-app | **Never** | `csd-core` = company data; Car Guy lives in `x-core` |
| `GOOGLE_SERVICE_ACCOUNT_JSON_*`, `GOOGLE_CALENDAR_DELEGATED_USER_*` | SGC | **Never** | Domain-wide delegation over the company Workspace |
| `WHATSAPP_*` | SGC | **Never** | Company WhatsApp Business identity |
| `AGENTE_ESCRIBA_GITHUB_TOKEN`, `VERCEL_OIDC_TOKEN` | SGC | **Never** | Company repo / deploy identity |
| `STORE_REVIEW_*`, `QA_DEV_PASSWORD`, `*_SYNC_SECRET` | SGC | **Never** | Company test accounts and cron auth |
| Fuel prices, weather, geocoding | SGC `fuel-prices`, Open-Meteo, Nominatim | **No key to reuse**; Car Guy already has its own MICM importer | — |

PROMPT-01 writes this table (names, verdicts, reasons — no values) to `docs/KEYS-INVENTORY.md` after re-checking the sources, and adds anything new it finds.

## A2. Secrets procedure (`tools/set-ai-secrets.mjs`)
- Reads the three files / env, validates shape (`sk-ant-` prefix, `AIza` prefix, non-empty) without printing, and runs `supabase secrets set NAME --project-ref <x-core>` feeding the value through stdin/env, never argv or logs. Prints `NAME set (length N)`.
- `--check` lists secret **names** present in x-core and flags missing ones. `--dry-run` validates the files only.
- If the environment refuses reading the key files: stop that step, finish everything else, and print the exact command for Xaviel to run.
- `.gitignore` already covers `*api_key*` in SGC; in Car Guy add `*api_key*`, `*.env` outside `.env.example`, and a `.gitleaks.toml` (copy rules from csd-app's, read-only).
- `tools/check-bundle-env.mjs`: add a forbidden-pattern pass (`sk-ant-`, `AIza[0-9A-Za-z_-]{35}`, `AZURE_SPEECH`, `SUPABASE_SERVICE_ROLE`) over the web `dist/` and the APK bundle; non-zero exit on a hit. Wire it into `release-apk.sh` and the web build.

## A3. Gateway (`supabase/functions/_shared/`)
`cors.ts` · `env.ts` · `gate.ts` (ADR-66) · `anthropic.ts` (one `callClaude({ model, system, messages, tool, maxTokens })` using **forced tool_use for structured output**, retries on 429/529 with backoff, returns tokens + cost) · `images.ts` (size/mime validation, max 4 images, max ~1.5 MB each decoded) · `cost.ts` (price table per model, editable constant) · `stt.ts` (STT_API_KEY provider if present, else Azure; ≤ 30 s clips) · `errors.ts` (`error_code` list: `ai_disabled`, `ai_not_configured`, `sin_consentimiento_ia`, `rate_user`, `cap_user_day`, `cap_global_day`, `bad_input`, `provider_error`, `unreadable`).
Functions (all `cg-*`, deployed to x-core): `cg-ai-read`, `cg-stt`, `cg-ai-intent`, `cg-ai-obd`, `cg-ai-insights`, `cg-ai-triage`, `cg-places`. A `cg-ai-status` GET returns `{enabled, consent, configured, remainingToday}` for the UI (no provider call).

## A4. SQL `sql/042_ai_gateway.sql` (additive)
- `carguy.ai_consent(user_id pk → auth.users, accepted_at, version text)` + RPCs `my_ai_consent()`, `set_ai_consent(p_on boolean)`.
- `carguy.ai_usage(id, user_id, function, model, input_tokens, output_tokens, cost_usd numeric(10,6), vehicle_id null, ok bool, error_code null, created_at)`; **insert only by service role**, user selects own rows, admin selects all; index `(user_id, created_at)`, `(function, created_at)`; retention 90 days (cron or admin button).
- `app_config` keys (admin-writable via `set_app_config`, readable by signed-in): `ai_enabled=true`, `ai_limit_user_hour=30`, `ai_cap_user_day_usd=0.50`, `ai_cap_global_day_usd=5.00`, `ai_limit_places_user_day=20`.
- `carguy.ai_insights` is SPEC-E's; keep it in `sql/043`.
- Local-RLS scenario `scenario_042.sql`: a user cannot read another's usage or consent; anon reads nothing; the client cannot insert `ai_usage`.

## A5. App side
- `lib/ai/client.ts`: `callAi(fn, payload)` → typed result or `AiError{code}`; adds JWT; 20 s timeout; never retries a 4xx.
- `lib/ai/useAiStatus.ts`: one hook every AI button uses → `available | needs_account | needs_consent | offline | capped | disabled | not_configured`, each with a ready human message (es/en). The button hides nothing: it shows why.
- Consent sheet (first AI use, and Cuenta → Privacidad toggle): plain text — what is sent (the photo/audio/text you choose), who processes it (Anthropic, Azure for voice, Google for place search), what is kept (counts only), how to withdraw. Version-stamped.
- Admin → Uso y costos (extend `app/admin/uso.tsx`): AI spend today / 7 d / month by function and by user, caps editable, **kill switch**.
- Legal: update `content/legal` privacy text and create `docs/DATA-AND-THIRD-PARTIES.md` (what, where, why, retention, regions: Supabase x-core us-east-1, Anthropic US, Azure region of the key, Google).

## A6. Acceptance
Secrets present by name in x-core · bundle guard fails on a planted `sk-ant-` test string · `cg-ai-status` works signed in/out · consent enforced server-side (curl without consent → 403) · caps and kill switch demonstrably stop calls · `ai_usage` rows appear with cost · no key value anywhere in repo, logs, PROGRESS or the report.
