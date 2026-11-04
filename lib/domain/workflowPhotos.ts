/**
 * Pure helpers for the photo workflows (IMP 03112026 SPEC-G §G2/§G6/§G7). No AI, no imports of app state.
 *
 *  - G6 `checkItemFor`        which kind of thing a weekly-check item is, from its label (the server gets this closed id, never the
 *                             free text); `verdictFromSuggestion` pass/watch/fail → the checklist's ok/atencion/falla.
 *  - G7 `accidentChecklist`   the document checklist for an accident event, from RULES (seguro, matrícula, denuncia…); never advice
 *                             about fault or claims. `damageDraft` turns the read into an event description + severity suggestion.
 *  - G2 `albumSuggestions`    the per-photo read of an import batch → caption/angle per photo and, grouped by date, the "looks like
 *                             a change" suggestions as Milestone/Mod drafts. A suggestion is never saved by itself.
 * The closed lists mirror supabase/functions/cg-ai-read/workflowKinds.ts (a test pins them).
 */
import type { Verdict } from './inspections';

export const CHECK_ITEMS = ['tire_tread', 'oil_dipstick', 'coolant', 'brake_fluid', 'leak', 'battery', 'belts', 'lights', 'wipers', 'other'] as const;
export type CheckItem = (typeof CHECK_ITEMS)[number];
export type CheckSuggestion = 'pass' | 'watch' | 'fail';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Order matters: "líquido de frenos" must reach brake_fluid before a generic "líquido". */
const ITEM_WORDS: [CheckItem, RegExp][] = [
  ['brake_fluid', /liquido de frenos|brake fluid|frenos? .*(liquido|nivel)|nivel .*frenos?/],
  ['coolant', /refrigerante|anticongelante|coolant/],
  ['oil_dipstick', /aceite|varilla|dipstick|\boil\b/],
  ['tire_tread', /goma|llanta|neumatico|banda de rodamiento|labrado|dibujo|tire|tread|tyre/],
  ['leak', /fuga|gotea|derrame|mancha|leak/],
  ['battery', /bateria|bornes|battery|terminales/],
  ['belts', /correa|belt/],
  ['wipers', /limpiaparabrisas|plumas|wiper/],
  ['lights', /luces|luz |faro|stop|direccional|lights?|lamp/],
];

export function checkItemFor(label: string): CheckItem {
  const s = fold(label);
  // A pressure reading is a gauge job, not something a photo shows.
  if (/presion|pressure|psi/.test(s)) return 'other';
  for (const [id, re] of ITEM_WORDS) if (re.test(s)) return id;
  return 'other';
}

/** Only items a photo can say something about get the photo button; the rest stay exactly as they are. */
export const photoCheckable = (label: string): boolean => checkItemFor(label) !== 'other';

export function verdictFromSuggestion(s: CheckSuggestion): Verdict {
  return s === 'pass' ? 'ok' : s === 'watch' ? 'atencion' : 'falla';
}

