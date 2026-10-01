/**
 * The public dossier (IMP 28092026, 01-data-model-v2.md §2.5, ADR-22): what the
 * shared page and the car book show, built from what `carguy.public_dossier()`
 * returns (sql/012) or from the same shape assembled on the phone.
 *
 * Pure and relative-imports only: the Vercel function (api/c/[slug].ts) bundles
 * it without the app's `@/` alias. The SQL already strips what the owner hid
 * (costs, plate, VIN, sections); this file never re-adds anything, it only
 * orders and words it.
 */
import { currentSpecs, formatSpec, modBadge, parseTags, SPEC_FIELDS } from '../domain/build';
import { formatLap, isTimed } from '../domain/track';
import { isVehicleStatus, statusLabel } from '../domain/vehicleStatus';

export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** 8 characters, no look-alikes (no i/l/o/0/1). */
export function slug(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += SLUG_ALPHABET[Math.floor(random() * SLUG_ALPHABET.length) % SLUG_ALPHABET.length];
  return out;
}

export const isSlug = (s: string | null | undefined): s is string => typeof s === 'string' && /^[a-hj-km-np-z2-9]{8}$/.test(s);

/** The `show_*` switches, as the share screen and the book use them. */
export type ShareFlags = {
  plate: boolean;
  vin: boolean;
  costs: boolean;
  odometer: boolean;
  maintenance: boolean;
  mods: boolean;
  track: boolean;
  story: boolean;
  /** The car's status (en el taller, accidentado…) with its note and since — off unless chosen (sql/022). */
  status: boolean;
  /** v8 / sql/025 `show_tires`: the tires block, counts only (ADR-45). Off unless chosen. */
  tires: boolean;
  /** v9 / sql/032 `show_memory`: "Lo que uso", spec-sheet rows only (never free facts or Papeles). Off unless chosen. */
  memory: boolean;
};

/** `public_dossier()`'s JSON (snake_case, as it comes over the wire). */
export type RawDossier = {
  slug: string | null;
  visibility: 'private' | 'link' | 'public';
  published_at?: string | null;
  /** sql/025's `show` has no `tires` key (the block's presence says it); the phone's preview sends it. sql/032 sends `memory`. */
  show: Omit<ShareFlags, 'tires' | 'memory'> & { tires?: boolean; memory?: boolean };
  vehicle: {
    name: string;
    type?: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    trim?: string | null;
    color: string | null;
    nickname: string | null;
    status?: string | null;
    /** Only with `show.status` (sql/022). */
    status_note?: string | null;
    status_since?: string | null;
    chassis_code: string | null;
    engine_code: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
    origin?: string | null;
    imported_year?: number | null;
    hero_media_id: string | null;
    plate: string | null;
    vin: string | null;
    story: string | null;
    updated_at?: string | null;
  };
  odometer_km?: number | null;
  specsheet?: { stock: string | null; overrides: string | null } | null;
  mods?: {
    id: string;
    name: string;
    brand: string | null;
    variant?: string | null;
    category_id: string;
    category: string | null;
    status: string;
    installed_at: string | null;
    removed_at?: string | null;
    affects_specs: boolean;
    spec_effects: string | null;
    tags: string | null;
    cost_dop?: number | null;
  }[];
  services?: { kind: string; occurred_at: string; title: string; odometer_km?: number | null; total_dop?: number | null }[];
  track?: { id: string; occurred_at: string; title: string; discipline: string; venue_id: string | null; venue: string | null; layout?: string | null; sessions: number; runs: number | null; best_lap_ms: number | null }[];
  milestones?: { kind: string; occurred_at: string; title: string; story: string }[];
  /**
   * "Lo que me ha costado" (IMP 29092026 note 8), precomputed by
   * `ownershipCost` on the phone — present only when the owner turned "costos"
   * on. The phone publishes it with the share (`vehicle_share.costs_summary`) and
   * `public_dossier()` sends it back (sql/022), so the page and the book agree.
   */
  costs?: {
    purchase_dop: number | null;
    sold_dop: number | null;
    by_category: { mods: number; mantenimiento: number; combustible: number; pista: number; otros: number };
    total_dop: number;
    per_km_dop: number | null;
    since: string | null;
  } | null;
  /** sql/025, only with show_tires: how many tire rows and how many per status (never brands, DOT or costs). */
  tires?: { count: number; badges: { status: string; count: number }[] } | null;
  /**
   * "Lo que uso" (IMP 30092026 note 6), worded by the phone. The book builds it from the local tables
   * (every row) when its switch is on; the public page gets the copy the phone publishes in
   * `vehicle_share.memory_summary` with show_memory — spec-sheet rows only (sql/032, publicMemoryRows).
   */
  memory?: { section: string; title: string; label: string; value: string; source?: 'ficha' | 'dato' }[] | null;
  photos: string[];
};

