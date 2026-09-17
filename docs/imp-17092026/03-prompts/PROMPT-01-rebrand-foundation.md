# PROMPT 01 — Rebrand to Car Guy + project foundation (identity, tokens, tests, lint)

**Depends on:** Phase 0 · **Branch:** `imp-17092026/phase-1-rebrand` · **ADRs:** 01, 04, 13, 15
**Goal:** G8 (identity), groundwork for everything else. No new features; the app still does exactly
what Tu Combustible RD does, but it is called Car Guy, looks like Car Guy, and has tests + lint.

> **Before running:** Phase 0 merged. `npm i --no-save sharp` will be needed for icons (the prompt
> does it). Optional: `npx eas login` so step 3 can link the new slug (otherwise it is deferred to
> the manual checklist).
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 1 of IMP 17092026: rebrand "Tu Combustible RD" → "Car Guy" and lay the technical foundation.

Read first:
- CLAUDE.md → AGENTS.md (read the Expo 57 docs for every module you touch)
- docs/imp-17092026/00-context/01-project-brief.md   (decisions D1, D5, D6)
- docs/imp-17092026/00-context/03-architecture-decisions.md   (ADR-01, 04, 13, 15)
- docs/imp-17092026/00-context/04-conventions.md
- docs/imp-17092026/00-context/05-design-identity.md   (this is the spec for the look)
- docs/imp-17092026/00-context/02-repo-audit.md §4 and §6
- docs/imp-17092026/01-research/03-expo57-technical.md §7 (rebranding) and §8 (testing/lint)

Branch: imp-17092026/phase-1-rebrand

Requirements:

1. IDENTITY (ADR-01)
   - app.json: name "Car Guy", slug "car-guy", scheme "carguy", version "2.0.0",
     android.package "com.xaviel.carguy", android.versionCode 1, userInterfaceStyle "automatic",
     web.name "Car Guy", web.shortName "Car Guy", web.themeColor "#0E1116",
     description "Tu carro, al día. Mantenimiento, chequeos, combustible e historial de tus vehículos."
     Remove extra.eas.projectId if present (it belongs to the old slug). Keep every plugin.
     Splash: use the expo-splash-screen plugin object with backgroundColor "#0E1116" and the new mark.
   - package.json name "car-guy".
   - app/_layout.tsx: every Stack.Screen title that says "Tu Combustible RD" → "Car Guy".
   - app/+html.tsx: meta description as above, theme-color #0E1116, body background #0E1116,
     apple-mobile-web-app-title "Car Guy", apple-mobile-web-app-status-bar-style "black-translucent".
   - public/manifest.webmanifest: name/short_name "Car Guy", theme_color/background_color #0E1116,
     description, lang es-DO, icons regenerated (step 2).
   - public/sw.js: bump the cache name (e.g. carguy-v1) so old shells are evicted; keep the rest.
   - tools/finalize-web.mjs: TITLE = 'Car Guy'.
   - README.md: rewrite the header and "Qué hace" for Car Guy (vehicle care app, fuel is one part);
     keep the sections about running, Android package (now com.xaviel.carguy — explain that Tu
     Combustible RD stays a separate app and data comes in via backup import), and data-on-update
     notes (update the storage key text when Phase 2 lands; for now say "see docs/imp-17092026").
     Add a "Origen" line: "Car Guy nació de Tu Combustible RD (v1.x)".
   - lib/backup.ts: the exported file stays readable by the old format check; change the `app`
     field of NEW exports to 'car-guy' and BACKUP_VERSION to 2, and make importBackup accept both
     'tu-combustible-rd' and 'car-guy' (Phase 2 rewrites the payload; keep the contract).
   - Grep the whole repo (excluding node_modules, dist, docs/imp-17092026/01-research) for
     "Tu Combustible", "tucombustible", "tu-combustible", "combustible rd" and fix every
     user-facing occurrence. The storage KEY 'tu-combustible-rd/v1' must NOT change (Phase 2
     imports it).

