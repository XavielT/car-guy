# PROMPT-07 — Desktop-grade web for the laptop (P4, P4a)

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, ADR-70, **SPEC-F**, the baselines and `findings.md` D-n from PROMPT-00, `components/tabbar/CarGuyTabBar.tsx`, `components/ui`, `constants/theme`, `lib/features/registry.ts`. Nothing waits; log defaults. **The phone layout must not change**: the compact baselines from PROMPT-00 must still match.

## Steps
1. **`lib/theme/useLayout.ts`** (SPEC-F §F1) + tests; layout primitives: `Page` (max-width/centering), `Grid`, `SplitPane`, `Dialog` presentation for `Sheet` ≥ 768.
2. **Side rail** replacing the tab bar ≥ 1024, fed by the feature registry; vehicle switcher; collapsible; keyboard accessible.
3. **Inicio dashboard** in columns; **master/detail** for Historial, Garaje, Documentos, Contactos, Recordatorios, OBD; **Cifras/Reporte** multi-column charts sized from the container + sortable table with CSV button; forms in a centred card beside the capture panel; MapLibre full-height panes in Conducir/Viajes/Juntes.
4. **Interaction** (SPEC-F §F3): `/`/`Ctrl+K` search (also natural language via `cg-ai-intent`), go-to shortcuts, `?` cheat-sheet, focus rings/tab order/aria, hover states, tooltips; **drag-and-drop and paste** into the capture components from PROMPT-02/03 (receipts, matrícula, PDFs) and multi-file drop on the album importer; print stylesheets (Libro, Reporte, vehicle sheet).
5. **PWA desktop** (SPEC-F §F4): manifest updates (display override, shortcuts, screenshots, maskable icons), `/instalar` desktop section, confirm `vercel.json` Permissions-Policy (`microphone=(self)` from PROMPT-02), service worker unchanged semantics.
6. **`docs/LAPTOP.md`** and `npm run web:desktop` (SPEC-F §F5). Make no change to the AI keys flow: laptop dev needs only public env values.
7. **Verification**: Playwright at 1440×900, 1024×768 and 390×844 for the screens listed in PROMPT-00 plus the six master/detail screens; screenshots to `04-tracking/screens/f7-*.png`; compact pixel-diff vs baseline; keyboard test; Lighthouse desktop report (numbers reported, not gated). Typecheck/lint/tests/build green. Commit.

## Acceptance
SPEC-F §F6.

## Final report
Before/after desktop screenshots list, compact-diff result, shortcuts implemented, any screen left in a stretched state and why.
