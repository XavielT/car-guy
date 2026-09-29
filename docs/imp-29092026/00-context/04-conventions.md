# Conventions — IMP 29092026 (inherits imp-17092026 and imp-28092026 conventions)

Everything from `docs/imp-17092026/00-context/04-conventions.md` and
`docs/imp-28092026/00-context/04-conventions.md` still applies. Additions:

1. **Repo path.** `cd ~/dev2/car-guy` if the rename happened, else `~/dev2/tu-gasolina-rd`.
   PROMPT-00 prints which one it found; every later prompt says `cd` to "the repo folder".
2. **Hotfix branch discipline.** `fix/2.1.3-hotfix` branches from `main` (v2.1.2), merges back to
   `main` and is tagged before `imp-29092026/phase-2-schema-v6` starts. Phase branches then chain
   as before (`imp-29092026/phase-N-<name>`).
3. **Units.** After v6, every volume in the DB is **liters**; every number shown passes through
   `lib/domain/units.ts`; tests assert both directions with the exact factor 3.785411784.
4. **Background code has its own folder.** `lib/trips/task.ts` (TaskManager task, imported from
   `index.ts` before `expo-router/entry`), `lib/trips/machine.ts` (pure state machine, 100 %
   tested), `lib/trips/geo.ts` (haversine, projection, simplify, polyline, stats — pure),
   `lib/trips/live.ts` (foreground watch → store). Nothing in `lib/trips/*` imports React.
   `*.web.ts` shims keep the background task out of the web bundle.
5. **Permissions copy is product copy.** Every permission dialog has an explanation screen before
   it, in Spanish, saying what happens if the user says no. The app never nags: one ask per
   feature, then a row in Ajustes to change the answer.
6. **Data pickers are data files.** Makes/models, colours, body types, oil grades/brands live in
   `lib/domain/refdata/*.json` with a `source` and `license` field at the top, loaded statically
   (≤ 50 KB raw in total); search helpers in `lib/domain/refdata/index.ts` reuse the accent fold
   from 2.1.1.
7. **Never expose developer text.** User-facing errors come from `es.ts` and never contain file
   names, env var names or stack text. Technical detail goes to `__DEV__` logs and to the
   feedback form's hidden `diagnostics` field.
8. **Every phase verifies on the Redmi** (2.2 is about the phone) and on web; screenshots in
   `docs/qa/imp-29092026-phase-N-*.png`. Phase 5 verifies twice: on the emulator with a synthetic
   GPX (`docs/imp-29092026/fixtures/drive-synthetic.gpx`, straight segments with realistic speeds,
   written by PROMPT-05 — no need for real streets), and on the Redmi with a **real drive** by
   Xaviel (manual checklist).
9. **Report block** as before, plus *Notes closed* (which note numbers from the brief this phase
   closed).
