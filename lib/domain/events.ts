/**
 * Events (IMP 30092026 note 5, data model v8 §1.2, ADR-44). Pure and tested.
 *
 * An event is a milestone with more columns: `event_type = 'hito'` is the nice
 * kind the album always had; everything else (a crash, a breakdown, a ticket)
 * carries a severity, a cost and maybe something still pending. The functions
 * take any row with the milestone's columns, so they work on the repo's rows and
 * on the seed alike; rows read before v8 (no `eventType`) fall back to the kind.
 */
import type { Milestone } from '../db/types';
import { money } from '../format';
import { t } from '../i18n';

export type EventType =
  | 'hito'
  | 'accidente'
  | 'dano_menor'
  | 'averia'
  | 'sobrecalentamiento'
  | 'robo'
  | 'multa'
  | 'viaje_largo'
  | 'junte'
  | 'otro';

export type Severity = 'leve' | 'moderado' | 'grave';

/** Ionicons glyph names (the app's icon set — components/ui/RecordRow.tsx uses `flag-outline` for hitos). */
const EVENT_ICONS: [EventType, string][] = [
  ['hito', 'flag-outline'],
  ['accidente', 'car-outline'],
  ['dano_menor', 'bandage-outline'],
  ['averia', 'build-outline'],
  ['sobrecalentamiento', 'thermometer-outline'],
  ['robo', 'lock-open-outline'],
  ['multa', 'receipt-outline'],
  ['viaje_largo', 'map-outline'],
  ['junte', 'people-outline'],
  ['otro', 'ellipsis-horizontal-circle-outline'],
];

/** `label` is a getter: it reads the dictionary when shown, so it follows the language. */
export const EVENT_TYPES: { readonly id: EventType; readonly label: string; readonly icon: string }[] = EVENT_ICONS.map(([id, icon]) => ({
  id,
  icon,
  get label() {
    return t.events.types[id];
  },
}));

/** Live labels by id (getters over the dictionary). */
function liveLabels<K extends string>(ids: readonly K[], read: (id: K) => string): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const id of ids) Object.defineProperty(out, id, { get: () => read(id), enumerable: true });
  return out;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = liveLabels(
  EVENT_ICONS.map(([id]) => id),
  (id) => t.events.types[id],
);
export const EVENT_TYPE_ICON = Object.fromEntries(EVENT_ICONS) as Record<EventType, string>;

const SEVERITY_IDS: Severity[] = ['leve', 'moderado', 'grave'];

export const SEVERITIES: { readonly id: Severity; readonly label: string }[] = SEVERITY_IDS.map((id) => ({
  id,
  get label() {
    return t.events.severities[id];
  },
}));

export const SEVERITY_LABEL: Record<Severity, string> = liveLabels(SEVERITY_IDS, (id) => t.events.severities[id]);

const SEVERITY_RANK: Record<Severity, number> = { leve: 1, moderado: 2, grave: 3 };

/** The v8 columns on `milestone`. */
export type EventFields = {
  eventType: EventType;
  /** Null for a hito. */
  severity: Severity | null;
  costDop: number | null;
  /** What is still to do ("pintar el guardafango"); '' when nothing. */
  pending: string;
  resolvedAt: string | null;
  linkedServiceId: string | null;
  linkedModId: string | null;
  linkedInspectionId: string | null;
  locationLabel: string;
};

/** A milestone row, with the v8 columns when the row has them. */
export type EventRow = Pick<Milestone, 'id' | 'vehicleId' | 'kind' | 'occurredAt' | 'title'> & {
  deletedAt?: string | null;
} & Partial<EventFields>;

/** The row's event type; before v8 an `accidente` kind was the only event (the migration's backfill rule). */
export function eventTypeOf(m: EventRow): EventType {
  if (m.eventType) return m.eventType;
  return m.kind === 'accidente' ? 'accidente' : 'hito';
}

export function isEvent(m: EventRow): boolean {
  return eventTypeOf(m) !== 'hito';
}

/** Still something to do: a pending text and no resolved date. */
export function isPending(m: EventRow): boolean {
  return Boolean(m.pending?.trim()) && !m.resolvedAt;
}

/** Severity at or above `moderado` — the album's red marker (ADR-44). */
export function isSerious(m: EventRow): boolean {
  return m.severity != null && SEVERITY_RANK[m.severity] >= SEVERITY_RANK.moderado;
}

const newestFirst = (a: EventRow, b: EventRow) => b.occurredAt.localeCompare(a.occurredAt);

function ofVehicle<T extends EventRow>(milestones: readonly T[], vehicleId: string): T[] {
  return milestones.filter((m) => m.vehicleId === vehicleId && !m.deletedAt);
}

/** The vehicle hub's amber rows ("Pendiente: pintar el guardafango · desde 12 ago"), newest first. */
export function pendingEvents<T extends EventRow>(milestones: readonly T[], vehicleId: string): T[] {
  return ofVehicle(milestones, vehicleId).filter(isPending).sort(newestFirst);
}

export type TimelineMarker = 'grave' | 'serious' | 'pending' | 'normal';

export type TimelineItem<T extends EventRow = EventRow> = {
  milestone: T;
  eventType: EventType;
  label: string;
  icon: string;
  marker: TimelineMarker;
  subtitle: string;
};

