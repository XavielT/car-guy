# Keys inventory — what Car Guy may and may not reuse from SGC and csd-app

IMP 03112026 · PROMPT-01 · SPEC-A §A1 · resolves note P1 / P1a ("the keys, tokens and etc.").

**This file lists NAMES, verdicts and reasons. It never contains a value.** Sources of the names: `Deno.env.get("…")` and `process.env.…` greps over `C:\dev\SGC\supabase\functions`, `C:\dev\SGC\tools|scripts|qa`, `C:\dev2\csd-app\scripts`, `C:\dev2\csd-app\.env.example` and SGC's docs (`COMPA-API-KEY.md`, `docs/google-maps-cloud-checklist.md`, `docs/mapas-google-vs-leaflet.md`). No `.env*` or key file was opened to write this file.

Where a reused key lives in Car Guy: **only** as a Supabase Edge Function secret of project `x-core` (`nakgrkcqyuycadeuenuw`), read by functions named `cg-*`. Never in `EXPO_PUBLIC_*`, never in the app bundle, never in the repo (guarded by `.gitleaks.toml` and `tools/check-bundle-env.mjs`).

## Reuse — set as x-core secrets (by `tools/set-ai-secrets.mjs`)
| Name | Source in SGC | Used in Car Guy by | Reason / limits |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | SGC edge secret; local raw file `ANTHROPIC_API_KEY.env` in SGC root | every `cg-ai-*` function | Xaviel's decision (P1). Company pays; so caps + kill switch (ADR-66). Recommended later: a second key in the same Anthropic workspace named for Car Guy — one `secrets set`, zero code. |
| `GOOGLE_MAPS_API_KEY` (server key) | SGC edge secret; local raw file `maps_platform_api_key.env` | `cg-places` **only**, and only if `FEATURE_GOOGLE_PLACES` is turned on | Default OFF (Places ToS §14.2/14.3, see `docs/imp-03112026/google-terms-verdict.md`). Car Guy draws MapLibre, SGC draws Google Maps — **never** port SGC's Geocoding/Directions/Roads/`resolve-maps-link` functions. SGC's own checklist says it once was an unrestricted general key: prefer a new Car Guy key restricted to **Places API (New)** only. |
| `STT_PROVIDER`, `STT_API_KEY`, `STT_MODEL` | SGC Supabase secrets (names visible with `secrets list` on the SGC project; values never shown) | `cg-stt` | SGC's speech-to-text is OpenAI or Groq (`_shared/stt.ts`), **not Azure**. Reused if present in SGC's project. |
| `OPENAI_API_KEY` | SGC fallback of `STT_API_KEY` | (only as that fallback) | Reuse only through `STT_API_KEY`; Car Guy does not call OpenAI for anything else. |
| `CG_MODEL_VISION`, `CG_MODEL_REASON` | — (new, not secret) | all `cg-ai-*` | Defaults `claude-haiku-5-5` / `claude-sonnet-5-5` (`docs/imp-03112026/models-and-prices.md`). Changing a model is a secret change, not a code change. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | only SGC's local build scripts for tutorial-video narration | **not used** | Not an SGC runtime secret and not an STT path in SGC. Skip unless Xaviel adds an Azure resource of his own. |

