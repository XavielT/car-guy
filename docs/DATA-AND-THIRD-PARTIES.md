# Car Guy: data and third parties

One living inventory (the pattern of SGC's `docs/DATOS-Y-TERCEROS.md`). **Rule: any new piece of data, any new third party, and any change of model or provider updates this file in the same change, and flags `content/legal/privacidad.*.md` and the store privacy forms for review.** Play Store is out of scope for now (Xaviel's choice); this file is what those forms would be filled from.

Last reviewed: 2026-11-03 (IMP 03112026, phase 1). Values (keys, tokens) never appear here.

## Where data lives
| Where | What | Notes |
|---|---|---|
| The person's device | Everything: SQLite (phone) / browser storage (web), photos, trips, settings | Works with no account and no network (ADR-05). GPS points of a trip are kept 30 days. |
| Supabase project `x-core`, schema `carguy` | Only with an account: the same tables synced, private storage for photos, `app_config`, `ai_consent`, `ai_usage` | Shared with Music Hub and xaviel-web; Car Guy data is separated by schema and per-user RLS. Region as stated in the published privacy policy (AWS us-west-2, United States): **verify in the Supabase dashboard**, SPEC-A had written us-east-1. |
| Vercel | The web app / PWA and `api/*` functions | Logs requests (IP). |
| GitHub Releases | The Android APK download | Sees the downloader's IP. |

## What the AI gateway handles (IMP 03112026)
| Data | Sent to | When | Stored by us? | Linked to the person? |
|---|---|---|---|---|
| A photo the person picks for an AI action (receipt, dashboard, part label, document…) | Anthropic, through the `cg-*` Edge Function | Only after explicit consent and a tap | **No.** The function reads, returns the fields asked for, discards. Never logged. | The request carries their JWT; nothing about the content is kept |
| Audio dictated by the person | A speech-to-text provider (`STT_PROVIDER`: OpenAI or Groq), then only the text goes on to Anthropic | Only with consent, mic permission and a tap | **No.** Audio is discarded after transcription. | No |
| A text the person types for an AI action | Anthropic | As above | No | No |
| Facts computed by the app for an insight (counts, costs, intervals) | Anthropic | Only when an insight is requested | No (insight text may be cached in the person's own data in a later phase) | Yes (their own data); no plate, VIN, cédula, name or exact places |
| **Usage record**: function, model, tokens, cost, ok/error code, optional vehicle id | `carguy.ai_usage` | Every provider call | **Yes, 90 days** (admin button prunes) | Yes, to enforce limits; the person reads their own rows, the admin reads all |
| **Consent record**: accepted at, notice version | `carguy.ai_consent` | When the person turns AI on | Until withdrawn or account deletion | Yes |

Never sent to any AI provider: background location, trips and GPS traces, the person's contacts' phone numbers, the matrícula/seguro **image** beyond the single read (the fields returned never include the cédula, name or address).

## Third parties
| Third party | Why | What it receives | Retention (its side) | Reference |
|---|---|---|---|---|
| **Anthropic** (US) | Reads photos and texts; phrases insights | Only the request of an AI action the person chose | Claude API: prompts and outputs are **not retained by default**; the exception is the "Covered Models" (Fable 5.x / Mythos 5.x) which need 30-day retention; zero-data-retention is available by contract. Car Guy's defaults (`claude-haiku-5-5`, `claude-sonnet-5-5`) are not covered models. **If `CG_MODEL_*` is ever pointed at a covered model, this row and the privacy policy change.** | platform.claude.com API and data retention page, fetched 2026-11-03 (the Commercial Terms page itself was not fetched) |
| **STT provider** (OpenAI or Groq, per `STT_PROVIDER`) | Speech to text | The audio clip (≤ ~30 s) | Not reviewed yet; confirm its API retention before voice ships (PROMPT-02) | `docs/imp-03112026/sgc-ai-reference.md` §1.2 |
| **Google Maps Platform** (Places) | Optional list of nearby workshops | A text query and a location rounded to ~500 m | Only `place_id` may be stored; other fields not persisted (Places ToS §14) | `docs/imp-03112026/google-terms-verdict.md`. **Default OFF** (`FEATURE_GOOGLE_PLACES`); the data row exists so the answer is ready if it is turned on |
| **Supabase** | Database, auth, storage, Edge Functions | Everything the person syncs | Until the person deletes the account; provider backups renew | privacy policy §5, §8 |
| **Vercel** | Web hosting | Requests, IP | Provider logs | privacy policy §5 |
| **MapTiler / OpenFreeMap / OpenStreetMap** | Map tiles | IP and the map area being viewed | Provider logs | privacy policy §6 |
| **GitHub** | APK download | IP of the downloader | Provider logs | privacy policy §6 |

## Controls the person has
- AI is **off until the person turns it on** (Cuenta → Privacidad → Usar IA) and can be withdrawn at any moment; the server re-checks consent on every call (`403 sin_consentimiento_ia`).
- The admin has a **kill switch** and daily caps (Admin → Uso y costos → IA). The company's key pays for these calls, so the caps are the safety net.
- Every AI result **pre-fills a form; nothing is saved until the person confirms** (ADR-67).

## Open items (for the owner)
- Privacy policy text now mentions AI, Anthropic, speech-to-text and Google, **but `LEGAL_VERSION` was not bumped** (a bump asks every user to accept again). Bump it at release (PROMPT-08) in the same change that ships the first AI action.
- Confirm the STT provider's retention and the Supabase region before voice and the store forms.
- Rotating the two company keys (they were printed in the session that wrote the package) is recommended; no code changes.
