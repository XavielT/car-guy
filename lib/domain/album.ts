/**
 * The album's rules (IMP 28092026, 01-data-model-v2.md §2.1): when a photo was
 * taken, whether it is one we already have, how the timeline groups, what the
 * car was like on a given day, and how full the cloud quota is.
 *
 * Pure — no database, no platform — so every rule is tested rather than
 * eyeballed on a phone. lib/db/albumQueries.ts feeds it rows.
 */

export type DatePrecision = 'day' | 'month' | 'year';

// ------------------------------------------------------------ taken_at ---

/**
 * EXIF `DateTimeOriginal` is "YYYY:MM:DD HH:MM:SS" with **no timezone** — the
 * camera's wall clock. Read it as local time (the phone and the car are in the
 * same place), never as UTC. Returns an ISO instant, or null for anything else,
 * including the all-zero date some cameras write when the clock was never set.
 */
export function parseExifDate(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  if (y < 1950 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d, h, mi, s || 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type TakenAtSource = 'exif' | 'file' | 'none';

/**
 * Where a photo's date comes from, best first: the camera's EXIF, then the
 * file's own timestamp (MediaStore creation time on Android, `lastModified` on
 * web — for a WhatsApp download that is the download day, so it is flagged as
 * such), then nothing and the user picks. A file date in the future or before
 * 1990 is ignored as a broken clock.
 */
export function resolveTakenAt(
  input: { exif?: unknown; fileTimeMs?: number | null },
  now: Date = new Date(),
): { takenAt: string | null; source: TakenAtSource } {
  const exif = parseExifDate(input.exif);
  if (exif && new Date(exif).getTime() <= now.getTime() + 86_400_000) return { takenAt: exif, source: 'exif' };
  const ms = input.fileTimeMs;
  if (typeof ms === 'number' && ms > Date.UTC(1990, 0, 1) && ms <= now.getTime() + 86_400_000) {
    return { takenAt: new Date(ms).toISOString(), source: 'file' };
  }
  return { takenAt: null, source: 'none' };
}

/**
 * A date the user chose for a set of photos, at the precision they know it:
 * "del 15 de junio", "de junio 2019", "de 2019". Month and year dates sit on the
 * 1st at noon local, so no timezone can push them into the neighbour.
 */
export function dateAtPrecision(year: number, month0: number | null, day: number | null, precision: DatePrecision): string {
  if (precision === 'year') return new Date(year, 0, 1, 12).toISOString();
  if (precision === 'month') return new Date(year, month0 ?? 0, 1, 12).toISOString();
  return new Date(year, month0 ?? 0, day ?? 1, 12).toISOString();
}

// ---------------------------------------------------------- duplicates ---

type DupShape = { width: number | null; height: number | null; takenAt: string | null; sizeBytes: number | null };

/**
 * Same photo, same vehicle: `(width, height, taken_at, size_bytes)` per the
 * spec. Sizes are compared on the *compressed* copy we store, so the candidate
 * must be measured after compression too. A photo with no date and no size can
 * never be proven a duplicate and is always kept.
 */
export function dupKey(m: DupShape): string | null {
  if (!m.takenAt && m.sizeBytes == null) return null;
  const minute = m.takenAt ? m.takenAt.slice(0, 16) : '';
  return `${m.width ?? ''}x${m.height ?? ''}|${minute}|${m.sizeBytes ?? ''}`;
}

export function isDuplicate(candidate: DupShape, existing: Iterable<DupShape>): boolean {
  const key = dupKey(candidate);
  if (!key) return false;
  for (const e of existing) if (dupKey(e) === key) return true;
  return false;
}

// ------------------------------------------------------------- timeline ---

export type TimelinePhoto = {
  id: string;
  takenAt: string | null;
  createdAt: string;
  precision: DatePrecision;
  blurhash?: string | null;
  isFavorite?: boolean;
  /** Linked record, when the photo belongs to one (hito, mod, pista). */
  milestoneId?: string | null;
  modId?: string | null;
  trackEventId?: string | null;
  /** A service record's own photo (media owned by the record, not an album item). */
  serviceId?: string | null;
  /** A check photo (IMP 29092026 note 3): it rides on that check's CHEQUEO card. */
  inspectionId?: string | null;
};

export type TimelineEvent =
  /**
   * A milestone. v8 (ADR-44): `eventType` other than 'hito' makes it an event —
   * its badge says the type, and `serious` (severity ≥ moderado) paints it red.
   */
  | { kind: 'hito'; id: string; date: string; title: string; subtitle?: string | null; story?: string; milestoneKind: string; eventType?: string; serious?: boolean }
  | { kind: 'mod'; id: string; date: string; title: string; subtitle?: string | null; removed?: boolean }
  | { kind: 'pista'; id: string; date: string; title: string; subtitle?: string | null; discipline: string }
  | { kind: 'mantenimiento'; id: string; date: string; title: string; subtitle?: string | null }
  /** A check with photos on its items; title = the items' labels. */
  | { kind: 'chequeo'; id: string; date: string; title: string; subtitle?: string | null };

export type TimelineItem =
  | (TimelineEvent & { photos: TimelinePhoto[]; before?: string | null; after?: string | null })
  | { kind: 'fotos'; id: string; date: string; photos: TimelinePhoto[] };

export type TimelineSection = {
  /** "2025-08" for a month, "2019" for photos known only to the year. */
  key: string;
  year: number;
  /** 0-based; null for a year-only section. */
  month: number | null;
  odometerKm: number | null;
  items: TimelineItem[];
};

/** The date a photo files under: when it was taken, else when it was added. */
export function photoDate(p: Pick<TimelinePhoto, 'takenAt' | 'createdAt'>): string {
  return p.takenAt ?? p.createdAt;
}

function sectionKey(iso: string, precision: DatePrecision): { key: string; year: number; month: number | null } {
  const d = new Date(iso);
  const year = d.getFullYear();
  if (precision === 'year') return { key: String(year), year, month: null };
  const month = d.getMonth();
  return { key: `${year}-${String(month + 1).padStart(2, '0')}`, year, month };
}

/** Sort key for a section: a year-only section sits after that year's months (it is "sometime in 2019"). */
function sectionOrder(s: Pick<TimelineSection, 'year' | 'month'>): number {
  return s.year * 100 + (s.month == null ? -1 : s.month);
}

/**
 * The odometer "then": the reading nearest to the month's start — the last one
 * before it, else the first one inside the month. Null when there is none within
 * the month either (an old photo from before any record).
 */
export function odometerNear(readings: { occurredAt: string; valueKm: number }[], year: number, month: number | null): number | null {
  const start = new Date(year, month ?? 0, 1).getTime();
  const end = month == null ? new Date(year + 1, 0, 1).getTime() : new Date(year, month + 1, 1).getTime();
  let before: { t: number; v: number } | null = null;
  let inside: { t: number; v: number } | null = null;
  for (const r of readings) {
    const t = new Date(r.occurredAt).getTime();
    if (t < start) {
      if (!before || t > before.t) before = { t, v: r.valueKm };
    } else if (t < end) {
      if (!inside || t < inside.t) inside = { t, v: r.valueKm };
    }
  }
  return before?.v ?? inside?.v ?? null;
}

/**
 * The album timeline: photos, milestones, mod installs/removals, track events
 * and services with photos, newest first, grouped by month (a year-precision
 * photo under its year only). Photos linked to an event ride on that event's
 * card; the rest of a month's loose photos collapse into one "FOTOS" card.
 * `before`/`after` are the mod's ANTES/DESPUÉS pair when it has one.
 */
export function buildTimeline(input: {
  photos: TimelinePhoto[];
  events: TimelineEvent[];
  readings?: { occurredAt: string; valueKm: number }[];
  modPairs?: Record<string, { before: string | null; after: string | null }>;
}): TimelineSection[] {
  const sections = new Map<string, TimelineSection>();
  const section = (iso: string, precision: DatePrecision) => {
    const k = sectionKey(iso, precision);
    let s = sections.get(k.key);
    if (!s) {
      s = { ...k, odometerKm: null, items: [] };
      sections.set(k.key, s);
    }
    return s;
  };

  const byEvent = new Map<string, TimelinePhoto[]>();
  const loose: TimelinePhoto[] = [];
  for (const p of input.photos) {
    const link = p.milestoneId
      ? `hito:${p.milestoneId}`
      : p.modId
        ? `mod:${p.modId}`
        : p.trackEventId
          ? `pista:${p.trackEventId}`
          : p.serviceId
            ? `mantenimiento:${p.serviceId}`
            : p.inspectionId
              ? `chequeo:${p.inspectionId}`
              : null;
    if (link) {
      const list = byEvent.get(link) ?? [];
      list.push(p);
      byEvent.set(link, list);
    } else loose.push(p);
  }

  const known = new Set(input.events.map((e) => `${e.kind}:${e.id}`));
  for (const e of input.events) {
    const photos = sortPhotos(byEvent.get(`${e.kind}:${e.id}`) ?? []);
    const pair = e.kind === 'mod' ? input.modPairs?.[e.id] : undefined;
    section(e.date, 'day').items.push({ ...e, photos, before: pair?.before ?? null, after: pair?.after ?? null });
  }
  // A photo linked to a record the timeline does not show (deleted, or a kind
  // it does not draw) is still a photo of the car.
  for (const [link, photos] of byEvent) if (!known.has(link)) loose.push(...photos);

  const looseBySection = new Map<string, TimelinePhoto[]>();
  for (const p of loose) {
    const s = section(photoDate(p), p.precision);
    const list = looseBySection.get(s.key) ?? [];
    list.push(p);
    looseBySection.set(s.key, list);
  }
  for (const [key, photos] of looseBySection) {
    const sorted = sortPhotos(photos);
    sections.get(key)!.items.push({ kind: 'fotos', id: `fotos:${key}`, date: photoDate(sorted[0]), photos: sorted });
  }

  const out = [...sections.values()].sort((a, b) => sectionOrder(b) - sectionOrder(a));
  for (const s of out) {
    s.items.sort((a, b) => b.date.localeCompare(a.date));
    s.odometerKm = input.readings ? odometerNear(input.readings, s.year, s.month) : null;
  }
  return out;
}

function sortPhotos(photos: TimelinePhoto[]): TimelinePhoto[] {
  return [...photos].sort((a, b) => photoDate(b).localeCompare(photoDate(a)));
}

/** Grid mode: sections of photos only, same grouping as the timeline. */
export function gridSections(photos: TimelinePhoto[]): { key: string; year: number; month: number | null; photos: TimelinePhoto[] }[] {
  return buildTimeline({ photos, events: [] }).map((s) => ({
    key: s.key,
    year: s.year,
    month: s.month,
    photos: s.items.flatMap((i) => i.photos),
  }));
}

/**
 * Grid mode flattened for a FlatList with `getItemLayout`: a header row per
 * section, then rows of `columns` photos. Every row type has a fixed height, so
 * "jump to 2021" is an offset, not a measurement.
 */
export type GridRow =
  | { type: 'header'; key: string; year: number; month: number | null; count: number }
  | { type: 'photos'; key: string; photos: TimelinePhoto[] };

export function flattenGrid(sections: ReturnType<typeof gridSections>, columns = 3): GridRow[] {
  const rows: GridRow[] = [];
  for (const s of sections) {
    rows.push({ type: 'header', key: `h:${s.key}`, year: s.year, month: s.month, count: s.photos.length });
    for (let i = 0; i < s.photos.length; i += columns) {
      rows.push({ type: 'photos', key: `r:${s.key}:${i}`, photos: s.photos.slice(i, i + columns) });
    }
  }
  return rows;
}

/** Offsets for `getItemLayout`, given the fixed heights of the two row kinds. */
export function gridLayout(rows: GridRow[], headerHeight: number, rowHeight: number): { length: number; offset: number }[] {
  let offset = 0;
  return rows.map((r) => {
    const length = r.type === 'header' ? headerHeight : rowHeight;
    const out = { length, offset };
    offset += length;
    return out;
  });
}

/**
 * The years the scrubber offers: from when the car arrived (or its oldest photo,
 * whichever is earlier) to when it left (or this year), newest first.
 */
export function albumYears(opts: { acquiredAt?: string | null; soldAt?: string | null; oldestPhoto?: string | null; today?: Date }): number[] {
  const today = opts.today ?? new Date();
  const starts = [opts.acquiredAt, opts.oldestPhoto].filter((d): d is string => Boolean(d)).map(yearOf);
  const end = opts.soldAt ? yearOf(opts.soldAt) : today.getFullYear();
  const start = starts.length ? Math.min(...starts, end) : end;
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

/** A date-only "2018-01-01" is that calendar year, not UTC midnight shifted into 2017. */
function yearOf(iso: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(0, 4)) : new Date(iso).getFullYear();
}

// -------------------------------------------------------- "así estaba" ---

export type StateMod = {
  id: string;
  name: string;
  status: string;
  installedAt: string | null;
  removedAt: string | null;
  specEffects: Record<string, unknown>;
};

export type CarState = {
  date: string;
  photos: TimelinePhoto[];
  modsInstalled: StateMod[];
  odometerKm: number | null;
  specs: Record<string, unknown>;
  /** Which mod set each spec, for the "desde" chip. */
  specSource: Record<string, string>;
};

/**
 * "Así estaba el carro" on `date`: the last six photos taken by then, the mods
 * on the car that day (installed by then and not yet removed), the odometer
 * (nearest reading on or before), and the specs — stock with those mods'
 * effects applied in install order, so a later swap wins over an earlier one.
 */
export function stateAt(
  date: string,
  input: {
    photos: TimelinePhoto[];
    mods: StateMod[];
    readings: { occurredAt: string; valueKm: number }[];
    stock: Record<string, unknown>;
  },
): CarState {
  const t = new Date(date).getTime();
  const photos = sortPhotos(input.photos.filter((p) => new Date(photoDate(p)).getTime() <= t)).slice(0, 6);

  const modsInstalled = input.mods
    .filter((m) => m.installedAt && new Date(m.installedAt).getTime() <= t)
    .filter((m) => !m.removedAt || new Date(m.removedAt).getTime() > t)
    .filter((m) => m.status !== 'planeado' && m.status !== 'pedido')
    .sort((a, b) => a.installedAt!.localeCompare(b.installedAt!));

  const specs: Record<string, unknown> = { ...input.stock };
  const specSource: Record<string, string> = {};
  for (const m of modsInstalled) {
    for (const [k, v] of Object.entries(m.specEffects ?? {})) {
      if (v == null || v === '') continue;
      specs[k] = v;
      specSource[k] = m.name;
    }
  }

  let odometerKm: number | null = null;
  let best = -Infinity;
  for (const r of input.readings) {
    const rt = new Date(r.occurredAt).getTime();
    if (rt <= t && rt > best) {
      best = rt;
      odometerKm = r.valueKm;
    }
  }

  return { date, photos, modsInstalled, odometerKm, specs, specSource };
}

/** Parses a JSON column that should hold an object; a bad value is an empty object, never a crash. */
export function jsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------- storage ---

export type StorageLevel = 'ok' | 'warn' | 'full';

/** 90 % warns, 100 % pauses uploads (local keeps working). Unknown quota → ok. */
export function storageLevel(usedBytes: number, quotaBytes: number | null | undefined): StorageLevel {
  if (!quotaBytes || quotaBytes <= 0) return 'ok';
  const ratio = usedBytes / quotaBytes;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.9) return 'warn';
  return 'ok';
}

/** "42 MB", "1.2 GB", "850 KB" — for the meter. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Whether an upload of `nextBytes` fits. The server enforces the quota in the
 * insert policy (sql/011); this is the client's early "no" so a full account
 * does not spend a round trip per photo learning the same thing.
 */
export function fitsQuota(usedBytes: number, quotaBytes: number | null | undefined, nextBytes: number): boolean {
  if (!quotaBytes || quotaBytes <= 0) return true;
  return usedBytes + nextBytes <= quotaBytes;
}
