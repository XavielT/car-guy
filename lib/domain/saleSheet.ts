/**
 * The sale-ready summary (IMP 03112026 SPEC-G §G9). Pure, no AI, no imports of app state.
 *
 *  - `buildSaleFacts` turns the dossier the Libro already builds (so the SAME share switches apply: plate, VIN, costs, odometer
 *    are absent from the facts unless the owner turned them on) plus the documents into a short list of facts.
 *  - `templateSale` writes a complete, factual one-page text from those facts, es or en. This is the whole feature without AI.
 *  - `mergeSale` lets the model's paragraphs replace a template paragraph only when the server returned that section (it
 *    re-checked every number against the facts), and keeps the template everywhere else.
 *
 * What the sheet never contains: plate, VIN, owner name, nickname, events (accidents are private records, ADR-44), a price or
 * valuation, or any statement of condition. The owner edits the text before exporting; the screen reminds them that a buyer may
 * ask about accidents.
 */
import type { SaleFact, SaleSection, SaleText } from '../../supabase/functions/cg-ai-sale/sale';
import type { RawDossier } from '../share/dossier';

export type { SaleFact, SaleSection, SaleText };
export type Lang = 'es' | 'en';
export type SaleDoc = { title: string; kind: string; issuedAt: string | null; expiresAt: string | null };

export const SECTION_ORDER: SaleSection[] = ['resumen', 'mantenimiento', 'reparaciones', 'modificaciones', 'documentos'];
export const LIMITS = { repairs: 6, mods: 8 };

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
const label = (...parts: (string | number | null | undefined)[]) => parts.filter((p) => p != null && String(p).trim() !== '').join(' ');

/** "2019 Toyota Corolla": the car's name for the buyer. Never the nickname or the plate. */
export function carLabel(v: Pick<RawDossier['vehicle'], 'make' | 'model' | 'year' | 'name'>): string {
  return label(v.year, v.make, v.model) || v.name;
}

export function buildSaleFacts(raw: RawDossier, docs: readonly SaleDoc[] | null, today: string): SaleFact[] {
  const facts: SaleFact[] = [];
  const v = raw.vehicle;
  const car: SaleFact['data'] = {};
  if (v.year) car.year = v.year;
  if (v.make) car.make = v.make;
  if (v.model) car.model = v.model;
  if (v.trim) car.trim = v.trim;
  if (v.transmission) car.transmission = v.transmission;
  if (raw.show.odometer && raw.odometer_km != null) car.odometerKm = Math.round(raw.odometer_km);
  facts.push({ id: 'carro', section: 'carro', data: car });

  const services = raw.services ?? [];
  const maint = services.filter((s) => s.kind === 'mantenimiento');
  if (raw.show.maintenance && maint.length) {
    const last = maint[0]!; // the dossier orders newest first
    const data: SaleFact['data'] = { count: maint.length, lastTitle: last.title, lastDate: day(last.occurred_at) };
    if (last.odometer_km != null) data.lastKm = Math.round(last.odometer_km);
    const total = maint.reduce((t, s) => t + (s.total_dop ?? 0), 0);
    if (raw.show.costs && total > 0) data.totalDop = Math.round(total);
    const first = maint[maint.length - 1]!;
    if (maint.length > 1) data.since = day(first.occurred_at);
    facts.push({ id: 'mant', section: 'mantenimiento', data });
  }

  const repairs = services.filter((s) => s.kind === 'reparacion');
  if (raw.show.maintenance && repairs.length) {
    facts.push({ id: 'rep', section: 'reparaciones', data: { count: repairs.length } });
    repairs.slice(0, LIMITS.repairs).forEach((s, i) => {
      const data: SaleFact['data'] = { title: s.title, date: day(s.occurred_at) };
      if (s.odometer_km != null) data.km = Math.round(s.odometer_km);
      if (s.total_dop != null && s.total_dop > 0) data.costDop = Math.round(s.total_dop);
      if (s.warranty_until_date && s.warranty_until_date >= today) data.warrantyUntil = day(s.warranty_until_date);
      facts.push({ id: `rep-${i + 1}`, section: 'reparaciones', data });
    });
  }

  const mods = (raw.mods ?? []).filter((m) => m.status === 'instalado' && !m.removed_at);
  if (raw.show.mods && mods.length) {
    facts.push({ id: 'mods', section: 'modificaciones', data: { count: mods.length } });
    mods.slice(0, LIMITS.mods).forEach((m, i) => {
      const data: SaleFact['data'] = { name: m.name };
      if (m.brand) data.brand = m.brand;
      if (m.installed_at) data.installedYear = Number(m.installed_at.slice(0, 4));
      facts.push({ id: `mod-${i + 1}`, section: 'modificaciones', data });
    });
  }

  for (const d of docs ?? []) {
    if (!['seguro', 'marbete', 'matricula'].includes(d.kind) || !d.expiresAt) continue;
    const until = day(d.expiresAt)!;
    facts.push({ id: `doc-${d.kind}`, section: 'documentos', data: { kind: d.kind, validUntil: until, valid: until >= today } });
  }
  return facts;
}