## Never reuse
| Name(s) | What it is | Why never |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `*_DEV`, `*_PROD`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF*`, `SUPABASE_ACCESS_TOKEN`, `SGC_SUPABASE_*`, `AGENTE_ESCRIBA_SUPABASE_*` | SGC / csd-core database keys and the management token | csd-core is the company's data. Car Guy lives in x-core. (The management token Car Guy's own tools use is a different, personal token in the gitignored `.env.supabase`.) |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_DELEGATED_USER`, `FCM_SERVICE_ACCOUNT_JSON` | Workspace delegation / SGC Firebase | Domain-wide delegation over the company mailboxes/calendars; Car Guy has its own `google-services.json`. |
| `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ASSISTANT_SECRET`, `WHATSAPP_GRAPH_VERSION` | Company WhatsApp Business number | Company identity. |
| `AGENTE_ESCRIBA_GITHUB_TOKEN`, `AGENTE_ESCRIBA_GITHUB_REPO`, `VERCEL_*` (incl. OIDC) | GitHub PAT for SGC's repo; Vercel project identity | Scoped to SGC repo/projects. |
| `QA_DEV_PASSWORD`, `QA_TEST_PASSWORD`, `SGC_QA_*`, `STORE_REVIEW_*`, `STORE_URL` | Test accounts | Company test identities. |
| `INFRA_SYNC_SECRET`, `STT_SYNC_SECRET`, `CRONOGRAMA_SYNC_SECRET`, `ODOO_SYNC_SECRET`, `WEATHER_SYNC_SECRET`, `FUEL_PRICES_SECRET` | `x-sync-secret` between SGC's DB and its edges | Tied to SGC's wiring; Car Guy generates its own random value if it copies the pattern. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | SGC web-push identity | Car Guy pushes through Expo push (`api/junte-push.ts`); the iPhone PWA has no push (ADR-48). |
| `BOVEDA_MASTER_KEY` | SGC credential-vault master key | Encryption master key. |
| `FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET` | Meetings integration | SGC's account. |
| `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_API_KEY`, `ODOO_COMPANY_ID`, `ODOO_CORS_ORIGINS`, `ODOO_MAX_CONCURRENTE`, `ODOO_CIRCUITO_*` | Company ERP | Company system. |
| Google Maps **browser** key (`parametros.google_maps_browser_key`, served by RPC `maps_api_key()`) | Referrer-bound to SGC's domains | Useless and wrong for Car Guy (MapLibre); never copied. |

## No credential to reuse (config, URLs, flags)
`APP_URL`, `WEB_URL`, `ENTORNO`, `SGC_ENV`, `INFRA_ALERT_EMAILS`, `NOTIFICATIONS_FROM_EMAIL`, `NOTIF_REDIRECT_TO`, `PUSH_ALLOWLIST`, `SGC_TROPES_UPDATE`, `CSD_TROPES_UPDATE`, `ANDROID_HOME`/`JAVA_HOME`-style build variables, model-name variables of SGC (`ASSISTANT_MODEL`, `LEER_*_MODEL`, `BITACORA_IA_MODEL`, `RESUMIR_REPORTE_MODEL`). Fuel prices, weather and geocoding in SGC need no key Car Guy could reuse (Car Guy has its own MICM importer).

## Found beyond the original SPEC-A table (PROMPT-01 re-check)
`OPENAI_API_KEY` (STT fallback), `PUSH_ALLOWLIST`, `NOTIF_REDIRECT_TO`, `ENTORNO`, `SUPABASE_ANON_KEY_DEV/PROD`, `STORE_URL`, `SGC_TROPES_UPDATE`/`CSD_TROPES_UPDATE`, `ODOO_*` tuning, `FIREFLIES_*`, `BOVEDA_MASTER_KEY`, `WHATSAPP_GRAPH_VERSION`, `FCM_SERVICE_ACCOUNT_JSON`. Each has a verdict above (all "never" or "config").

## csd-app
`.env.example` lists only Supabase names (`SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`) → all **never**. Its `.gitleaks.toml` (default rules + an allowlist for the public anon key) is the model for Car Guy's.

## Procedure and rotation
- Set / check: `node tools/set-ai-secrets.mjs --dry-run | --check | --apply` (`--apply` is the only mode that writes; no flags prints usage) — prints names and lengths only.
- Rotation: the two company keys were printed in the session that produced the IMP 03112026 package. Rotating them is recommended; it needs **no code change** (`secrets set` again).
- Moving Car Guy to its own Anthropic key later: one `set-ai-secrets` run with the new file; nothing else.