2. ICONS AND SPLASH (05-design-identity.md → "App icon and splash")
   - Replace assets/pwa/*.svg with the new mark: dark tile #0E1116, 270° gauge arc in #22D3EE with
     round caps, a needle at ~2 o'clock, a #34D399 dot at the tip. Variants: icon.svg (tile),
     icon-fullbleed.svg, icon-maskable.svg (mark inside the 80% safe zone), mark.svg (no tile),
     adaptive-foreground.svg, adaptive-monochrome.svg (single colour).
   - Update tools/make-icons.mjs colours/paths, keep the 0.78 adaptive scale, run it
     (npm i --no-save sharp && node tools/make-icons.mjs) to regenerate assets/images/*,
     public/favicon.png, public/icons/*. Confirm the sizes listed in the manifest exist.
   - Do not run expo prebuild here (Phase 10 does).

3. EAS LINK (ADR-01) — only if `npx eas whoami` shows a logged-in account:
   run `npx eas init` non-interactively where possible to create/link a project for slug "car-guy"
   (it writes extra.eas.projectId). If not logged in, skip and write the exact commands in
   docs/imp-17092026/05-manual-checklist.md under "EAS" and in the report.

4. DESIGN TOKENS + BASE COMPONENTS (ADR-13, 05-design-identity.md)
   - npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
   - constants/theme.ts: export `palette` (dark + light objects exactly as the token tables),
     `categoryColors`, `fonts` (display/title/body/medium/semibold/mono/monoBold → the new
     families), `radius`, `space`. Keep the OLD export names (`colors`) as a compatibility alias
     mapped onto the dark palette (canopy→bg.base, receipt→bg.surface, ink→text.primary,
     muted→text.secondary, led→accent, nozzle→accent, teal→status.ok, line→line, white→bg.raised,
     danger→status.vencido, receiptDeep→bg.raised, canopyLift→bg.raised, ledDim→accent.pressed)
     so every legacy screen compiles and instantly looks dark; Phase 6 removes the alias.
   - lib/theme/useTheme.ts: hook returning the active palette from `setting.theme`
     (system|dark|light; default system, dark when the system has no preference) and `useColorScheme`.
     Provide <ThemeProvider> in app/_layout.tsx. Until Phase 2, persist the preference in AsyncStorage
     key 'car-guy/theme'.
   - components/T.tsx: same `face` API, new font families loaded in app/_layout.tsx (remove the
     Syne/Figtree/IBM Plex imports and dependencies ONLY if no file still references them after the
     alias — otherwise leave them and note it for Phase 6).
   - components/ui/: StatusPill, GaugeRing (react-native-svg — npx expo install react-native-svg),
     EmptyState, QuickActions (accepts an array of {label, icon, onPress}), Sheet. Restyle the
     existing PrimaryButton/GhostButton/Chip/Card/Field with the tokens (radius, colours) without
     changing their props. Add a Storybook-free preview route app/dev/tokens.tsx (only rendered in
     development: guard with __DEV__ and exclude from the web export if expo-router supports it;
     otherwise keep it but hide it from the tab bar) showing the palette, type scale and the
     components in both schemes — this is how I review the identity.
   - Tab bar and Stack header styles use the tokens; StatusBar style follows the scheme.

5. TESTS + LINT (ADR-04)
   - npx expo install jest-expo jest @types/jest --dev ; package.json "jest": {"preset": "jest-expo"},
     "test": "jest". tsconfig "types": ["jest"].
   - Create lib/domain/ and MOVE the pure functions from lib/math.ts into lib/domain/economy.ts
     (completeAmounts, computeEconomy, economyById, reviewFillUp, latestEconomyInsight, sumSpend,
     distanceInLogs, lastOdometer, roundMoney, roundVolume, parseDecimal, inMonth). Keep lib/math.ts
     as a re-export barrel so nothing else changes. Write __tests__/domain/economy.test.ts covering:
     two-of-three completion (all three pairs + insufficient), brim-to-brim with partials in the
     middle, first full tank is baseline, reviewFillUp low/great/normal/first, sortFillUps tie-break.
     These tests pin today's behaviour — do not "fix" the math.
   - npx expo lint (installs eslint-config-expo, writes eslint.config.js). Fix lint errors in touched
     files; for pre-existing warnings elsewhere, fix only trivial ones and list the rest.
   - Delete unreferenced template leftovers (components/Themed.tsx, StyledText.tsx, ExternalLink.tsx,
     useColorScheme*.ts, useClientOnlyValue*.ts, constants/Colors.ts, assets/fonts/SpaceMono-Regular.ttf)
     — grep first; delete only what nothing imports.

6. VERIFY: npx tsc --noEmit · npx expo lint · npm test · npm run build · web run: the app opens in
   dark, title "Car Guy" in the tab, manifest installable, favicon new; Android (Expo Go): launcher
   name/icon come only from a native build, so verify in-app fonts/colours and that the fuel flow
   (onboarding → vehicle → carga → historial → cifras → más → backup) still works end to end.
   Take screenshots of Inicio and app/dev/tokens in both schemes into docs/qa/phase-1-*.png.

7. Report in docs/imp-17092026/04-tracking/PROGRESS.md (block from 04-conventions.md), commit in
   small conventional commits, merge to main, push. The Vercel deploy of main now shows Car Guy at
   the OLD url (fine until Phase 10).
```

---

## Acceptance criteria

- [ ] `app.json`/`package.json`/manifest/HTML/README carry the Car Guy identity; `android.package` = `com.xaviel.carguy`; no "Tu Combustible" user-facing string remains (grep report).
- [ ] New icon set regenerated from SVG sources; manifest sizes exist; splash background `#0E1116`.
- [ ] `constants/theme.ts` exposes the dark/light palettes, category colours, fonts, radius, spacing; legacy `colors` alias keeps old screens compiling.
- [ ] `useTheme()` + provider; system/dark/light preference persisted; StatusBar and tab bar follow.
- [ ] `StatusPill`, `GaugeRing`, `EmptyState`, `QuickActions`, `Sheet` exist; `app/dev/tokens.tsx` previews them in both schemes.
- [ ] `lib/domain/economy.ts` + tests; `npm test` green; `lib/math.ts` re-exports.
- [ ] `npx expo lint` clean; `npx tsc --noEmit` clean; `npm run build` green.
- [ ] Fuel flow verified on web and Android (Expo Go); screenshots saved.
- [ ] EAS linked to slug `car-guy`, or the exact manual commands recorded.

## Watch for

- **Web font flash / fallback**: `useFonts` must include every weight referenced in `fonts`; a missing weight silently falls back to system font on web.
- **`userInterfaceStyle: "automatic"`** makes Android follow the system; the legacy screens use the alias (dark) regardless — expected in this phase.
- **`+html.tsx` body background** must equal the default scheme's `bg.base`, or the first paint flashes.
- **SW cache name**: if you forget to bump it, the old cream shell keeps loading on installed PWAs.
- **TS 6 + jest-expo types**: if `@types/jest` conflicts with `expo-env.d.ts`, scope `types` in a `tsconfig.test.json`; report.
- Do not touch `lib/storage.ts` KEY or `lib/types.ts` — Phase 2 owns them.

## Notes for later phases

Record in PROGRESS.md: final token file shape, which legacy screens still use the `colors` alias (Phase 6 list), whether Syne/Figtree/Plex were removed, EAS project id, and any lint rules disabled.
