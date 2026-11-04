/**
 * Maps what the AI read from an invoice or a dashboard onto the service / expense / odometer forms
 * (IMP 03112026 SPEC-B §B3, §B4; ADR-67). Pure: no React, no database. Same contract as `fuelMap`: it proposes the
 * STRINGS the form inputs hold plus a confidence per field, only for fields that were actually read. The screens keep
 * their own validation and the normal Save; nothing here is saved.
 */
import type { PartDraft } from '../db/serviceOps';
import { conf, num, str, type ReadItem, type ReadResult } from './read';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────── odometer ─────────────────────────

export type OdometerPrefill = { value: string; milesRead: boolean; confidence: number };

/** A dashboard photo → the odometer to type. A dashboard in miles is kept as read and flagged (the form offers "Usar km"). */
export function odometerFrom(r: ReadResult): OdometerPrefill | null {
  const v = num(r, 'odometer');
  if (v == null) return null;
  return { value: String(Math.round(v)), milesRead: str(r, 'unit') === 'mi', confidence: conf(r, 'odometer') };
}

// ───────────────────────── warranty text ─────────────────────────

export type Warranty = { months: number | null; days: number | null; km: number | null };

/** "6 meses o 10,000 km", "1 año", "90 días", "12.000 km" → numbers. Anything it cannot read stays null. */
export function parseWarranty(text: string | null | undefined): Warranty {
  const out: Warranty = { months: null, days: null, km: null };
  if (!text) return out;
  const s = text.toLowerCase();
  const years = s.match(/(\d+)\s*(?:años?|anos?)\b/);
  const months = s.match(/(\d+)\s*mes(?:es)?\b/);
  const days = s.match(/(\d+)\s*d[ií]as?\b/);
  if (years) out.months = Number(years[1]) * 12;
  if (months) out.months = (out.months ?? 0) + Number(months[1]);
  if (days) out.days = Number(days[1]);
  const km = s.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:km|kms|kil[oó]metros?)\b/);
  if (km) out.km = Number(km[1].replace(/[.,](?=\d{3}\b)/g, ''));
  if (out.months === 0) out.months = null;
  if (out.days === 0) out.days = null;
  if (out.km === 0) out.km = null;
  return out;
}

/** YYYY-MM-DD + months (day clamped to the target month's length) + days → YYYY-MM-DD. */
export function addToDate(isoDate: string, months: number, days: number): string | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1 + months;
  const first = Date.UTC(y + Math.floor(mo / 12), ((mo % 12) + 12) % 12, 1);
  const last = new Date(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth() + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth(), Math.min(Number(m[3]), last) + days));
  return d.toISOString().slice(0, 10);
}

// ───────────────────────── invoice → service form ─────────────────────────

export type InvoiceMarks = Partial<Record<'shop' | 'date' | 'total' | 'costParts' | 'costLabor' | 'warranty', number>>;

export type InvoicePrefill = {
  shop?: string;
  date?: string;
  /** Only set when the invoice total is not what parts + labour add up to (the form's total is computed otherwise). */
  totalOverride?: string;
  costParts?: string;
  costLabor?: string;
  parts: PartDraft[];
  warrantyDate?: string;
  warrantyKm?: string;
  /** What the invoice says, kept for the note: NCF, RNC. */
  noteLines: string[];
};

const lineTotal = (it: ReadItem): number | null => {
  const q = typeof it.qty?.value === 'number' ? it.qty.value : 1;
  const p = typeof it.unit_price?.value === 'number' ? it.unit_price.value : null;
  return p == null ? null : round2(q * p);
};

/** An invoice (one or more photos) → the service form's values. `repairDate` is the date the warranty counts from. */
export function invoicePrefillFrom(r: ReadResult, fallbackDate: string): { prefill: InvoicePrefill; marks: InvoiceMarks } {
  const prefill: InvoicePrefill = { parts: [], noteLines: [] };
  const marks: InvoiceMarks = {};

  const shop = str(r, 'shop');
  if (shop) {
    prefill.shop = shop;
    marks.shop = conf(r, 'shop');
  }
  const date = str(r, 'date');
  if (date) {
    prefill.date = date;
    marks.date = conf(r, 'date');
  }

  let parts = 0;
  let labour = 0;
  let sawLabour = false;
  let sawAny = false;
  let itemConf = 1;
  for (const it of r.items ?? []) {
    const total = lineTotal(it);
    const desc = typeof it.description?.value === 'string' ? it.description.value : '';
    if (total == null || !desc) continue;
    sawAny = true;
    itemConf = Math.min(itemConf, it.unit_price?.confidence ?? 0, it.description?.confidence ?? 0);
    const kind = it.kind?.value;
    if (kind === 'labour') {
      labour += total;
      sawLabour = true;
    } else {
      parts += total;
      const qty = typeof it.qty?.value === 'number' ? it.qty.value : 1;
      prefill.parts.push({ name: desc, quantity: qty, unitCostDop: typeof it.unit_price?.value === 'number' ? it.unit_price.value : null });
    }
  }
  if (sawAny) {
    prefill.costParts = String(round2(parts));
    marks.costParts = itemConf;
    if (sawLabour) {
      prefill.costLabor = String(round2(labour));
      marks.costLabor = itemConf;
    }
  }

  const total = num(r, 'total');
  if (total != null) {
    // The form computes parts + labour; only a total that disagrees is set explicitly (so what was printed wins).
    if (!sawAny || Math.abs(round2(parts + labour) - total) > 0.5) prefill.totalOverride = String(round2(total));
    marks.total = conf(r, 'total');
  }

  const w = parseWarranty(str(r, 'warranty_text'));
  const base = prefill.date ?? fallbackDate;
  if (w.months != null || w.days != null) {
    const until = addToDate(base, w.months ?? 0, w.days ?? 0);
    if (until) prefill.warrantyDate = until;
  }
  if (w.km != null) prefill.warrantyKm = String(w.km);
  if (prefill.warrantyDate || prefill.warrantyKm) marks.warranty = conf(r, 'warranty_text');

  const ncf = str(r, 'ncf');
  const rnc = str(r, 'rnc');
  if (ncf) prefill.noteLines.push(`NCF ${ncf}`);
  if (rnc) prefill.noteLines.push(`RNC ${rnc}`);
  return { prefill, marks };
}

// ───────────────────────── invoice → expense form ─────────────────────────

export type ExpensePrefill = { amount?: string; date?: string; vendor?: string; noteLines: string[] };
export type ExpenseMarks = Partial<Record<'amount' | 'date' | 'vendor' | 'category', number>>;

/** A receipt or invoice → the expense form (amount, date, who). The category is never guessed: the person picks it. */
export function expensePrefillFrom(r: ReadResult): { prefill: ExpensePrefill; marks: ExpenseMarks } {
  const prefill: ExpensePrefill = { noteLines: [] };
  const marks: ExpenseMarks = {};
  const total = num(r, 'total');
  if (total != null) {
    prefill.amount = String(round2(total));
    marks.amount = conf(r, 'total');
  }
  const date = str(r, 'date');
  if (date) {
    prefill.date = date;
    marks.date = conf(r, 'date');
  }
  const vendor = str(r, 'shop');
  if (vendor) {
    prefill.vendor = vendor;
    marks.vendor = conf(r, 'shop');
  }
  const ncf = str(r, 'ncf');
  if (ncf) prefill.noteLines.push(`NCF ${ncf}`);
  return { prefill, marks };
}
