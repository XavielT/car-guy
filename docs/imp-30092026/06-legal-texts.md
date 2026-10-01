# Legal texts and account deletion — Phase 6 (note 15, ADR-47)

> **Estos textos no son asesoría legal.** Son borradores de ingeniería hechos a partir de
> `01-research/02-i18n-skeleton-onboarding-avatars-legal.md` §5. Revísalos con un abogado
> dominicano (Ley 172-13) antes de publicar en Play Store. Esta nota vive en `docs/`, **nunca** en
> las páginas públicas (`__tests__/legal/markdown.test.ts` y `tools/smoke-legal.mjs` lo comprueban).

## Where things are

| What | Where |
|---|---|
| The texts (ES + EN), version `2026-10`, effective 2026-10-01 | `content/legal/{terminos,privacidad,eliminar-cuenta}.{es,en}.md` |
| Version, date, contact constants | `lib/legal/index.ts` (`LEGAL_VERSION`, `LEGAL_DATE`, `LEGAL_CONTACT`) |
| Parser + HTML renderer (shared by the app and the pages) | `lib/legal/markdown.ts` |
| Generated outputs (committed) | `public/{terminos,privacidad,eliminar-cuenta}.html`, `lib/legal/content.generated.ts` |
| Regenerate after any edit | `node tools/build-legal.mjs` (the jest test fails while stale) |
| Public URLs | `/terminos`, `/privacidad`, `/eliminar-cuenta` (`?lang=en`, else the app's language, else the browser's) |
| In-app | Más → Legal (`app/legal/*`), the first-launch sheet (`components/legal/LegalSheet.tsx`), the signup checkbox (`components/legal/SignupConsent.tsx`) |
| Account deletion | `sql/028_delete_account.sql`, `api/eliminar-cuenta.ts`, `app/borrar-cuenta.tsx`, `app/admin/eliminar.tsx`, `lib/account/*` |
| Smoke | `node tools/smoke-legal.mjs [base-url]` |

## Blockers for Xaviel

1. **Contact e-mail.** Every text says `CONTACTO@EJEMPLO`. Choose the address, then replace it in
   `lib/legal/index.ts` (`LEGAL_CONTACT`) and in the six Markdown files, and run
   `node tools/build-legal.mjs`. The test checks the texts and the constant agree and that no other
   address appears.
2. **Legal review** of the six texts (above).
3. **`SUPABASE_SERVICE_ROLE_KEY`** on Vercel (Production) for `api/eliminar-cuenta.ts` only. Without it
   the function answers `503 { reason: 'no-service-key' }`, the app still deletes all Car Guy data and
   says the login is removed by the admin, and Admin → Cuentas por eliminar lists the account with a
   button to Supabase → Authentication → Users.
4. **Apply `sql/028_delete_account.sql`** (not `--shared`: it only reads `storage.objects` and
   `auth.users`): `node tools/apply-sql.mjs sql/028_delete_account.sql --dry-run`, then without
   `--dry-run`. Rollback block at the end of the file.

## Facts the texts state (check they are still true before publishing)

Developer Xaviel Terrero (DR) · data on the device (SQLite / browser storage), and with an account in
Supabase on AWS us-west-2 (United States), shared project separated by RLS · web and functions on
Vercel (request logs with IP) · APKs from GitHub Releases (IP) · map tiles from
OpenFreeMap/OpenStreetMap (IP + viewed area) · feedback with device info and diagnostics, no
advertising ID · background location only with automatic trips on, persistent notification ·
optional plate/VIN · trip GPS points kept 30 days on the device · cloud data kept until account
deletion · 18+ to create an account, not directed at under-13s · Ley 172-13 ARCO rights · GPS
speed/odometer are estimates · drive-mode safety notice and Ley 63-17 · governing law DR, courts of
Santo Domingo · deletion without the app: e-mail from the account's address, within 30 days.

## Play Console (when it comes)

Data safety: location (precise, background), photos, personal info (e-mail), other info (plate/VIN),
app info and performance (feedback device info), user IDs — collected, not shared (Supabase/Vercel
are service providers), encrypted in transit, deletion URL `https://car-guy.vercel.app/eliminar-cuenta`.
Privacy policy URL `https://car-guy.vercel.app/privacidad`.
