# PROMPT 00 — Kickoff 2.1: folder rename, package into repo, baseline, dev seed with the real garage

**Depends on:** v2.0.0 released · **Branch:** `imp-28092026/phase-0-kickoff` · **Size:** S

> **Manual first (Xaviel, in a terminal with no Claude session open in the folder):**
> `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy` — then start Claude Code from `~/dev2/car-guy`.
> If you prefer not to rename now, run everything from the old path; the prompts say "wherever
> the repo lives".
>
> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Kickoff of the IMP 28092026 cycle for Car Guy: v2.1 "Hachi-Gō" — JDM look + car-guy features
(album/memory, build log, DIY, track, sharing). This phase changes no product behaviour.

Read first:
- CLAUDE.md → AGENTS.md (Expo 57 docs rule)
- docs/NEXT.md (state after v2.0.0)
- /home/xaviel/improvements/imps car guy/september 2026/imps 28092026/README.md
- …/imps 28092026/00-context/01-project-brief.md
- …/imps 28092026/00-context/02-state-of-the-repo.md
- …/imps 28092026/00-context/04-conventions.md

Do:

1. Confirm the working directory (pwd). If it is still ~/dev2/tu-gasolina-rd, continue anyway and
   note in the report that the rename is pending (it cannot be done from inside the session).
   Update every doc that mentions the old path as "current" (docs/NEXT.md "Local folder" row,
   docs/RESUME.md) to ~/dev2/car-guy.

2. Copy the package into the repo as docs/imp-28092026/ (keep 00-context, 01-research, 02-specs,
   03-prompts, 04-tracking, README.md). From now on prompts read docs/imp-28092026/…; the copy in
   ~/improvements is the master I edit by hand — if they differ, use the newer (mtime) and say so.

3. Verify docs/imp-28092026/00-context/02-state-of-the-repo.md against the code (versions, tables,
   theme shape, sync tables, sql files, tools). Write differences under "Audit corrections" in
   docs/imp-28092026/04-tracking/PROGRESS.md. Do not fix code.

4. Baseline: npm ci (or install), npx tsc --noEmit, npx expo lint, npm test (record the count),
   npm run build (dist size), node tools/verify-x-core.mjs and node tools/verify-sync.mjs (only if
   .env.local has the Supabase vars; otherwise record "skipped, no env"). Tooling: node, npm, eas
   whoami (via the token in .env.expo.local as docs/NEXT.md explains), vercel whoami, gh auth
   status, adb devices. Record under "Baseline".

5. Dev seed with the real garage (app/dev/seed.tsx, __DEV__ only). Replace the demo vehicles with:
   - Toyota Trueno AE85 1985 — nickname "hachi-gō" (ハチゴー), type carro, chassis_code AE85, engine
     4A-GE 20V (swap), manual, RWD, origin jdm, status activo, no plate/VIN (leave empty — never
     real identifiers), story: "Preparado para drift y ceritos. Aros, radiador y abanicos racing,
     ECU tuneada con pops and bangs. No sé cuántos caballos, pero el motor es alegre, gira rápido
     y alto."; fuel premium; odometer ~52 400 km.
   - Citroën DS3 2015 — 1.6 NA automático, stock, status activo, nickname "el daily", origin eudm.
   - Citroën C3 2003 hatchback — 1.6 NA manual, interior tela beige, stock, status proyecto, story
     "Chocado hace unos meses; en restauración. Cuando esté funcional, se modifica."; plus 4 open
     tasks (chapa, pintura, alineación, revisión de suspensión) and a milestone accidente.
   - Volkswagen Jetta 2003 1.8T automático — stock, status vendido, ownership 2018 → 2021, story
     "Mi primer carro. No encontré fotos de él cuando cambié de teléfono — por eso existe el álbum."
   Since schema v2 does not exist yet, seed only the v1 columns now and leave a clearly marked
   `// TODO(v2): nickname/status/story/ownership` block that PROMPT-01 fills. Keep the existing
   fuel/service/expense/inspection sample data but attach it to the AE85 and DS3.

6. Fixtures: export a v2 backup JSON from the seeded dev DB into
   docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json (the migration test in PROMPT-01
   imports it). Add docs/imp-28092026/fixtures/*.real.json to .gitignore.

7. Report (block in 04-conventions.md), commit "chore(imp-28092026): kickoff — package, audit,
   baseline, real-garage seed", merge to main, push.
```

---

## Acceptance criteria

- [ ] `docs/imp-28092026/` in the repo; path docs updated; rename status recorded.
- [ ] Audit corrections and baseline recorded (tests count, build size, verify scripts).
- [ ] Dev seed shows AE85 / DS3 / C3 / Jetta with the v1 fields; v2 TODO block present.
- [ ] Sample v2.0 backup fixture exists; real fixtures gitignored.
- [ ] `main` green and deployed.