// ─────────────────────────────────────────────────────────────────────────────── words
const MONTHS: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export function dateWords(iso: unknown, lang: Lang): string {
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[3])} ${MONTHS[lang][Number(m[2]) - 1]} ${m[1]}` : '';
}
const int = (n: unknown) => (typeof n === 'number' ? Math.round(n).toLocaleString('en-US') : '');
const rd = (n: unknown) => `RD$ ${int(n)}`;
const DOC: Record<Lang, Record<string, string>> = {
  es: { seguro: 'seguro', marbete: 'marbete', matricula: 'matrícula' },
  en: { seguro: 'insurance', marbete: 'marbete (annual road tax sticker)', matricula: 'registration' },
};

const T = {
  es: {
    title: (car: string) => `Hoja de venta: ${car}`,
    sections: { resumen: 'Resumen', mantenimiento: 'Mantenimiento', reparaciones: 'Reparaciones', modificaciones: 'Modificaciones', documentos: 'Documentos' } as Record<SaleSection, string>,
    car: (label: string, km: unknown) => `${label}${km != null ? `, con ${int(km)} km registrados` : ''}. Los datos de esta hoja salen de los registros del dueño en Car Guy.`,
    maint: (count: number, lastTitle: string, lastDate: string, lastKm: unknown, since: string, total: unknown) =>
      `${count === 1 ? 'Tiene 1 mantenimiento registrado' : `Tiene ${count} mantenimientos registrados${since ? ` desde ${since}` : ''}`}. El último: ${lastTitle}${lastDate ? `, el ${lastDate}` : ''}${lastKm != null ? ` a los ${int(lastKm)} km` : ''}.${total != null ? ` En total, ${rd(total)} en mantenimiento.` : ''}`,
    repCount: (n: number) => (n === 1 ? 'Tiene 1 reparación registrada.' : `Tiene ${n} reparaciones registradas.`),
    repLine: (title: string, date: string, km: unknown, cost: unknown, warranty: string) => `${title}${date ? `, ${date}` : ''}${km != null ? `, a ${int(km)} km` : ''}${cost != null ? `, ${rd(cost)}` : ''}${warranty ? `, garantía hasta ${warranty}` : ''}.`,
    modCount: (n: number) => (n === 1 ? 'Tiene 1 modificación instalada.' : `Tiene ${n} modificaciones instaladas.`),
    modLine: (name: string, brand: unknown, year: unknown) => `${name}${brand ? ` (${brand})` : ''}${year ? `, instalada en ${year}` : ''}.`,
    docValid: (what: string, until: string) => `${cap(what)}: vigente hasta ${until}.`,
    docExpired: (what: string, until: string) => `${cap(what)}: venció el ${until}.`,
  },
  en: {
    title: (car: string) => `Sale sheet: ${car}`,
    sections: { resumen: 'Summary', mantenimiento: 'Maintenance', reparaciones: 'Repairs', modificaciones: 'Modifications', documentos: 'Documents' } as Record<SaleSection, string>,
    car: (label: string, km: unknown) => `${label}${km != null ? `, with ${int(km)} km recorded` : ''}. The details in this sheet come from the owner's own records in Car Guy.`,
    maint: (count: number, lastTitle: string, lastDate: string, lastKm: unknown, since: string, total: unknown) =>
      `${count === 1 ? 'It has 1 maintenance record' : `It has ${count} maintenance records${since ? ` since ${since}` : ''}`}. The latest: ${lastTitle}${lastDate ? `, on ${lastDate}` : ''}${lastKm != null ? ` at ${int(lastKm)} km` : ''}.${total != null ? ` In total, ${rd(total)} on maintenance.` : ''}`,
    repCount: (n: number) => (n === 1 ? 'It has 1 repair on record.' : `It has ${n} repairs on record.`),
    repLine: (title: string, date: string, km: unknown, cost: unknown, warranty: string) => `${title}${date ? `, ${date}` : ''}${km != null ? `, at ${int(km)} km` : ''}${cost != null ? `, ${rd(cost)}` : ''}${warranty ? `, warranty until ${warranty}` : ''}.`,
    modCount: (n: number) => (n === 1 ? 'It has 1 modification installed.' : `It has ${n} modifications installed.`),
    modLine: (name: string, brand: unknown, year: unknown) => `${name}${brand ? ` (${brand})` : ''}${year ? `, installed in ${year}` : ''}.`,
    docValid: (what: string, until: string) => `${cap(what)}: valid until ${until}.`,
    docExpired: (what: string, until: string) => `${cap(what)}: expired on ${until}.`,
  },
} as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type SaleSheet = { lang: Lang; title: string; sections: { section: SaleSection; heading: string; text: string; source: 'template' | 'ai'; facts: string[] }[] };

