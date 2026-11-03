/**
 * Intent → screen (IMP 03112026 SPEC-B §B3): what `cg-ai-intent` returned becomes a route plus the draft for the SAME
 * form the person already knows. One utterance in, one pre-filled form out: not a chat. Pure.
 */
import { fuelTypeFromText, toVehiclePrice, toVehicleVolume, type AiMarks, type FuelPrefill } from './fuelMap';
import type { DraftForm } from './draft';
import type { ReadField } from './read';
import type { VolumeUnit } from '../domain/units';

export type IntentTarget = 'fuel' | 'service' | 'repair' | 'expense' | 'odometer' | 'reminder' | 'task' | 'event' | 'obd' | 'navigate';

/** The body `cg-ai-intent` answers (supabase/functions/cg-ai-intent/intents.ts). */
export type IntentResult = {
  ok: true;
  target: IntentTarget;
  target_confidence: number;
  fields: Record<string, ReadField>;
  vehicle: { id: string; name: string } | null;
  choices: { id: string; name: string }[] | null;
  model: string | null;
};

export type IntentRoute = {
  pathname: string;
  params: Record<string, string>;
  /** The draft to hand the form, or null for a plain navigation (obd, navigate). */
  draft: { form: DraftForm; prefill: Record<string, unknown>; marks: Record<string, number> } | null;
};

const s = (r: IntentResult, k: string): string | null => {
  const v = r.fields[k]?.value;
  return typeof v === 'string' && v ? v : null;
};
const n = (r: IntentResult, k: string): number | null => {
  const v = r.fields[k]?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const c = (r: IntentResult, k: string) => r.fields[k]?.confidence ?? 0;

/** Keeps only defined entries so a form never receives `undefined` where it expected "not filled". */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

export function intentToRoute(r: IntentResult, opts: { volumeUnit?: VolumeUnit; featureHref?: (id: string) => string | null } = {}): IntentRoute | null {
  const unit = opts.volumeUnit ?? 'gal';
  switch (r.target) {
    case 'fuel': {
      const gallons = n(r, 'gallons');
      const price = n(r, 'unit_price');
      const total = n(r, 'total');
      const fuel = fuelTypeFromText(s(r, 'product'));
      const prefill: FuelPrefill = compact({
        date: s(r, 'date') ?? undefined,
        odo: n(r, 'odometer') != null ? String(Math.round(n(r, 'odometer')!)) : undefined,
        fuel: fuel ?? undefined,
        vol: gallons != null ? String(Math.round(toVehicleVolume(gallons, unit) * 1000) / 1000) : undefined,
        price: price != null ? String(Math.round(toVehiclePrice(price, unit) * 100) / 100) : undefined,
        total: total != null ? String(total) : undefined,
        station: s(r, 'station') ?? undefined,
      });
      const marks: AiMarks = compact({
        date: s(r, 'date') ? c(r, 'date') : undefined,
        odo: n(r, 'odometer') != null ? c(r, 'odometer') : undefined,
        fuel: fuel ? c(r, 'product') : undefined,
        vol: gallons != null ? c(r, 'gallons') : undefined,
        price: price != null ? c(r, 'unit_price') : undefined,
        total: total != null ? c(r, 'total') : undefined,
        station: s(r, 'station') ? c(r, 'station') : undefined,
      });
      return { pathname: '/carga/nueva', params: {}, draft: { form: 'fuel', prefill, marks } };
    }
    case 'service':
    case 'repair': {
      const prefill = compact({
        title: s(r, 'title') ?? s(r, 'description') ?? undefined,
        description: s(r, 'description') ?? undefined,
        shop: s(r, 'shop') ?? undefined,
        total: n(r, 'total') != null ? String(n(r, 'total')) : undefined,
        odometer: n(r, 'odometer') != null ? String(Math.round(n(r, 'odometer')!)) : undefined,
        date: s(r, 'date') ?? undefined,
        system: s(r, 'system') ?? undefined,
      });
      const marks = compact({
        title: s(r, 'title') || s(r, 'description') ? Math.max(c(r, 'title'), c(r, 'description')) : undefined,
        shop: s(r, 'shop') ? c(r, 'shop') : undefined,
        total: n(r, 'total') != null ? c(r, 'total') : undefined,
        odometer: n(r, 'odometer') != null ? c(r, 'odometer') : undefined,
        date: s(r, 'date') ? c(r, 'date') : undefined,
      });
      return {
        pathname: '/servicio/nuevo',
        params: r.target === 'repair' ? { kind: 'reparacion' } : {},
        draft: { form: r.target, prefill, marks },
      };
    }
    case 'expense': {
      const prefill = compact({
        category: s(r, 'category') ?? undefined,
        amount: n(r, 'total') != null ? String(n(r, 'total')) : undefined,
        description: s(r, 'description') ?? s(r, 'title') ?? undefined,
        vendor: s(r, 'shop') ?? s(r, 'station') ?? undefined,
        odometer: n(r, 'odometer') != null ? String(Math.round(n(r, 'odometer')!)) : undefined,
        date: s(r, 'date') ?? undefined,
      });
      const marks = compact({
        category: s(r, 'category') ? c(r, 'category') : undefined,
        amount: n(r, 'total') != null ? c(r, 'total') : undefined,
        description: s(r, 'description') || s(r, 'title') ? Math.max(c(r, 'description'), c(r, 'title')) : undefined,
        vendor: s(r, 'shop') || s(r, 'station') ? Math.max(c(r, 'shop'), c(r, 'station')) : undefined,
        odometer: n(r, 'odometer') != null ? c(r, 'odometer') : undefined,
        date: s(r, 'date') ? c(r, 'date') : undefined,
      });
      return { pathname: '/gasto/nuevo', params: {}, draft: { form: 'expense', prefill, marks } };
    }
    case 'odometer': {
      const odo = n(r, 'odometer');
      return {
        pathname: '/odometro',
        params: {},
        draft: odo != null ? { form: 'odometer', prefill: compact({ value: String(Math.round(odo)), date: s(r, 'date') ?? undefined }), marks: { value: c(r, 'odometer') } } : null,
      };
    }
    case 'reminder':
      return {
        pathname: '/recordatorio/nuevo',
        params: {},
        draft: { form: 'reminder', prefill: compact({ title: s(r, 'title') ?? s(r, 'description') ?? undefined, dueDate: s(r, 'due_date') ?? s(r, 'date') ?? undefined }), marks: {} },
      };
    case 'task':
      return { pathname: '/tarea/nueva', params: {}, draft: { form: 'task', prefill: compact({ title: s(r, 'title') ?? s(r, 'description') ?? undefined }), marks: {} } };
    case 'event':
      return { pathname: '/evento/nuevo', params: {}, draft: { form: 'event', prefill: compact({ title: s(r, 'title') ?? undefined, story: s(r, 'description') ?? undefined, date: s(r, 'date') ?? undefined }), marks: {} } };
    case 'obd': {
      const code = s(r, 'dtc_code');
      return code ? { pathname: '/obd/[code]', params: { code }, draft: null } : { pathname: '/obd', params: {}, draft: null };
    }
    case 'navigate': {
      const id = s(r, 'navigate_to');
      const href = id && opts.featureHref ? opts.featureHref(id) : null;
      return href ? { pathname: href, params: {}, draft: null } : null;
    }
  }
  return null;
}

/** Several possible cars: the person picks, nothing is guessed (SPEC-B §B3). */
export function needsVehicleChoice(r: IntentResult): boolean {
  return !!r.choices && r.choices.length > 1;
}
