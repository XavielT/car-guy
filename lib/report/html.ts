import { economyLabel } from '../fuel';
import type { EconomyPoint } from '../types';
import type { VehicleStats } from '../db/statsQueries';
import type { HistoryEntry } from '../db/types';
import { dateLabel, km, money } from '../format';
import { t } from '../i18n';
import { historyKindLabel, historyTitle } from '../domain/history';
import { COST_CATEGORIES, type OwnershipCost } from '../domain/costs';

/**
 * The vehicle report as a self-contained HTML string.
 *
 * "Cluster JDM 90s" (05-design-jdm.md) only where it costs no toner: a dark
 * header band like the instrument panel — Saira Condensed title, amber
 * eyebrow, Type R-style badges for the engine and chassis codes, a 4 px amber
 * rule under it — and then text pages that stay dark-on-white, printable and
 * photocopiable. Numbers stay in a mono face.
 *
 * All CSS is inline in one `<style>` block and there are no external requests —
 * `expo-print` renders the string in an offline WebView on Android, so a linked
 * font or a remote image would simply not arrive. The identity faces are named
 * first in each stack (they are used when the device has them) and fall back
 * to condensed/system faces otherwise.
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

/** Amber as ink on white (the light token `accent`, 4.5:1+). */
const ACCENT = '#8F5A00';
/** Amber as a fill / as text on the dark band (the dark token). */
const AMBER = '#FFB300';
const PANEL = '#121212';
const PANEL_TEXT = '#EDEDED';
const PANEL_SOFT = '#B3B3B3';
const REDLINE = '#E10600';
const INK = '#121212';
const SOFT = '#4A4A4A';
const LINE = '#E2E2E5';

const DISPLAY = `"Saira Condensed", "SairaCondensed_800ExtraBold", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif`;
const BODY = `"Rajdhani", "Rajdhani_500Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const MONO = `"JetBrains Mono", "JetBrainsMono_500Medium", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`;
const BADGE = `"Michroma", "Michroma_400Regular", "Arial Black", Arial, sans-serif`;

export function reportHtml(input: ReportInput): string {
  const { stats, history, economy, photoDataUri, generatedAt } = input;
  const { vehicle, kpis, byCategory, ownership, upcoming, period } = stats;

  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
  // Derived badges, one red max (05-design-jdm.md §5): the engine code, then the chassis code in outline.
  const badges = [
    vehicle.engineCode ? `<span class="badge">${escape(vehicle.engineCode)}</span>` : '',
    vehicle.chassisCode ? `<span class="badge outline">${escape(vehicle.chassisCode)}</span>` : '',
  ].join('');
  const average = economy.length
    ? economy.reduce((sum, point) => sum + point.kmPerUnit, 0) / economy.length
    : null;
  // The economy comes from the store's fill-ups, already in the vehicle's unit (v6).
  const economyUnit = economyLabel(vehicle.defaultFuelType, vehicle.volumeUnit ?? 'gal');

  return `<!DOCTYPE html>