/** The deterministic one-pager. A section with no facts is left out rather than filled with filler. */
export function templateSale(facts: readonly SaleFact[], lang: Lang): SaleSheet {
  const L = T[lang];
  const by = (id: string) => facts.find((f) => f.id === id);
  const car = by('carro');
  const out: SaleSheet['sections'] = [];
  const push = (section: SaleSection, text: string, ids: string[]) => text && out.push({ section, heading: L.sections[section], text, source: 'template', facts: ids });

  const carData = car?.data ?? {};
  const name = label(carData.year as number, carData.make as string, carData.model as string, carData.trim as string);
  if (car && name) push('resumen', L.car(name, carData.odometerKm ?? null), ['carro']);

  const m = by('mant');
  if (m) push('mantenimiento', L.maint(Number(m.data.count), String(m.data.lastTitle ?? ''), dateWords(m.data.lastDate, lang), m.data.lastKm ?? null, dateWords(m.data.since, lang), m.data.totalDop ?? null), ['mant']);

  const rep = by('rep');
  if (rep) {
    const rows = facts.filter((f) => /^rep-\d+$/.test(f.id));
    const lines = rows.map((f) => L.repLine(String(f.data.title), dateWords(f.data.date, lang), f.data.km ?? null, f.data.costDop ?? null, dateWords(f.data.warrantyUntil, lang)));
    push('reparaciones', [L.repCount(Number(rep.data.count)), ...lines].join(' '), ['rep', ...rows.map((f) => f.id)]);
  }

  const mods = by('mods');
  if (mods) {
    const rows = facts.filter((f) => /^mod-\d+$/.test(f.id));
    const lines = rows.map((f) => L.modLine(String(f.data.name), f.data.brand ?? null, f.data.installedYear ?? null));
    push('modificaciones', [L.modCount(Number(mods.data.count)), ...lines].join(' '), ['mods', ...rows.map((f) => f.id)]);
  }

  const docs = facts.filter((f) => f.id.startsWith('doc-'));
  if (docs.length) {
    const lines = docs.map((f) => {
      const what = DOC[lang][String(f.data.kind)] ?? String(f.data.kind);
      const until = dateWords(f.data.validUntil, lang);
      return f.data.valid ? L.docValid(what, until) : L.docExpired(what, until);
    });
    push('documentos', lines.join(' '), docs.map((f) => f.id));
  }
  return { lang, title: L.title(name || String(carData.model ?? '')), sections: out };
}

/** The model's paragraphs replace the template's only for the sections the server returned. Never adds a section the owner has no facts for. */
export function mergeSale(sheet: SaleSheet, ai: readonly SaleText[]): SaleSheet {
  return {
    ...sheet,
    sections: sheet.sections.map((s) => {
      const a = ai.find((x) => x.section === s.section);
      return a ? { ...s, text: a.text, source: 'ai' as const, facts: a.facts } : s;
    }),
  };
}

/** Plain text for the share sheet / clipboard / the PDF page: heading, then paragraph, blank line between. */
export function saleSheetText(sheet: SaleSheet): string {
  return [sheet.title, ...sheet.sections.map((s) => `${s.heading}\n${s.text}`)].join('\n\n');
}
