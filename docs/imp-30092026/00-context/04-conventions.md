# Conventions — IMP 30092026 (inherits the three previous cycles' conventions)

Additions:

1. **Strings go through `t`.** From Phase 3 on, no screen imports `es` directly; `useT()` in
   components, `t()` in non-React code. ESLint rule (`no-restricted-imports` for `@/lib/i18n/es`
   outside `lib/i18n/`) enforced from the end of Phase 3. New strings are added to **both** files in
   the same commit; the missing-keys test is part of `npm test`.
2. **Every screen ships with its skeleton** from Phase 3 on: a PR that adds a screen without
   `<Name>Skeleton` fails the "screen audit" test (a list of routes ↔ skeleton components).
3. **Map code is isolated.** `components/map/TripMap.tsx` / `.web.tsx`, `HeatMap.*`, `LiveMap.*`;
   nothing else imports maplibre. The style URL and the fallback key live in `lib/map/config.ts`.
   Native map screens are never rendered in Expo Go (guard with a friendly card).
4. **Branch naming** `imp-30092026/phase-N-<name>`; fix pack on `fix/2.3.1-fixpack`.
5. **Wheelz walk is read-only** (research 03 §C). Screenshots under
   `docs/imp-30092026/01-research/wheelz/` never include Xaviel's personal data at full resolution
   (crop the profile/e-mail; the repo is public).
6. **Legal texts are content**, not code: `content/legal/{terminos,privacidad,eliminar-cuenta}.{es,en}.md`
   rendered by one component on web and native; changing them bumps `LEGAL_VERSION`.
7. **Service keys**: the first server-side secret (ADR-38) lives only in Vercel env; `tools/` scripts
   that need it read it from the shell, never from a file in the repo; `check-bundle-env` also asserts
   the web bundle does **not** contain it.
8. **Report block** as before + *Notes closed* + *Screens with skeleton* (Phase 3 onward, count).
