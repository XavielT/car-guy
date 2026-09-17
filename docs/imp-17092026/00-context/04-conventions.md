# Conventions — rules for every phase

Every prompt says "follow `00-context/04-conventions.md`". These are the standing rules.

## Ground rules

1. **Read `CLAUDE.md` → `AGENTS.md` first.** It says: Expo has changed; read the exact versioned docs
   at https://docs.expo.dev/versions/v57.0.0/ before writing any code. Do it for every Expo module
   you touch (`expo-sqlite`, `expo-notifications`, `expo-image-picker`, `expo-image-manipulator`,
   `expo-file-system`, `expo-print`, `expo-router`). `01-research/03-expo57-technical.md` has the
   verified API shapes and versions, but the docs win if they disagree.
2. **The repo wins over this package.** `00-context/02-repo-audit.md` describes the code as of
   2026-09-17. If a path, type or behaviour differs when you run, adapt and log it in
   `04-tracking/PROGRESS.md` → "Deviations".
3. **Apply the ADR defaults; do not stop to ask.** Xaviel's rule for these packages: no item may be
   left waiting behind a pending decision. Pick the documented default (or the closest one), build,
   and put the decision in the report. The only legitimate stop is a destructive or irreversible
   action not covered here (e.g. dropping a table that has data, force-pushing, deleting a Vercel
   project).
4. **Install with `npx expo install <pkg>`** so versions match SDK 57. Report every new dependency
   and what it replaces. No dependency for something the stdlib or an existing dep already does.
5. **One phase per branch**, `imp-17092026/phase-<n>-<slug>`. Small conventional commits
   (`feat(db): …`, `fix(reminders): …`, `chore(brand): …`). Merge to `main` when the phase report
   is written. `main` deploys to Vercel automatically — a broken `main` is a broken PWA.
6. **Never break the fuel flow.** Registering a fill-up and seeing km/gal is the regression canary
   for every phase, the way Music Hub is for xaviel-web. Exercise it at the end of each phase.
7. **Never touch Music Hub behaviour** on `x-core` beyond the one `IF` documented in ADR-06.
   Anything else you believe needs changing there: report, do not change.
8. **Spanish UI, DR vocabulary.** *gomas*, *jeepeta*, *camioneta*, *motor* (motorcycle), *bomba*
   (gas station), *marbete*, *taller*, *chequeo/revisión*. Money `RD$`, volume gallons (m³ for GNV),
   distance km. Reuse `lib/format.ts`.
9. **Web and Android in the same change.** Anything that touches storage, files, dates, alerts or
   notifications needs its web path (`*.web.tsx` or `Platform.OS === 'web'`) in the same commit.
   Verify in the browser (`npx expo start --web`) and on Android (Expo Go or emulator) before
   reporting.

## Scope discipline

- Do only the phase in front of you. Log out-of-scope findings under "Observed, deferred" in
  `PROGRESS.md`; do not fix them.
- No drive-by refactors, formatting passes or dependency bumps outside the phase.
- If the phase is clearly bigger than described, split it yourself into part A / part B on the same
  branch, finish A fully (report included), then continue with B. Do not leave half-built features
  on `main`.

## Secrets

| Value | Where it may live |
|---|---|
| Supabase URL, anon key | Client (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — RLS protects the data |
| Supabase service-role key | **Nowhere in this repo.** SQL migrations run from the Supabase SQL editor or CLI with Xaviel's login |
| EAS project id | `app.json` `extra.eas.projectId` — fine, it is public |

Add every new variable to `.env.example` with a placeholder and a comment. `.env*.local` is
gitignored already.

## Verification — minimum per phase

- `npx tsc --noEmit` clean.
- `npx expo lint` clean (from PROMPT-01 on).
- `npm test` green (from PROMPT-01 on); new domain logic ships with tests.
- `npm run build` (web static export) succeeds.
- App starts in Expo Go on Android **and** in the browser; the fuel flow works; new features
  exercised manually as listed in the prompt's acceptance criteria.
- Every acceptance criterion reported as verified / not verified + why.

## Reporting — end every phase with this block in `04-tracking/PROGRESS.md`

```markdown
## Phase <n> — <name>   (branch `imp-17092026/phase-<n>-<slug>`)

**Status:** complete / partial / blocked
**Commits:** <range or list>

### Changed
- path — what and why (grouped, not every file)

### Dependencies added / removed
- pkg@version — reason

### Acceptance criteria
- [x] … — how verified (command, screen, device)
- [ ] … — why not, and what is needed

### Decisions made (defaults applied)
- …

### Deviations from the package
- …

### Observed, deferred
- …

### Notes for the next phase
- …
```

## Anti-patterns for this project

- Importing `Alert` from `react-native` (web no-op) → use `@/lib/alert`.
- Writing SQL in a screen or component → repos only (ADR-02).
- Hard `DELETE` on a syncable table → `deleted_at` (ADR-03).
- Domain logic inside React components → `lib/domain/**` (ADR-04).
- Using `expo-sqlite` sync API or Drizzle's expo driver (needs SharedArrayBuffer on web) (ADR-02).
- Requesting `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (ADR-07).
- Storing base64 images in SQLite `TEXT` or in AsyncStorage (ADR-10).
- Making the account mandatory anywhere, or wiping local data on sign-out (ADR-05).
- Changing `android.package` again, or reusing `com.xavieltucombustiblerd.app` (ADR-01).
- Caching `/_expo/**` worker/wasm cache-first in `public/sw.js` (ADR-02).