export type Dossier = {
  slug: string | null;
  indexable: boolean;
  title: string;
  name: string;
  nickname: string | null;
  badges: { label: string; tone: 'red' | 'amber' | 'green' | 'outline' }[];
  facts: { label: string; value: string }[];
  description: string;
  story: string | null;
  milestones: { date: string; title: string; story: string }[];
  specs: { label: string; stock: string; value: string; changed: boolean }[] | null;
  mods: { category: string; items: { name: string; detail: string; cost: string | null }[] }[] | null;
  modCount: number;
  modsTotal: string | null;
  maintenance: { count: number; last: { title: string; date: string } | null; total: string | null; recent: { title: string; date: string; cost: string | null }[] } | null;
  track: { events: number; bests: { venue: string; lap: string }[]; recent: { title: string; date: string; line: string }[] } | null;
  /** Only with "costos" on; the rows of the Cifras card, already worded. */
  costs: { rows: { label: string; value: string }[]; total: string; perKm: string | null; since: string | null } | null;
  /** Only with show_tires: "14 gomas · 6 quemadas · 4 montadas" and the highest badge earned. */
  tires: { count: number; line: string; badge: string | null } | null;
  /** "Lo que uso", grouped, only when present in the raw dossier. */
  memory: { title: string; rows: { label: string; value: string }[] }[] | null;
  heroUrl: string | null;
  photos: { id: string; full: string; thumb: string }[];
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthYear(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dop(n: number): string {
  return `RD$ ${Math.round(n).toLocaleString('en-US')}`;
}

const COST_LABELS: [keyof NonNullable<RawDossier['costs']>['by_category'], string][] = [
  ['mods', 'Mods'],
  ['mantenimiento', 'Mantenimiento'],
  ['combustible', 'Combustible'],
  ['pista', 'Pista'],
  ['otros', 'Otros'],
];

/** The page's tire words; the order the line reads (ADR-45). */
const TIRE_STATUS_WORDS: [string, string, string][] = [
  ['quemada', 'quemada', 'quemadas'],
  ['vendida', 'vendida', 'vendidas'],
  ['en_uso', 'montada', 'montadas'],
  ['guardada', 'guardada', 'guardadas'],
  ['nueva', 'nueva', 'nuevas'],
];

/**
 * lib/domain/tireStats.ts TIRE_BADGES with es.ts's names, copied because this
 * file bundles into the Vercel function without the i18n layer; a test keeps
 * the two in step.
 */
export const TIRE_BADGE_NAMES: { threshold: number; name: string }[] = [
  { threshold: 4, name: 'Primer juego' },
  { threshold: 10, name: 'Quemagomas' },
  { threshold: 25, name: 'Fabricante de humo' },
  { threshold: 50, name: 'Cliente frecuente del gomero' },
  { threshold: 100, name: "Leyenda de lao'" },
];

const km = (n: number) => `${Math.round(n).toLocaleString('en-US')} km`;

const LABELS: Record<string, Record<string, string>> = {
  transmission: { manual: 'Manual', automatica: 'Automática', cvt: 'CVT', secuencial: 'Secuencial' },
  drivetrain: { fwd: 'FWD', rwd: 'RWD', awd: 'AWD' },
  origin: { jdm: 'JDM', usdm: 'USDM', eudm: 'EUDM', local: 'Agencia', otro: 'Importado' },
  status: { instalado: 'instalado', quitado: 'quitado', vendido: 'vendido', danado: 'dañado' },
  discipline: { track_day: 'Track day', drift: 'Drift', drag: 'Drag', autocross: 'Autocross', junte: 'Junte', prueba: 'Prueba' },
};

/** Public object URLs in carguy-public; `base` is the Supabase project URL. */
export function publicPhotoUrl(base: string, slugValue: string, mediaId: string, thumb = false): string {
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/carguy-public/${slugValue}/${mediaId}${thumb ? '.thumb' : ''}.jpg`;
}

const json = (raw: string | null | undefined): Record<string, unknown> => {
  try {
    const v = JSON.parse(raw || '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/**
 * The page's content in Bring-a-Trailer order: who the car is, its story, STOCK →
 * ACTUAL, the mods by category, how it has been kept, what it has done on track,
 * the photos.
 */
export function publicDossier(raw: RawDossier, opts: { storageBase: string }): Dossier {
  const v = raw.vehicle;
  const mods = raw.mods ?? null;
  const onCar = (mods ?? []).filter((m) => m.status === 'instalado');
  const lastDiscipline = raw.track?.[0]?.discipline ?? null;
  const tags = onCar.flatMap((m) => parseTags(m.tags));

  const badges: Dossier['badges'] = [];
  if (onCar.length && v.engine_code) badges.push({ label: v.engine_code.replace(/-/g, '').toUpperCase().slice(0, 12), tone: 'red' });
  if (lastDiscipline === 'drift' || tags.some((t) => t.toLowerCase() === 'drift')) badges.push({ label: 'DRIFT', tone: 'amber' });
  else if (lastDiscipline && lastDiscipline !== 'junte') badges.push({ label: 'TRACK', tone: 'amber' });
  for (const t of tags) {
    const b = modBadge([t]);
    if (b && !badges.some((x) => x.label === b.label) && badges.length < 3) badges.push(b);
  }
  if (v.origin === 'jdm' && badges.length < 3 && !badges.some((b) => b.label === 'JDM')) badges.push({ label: 'JDM', tone: 'outline' });

  const title = [v.year, v.make, v.model].filter(Boolean).join(' ') || v.name;
  const facts: Dossier['facts'] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value != null && value !== '') facts.push({ label, value: String(value) });
  };
  add('Chasis', v.chassis_code);
  add('Motor', v.engine_code);
  add('Caja', v.transmission ? LABELS.transmission[v.transmission] ?? v.transmission : null);
  add('Tracción', v.drivetrain ? LABELS.drivetrain[v.drivetrain] ?? v.drivetrain : null);
  add('Origen', v.origin ? LABELS.origin[v.origin] ?? v.origin : null);
  add('Importado', v.imported_year);
  add('Color', v.color);
  if (raw.show.status && v.status && isVehicleStatus(v.status)) {
    const since = v.status_since ? ` · desde ${monthYear(v.status_since)}` : '';
    const note = v.status_note ? ` · ${v.status_note}` : '';
    add('Estado', `${statusLabel(v.status)}${since}${note}`);
  }
  if (raw.odometer_km != null) add('Odómetro', km(raw.odometer_km));
  add('Placa', v.plate);
  add('VIN', v.vin);

  // STOCK → ACTUAL: only fields that have a value.
  let specs: Dossier['specs'] = null;
  if (mods && raw.specsheet !== undefined) {
    const current = currentSpecs(
      json(raw.specsheet?.stock),
      mods.map((m) => ({ id: m.id, name: m.name, status: m.status as 'instalado', installedAt: m.installed_at, specEffects: m.spec_effects ?? '{}', affectsSpecs: m.affects_specs })),
      json(raw.specsheet?.overrides),
    );
    specs = SPEC_FIELDS.filter((f) => current[f.key]?.value != null).map((f) => {
      const c = current[f.key];
      return { label: f.label, stock: formatSpec(f.key, c.stock), value: formatSpec(f.key, c.value), changed: c.stock != null ? c.stock !== c.value : c.source?.kind !== 'stock' };
    });
  }

  let modGroups: Dossier['mods'] = null;
  let modsTotal: string | null = null;
  if (mods) {
    const groups = new Map<string, Dossier['mods'] extends (infer G)[] | null ? G : never>();
    for (const m of mods) {
      const cat = m.category ?? 'Otro';
      if (!groups.has(cat)) groups.set(cat, { category: cat, items: [] });
      const when = m.status === 'instalado' ? monthYear(m.installed_at) : `${LABELS.status[m.status] ?? m.status}${m.removed_at ? ` ${monthYear(m.removed_at)}` : ''}`;
      groups.get(cat)!.items.push({
        name: [m.name, m.variant].filter(Boolean).join(' · '),
        detail: [m.brand, when].filter(Boolean).join(' · '),
        cost: m.cost_dop != null && m.cost_dop > 0 ? dop(m.cost_dop) : null,
      });
    }
    modGroups = [...groups.values()];
    if (raw.show.costs) {
      // A mod migrated from a v2.0 "mejora" record carries that record's cost; count it once.
      modsTotal = dop(mods.reduce((t, m) => t + (m.cost_dop ?? 0), 0));
    }
  }

  let maintenance: Dossier['maintenance'] = null;
  if (raw.services) {
    const list = raw.services;
    maintenance = {
      count: list.length,
      last: list[0] ? { title: list[0].title, date: shortDate(list[0].occurred_at) } : null,
      total: raw.show.costs ? dop(list.reduce((t, r) => t + (r.total_dop ?? 0), 0)) : null,
      recent: list.slice(0, 8).map((r) => ({ title: r.title, date: shortDate(r.occurred_at), cost: r.total_dop != null && r.total_dop > 0 ? dop(r.total_dop) : null })),
    };
  }

  let track: Dossier['track'] = null;
  if (raw.track) {
    const best = new Map<string, number>();
    for (const e of raw.track) {
      if (!isTimed(e.discipline as never) || !e.best_lap_ms) continue;
      const venue = [e.venue ?? 'Pista', e.layout?.trim() || null].filter(Boolean).join(' · ');
      if (!best.has(venue) || e.best_lap_ms < best.get(venue)!) best.set(venue, e.best_lap_ms);
    }
    track = {
      events: raw.track.length,
      bests: [...best.entries()].map(([venue, ms]) => ({ venue, lap: formatLap(ms) })),
      recent: raw.track.slice(0, 6).map((e) => ({
        title: e.title || e.venue || 'Evento',
        date: shortDate(e.occurred_at),
        line: [LABELS.discipline[e.discipline] ?? e.discipline, e.venue, e.layout, `${e.sessions} ${e.sessions === 1 ? 'sesión' : 'sesiones'}`, isTimed(e.discipline as never) ? (e.best_lap_ms ? formatLap(e.best_lap_ms) : null) : e.runs ? `${e.runs} runs` : null]
          .filter(Boolean)
          .join(' · '),
      })),
    };
  }

  let costs: Dossier['costs'] = null;
  if (raw.show.costs && raw.costs) {
    const c = raw.costs;
    const rows: { label: string; value: string }[] = [];
    if (c.purchase_dop != null) rows.push({ label: 'Compra', value: dop(c.purchase_dop) });
    if (c.sold_dop != null) rows.push({ label: 'Venta', value: `− ${dop(c.sold_dop)}` });
    for (const [key, label] of COST_LABELS) {
      const n = c.by_category[key] ?? 0;
      if (n !== 0) rows.push({ label, value: dop(n) });
    }
    costs = {
      rows,
      total: dop(c.total_dop),
      perKm: c.per_km_dop != null ? `RD$ ${c.per_km_dop.toFixed(2)}/km` : null,
      since: c.since ? `Desde ${monthYear(c.since)}` : null,
    };
  }

  let tires: Dossier['tires'] = null;
  if (raw.tires && raw.tires.count > 0) {
    const by = new Map(raw.tires.badges.map((b) => [b.status, b.count]));
    const parts = [`${raw.tires.count} ${raw.tires.count === 1 ? 'goma' : 'gomas'}`];
    for (const [status, one, many] of TIRE_STATUS_WORDS) {
      const n = by.get(status) ?? 0;
      if (n) parts.push(`${n} ${n === 1 ? one : many}`);
    }
    const earned = TIRE_BADGE_NAMES.filter((b) => raw.tires!.count >= b.threshold).pop();
    tires = { count: raw.tires.count, line: parts.join(' · '), badge: earned?.name ?? null };
  }

  let memory: Dossier['memory'] = null;
  if (raw.memory?.length) {
    const groups = new Map<string, { title: string; rows: { label: string; value: string }[] }>();
    for (const r of raw.memory) {
      if (!groups.has(r.section)) groups.set(r.section, { title: r.title, rows: [] });
      groups.get(r.section)!.rows.push({ label: r.label, value: r.value });
    }
    memory = [...groups.values()];
  }

  const s = raw.slug;
  const photos = s ? raw.photos.map((id) => ({ id, full: publicPhotoUrl(opts.storageBase, s, id), thumb: publicPhotoUrl(opts.storageBase, s, id, true) })) : [];
  const heroId = v.hero_media_id ?? raw.photos[0] ?? null;

  const description = [
    [v.chassis_code, v.engine_code].filter(Boolean).join(' · ') || null,
    mods ? `${onCar.length} ${onCar.length === 1 ? 'mod' : 'mods'}` : null,
    raw.track?.length ? `${raw.track.length} ${raw.track.length === 1 ? 'evento de pista' : 'eventos de pista'}` : null,
    v.story ? v.story.slice(0, 120) + (v.story.length > 120 ? '…' : '') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    slug: s,
    indexable: raw.visibility === 'public',
    title,
    name: v.name,
    nickname: v.nickname,
    badges,
    facts,
    description: description || 'Hecho con Car Guy',
    story: v.story || null,
    milestones: (raw.milestones ?? []).map((m) => ({ date: monthYear(m.occurred_at), title: m.title, story: m.story })),
    specs,
    mods: modGroups,
    modCount: onCar.length,
    modsTotal,
    maintenance,
    track,
    costs,
    tires,
    memory,
    heroUrl: s && heroId ? publicPhotoUrl(opts.storageBase, s, heroId) : null,
    photos,
  };
}
