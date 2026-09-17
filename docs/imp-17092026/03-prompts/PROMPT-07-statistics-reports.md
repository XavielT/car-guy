# PROMPT 07 — Statistics (Cifras), charts, PDF vehicle report, CSV export

**Depends on:** Phase 6 · **Branch:** `imp-17092026/phase-7-cifras` · **ADRs:** 11, 04
**Goal:** G6 — note 9 "con estadísticas y todo", note 8 (history as a shareable report).

> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 7 of IMP 17092026: rebuild Cifras with real statistics and charts, add the PDF vehicle report
and CSV export.

Read first:
- CLAUDE.md → AGENTS.md; Expo 57 docs for expo-print (web limits!) and expo-sharing.
- docs/imp-17092026/02-specs/01-data-model.md §3.8 (stats functions)
- docs/imp-17092026/02-specs/03-screens-ia.md (Cifras tab, reporte.tsx)
- docs/imp-17092026/00-context/05-design-identity.md (category colours, mono numbers)
- docs/imp-17092026/01-research/03-expo57-technical.md §4 (charts), §6 (expo-print)
- docs/imp-17092026/01-research/01-competitive-analysis.md §2.5 (dashboards), §3.5

Branch: imp-17092026/phase-7-cifras

Requirements:

1. DOMAIN — lib/domain/stats.ts (pure, tested in __tests__/domain/stats.test.ts):
   monthlySpendByCategory(rows, months), costPerKm(fuel, services, expenses, readings, range),
   spendByCategory(range), distancePerMonth(readings), totalCostOfOwnership(vehicle, spend),
   economySeries (reuse computeEconomy), upcomingCosts(tasks, reminders with last cost),
   periodRanges(today) for Mes · 3 meses · Año · Todo. Categories: combustible, mantenimiento,
   reparacion, mejora, seguro/legal (seguro+marbete+impuesto+multa), otros.

2. CHARTS (ADR-11): npx expo install react-native-gifted-charts react-native-svg expo-linear-gradient.
   components/charts/: StackedBars (gasto mensual por categoría), Line (rendimiento km/gal por tanque
   with the average as a dashed reference), Donut (gasto por categoría with legend + amounts),
   Bars (km por mes). Theme-aware (tokens), category colours, mono value labels, empty states.
   Verify each renders on web (static export) and Android.

3. CIFRAS SCREEN (app/(tabs)/cifras.tsx): period segmented; KPI tiles (gasto total, RD$/km, km
   recorridos, rendimiento medio + delta vs previous period "↓ 12 %"); charts; TCO card when
   purchase_price exists (compra − venta + gastos; "costo por mes de propiedad"); "Próximos gastos
   estimados" (upcomingCosts); buttons "Reporte PDF" and "Exportar CSV". Tap a KPI → the matching
   chart scrolls into view. Keep the existing insight card logic.

4. PDF REPORT (app/reporte.tsx + lib/report/html.ts): HTML template (inline CSS, dark-on-white for
   print) with: vehicle header (photo as base64 on native; omitted on web if not loadable), KPIs
   for the period, upcoming reminders, full history table for the period (date, kind, title, km,
   RD$), economy summary, footer "Generado con Car Guy". Android: expo-print printToFileAsync →
   expo-sharing shareAsync(mimeType application/pdf). Web: expo-print printToFileAsync does not
   return a file — render the HTML in a hidden iframe / new tab route and call window.print()
   (state this in the UI: "Guardar como PDF desde el diálogo de impresión"). Period selector on the
   screen; preview of the HTML in a WebView-free way (RN-web: dangerouslySetInnerHTML via a
   platform file; native: expo-print's printAsync preview or just the share action + a text summary).

5. CSV EXPORT (lib/export/csv.ts): one CSV per table or a ZIP? Keep it simple: a single "Historial"
   CSV (feed rows with extra columns) + "Combustible" CSV (all fuel columns incl. km/gal) for the
   period, UTF-8 with BOM (Excel es-DO opens accents correctly), `;` separator? No — use `,` and
   quote fields; document. Share on Android, download on web.

6. VERIFY with a realistic dataset (import the sample fixture + add records): numbers cross-checked
   by hand for one month (write the expected values in the test); charts on web + Android; PDF
   shared from Android (Expo Go) and printed from web; CSV opens in LibreOffice/Excel. Screenshots
   docs/qa/phase-7-*. tsc/lint/test/build green. Report, merge, push.
```

---

## Acceptance criteria

- [ ] `lib/domain/stats.ts` with tests (hand-verified expected values for a fixture month).
- [ ] Four chart components, theme-aware, working on web static export and Android.
- [ ] Cifras: period selector, KPIs with deltas, charts, TCO, upcoming costs, report/CSV actions.
- [ ] PDF report shared on Android; print dialog on web; content per spec.
- [ ] CSV export (Historial + Combustible) with BOM; opens correctly.
- [ ] lint/tsc/test/build green; fuel flow verified.

## Watch for

- gifted-charts needs `expo-linear-gradient` as a peer; install it via `npx expo install`.
- Large datasets: aggregate in SQL (`strftime('%Y-%m', occurred_at)`) rather than in JS where cheap.
- `expo-print` on iOS/Android cannot load local file URLs in HTML — embed the photo as base64.
- Do not add Skia or victory-native.