function markerOf(m: EventRow): TimelineMarker {
  if (m.severity === 'grave') return 'grave';
  if (isSerious(m)) return 'serious';
  if (isPending(m)) return 'pending';
  return 'normal';
}

/**
 * The Eventos tab, newest first. Status changes (`kind = 'estado'`) are history
 * rows, not events, and stay out unless asked for.
 */
export function eventTimeline<T extends EventRow>(
  milestones: readonly T[],
  vehicleId: string,
  opts: { includeStatus?: boolean } = {},
): TimelineItem<T>[] {
  return ofVehicle(milestones, vehicleId)
    .filter((m) => opts.includeStatus || m.kind !== 'estado')
    .sort(newestFirst)
    .map((m) => {
      const eventType = eventTypeOf(m);
      return {
        milestone: m,
        eventType,
        label: EVENT_TYPE_LABEL[eventType],
        icon: EVENT_TYPE_ICON[eventType],
        marker: markerOf(m),
        subtitle: eventSubtitle(m),
      };
    });
}

/** "RD$ 45,000" for whole pesos, "RD$ 1,250.50" otherwise — the app's formatter without the noise. */
function moneyShort(n: number): string {
  return money(n).replace(/\.00$/, '');
}

/**
 * "Grave · RD$ 45,000 · pendiente: pintar el guardafango". Any part may be
 * missing; a hito shows only its cost, if any. A resolved pending shows as "resuelto".
 */
export function eventSubtitle(m: EventRow): string {
  const out: string[] = [];
  if (isEvent(m) && m.severity) out.push(SEVERITY_LABEL[m.severity]);
  if (m.costDop != null && m.costDop > 0) out.push(moneyShort(m.costDop));
  const pending = m.pending?.trim();
  if (pending) out.push(m.resolvedAt ? t.events.resolved : t.events.pending(pending));
  return out.join(' · ');
}

/**
 * What the events cost the car, for Cifras "Lo que me ha costado". An event linked
 * to a service is already counted there (the service carries the bill), so it
 * adds nothing here.
 * Hitos add nothing either (see eventCostRows).
 */
export function eventCostDop(milestones: readonly EventRow[], vehicleId: string): number {
  return eventCostRows(milestones, vehicleId).reduce((sum, m) => sum + (m.costDop ?? 0), 0);
}

/**
 * The rows behind eventCostDop, newest first: what the Cifras block lists under
 * its total. Events only — a hito's money is its purchase, mod or service — and
 * not one linked to a service (the service carries the bill) or without a cost.
 */
export function eventCostRows<T extends EventRow>(milestones: readonly T[], vehicleId: string): T[] {
  return ofVehicle(milestones, vehicleId)
    .filter((m) => isEvent(m) && !m.linkedServiceId && m.costDop != null && m.costDop > 0)
    .sort(newestFirst);
}

/** What history_feed v6 packs into an 'evento' row's subtitle: `kind|event_type|severity|pending|resolved_at`. */
export type FeedEvent = Pick<EventFields, 'eventType' | 'severity' | 'pending' | 'resolvedAt'> & { kind: string };

const EVENT_IDS = new Set<string>(EVENT_ICONS.map(([id]) => id));

/** Unpacks an 'evento' feed subtitle; unknown or missing parts fall back to 'otro' / null / ''. */
export function eventFromFeed(subtitle: string | null | undefined): FeedEvent {
  const [kind = '', type = '', severity = '', pending = '', resolvedAt = ''] = (subtitle ?? '').split('|');
  return {
    kind,
    eventType: EVENT_IDS.has(type) ? (type as EventType) : 'otro',
    severity: (SEVERITY_IDS as string[]).includes(severity) ? (severity as Severity) : null,
    pending,
    resolvedAt: resolvedAt || null,
  };
}

/** The editor's state before it is saved. */
export type EventDraft = {
  eventType: EventType;
  severity: Severity | null;
  /** As typed ("45,000", "RD$ 3500"); '' = no cost. */
  cost: string;
  pending: string;
  resolved: boolean;
  /** The resolved date already on the row, kept when "Resuelto" stays on. */
  resolvedAt: string | null;
  linkedServiceId: string | null;
  linkedModId: string | null;
  linkedInspectionId: string | null;
  locationLabel: string;
};

/**
 * The v8 columns from the editor (ADR-44): a hito carries no severity; an event
 * with none gets 'leve'; the cost parses to pesos or null; "Resuelto" stamps
 * `resolvedAt` (today, unless the row already had a date) and needs something
 * pending to resolve — clearing the pending text clears the date too.
 */
export function eventFieldsFromDraft(d: EventDraft, today: string): EventFields {
  const raw = d.cost.replace(/[^\d.]/g, '');
  const cost = raw ? Number(raw) : null;
  const pending = d.pending.trim();
  return {
    eventType: d.eventType,
    severity: d.eventType === 'hito' ? null : (d.severity ?? 'leve'),
    costDop: cost != null && Number.isFinite(cost) && cost > 0 ? cost : null,
    pending,
    resolvedAt: pending && d.resolved ? (d.resolvedAt ?? today) : null,
    linkedServiceId: d.linkedServiceId,
    linkedModId: d.linkedModId,
    linkedInspectionId: d.linkedInspectionId,
    locationLabel: d.locationLabel.trim(),
  };
}