<html lang="es-DO">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(t.report.documentTitle(vehicle.name))}</title>
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: ${BODY};
    color: ${INK};
    font-size: 11pt;
    line-height: 1.45;
  }
  .mono { font-family: ${MONO}; }
  /* The instrument panel: the only dark block, so the rest prints on white. */
  header {
    display: flex; gap: 16px; align-items: center;
    background: ${PANEL}; color: ${PANEL_TEXT};
    border-radius: 10px; padding: 14px 16px 16px;
    border-bottom: 4px solid ${AMBER};
  }
  header img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid #2A2A2A; }
  header .eyebrow { color: ${AMBER}; }
  header .sub { color: ${PANEL_SOFT}; }
  h1 {
    font-family: ${DISPLAY}; font-weight: 800; font-size: 24pt; line-height: 1.02;
    margin: 2px 0 0; text-transform: uppercase; letter-spacing: 0.01em; color: ${PANEL_TEXT};
  }
  h2 {
    font-family: ${DISPLAY}; font-weight: 600; font-size: 12pt; margin: 22px 0 8px;
    text-transform: uppercase; letter-spacing: 0.12em; color: ${INK};
    border-left: 3px solid ${AMBER}; padding-left: 8px;
  }
  .sub { color: ${SOFT}; margin: 2px 0 0; font-size: 10pt; }
  .eyebrow {
    font-family: ${DISPLAY}; color: ${ACCENT}; font-size: 8.5pt;
    text-transform: uppercase; letter-spacing: 0.16em; font-weight: 400;
  }
  .brand { font-family: ${BADGE}; letter-spacing: 0.12em; }
  .badges { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
  .badge {
    display: inline-block; font-family: ${BADGE}; font-size: 7.5pt; line-height: 1;
    text-transform: uppercase; letter-spacing: 0.12em; color: #FFFFFF;
    background: ${REDLINE}; border: 1px solid rgba(255, 77, 69, 0.4); border-radius: 3px; padding: 4px 6px;
  }
  .badge.outline { background: transparent; color: ${PANEL_SOFT}; border-color: #3F3F3F; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .kpi { flex: 1 1 130px; border: 1px solid ${LINE}; border-radius: 8px; padding: 10px 12px; }
  .kpi .label {
    font-family: ${DISPLAY}; color: ${SOFT}; font-size: 8.5pt;
    text-transform: uppercase; letter-spacing: 0.16em;
  }
  .kpi .value { font-size: 15pt; font-weight: 700; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-family: ${DISPLAY}; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: ${SOFT}; border-bottom: 1px solid ${INK}; padding: 5px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid ${LINE}; font-size: 10pt; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr { page-break-inside: avoid; }
  .bartrack { width: 34%; }
  .bartrack > span { display: block; height: 7px; border-radius: 4px; background: ${LINE}; }
  .bar { height: 7px; border-radius: 4px; background: ${AMBER}; display: block; }
  .muted { color: ${SOFT}; }
  footer { margin-top: 26px; border-top: 1px solid ${LINE}; padding-top: 8px; color: ${SOFT}; font-size: 8.5pt; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<header>
  ${photoDataUri ? `<img src="${photoDataUri}" alt="" />` : ''}
  <div style="flex:1">
    <div class="eyebrow brand">${escape(t.app.name)}</div>
    <h1>${escape(vehicle.name)}</h1>
    <p class="sub">${escape([subtitle, vehicle.plate].filter(Boolean).join(' · ') || '—')}</p>
    ${badges ? `<div class="badges">${badges}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="eyebrow">${escape(t.report.period)}</div>
    <div class="mono" style="font-size:10pt">${escape(periodLabel(period))}</div>
  </div>
</header>

<div class="kpis">
  ${kpi(t.stats.spend, money(kpis.spend))}
  ${kpi(t.stats.distance, kpis.distanceKm > 0 ? km(kpis.distanceKm) : '—')}
  ${kpi(t.stats.costPerKm, kpis.costPerKm != null ? money(kpis.costPerKm) : '—')}
  ${kpi(t.stats.economy, average != null ? `${average.toFixed(2)} ${economyUnit}` : '—')}
</div>

<h2>${escape(t.stats.byCategory)}</h2>
${
  byCategory.length
    ? `<table>
  <tbody>
    ${byCategory
      .map(
        (entry) => `<tr>
      <td style="width:38%">${escape(t.stats.categories[entry.category])}</td>
      <td class="bartrack"><span><span class="bar" style="width:${Math.max(2, Math.round(entry.share * 100))}%"></span></span></td>
      <td class="num mono">${escape(money(entry.total))}</td>
      <td class="num muted">${Math.round(entry.share * 100)} %</td>
    </tr>`,
      )
      .join('\n')}
  </tbody>
</table>`
    : `<p class="muted">${escape(t.stats.byCategoryEmpty)}</p>`
}

${ownership ? costsBlock(ownership) : ''}

${
  upcoming.items.length
    ? `<h2>${escape(t.stats.upcoming)}</h2>
<table>
  <tbody>
    ${upcoming.items
      .map(
        (item) => `<tr>
      <td>${escape(item.title)}<div class="muted" style="font-size:8.5pt">${escape(t.stats.upcomingBasis[item.basis])}</div></td>
      <td class="num mono">${escape(money(item.amountDop))}</td>
    </tr>`,
      )
      .join('\n')}
    <tr><td><strong>${escape(t.stats.total)}</strong></td><td class="num mono"><strong>${escape(money(upcoming.total))}</strong></td></tr>
  </tbody>
</table>`
    : ''
}

<h2>${escape(t.report.historyTitle)}</h2>
${
  history.length
    ? `<table>
  <thead>
    <tr>
      <th style="width:14%">${escape(t.report.columns.date)}</th>
      <th style="width:16%">${escape(t.report.columns.kind)}</th>
      <th>${escape(t.report.columns.title)}</th>
      <th class="num" style="width:14%">${escape(t.report.columns.odometer)}</th>
      <th class="num" style="width:16%">${escape(t.report.columns.amount)}</th>
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
    : `<p class="muted">${escape(t.report.historyEmpty)}</p>`
}

${
  economy.length
    ? `<h2>${escape(t.stats.economyTitle)}</h2>
<p class="mono">${escape(
        t.report.economySummary(
          economy.length,
          average != null ? average.toFixed(2) : '—',
          Math.min(...economy.map((p) => p.kmPerUnit)).toFixed(2),
          Math.max(...economy.map((p) => p.kmPerUnit)).toFixed(2),
          economyUnit,
        ),
      )}</p>`
    : ''
}

<footer>
  <span>${escape(t.report.footer)}</span>
  <span class="mono">${escape(dateLabel(generatedAt))}</span>
</footer>

</body>
</html>`;
}

/**
 * "Lo que me ha costado" (IMP 29092026 note 8): the same figure and rows as the
 * Cifras card, from `ownershipCost`.
 */
function costsBlock(cost: OwnershipCost): string {
  const row = (label: string, value: string, strong = false) =>
    strong
      ? `<tr><td><strong>${escape(label)}</strong></td><td class="num mono"><strong>${escape(value)}</strong></td></tr>`
      : `<tr><td>${escape(label)}</td><td class="num mono">${escape(value)}</td></tr>`;
  const since = cost.since
    ? cost.sinceBasis === 'compra'
      ? t.costs.since(dateLabel(cost.since))
      : t.costs.sinceFirst(dateLabel(cost.since))
    : null;
  return `<h2>${escape(t.costs.title)}</h2>
<table>
  <tbody>
    ${cost.purchasePrice != null ? row(t.costs.purchase, money(cost.purchasePrice)) : `<tr><td colspan="2" class="muted">${escape(t.costs.noPurchase)}</td></tr>`}
    ${cost.soldPrice != null ? row(t.costs.sold, `− ${money(cost.soldPrice)}`) : ''}
    ${COST_CATEGORIES.map((key) => row(t.costs.categories[key], money(cost.byCategory[key]))).join('\n    ')}
    ${cost.modsSold > 0 ? `<tr><td colspan="2" class="muted">${escape(t.costs.modsSold(money(cost.modsSold)))}</td></tr>` : ''}
    ${row(t.costs.total, money(cost.total), true)}
    ${row(t.costs.perKm, cost.perKm != null ? money(cost.perKm) : '—')}
    ${
      cost.costPerMonth != null
        ? `<tr><td class="muted">${escape(t.stats.ownershipPerMonth)} · ${escape(t.stats.ownershipMonths(cost.monthsOwned))}</td><td class="num mono muted">${escape(money(cost.costPerMonth))}</td></tr>`
        : ''
    }
    ${since ? `<tr><td colspan="2" class="muted">${escape(since)}</td></tr>` : ''}
  </tbody>
</table>`;
}

function kpi(label: string, value: string): string {
  return `<div class="kpi"><div class="label">${escape(label)}</div><div class="value mono">${escape(value)}</div></div>`;
}

function periodLabel(period: VehicleStats['period']): string {
  if (period.from == null) return t.stats.periods.todo;
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
