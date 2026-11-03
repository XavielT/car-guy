# PROMPT-06 — Other workflows where AI helps (answer: "anywhere else it improves the workflows")

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, ADR-66/67/69, **SPEC-G**, `docs/imp-03112026/ai-workflow-map.md` and `google-terms-verdict.md`. Nothing waits; log defaults. Each item has its own `FEATURE_*` flag (SPEC-G) and an off-switch in Admin → Uso y costos.

## Steps (G-numbers = SPEC-G sections; every item below is in scope, none optional)
1. **G1 Smart search / quick add** in Herramientas: non-keyword text or mic → `cg-ai-intent` → navigate with filters (closed targets) or pre-filled form; "how much/how many" answers come from existing stats queries as a result card (number + link), never from the model. Tests with 30 es-DO phrases.
2. **G4 Places**: `cg-places` (Places API New text search) per ADR-69 and the verdict file: list UI with attribution, "Open in Google Maps", "Add as contact" pre-filling `contactos/nuevo`, shop suggestion after a repair; location rounded to ~500 m; per-user daily limit from `app_config`; nothing drawn on MapLibre; caching exactly as the terms allow. If the verdict says no: leave `FEATURE_GOOGLE_PLACES=false`, implement the documented alternative (MapTiler geocoding or Overpass) behind the same UI, and say so.
3. **G2 Album/build photo understanding**: batch caption/angle/"change since last photo" suggestions as Milestone/Mod suggestions; ≤ 12 photos per import, 768 px, one call per batch; shipped enabled, each person opts in on first use with a plain consent line about volume and cost; Mod entry from a part-box/invoice photo via the existing `part_label`/`invoice` kinds (Wishlist → Installed link, Inventory).
4. **G5 Fuel price assist**: receipt-derived station/price offered as a `recibo` `FuelPrice` source with the person's OK; deterministic "paid RD$ X vs MICM reference" line.
5. **G6 Checklist photos**: `check_photo` kind for `chequeo` items; suggestion pass/watch/fail the person accepts or overrides; hedged language; existing `OnFail` creates the task/reminder.
6. **G7 Accident events**: damage photos → description + `EventSeverity` suggestion + deterministic document checklist; no claim or liability advice.
7. **G9 Sale-ready summary** in `vehiculo/[id]/libro`: facts JSON → prose via `cg-ai-insights`-style number validation, editable, es/en export; also in the printed Libro.
8. **G3 and G8** are *deliberate non-features*: confirm in code that trips use only deterministic summaries and that Juntes/profiles/community have no AI hook; write the "considered / rejected" notes into the ADR file.
9. Tests, evals where a model is involved (`evals/ai/*.json`), unit tests for deterministic parts, Admin switches. Deploy `cg-places`, updated functions; log. es/en strings. Playwright mobile + desktop checks. Green checks. Commit.

## Acceptance
SPEC-G §G10; Google attribution visible and no Google data on any map; each flag works on/off.

## Final report
Per item: shipped / flag default / eval result; Places verdict applied; observed volume-driven cost of the album batch; anything you rejected and why.
