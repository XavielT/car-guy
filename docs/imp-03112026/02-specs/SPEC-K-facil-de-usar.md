# SPEC-K — Easy to understand and use (P8)

Xaviel (03-nov): "it should be easier and more understandable to use; if the user is hit with too much content on screen they get lost — I myself sometimes try to use it and don't know where to start or where to find or do something specific."

That sentence is the acceptance test: **the person who built the app must be able to open it cold and know what to do.** This spec changes information architecture, defaults and wording; it removes nothing the app can do (nothing valid is deleted; things are *moved, grouped, collapsed or offered later*).

## K0. Measure the problem first (PROMPT-12 step 1 → `docs/imp-03112026/ux-audit.md`)
Before redesigning, produce numbers from the real code and a running build (Playwright at 390×844 and 1280×800):
- For every top-level screen (Inicio, each tab, Herramientas, vehicle ficha, Viajes, Conducir, Cifras): count visible tappable elements above the fold and in total, section count, and number of distinct "primary" buttons.
- **Task map**: for 15 everyday tasks, the taps from a cold start and whether the label names the task: *cargar gasolina · iniciar un viaje · ver mis viajes · registrar un servicio · registrar una reparación · ver cuánto gasté este mes · poner un recordatorio (marbete) · guardar un documento · ver el último kilometraje · ver estadísticas de mi carro · agregar una modificación · subir fotos · ver el resumen del mes · compartir mi garaje · escanear un código OBD*. Record taps (target ≤ 2 from Inicio for the first 8, ≤ 3 for the rest) and where the word the user would use is not the word on screen.
- Use `lib/features/registry.ts` + `lib/features/usage.ts` to list how many features exist and which are actually used (local only).
The audit is the "before"; PROMPT-12 ends with the same table "after".

## K1. Inicio becomes "Hoy": one next step, a few big actions
Principle: **one screen, one question — "what do I want to do now?"**
- **Vehicle header** (photo, name, current odometer, a vehicle switcher if > 1 car).
- **Siguiente paso** — a single card chosen by a pure, tested ranking function `nextStep(state)`; order: overdue legal/maintenance reminder → document expired/expiring ≤ 14 days → *no fill-up in > N days* → *odometer not updated in > 30 days* → a recap that just closed → "Detection health" problem (SPEC-H) → first-run checklist item → the person's most-used action. One card, one button, a "Más tarde" that hides it for 24 h. Never a stack of cards.
- **Acciones grandes** (max 4, ≥ 56 px tall, label = verb + object, SVG icon): **Cargar gasolina · Iniciar viaje · Registrar servicio · Más (todo lo demás)**. The first two are the app's two daily jobs. The 4th opens the full list (K3). The set adapts only if the person chooses it (K3), never silently.
- **Resumen** strip: at most 3 numbers (this month: km, spend, last fill-up efficiency) → tap opens the recap/Cifras.
- Everything else that Inicio shows today (secondary cards, feeds, community, tips) moves under **"Actividad"** (a collapsed list below, or its own screen) or into the vehicle ficha. **Inventory rule**: PROMPT-12 lists every block Inicio has today and where it went; nothing disappears without an entry.
- Empty state (new person, no car): one card, "Agrega tu carro" (with the photo/matrícula scan from SPEC-C if enabled), nothing else.

## K2. Navigation by task, not by feature
- Target **≤ 5 bottom tabs** (phone) / the same five in the side rail (desktop, SPEC-F): **Hoy · Mi carro · Viajes · Resúmenes/Cifras · Más**. PROMPT-12 reads the real tab structure and keeps what already works; the rule is *names are what the person wants to do or see*, not internal module names.
- **Mi carro** = ficha of the active vehicle: Servicios y reparaciones · Documentos y recordatorios · Combustible · Modificaciones/Build · Fotos · Odómetro · Calibración (SPEC-I) · Compartir. Sections are a short list of big rows with a one-line status each ("Marbete: vence en 12 días"), not a wall of widgets.
- **Más** = the existing Herramientas hub, reorganised into 5–6 labelled groups with a search box on top (K4). "Todas las funciones" always lists everything, even what the person hid (K3).
- Remove duplicated entry points that confuse (same action reachable from 4 places with different names) — keep one canonical path + shortcuts, record the removed ones in the audit.

