import type { EconomyPoint } from '../types';
import type { VehicleStats } from '../db/statsQueries';
import type { HistoryEntry } from '../db/types';
import { dateLabel, km, money } from '../format';
import { es } from '../i18n/es';
import { historyKindLabel, historyTitle } from '../domain/history';

/**
 * The vehicle report as a self-contained HTML string.
 *
 * Dark-on-white, not the app's palette: this is printed or saved as a PDF, and
 * "Tablero nocturno" on paper is a page of toner and an unreadable photocopy.
 * The identity survives in the type and the accent rule, not in the background.
 *
 * All CSS is inline in one `<style>` block and there are no external requests —
 * `expo-print` renders the string in an offline WebView on Android, so a linked
 * font or a remote image would simply not arrive.
 */

export type ReportInput = {
  stats: VehicleStats;
  /** The period's rows, newest first, already filtered by the caller. */
  history: HistoryEntry[];
  economy: EconomyPoint[];
  /**
   * The vehicle photo as a `data:` URI. Android's WebView cannot load a
   * `file://` asset from printed HTML, so the caller reads and encodes it;
   * omitted on web, where the same photo lives behind an object URL that the
   * print view would lose anyway.
   */
  photoDataUri?: string | null;
  generatedAt: string;
};

const ACCENT = '#CF4C00';
const INK = '#121212';
const SOFT = '#5A5A5A';
const LINE = '#E2E2E5';

