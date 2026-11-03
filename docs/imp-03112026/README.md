# Car Guy — cycle IMP 03112026 (v2.7 "Sensei" 先生: company keys, AI inside the workflows, desktop web)

Written 2026-11-03 after reading the real repos: `C:\dev2\car-guy` (Car Guy, 2.6.0), and, read-only, `C:\dev\SGC` and `C:\dev2\csd-app`. Prompt package for Claude Code CLI, continuing IMP 16102026 (v2.6 "Kōbō").

## Where it goes
`C:\developer\improvements\car guy improvements\Noviembre 2026\imp cg 03112026\` (convention since 16-oct). PROMPT-00 copies it into the repo at `docs/imp-03112026/`.

## Order
One prompt per Claude Code session: `03-prompts/PROMPT-00` … `PROMPT-12` (see `PLAN.md` for the order; round 2 = 09–12 + Fuel Express inside 02).

## Contents
- `00-context/NOTAS-ORIGINALES.md` — your two messages verbatim, split into items P1…P9, plus your answers
- `00-context/BRIEF.md` — real state, what SGC already does with AI, honest notes, permanent rules
- `00-context/03-architecture-decisions.md` — ADR-65…75
- `02-specs/SPEC-A…K` — A keys + gateway · B photo/voice capture (+ §B7 Fuel Express) · C documents · D OBD + repairs · E prediction + alerts · F desktop · G other workflows · **H automatic trips · I speed + route lines · J recaps · K easy to use**
- `03-prompts/PROMPT-00…12`
- `04-tracking/PROGRESS.md` — Claude Code fills it
- `COBERTURA-NOTAS.md` — every note → phase (check it against what you wrote)
- `PLAN.md`, `05-manual-checklist.md`

## Things you should know
- **The web already exists** (Expo web + PWA on Vercel). Nothing to create: phase 07 makes it a proper laptop experience.
- **The keys never go in the app.** They become secrets of Edge Functions in `x-core`; the app only calls those functions.
- **Reusing the company's keys is done, with brakes**: per-user and global caps, a kill switch and a cost screen in Admin. Not everything SGC holds is reusable — Supabase prod keys, the Google service account, WhatsApp and GitHub tokens are deliberately left out (`SPEC-A §A1`).
- **Google**: used on the server for lists (find a gomera/taller), never drawn on the map, because Car Guy's maps are MapLibre; phase 00 re-checks Google's current terms and sets the flag accordingly.
- **Voice** adds the microphone, so 2.7.0 is an **APK**, not an OTA.
- The two key files were printed in the session that wrote this package. Rotating them is recommended; no code changes when you do.
- Files are in English (Claude Code prompts); app UI strings stay Spanish with English translations.

## Round 2 (added the same day)
- **Trips**: the real cause is that the tracking service is only armed while the app is open. Fix = triggers from the phone's OS (activity recognition, the car's Bluetooth, geofence, boot) + a wizard that checks every permission + a health card. **iPhone cannot do this as a web app**: you get a one-tap Shortcut that opens Car Guy and records (stated honestly in the app).
- **Speed**: one engine for the needle, top speed, averages and the map; per-car calibration (your dash reads higher than GPS on purpose); proven by a replay test with an old-vs-new table. Route frequency becomes thin glowing lines instead of blobs.
- **Recaps**: monthly and yearly story cards + shareable image, private by default (no plate, odometer or exact places).
- **Easier**: Inicio becomes "Hoy" (one next step + 4 big actions), navigation by task, you choose what to see, forms ask the minimum first. Nothing is deleted. The proof is the 3-people cold-start test in the checklist.
- **Fuel Express**: dashboard photo + receipt photo → one confirmation card → one tap.
- **Order**: Release A first (09, 10, 12, 11 — no AI, an APK because of the trip module), then the AI/desktop release.
