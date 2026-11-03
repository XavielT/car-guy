# PROMPT-03 — Vehicle documents and onboarding (answer: "vehicle documents")

Claude Code, Car Guy repo, branch `imp-03112026`. Read `BRIEF.md`, ADR-66/67, **SPEC-C**, and the `cg-ai-read` registry from PROMPT-02. Nothing waits; log defaults.

## Steps
1. Add kinds `doc_matricula`, `doc_seguro`, `doc_marbete`, `doc_licencia`, `doc_revision`, `doc_garantia` (+ a first classification pass so the person need not choose the kind) and `vin_plate` to `cg-ai-read`. **Privacy contract in the system prompt and in a server-side post-filter**: never return cédula, address, owner name; only plate, VIN, vehicle description, dates, insurer, policy number, coverage. Fixture with a cédula must not come back.
2. `documento/nuevo`: "Scan document" (photo, gallery, **PDF first page → image** with the existing PDF tooling). Pre-fill kind/title/`issuedAt`/`expiresAt`/notes; keep the existing save → reminder link (`documentOps` `result.linked`) untouched. Add the **wrong-car guard** (plate/VIN mismatch → switch vehicle or save anyway).
3. `vehiculo/nuevo` + `[id]/editar`: "Scan matrícula" and "Scan VIN" prefill make/model/year/colour/plate/VIN/engine/fuel/seats; then `lib/domain/vpic.ts` enrichment; show conflicts (VPIC wins specs, document wins plate/colour). Door-jamb/cap/tire-sidewall `part_label` feeds Ficha facts, Fluidos and `oilInterval`. Use `SelectField` (ADR-60) for every choice field.
4. C3: "Create reminder" suggestion for a document with an expiry and no reminder (pure function in `lib/domain/` with tests).
5. Extend the ADR-63 round-trip test with all new prefilled vehicle/document fields; unit tests for the mismatch guard and VPIC-vs-document merge; evals `evals/ai/documents.json` (synthetic Dominican matrícula, seguro, marbete, licencia layouts + README for real photos).
6. Deploy updated `cg-ai-read`; log. es/en strings; verify with Playwright (mobile + desktop viewports). Green checks. Commit.

## Acceptance
SPEC-C §C4 exactly.

## Final report
Accuracy per document kind, what the privacy filter removed in the fixtures, how VPIC conflicts were resolved, anything needing real documents from Xaviel.
