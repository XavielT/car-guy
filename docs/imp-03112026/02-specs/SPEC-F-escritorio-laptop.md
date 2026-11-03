# SPEC-F — Laptop: a desktop-grade web (P4, P4a) — ADR-70

Fact: Car Guy already has a website — Expo web (react-native-web) on Vercel with `manifest.webmanifest`, `sw.js`, rewrites for every route, public pages (`/c/…`, `/u/…`, `/j/…`). So the note "if it doesn't have a website, create it" resolves to: **make that web feel native on a laptop**. Today on a laptop it is the phone layout stretched.

## F1. `useLayout()` and breakpoints
`lib/theme/useLayout.ts`: `compact` < 768 · `regular` 768–1023 · `wide` ≥ 1024 (and `isDesktopPointer` from `matchMedia('(hover:hover) and (pointer:fine)')`). Phones and the APK are always `compact`; iPhone PWA unchanged. Add Playwright baseline screenshots of the compact layout **before** changing anything; they must match after (pixel-diff tolerance 0.1 %).

## F2. Wide layout
- **Side rail** replaces `CarGuyTabBar` ≥ 1024: Inicio · Garaje · Conducir · Historial · Herramientas · Más, vehicle switcher on top, account at the bottom, collapsible. The registry (ADR-62) already lists every function, so the rail's "Herramientas" is the hub, not a hand-made list.
- **Content**: centred, max-width 1200, 12-column grid helper; Inicio becomes a dashboard (cluster/telltales + Car Health + last fill + pending + mini-stats in columns).
- **Master/detail** for Historial (list left, record right), Garaje (grid of cards → detail pane), Documentos, Contactos, Recordatorios, OBD (codes left, explanation right).
- **Cifras/Reporte**: multi-column charts at real width (`react-native-gifted-charts` sized from container), table view with sortable columns + CSV export button in place.
- **Forms** in a centred card (max 640) with the capture panel (photo/drop zone) beside it, so receipt + form are visible together.
- **Maps** (MapLibre GL web): full-height pane in Conducir/Viajes/Juntes, with a side list.
- Modals/sheets become centred dialogs ≥ 768 (`Sheet` component gets a `wide` presentation).

## F3. Desktop interaction
- Keyboard: `/` or `Ctrl/Cmd+K` opens the Herramientas search (also takes natural language → `cg-ai-intent`); `g` then `h/g/i/m` go to Inicio/Garaje/Historial/Más; `n` new fill-up; `Esc` closes; visible shortcut cheat-sheet (`?`). Focus rings, tab order, `aria-*` on custom controls.
- Hover states, cursor pointer, tooltips on icon buttons; right-click not required anywhere.
- **Drag-and-drop and paste** of images/PDFs onto capture screens (SPEC-B/C): drop a receipt or a matrícula and the AI reading starts; multi-file drop on the album importer.
- Printing: print stylesheet for Libro, Reporte and a vehicle sheet (hide chrome, page breaks).

## F4. PWA on desktop
Manifest: `display: standalone`, `display_override: ["window-controls-overlay","standalone"]`, 192/512/maskable icons, `theme_color`, shortcuts (New fill-up, Dictate, Scan receipt), `screenshots` for the install prompt; `/instalar` explains desktop install (Chrome/Edge). `vercel.json` Permissions-Policy: `camera=(self), microphone=(self), geolocation=(self)` (microphone is needed by SPEC-B). Service worker keeps `Cache-Control: no-cache` and offline shell.

## F5. "Open the project on the laptop" (developer side, P4)
`docs/LAPTOP.md`: clone `github.com/XavielT/car-guy`, Node version from `.nvmrc`/engines, `npm ci`, copy `.env.example` → `.env.local` (public values only), `npx expo start --web`, Playwright browsers, EAS login, `tools/apply-sql.mjs` token location (`.env.supabase`, gitignored — **never** the AI keys; those live only in x-core), WSL for `tools/local-rls`, Git Bash for `tools/ota-gate.cjs`, how to run the desktop check at 1440×900. `package.json` script `web:desktop` opens the dev server and a 1440×900 Playwright window.

## F6. Acceptance
At 1440×900 and 1024×768: side rail, centred grid, master/detail on the six screens, charts fill the width, dialogs centred, keyboard shortcuts work, paste/drop starts an AI read, print preview of Libro is clean, PWA installs on desktop Chrome/Edge with shortcuts. At 390×844: pixel-identical to the baseline. Lighthouse (desktop) PWA/Accessibility ≥ 90 reported, not gated.
