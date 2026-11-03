# Findings — IMP 03112026

## Desktop defects (baseline at 1440×900, Expo web build, seeded garage) — SPEC-F input
Evidence: `04-tracking/screens/f0-<route>-1440.png` (compare `-390.png`).

| ID | Defect | Seen on | Fix lives in |
|---|---|---|---|
| D-1 | Whole app is the phone layout in a ~560 px centred strip; ~440 px of empty canvas on each side at 1440 | every route | SPEC-F §F1 `useLayout()` (wide ≥ 1024), max-width + panes |
| D-2 | Phone bottom tab bar and the floating red "Conducir" button are used on desktop (no side rail); Conducir overlaps the page bottom | inicio, garaje, historial | SPEC-F side rail (ADR-70) |
| D-3 | Inicio is one gauge and one tip; no second column (next service, reminders, last fill-ups) although there is room | inicio | SPEC-F two-pane / dashboard grid |
| D-4 | Garaje cards stay 2-up inside the narrow strip, leaving an orphan third card | garaje | wide grid 3–4 columns |
| D-5 | Historial is one long single column; no master/detail — opening a record leaves the list | historial | master/detail (list left, detail right) |
| D-6 | Cifras: stat cards truncate numbers with an ellipsis ("RD$ 21,746.…", "RD$ 66,100.…") and the chart sits alone in one column | cifras | multi-column charts; no truncation on wide |
| D-7 | Forms are one full-width field per row and very long (carga/nueva needs scrolling at 900 px tall) | carga-nueva, servicio-nuevo, documento-nuevo | 2-column forms on wide; sticky Save |
| D-8 | Photo/PDF input on web is only "Elegir de la galería" + "+ Adjuntar PDF": no drag-and-drop, no paste, no camera/file distinction | documento-nuevo (and every photo slot) | SPEC-F drag-and-drop + paste (also feeds AI capture) |
| D-9 | No keyboard shortcuts / search focus (`/`), no hover states; dates use the browser's native `dd/mm/yyyy` picker, visually unlike the app's controls | all forms | SPEC-F §keyboard; align date control |

Compact (390×844) must stay pixel-identical after phase 07 (ADR-70).

## Baseline reds (not caused by this cycle, not fixed)
- Node 20 default vs repo needing Node ≥ 22 → use Node 22 for jest/tsc/scripts.
- Under Node 22: `__tests__/changelog/parse`, `legal/markdown`, `ui/skeletons`, `db/track` fail (9 tests). Likely Windows (CRLF / path globbing). Recorded so later phases can tell new reds from old.
- `npm run build` does not work in cmd.exe (POSIX env-var prefix).
- Lint: 2 warnings (`app/cuenta.tsx:30`, `app/vehiculo/[id]/reparaciones.tsx:59`).

## Corrections to the package found while reading the references
- **STT:** SGC's `_shared/stt.ts` talks to **OpenAI or Groq** (`STT_PROVIDER`/`STT_API_KEY`/`STT_MODEL`), not Azure. Azure Speech key names appear only in tutorial-video narration scripts. SPEC-A's `AZURE_SPEECH_*` row is therefore wrong as "reuse"; default becomes the `STT_*` secrets if present in SGC's Supabase secrets, else `cg-stt` answers 503 `ai_not_configured` (voice hidden/degraded). See `sgc-ai-reference.md`.
- **No price table, no kill switch** exist in SGC (prices hard-coded per function; closest is `agente_costo_tope_diario_usd`). Car Guy builds both (ADR-66).
- **SPEC vs code:** `kmPerDay` and projected due dates already exist (`lib/domain/odometer.ts`, `reminders.ts`); `DocumentKind` has no revision kind; `media` has no role column (odometer-photo role needs a v13 owner link); DIY already has `createRepairForDtc`/`linkDtcRepair`; warranty helpers already exist. Details at the top of `ai-workflow-map.md`.
- **Google:** the live Places terms §14.2 forbids use "in conjunction with a non-Google map"; persisting name/phone/address is uncovered → flag default OFF (`google-terms-verdict.md`).
- **Models:** `claude-haiku-5-5` and `claude-sonnet-5-5` are current and cheaper/newer than the fallbacks (`models-and-prices.md`).