/** The note a suggestion adds to an ATENCIÓN / FALLA answer: marked as AI so it is never mistaken for the owner's own eyes. */
export function noteFromObservation(observation: string, prefix: string): string {
  const o = observation.trim();
  return o ? `${prefix} ${o}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────── G7 accident
export type Severity = 'leve' | 'moderado' | 'grave';
export const DAMAGE_AREAS = ['front', 'rear', 'left', 'right', 'roof', 'hood', 'trunk', 'bumper_front', 'bumper_rear', 'door', 'fender', 'windshield', 'window', 'light', 'wheel', 'mirror', 'interior', 'undercarriage', 'other'] as const;
export type DamageArea = (typeof DAMAGE_AREAS)[number];

export type DamageRead = { description: string | null; severity: Severity | null; severityConfidence: number; areas: DamageArea[] };

/** The read result's fields → a draft for the event form. Anything the server blanked stays blank. */
export function damageDraft(fields: Record<string, { value: string | number | null; confidence: number }>, items: Record<string, { value: string | number | null }>[] | undefined): DamageRead {
  const sev = fields.severity?.value;
  const areas = (items ?? []).map((i) => i.area?.value).filter((a): a is DamageArea => typeof a === 'string' && (DAMAGE_AREAS as readonly string[]).includes(a));
  return {
    description: typeof fields.description?.value === 'string' ? fields.description.value : null,
    severity: sev === 'leve' || sev === 'moderado' || sev === 'grave' ? sev : null,
    severityConfidence: fields.severity?.confidence ?? 0,
    areas: [...new Set(areas)],
  };
}

export type ChecklistItem = { id: 'seguro' | 'matricula' | 'denuncia' | 'fotos' | 'otro_conductor'; state: 'ok' | 'missing' | 'expired' | 'todo' };
export type DocLite = { kind: string; expiresAt: string | null };

/**
 * The accident document checklist, from rules. `seguro` and `matricula` come from the car's own documents (valid today, missing, or
 * expired); the rest are reminders of what to gather. No statement about fault, coverage or what to claim.
 */
export function accidentChecklist(docs: readonly DocLite[], today: string, opts: { photoCount: number }): ChecklistItem[] {
  const state = (kind: string): ChecklistItem['state'] => {
    const mine = docs.filter((d) => d.kind === kind);
    if (!mine.length) return 'missing';
    return mine.some((d) => !d.expiresAt || d.expiresAt.slice(0, 10) >= today) ? 'ok' : 'expired';
  };
  return [
    { id: 'seguro', state: state('seguro') },
    { id: 'matricula', state: state('matricula') },
    { id: 'denuncia', state: 'todo' },
    { id: 'fotos', state: opts.photoCount > 0 ? 'ok' : 'todo' },
    { id: 'otro_conductor', state: 'todo' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────── G2 album
export const ALBUM_ANGLES = ['front', 'rear', 'side', 'interior', 'engine_bay', 'wheels', 'detail', 'other'] as const;
export type AlbumAngle = (typeof ALBUM_ANGLES)[number];
export const ALBUM_CHANGES = ['none', 'wheels', 'paint', 'aero', 'exhaust', 'stance', 'interior', 'other'] as const;
export type AlbumChange = (typeof ALBUM_CHANGES)[number];
/** The most photos one import sends in one call (SPEC-G §G2). */
export const ALBUM_BATCH = 12;

export type AlbumPhotoIn = { index: number; takenAt: string | null };
export type AlbumRead = { index: number; angle: AlbumAngle | null; caption: string | null; change: AlbumChange; changeNote: string | null };
export type AlbumSuggestion = { date: string; indexes: number[]; change: Exclude<AlbumChange, 'none'>; note: string | null; kind: 'mod' | 'milestone' };

type ItemLike = Record<string, { value: string | number | null }>;

/** The server's items → one read per photo number, defensively (it already dropped repeats, but the app does not trust the wire). */
export function albumReads(items: readonly ItemLike[] | undefined, count: number): AlbumRead[] {
  const out = new Map<number, AlbumRead>();
  for (const it of items ?? []) {
    const index = it.index?.value;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 1 || index > count || out.has(index)) continue;
    const angle = it.angle?.value;
    const change = it.change?.value;
    out.set(index, {
      index,
      angle: typeof angle === 'string' && (ALBUM_ANGLES as readonly string[]).includes(angle) ? (angle as AlbumAngle) : null,
      caption: typeof it.caption?.value === 'string' ? it.caption.value : null,
      change: typeof change === 'string' && (ALBUM_CHANGES as readonly string[]).includes(change) ? (change as AlbumChange) : 'none',
      changeNote: typeof it.change_note?.value === 'string' ? it.change_note.value : null,
    });
  }
  return [...out.values()].sort((a, b) => a.index - b.index);
}

/** Which changes are a part on the car (a Mod) and which are a moment (a Milestone). */
const AS_MOD: Record<Exclude<AlbumChange, 'none'>, 'mod' | 'milestone'> = { wheels: 'mod', paint: 'milestone', aero: 'mod', exhaust: 'mod', stance: 'mod', interior: 'mod', other: 'milestone' };

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * "Looks like a change since the last photo", grouped by date. Two photos of the same change on the same day make ONE suggestion, so a
 * photo session does not become five "new wheels". A photo with no date is grouped under '' (the screen asks for a date).
 */
export function albumSuggestions(photos: readonly AlbumPhotoIn[], reads: readonly AlbumRead[]): AlbumSuggestion[] {
  const byIndex = new Map(photos.map((p) => [p.index, p]));
  const groups = new Map<string, AlbumSuggestion>();
  for (const r of reads) {
    if (r.change === 'none') continue;
    const date = dayOf(byIndex.get(r.index)?.takenAt ?? null);
    const key = `${date}|${r.change}`;
    const g = groups.get(key);
    if (g) {
      g.indexes.push(r.index);
      g.note ??= r.changeNote;
    } else groups.set(key, { date, indexes: [r.index], change: r.change, note: r.changeNote, kind: AS_MOD[r.change] });
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Photos are sent oldest first, in batches of ≤ 12; the order is what makes "since the previous photo" mean something. */
export function albumBatches<T extends { takenAt: string | null }>(photos: readonly T[]): T[][] {
  const sorted = [...photos].sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? ''));
  const out: T[][] = [];
  for (let i = 0; i < sorted.length; i += ALBUM_BATCH) out.push(sorted.slice(i, i + ALBUM_BATCH));
  return out;
}