export function reportHtml(input: ReportInput): string {
  const { stats, history, economy, photoDataUri, generatedAt } = input;
  const { vehicle, kpis, byCategory, ownership, upcoming, period } = stats;

  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
  const average = economy.length
    ? economy.reduce((sum, point) => sum + point.kmPerUnit, 0) / economy.length
    : null;

  return `<!DOCTYPE html>
<html lang="es-DO">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(es.report.documentTitle(vehicle.name))}</title>
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: ${INK};
    font-size: 11pt;
    line-height: 1.45;
  }
  .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
  header { display: flex; gap: 16px; align-items: flex-start; border-bottom: 2px solid ${INK}; padding-bottom: 12px; }
  header img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; }
  h1 { font-size: 20pt; margin: 0; letter-spacing: -0.3px; }
  h2 { font-size: 12pt; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; color: ${SOFT}; }
  .sub { color: ${SOFT}; margin: 2px 0 0; font-size: 10pt; }
  .eyebrow { color: ${ACCENT}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .kpi { flex: 1 1 130px; border: 1px solid ${LINE}; border-radius: 8px; padding: 10px 12px; }
  .kpi .label { color: ${SOFT}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; }
  .kpi .value { font-size: 15pt; font-weight: 700; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: ${SOFT}; border-bottom: 1px solid ${INK}; padding: 5px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid ${LINE}; font-size: 10pt; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr { page-break-inside: avoid; }
  .bartrack { width: 34%; }
  .bartrack > span { display: block; height: 7px; border-radius: 4px; background: ${LINE}; }
  .bar { height: 7px; border-radius: 4px; background: ${ACCENT}; display: block; }
  .muted { color: ${SOFT}; }
  footer { margin-top: 26px; border-top: 1px solid ${LINE}; padding-top: 8px; color: ${SOFT}; font-size: 8.5pt; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<header>
  ${photoDataUri ? `<img src="${photoDataUri}" alt="" />` : ''}
  <div style="flex:1">
    <div class="eyebrow">${escape(es.app.name)}</div>
    <h1>${escape(vehicle.name)}</h1>
    <p class="sub">${escape([subtitle, vehicle.plate].filter(Boolean).join(' · ') || '—')}</p>
  </div>
  <div style="text-align:right">
    <div class="eyebrow">${escape(es.report.period)}</div>
    <div class="mono" style="font-size:10pt">${escape(periodLabel(period))}</div>
  </div>
</header>

<div class="kpis">
  ${kpi(es.stats.spend, money(kpis.spend))}
  ${kpi(es.stats.distance, kpis.distanceKm > 0 ? km(kpis.distanceKm) : '—')}
  ${kpi(es.stats.costPerKm, kpis.costPerKm != null ? money(kpis.costPerKm) : '—')}
  ${kpi(es.stats.economy, average != null ? `${average.toFixed(2)} km/gal` : '—')}
</div>

<h2>${escape(es.stats.byCategory)}</h2>
${
  byCategory.length
    ? `<table>
  <tbody>
    ${byCategory
      .map(
        (entry) => `<tr>
      <td style="width:38%">${escape(es.stats.categories[entry.category])}</td>
      <td class="bartrack"><span><span class="bar" style="width:${Math.max(2, Math.round(entry.share * 100))}%"></span></span></td>
      <td class="num mono">${escape(money(entry.total))}</td>
      <td class="num muted">${Math.round(entry.share * 100)} %</td>
    </tr>`,
      )
      .join('\n')}
  </tbody>
</table>`
    : `<p class="muted">${escape(es.stats.byCategoryEmpty)}</p>`
}

${
  ownership
    ? `<h2>${escape(es.stats.ownership)}</h2>
<table>
  <tbody>
    <tr><td>${escape(es.stats.ownershipPurchase)}</td><td class="num mono">${escape(money(ownership.purchasePrice))}</td></tr>
    ${ownership.soldPrice != null ? `<tr><td>${escape(es.stats.ownershipSold)}</td><td class="num mono">− ${escape(money(ownership.soldPrice))}</td></tr>` : ''}
    <tr><td>${escape(es.stats.ownershipSpend)}</td><td class="num mono">${escape(money(ownership.spend))}</td></tr>
    <tr><td><strong>${escape(es.stats.ownershipTotal)}</strong></td><td class="num mono"><strong>${escape(money(ownership.total))}</strong></td></tr>
    ${
      ownership.costPerMonth != null
        ? `<tr><td class="muted">${escape(es.stats.ownershipPerMonth)} · ${escape(es.stats.ownershipMonths(ownership.monthsOwned))}</td><td class="num mono muted">${escape(money(ownership.costPerMonth))}</td></tr>`
        : ''
    }
  </tbody>
</table>`
    : ''
}

${
  upcoming.items.length
    ? `<h2>${escape(es.stats.upcoming)}</h2>
<table>
  <tbody>
    ${upcoming.items
      .map(
        (item) => `<tr>
      <td>${escape(item.title)}<div class="muted" style="font-size:8.5pt">${escape(es.stats.upcomingBasis[item.basis])}</div></td>
      <td class="num mono">${escape(money(item.amountDop))}</td>
    </tr>`,
      )
      .join('\n')}
    <tr><td><strong>${escape(es.stats.total)}</strong></td><td class="num mono"><strong>${escape(money(upcoming.total))}</strong></td></tr>
  </tbody>
</table>`
    : ''
}

<h2>${escape(es.report.historyTitle)}</h2>
${
  history.length
    ? `<table>
  <thead>
    <tr>
      <th style="width:14%">${escape(es.report.columns.date)}</th>
      <th style="width:16%">${escape(es.report.columns.kind)}</th>
      <th>${escape(es.report.columns.title)}</th>
      <th class="num" style="width:14%">${escape(es.report.columns.odometer)}</th>
      <th class="num" style="width:16%">${escape(es.report.columns.amount)}</th>
    </tr>
  </thead>
  <tbody>
    ${history
      .map(
        (row) => `<tr>
      <td class="mono">${escape(dateLabel(row.occurredAt))}</td>
      <td>${escape(historyKindLabel(row.kind))}</td>
      <td>${escape(historyTitle(row))}${row.subtitle ? `<span class="muted"> · ${escape(row.subtitle)}</span>` : ''}</td>
      <td class="num mono">${row.odometerKm != null ? escape(km(row.odometerKm)) : ''}</td>
      <td class="num mono">${row.amountDop != null ? escape(money(row.amountDop)) : ''}</td>
    </tr>`,
      )
      .join('\n')}
  </tbody>
</table>`
    : `<p class="muted">${escape(es.report.historyEmpty)}</p>`
}

${
  economy.length
    ? `<h2>${escape(es.stats.economyTitle)}</h2>
<p class="mono">${escape(
        es.report.economySummary(
          economy.length,
          average != null ? average.toFixed(2) : '—',
          Math.min(...economy.map((p) => p.kmPerUnit)).toFixed(2),
          Math.max(...economy.map((p) => p.kmPerUnit)).toFixed(2),
        ),
      )}</p>`
    : ''
}

<footer>
  <span>${escape(es.report.footer)}</span>
  <span class="mono">${escape(dateLabel(generatedAt))}</span>
</footer>

</body>
</html>`;
}

function kpi(label: string, value: string): string {
  return `<div class="kpi"><div class="label">${escape(label)}</div><div class="value mono">${escape(value)}</div></div>`;
}

function periodLabel(period: VehicleStats['period']): string {
  if (period.from == null) return es.stats.periods.todo;
  return `${dateLabel(period.from)} — ${dateLabel(period.to)}`;
}


/**
 * Every interpolated value passes through here.
 *
 * A vehicle called `<script>` or a shop name with an ampersand is not an attack
 * — it is a Tuesday — but it would still break the document, and the same
 * escaping keeps a pasted note from rewriting the page in the print WebView.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