## K3. "What do you use Car Guy for?" — the person's own feature set (ADR-73)
- First run (and later in Ajustes → "Qué quiero ver"): multi-select cards with icons: **Gasolina y gastos · Mantenimiento y reparaciones · Documentos y recordatorios · Viajes y rutas · Mi proyecto (modificaciones, fotos) · Pista/track · Comunidad y juntes**, plus **"Todo"**. Pre-selected: Gasolina + Mantenimiento + Documentos + Viajes (the core).
- The choice sets which sections appear on Hoy, in Mi carro and as primary rows in Más. **Hidden is never deleted and never unreachable**: search, "Todas las funciones" and deep links still open any feature; opening a hidden feature offers "Mostrarlo siempre".
- Existing users: no change on update except the new IA; a one-time gentle card in "Siguiente paso" offers "¿Quieres ver solo lo que usas?" (uses `usage.ts`: pre-fills with what they have used in the last 60 days). Never silently hides anything.
- Stored with the existing preferences mechanism (local first; synced if prefs already sync — verify, do not invent a new table without need; if one is needed it goes in the schema v13 migration, additive).
- Registry: each feature in `registry.ts` gets a `group` and a `level` (`core | regular | advanced`); `advanced` features start under "Más → Avanzado" unless the person's selection includes them. Keep the registry the single source (ADR-62).

## K4. One box that answers "where do I…?"
- A persistent search/"¿Qué quieres hacer?" field at the top of **Más** (and as ⌘K / `/` on desktop). It matches the registry's keywords **and the words people use** (a synonyms list in es-DO: "gasolina/combustible/tanque/carga", "gomera/neumático/llanta", "taller/mecánico/reparación", "marbete/seguro/documentos"…), shows results as verbs ("Cargar gasolina", "Ver mis viajes"), and when AI is on (SPEC-G §G1) free sentences also work. Typing never needs exact names.
- Recents: the last 3 things the person did appear as chips when the box is empty.

## K5. Fewer fields at a time: "lo mínimo primero"
The big forms (fuel, servicio/reparación, gasto, vehículo, recordatorio) get a two-level layout:
- **Level 1 — what is required to save**, in the order a person thinks (fuel: km · galones · total/precio; servicio: qué se hizo · cuánto · fecha). Large fields, numeric keypads, sensible defaults (today's date, active vehicle, last fuel type/station, full tank = yes unless told).
- **Level 2 — "Más detalles"** collapsed (notes, shop, warranty, partial fill, photos, items table…). Remembers expanded/collapsed per form per person.
- Validation messages are human ("Ese kilometraje es menor que el último (84,300). ¿Seguro?"), never codes; one error at a time, near the field; autosave drafts so leaving a form never loses work.
- Fuel's Level 1 is superseded by **Fuel Express** (SPEC-B §B7) when AI is available; the manual form remains one tap away ("Llenarlo a mano").

## K6. First-run: three steps, not a tour
A dismissible **"Primeros pasos"** card in Hoy: ① Agrega tu carro ② Registra tu primera carga (or "Importar") ③ Activa los viajes automáticos (SPEC-H wizard; on iPhone → "Instala la app y el atajo"). Each shows done/not done from real data; disappears when complete or dismissed. No modal carousels, no coach-mark tour. Every empty screen elsewhere has **one sentence + one button** and an example of what will appear.

## K7. Density, wording and look
- Page rules: **max one primary button per screen**; max ~7 rows before grouping/collapsing; section headers sentence-case, ≤ 3 words; secondary actions in an overflow, not as equal-weight buttons.
- Language: plain es-DO, verbs first, no module names or acronyms (OBD → "Códigos del motor (OBD)" once, then "Códigos"); a **glossary pass** over all es strings in the touched screens; matching en strings.
- Touch targets ≥ 48 px (≥ 56 px for the big actions); type scale: one display, one title, one body, one caption; spacing from the existing tokens; no new colours.
- Icons SVG only (ADR/AW12-style rule in house CLAUDE: no emoji icons).
- Progressive disclosure widgets: `Collapsible` section (animated with motion tokens, remembers state), `StatusRow` (label + one-line status + chevron), `NextStepCard`, `BigAction`. Built once in `components/ui`, used everywhere; the desktop layout reuses them.

## K8. Prove it with people, not opinion
- **Cold-start test** (manual checklist): give a phone with a fresh install to 3 people who do not know the app (friends/family) and ask them to do 5 tasks (add a car, log a fill-up, start a trip, see this month's spend, set a marbete reminder) while silent; record time, wrong taps, quotes. Target: all 5 tasks without help in < 3 min each. Findings go to `docs/imp-03112026/ux-findings.md`; any task that fails becomes a defect fixed in the same round if cheap, else listed.
- Automated: Playwright task scripts (the 15 tasks) assert the tap counts from K0; a test asserts ≤ 4 big actions and ≤ 1 `NextStepCard` on Hoy; `nextStep()` is unit-tested with a table of states.
- Local-only usage events (`usage.ts`) to see after a month which actions are used; nothing leaves the device.

## K9. Acceptance
Audit before/after table shows fewer visible elements on Inicio and every listed task within its tap target; Hoy has one next-step card and ≤ 4 big actions; nothing that existed is unreachable (the inventory in the audit has a destination for every old block and the "Todas las funciones" list equals the registry); feature selection works and reverses; forms show the minimum first; es/en strings reviewed; a11y checks pass (focus order, labels, contrast, targets); phone layout re-verified and desktop (SPEC-F) uses the same IA; the cold-start test is run by Xaviel (manual item) and the result recorded.
