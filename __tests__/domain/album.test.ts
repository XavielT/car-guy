import {
  albumYears,
  buildTimeline,
  dateAtPrecision,
  dupKey,
  flattenGrid,
  formatBytes,
  fitsQuota,
  gridLayout,
  gridSections,
  isDuplicate,
  jsonObject,
  odometerNear,
  parseExifDate,
  resolveTakenAt,
  stateAt,
  storageLevel,
  type TimelinePhoto,
} from '@/lib/domain/album';

const local = (y: number, m: number, d: number, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const photo = (id: string, takenAt: string | null, over: Partial<TimelinePhoto> = {}): TimelinePhoto => ({
  id,
  takenAt,
  createdAt: local(2026, 9, 28),
  precision: 'day',
  ...over,
});

describe('parseExifDate', () => {
  it('reads EXIF as local wall-clock time, not UTC', () => {
    expect(parseExifDate('2019:06:15 14:30:05')).toBe(new Date(2019, 5, 15, 14, 30, 5).toISOString());
  });
  it('accepts dashes and a T', () => expect(parseExifDate('2019-06-15T14:30')).toBe(new Date(2019, 5, 15, 14, 30).toISOString()));
  it('passes a Date through (exifr on web)', () => expect(parseExifDate(new Date(2020, 0, 2))).toBe(new Date(2020, 0, 2).toISOString()));
  it('rejects the unset camera clock and junk', () => {
    expect(parseExifDate('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDate('ayer')).toBeNull();
    expect(parseExifDate(undefined)).toBeNull();
    expect(parseExifDate(new Date('x'))).toBeNull();
  });
});

describe('resolveTakenAt', () => {
  const now = new Date(2026, 8, 28);
  it('prefers EXIF', () => expect(resolveTakenAt({ exif: '2018:03:01 09:00:00', fileTimeMs: Date.UTC(2024, 0, 1) }, now)).toEqual({ takenAt: new Date(2018, 2, 1, 9).toISOString(), source: 'exif' }));
  it('falls back to the file time', () => expect(resolveTakenAt({ fileTimeMs: Date.UTC(2021, 4, 1) }, now)).toEqual({ takenAt: new Date(Date.UTC(2021, 4, 1)).toISOString(), source: 'file' }));
  it('ignores a future EXIF and a broken file clock', () => {
    expect(resolveTakenAt({ exif: '2030:01:01 00:00:00', fileTimeMs: 0 }, now)).toEqual({ takenAt: null, source: 'none' });
  });
});

describe('dateAtPrecision', () => {
  it('month and year land on the 1st at noon local', () => {
    expect(dateAtPrecision(2019, 5, 20, 'month')).toBe(new Date(2019, 5, 1, 12).toISOString());
    expect(dateAtPrecision(2019, 5, 20, 'year')).toBe(new Date(2019, 0, 1, 12).toISOString());
    expect(dateAtPrecision(2019, 5, 20, 'day')).toBe(new Date(2019, 5, 20, 12).toISOString());
  });
});

describe('duplicates', () => {
  const a = { width: 1600, height: 1200, takenAt: '2019-06-15T18:30:05.000Z', sizeBytes: 250000 };
  it('same shape, same minute → duplicate', () => expect(isDuplicate({ ...a, takenAt: '2019-06-15T18:30:59.000Z' }, [a])).toBe(true));
  it('a different size is a different photo', () => expect(isDuplicate({ ...a, sizeBytes: 250001 }, [a])).toBe(false));
  it('no date and no size can never be proven a duplicate', () => {
    expect(dupKey({ width: 1, height: 1, takenAt: null, sizeBytes: null })).toBeNull();
    expect(isDuplicate({ width: 1, height: 1, takenAt: null, sizeBytes: null }, [{ width: 1, height: 1, takenAt: null, sizeBytes: null }])).toBe(false);
  });
});

describe('buildTimeline', () => {
  const photos = [
    photo('p1', local(2025, 8, 10)),
    photo('p2', local(2025, 8, 12), { milestoneId: 'm1' }),
    photo('p3', local(2025, 3, 2)),
    photo('p4', local(2019, 1, 1), { precision: 'year' }),
    photo('p5', local(2019, 6, 1), { precision: 'month' }),
    photo('p6', null, { createdAt: local(2025, 8, 20) }),
    photo('p7', local(2024, 1, 1), { modId: 'gone' }),
  ];
  const events = [
    { kind: 'hito' as const, id: 'm1', date: local(2025, 8, 12), title: 'Motor 4AGE 20V instalado', milestoneKind: 'swap' },
    { kind: 'mod' as const, id: 'mod1', date: local(2025, 8, 5), title: 'Aros 15x8' },
  ];
  const sections = buildTimeline({
    photos,
    events,
    readings: [
      { occurredAt: local(2025, 7, 28), valueKm: 52100 },
      { occurredAt: local(2025, 3, 15), valueKm: 48300 },
    ],
    modPairs: { mod1: { before: 'pa', after: 'pd' } },
  });

  it('orders sections newest first; a year-only section sits after its months', () => {
    expect(sections.map((s) => s.key)).toEqual(['2025-08', '2025-03', '2024-01', '2019-06', '2019']);
  });
  it('photos linked to an event ride on its card; the rest collapse into one FOTOS card', () => {
    const aug = sections[0];
    expect(aug.items.map((i) => i.kind)).toEqual(['fotos', 'hito', 'mod']);
    expect(aug.items[1].photos.map((p) => p.id)).toEqual(['p2']);
    // p6 has no date: it files under the day it was added.
    expect(aug.items[0].photos.map((p) => p.id)).toEqual(['p6', 'p1']);
  });
  it('keeps the ANTES/DESPUÉS pair on a mod', () => {
    const mod = sections[0].items.find((i) => i.kind === 'mod')!;
    expect(mod.kind === 'mod' && [mod.before, mod.after]).toEqual(['pa', 'pd']);
  });
  it('a photo linked to a record the timeline does not show is still in the album', () => {
    expect(sections.find((s) => s.key === '2024-01')!.items[0].photos.map((p) => p.id)).toEqual(['p7']);
  });
  it('month headers carry the odometer nearest to the month start', () => {
    expect(sections[0].odometerKm).toBe(52100);
    expect(sections[1].odometerKm).toBe(48300);
    expect(sections.find((s) => s.key === '2019')!.odometerKm).toBeNull();
  });
});

describe('odometerNear', () => {
  it('takes the first reading inside the month when there is none before', () => {
    expect(odometerNear([{ occurredAt: local(2025, 3, 20), valueKm: 48500 }], 2025, 2)).toBe(48500);
  });
});

describe('grid', () => {
  const photos = Array.from({ length: 7 }, (_, i) => photo(`g${i}`, local(2025, 8, i + 1)));
  it('flattens into headers and rows of three with fixed-height offsets', () => {
    const rows = flattenGrid(gridSections([...photos, photo('old', local(2024, 2, 1))]));
    expect(rows.map((r) => r.type)).toEqual(['header', 'photos', 'photos', 'photos', 'header', 'photos']);
    expect(rows[3].type === 'photos' && rows[3].photos.length).toBe(1);
    const layout = gridLayout(rows, 40, 120);
    expect(layout[4]).toEqual({ length: 40, offset: 40 + 120 * 3 });
  });
});

describe('albumYears', () => {
  const today = new Date(2026, 8, 28);
  it('from the earlier of purchase and oldest photo to sale or today', () => {
    expect(albumYears({ acquiredAt: '2021-06-01', oldestPhoto: '2019-03-01', today })).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
    expect(albumYears({ acquiredAt: '2018-01-01', soldAt: '2021-05-01', today })).toEqual([2021, 2020, 2019, 2018]);
    expect(albumYears({ today })).toEqual([2026]);
  });
});

describe('stateAt', () => {
  const mods = [
    { id: 'a', name: 'Swap 4A-GE 20V', status: 'instalado', installedAt: local(2025, 8, 1), removedAt: null, specEffects: { engine_code: '4A-GE 20V', hp: 160 } },
    { id: 'b', name: 'Aros viejos', status: 'quitado', installedAt: local(2022, 1, 1), removedAt: local(2025, 1, 1), specEffects: { wheel_f: '14x6' } },
    { id: 'c', name: 'Coilovers', status: 'planeado', installedAt: local(2024, 1, 1), removedAt: null, specEffects: { height: '-40 mm' } },
  ];
  const input = {
    photos: Array.from({ length: 8 }, (_, i) => photo(`s${i}`, local(2024, i + 1, 1))),
    mods,
    readings: [
      { occurredAt: local(2024, 6, 1), valueKm: 45000 },
      { occurredAt: local(2025, 9, 1), valueKm: 52000 },
    ],
    stock: { engine_code: '3A-U', hp: 78, wheel_f: '13x5' },
  };

  it('mid-2024: stock engine, old wheels, no planned mods, last six photos', () => {
    const s = stateAt(local(2024, 7, 15), input);
    expect(s.specs).toEqual({ engine_code: '3A-U', hp: 78, wheel_f: '14x6' });
    expect(s.specSource).toEqual({ wheel_f: 'Aros viejos' });
    expect(s.modsInstalled.map((m) => m.id)).toEqual(['b']);
    expect(s.odometerKm).toBe(45000);
    expect(s.photos.map((p) => p.id)).toEqual(['s6', 's5', 's4', 's3', 's2', 's1']);
  });
  it('after the swap and with the old wheels gone', () => {
    const s = stateAt(local(2025, 9, 15), input);
    expect(s.specs).toMatchObject({ engine_code: '4A-GE 20V', hp: 160, wheel_f: '13x5' });
    expect(s.modsInstalled.map((m) => m.id)).toEqual(['a']);
    expect(s.odometerKm).toBe(52000);
  });
  it('before any record', () => {
    const s = stateAt(local(2020, 1, 1), input);
    expect(s).toMatchObject({ odometerKm: null, modsInstalled: [], photos: [] });
  });
  it('jsonObject never throws', () => {
    expect(jsonObject('{"hp":1}')).toEqual({ hp: 1 });
    expect(jsonObject('[1]')).toEqual({});
    expect(jsonObject('nope')).toEqual({});
    expect(jsonObject(null)).toEqual({});
  });
});

describe('storage meter', () => {
  const quota = 300 * 1024 * 1024;
  it('warns at 90 %, pauses at 100 %', () => {
    expect(storageLevel(0.5 * quota, quota)).toBe('ok');
    expect(storageLevel(0.9 * quota, quota)).toBe('warn');
    expect(storageLevel(quota, quota)).toBe('full');
    expect(storageLevel(10, null)).toBe('ok');
  });
  it('fitsQuota', () => {
    expect(fitsQuota(quota - 100, quota, 100)).toBe(true);
    expect(fitsQuota(quota - 100, quota, 101)).toBe(false);
    expect(fitsQuota(5, 0, 10)).toBe(true);
  });
  it('formatBytes', () => {
    expect(formatBytes(42 * 1024 * 1024)).toBe('42 MB');
    expect(formatBytes(1.2 * 1024 ** 3)).toBe('1.2 GB');
    expect(formatBytes(300)).toBe('1 KB');
  });
});

describe('check photos on the timeline (IMP 29092026 note 3)', () => {
  it('ride on their CHEQUEO card instead of the loose FOTOS card', () => {
    const { buildTimeline } = jest.requireActual('@/lib/domain/album') as typeof import('@/lib/domain/album');
    const sections = buildTimeline({
      photos: [
        { id: 'p1', takenAt: '2026-09-26T12:00:00.000Z', createdAt: '2026-09-26T12:00:00.000Z', precision: 'day', inspectionId: 'ins1' },
        { id: 'p2', takenAt: '2026-09-26T12:00:00.000Z', createdAt: '2026-09-26T12:00:00.000Z', precision: 'day' },
      ],
      events: [{ kind: 'chequeo', id: 'ins1', date: '2026-09-26T12:00:00.000Z', title: 'Fugas debajo del carro' }],
    });
    const items = sections[0].items;
    const check = items.find((i) => i.kind === 'chequeo');
    expect(check?.photos.map((p) => p.id)).toEqual(['p1']);
    expect(items.find((i) => i.kind === 'fotos')?.photos.map((p) => p.id)).toEqual(['p2']);
  });
});
