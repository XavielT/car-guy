import {
  badgesFor,
  garageTireStats,
  messagesFor,
  nextBadge,
  tireStats,
  type ConsumableInput,
  type TireInput,
  type WheelSetInput,
} from '@/lib/domain/tireStats';

const NOW = new Date(2026, 8, 30, 12, 0, 0); // 30 Sep 2026

let n = 0;
function tire(vehicleId: string, date: string | null, status: TireInput['status'], over: Partial<TireInput> = {}): TireInput {
  n += 1;
  return {
    id: `${vehicleId}-t${n}`,
    vehicleId,
    wheelSetId: null,
    brand: 'Federal',
    model: '595 RS-R',
    size: '195/50R15',
    position: status === 'en_uso' ? 'rl' : 'unmounted',
    status,
    heatCycles: 0,
    purchasedAt: date,
    costDop: 5000,
    dotCode: null,
    treadMmNew: null,
    treadMmCurrent: null,
    createdAt: `${date ?? '2026-08-20'}T12:00:00.000Z`,
    updatedAt: `${date ?? '2026-08-20'}T12:00:00.000Z`,
    deletedAt: null,
    ...over,
  };
}

/**
 * The seed's Trueno (Phase 2 §4): 14 tire rows over two years. Two sets burned
 * and sold, a set on the car now (one rear past the heat-cycle limit), a pair of
 * track spares nobody priced.
 */
function truenoTires(): TireInput[] {
  const retiredA = { updatedAt: '2025-03-01T12:00:00.000Z' };
  const retiredB = { updatedAt: '2025-11-10T12:00:00.000Z' };
  return [
    ...Array.from({ length: 4 }, () => tire('trueno', '2024-10-05', 'quemada', { costDop: 4500, ...retiredA })),
    tire('trueno', '2025-03-01', 'quemada', retiredB),
    tire('trueno', '2025-03-01', 'quemada', retiredB),
    tire('trueno', '2025-03-01', 'vendida', retiredB),
    tire('trueno', '2025-03-01', 'vendida', retiredB),
    tire('trueno', '2026-04-15', 'en_uso', { costDop: 6000, heatCycles: 9, position: 'rl', brand: 'Nankang', model: 'NS-2R', dotCode: 'DOT XX 1526' }),
    tire('trueno', '2026-04-15', 'en_uso', { costDop: 6000, heatCycles: 5, position: 'rr', treadMmNew: 8, treadMmCurrent: 5 }),
    tire('trueno', '2026-04-15', 'en_uso', { costDop: 6000, heatCycles: 3, position: 'fl' }),
    tire('trueno', '2026-04-15', 'en_uso', { costDop: 6000, heatCycles: 3, position: 'fr' }),
    tire('trueno', null, 'nueva', { costDop: null }),
    tire('trueno', null, 'guardada', { costDop: null }),
  ];
}

const DS3_TIRES = (): TireInput[] =>
  Array.from({ length: 4 }, () => tire('ds3', '2025-06-10', 'en_uso', { brand: 'Michelin', model: 'Primacy 4', size: '205/55R16', costDop: 7500 }));

const SETS: WheelSetInput[] = [
  { id: 'ws-trueno', vehicleId: 'trueno' },
  { id: 'ws-ds3', vehicleId: 'ds3' },
];

describe('tireStats on the seed’s Trueno', () => {
  const tires = [...truenoTires(), ...DS3_TIRES(), tire('trueno', '2026-09-01', 'en_uso', { deletedAt: '2026-09-02T00:00:00Z' })];
  const s = tireStats(tires, SETS, 'trueno', { now: NOW });

  it('counts by status, only this car’s live rows', () => {
    expect(s.total).toBe(14);
    expect(s.byStatus).toEqual({ nueva: 1, en_uso: 4, guardada: 1, quemada: 6, vendida: 2 });
    expect(s).toMatchObject({ mounted: 4, active: 6, retired: 8, burned: 6 });
  });

  it('by year, this year, money', () => {
    expect(s.byYear).toEqual([
      { year: 2024, count: 4 },
      { year: 2025, count: 4 },
      { year: 2026, count: 6 },
    ]);
    expect(s.thisYear).toBe(6);
    expect(s.spentDop).toBe(4 * 4500 + 4 * 5000 + 4 * 6000);
    expect(s.pricedCount).toBe(12);
  });

  it('pace over the last 6 months and the next-set ETA', () => {
    // 6 tires since April = 1.5 sets in 6 months; one set every ~122 days after 20 Aug.
    expect(s.setsPerMonth).toBe(0.25);
    expect(s.nextSetInDays).toBe(80);
  });

  it('per tire: age to retirement or now, DOT age, tread used, heat warning', () => {
    expect(s.perTire).toHaveLength(14);
    const first = s.perTire[0];
    expect(first).toMatchObject({ status: 'quemada', label: 'Federal 595 RS-R · 195/50R15' });
    expect(first.ageDays).toBe(147); // 5 Oct 2024 → 1 Mar 2025
    const hot = s.perTire.find((p) => p.heatCycles === 9)!;
    expect(hot).toMatchObject({ label: 'Nankang NS-2R · 195/50R15', overHeatCycles: true, dotAgeYears: 0.5 });
    expect(s.perTire.find((p) => p.heatCycles === 5)!.treadUsedPct).toBe(38);
    expect(s.heatWarnings.map((w) => w.heatCycles)).toEqual([9]);
  });

  it('the heat-cycle limit is a setting', () => {
    expect(tireStats(tires, SETS, 'trueno', { now: NOW, heatCycleLimit: 4 }).heatWarnings.map((w) => w.heatCycles)).toEqual([9, 5]);
  });

  it('badges: thresholds, the date of the n-th tire, what is left', () => {
    const badges = badgesFor(s);
    expect(badges.map((b) => [b.id, b.earned, b.reachedAt, b.remaining])).toEqual([
      ['primer_juego', true, '2024-10-05', 0],
      ['quemagomas', true, '2026-04-15', 0],
      ['fabricante_humo', false, null, 11],
      ['cliente_gomero', false, null, 36],
      ['leyenda_lao', false, null, 86],
    ]);
    expect(badges.map((b) => b.label)).toEqual(['Primer juego', 'Quemagomas', 'Fabricante de humo', 'Cliente frecuente del gomero', "Leyenda de lao'"]);
    expect(badgesFor(s, 'en')[0].label).toBe('First set');
    expect(nextBadge(s)?.id).toBe('fabricante_humo');
  });

  it('messages, Spanish and English', () => {
    expect(messagesFor(s)).toEqual([
      '14 gomas · 6 este año',
      '≈ RD$ 62,000 en gomas',
      'Al ritmo actual, próximo juego en ~3 meses',
      'Faltan 11 para «Fabricante de humo»',
      'Nankang NS-2R · 195/50R15 lleva 9 ciclos de calor — revísala',
    ]);
    expect(messagesFor(s, 'en')[0]).toBe('14 tires · 6 this year');
    expect(messagesFor(s, 'en')[3]).toBe('11 to go for “Smoke machine”');
  });
});

describe('consumables (track-day goma_quemada)', () => {
  const tires = truenoTires();
  const mounted = tires.find((t) => t.status === 'en_uso')!;
  const usage = (over: Partial<ConsumableInput>): ConsumableInput => ({
    id: `c${Math.random()}`,
    kind: 'goma_quemada',
    tireId: null,
    wheelSetId: null,
    qty: 1,
    createdAt: '2026-09-14T15:00:00.000Z',
    deletedAt: null,
    ...over,
  });

  it('a linked one burns that tire once; an unlinked one on this car’s set adds qty tires', () => {
    const s = tireStats(tires, SETS, 'trueno', {
      now: NOW,
      consumables: [
        usage({ tireId: mounted.id }),
        usage({ tireId: mounted.id }),
        usage({ wheelSetId: 'ws-trueno', qty: 2 }),
        usage({ wheelSetId: 'ws-ds3', qty: 4 }),
        usage({ kind: 'ciclo_goma', tireId: mounted.id }),
        usage({ wheelSetId: 'ws-trueno', deletedAt: 'x' }),
      ],
    });
    expect(s.total).toBe(16);
    expect(s.burned).toBe(6 + 1 + 2);
    expect(s.thisYear).toBe(8);
    expect(s.datedAsc.filter((d) => d === '2026-09-14')).toHaveLength(2);
  });

  it('without wheel sets an unlinked one cannot be attributed to a car', () => {
    expect(tireStats(tires, null, 'trueno', { now: NOW, consumables: [usage({ wheelSetId: 'ws-trueno' })] }).total).toBe(14);
  });
});

describe('garageTireStats', () => {
  it('every car together', () => {
    const s = garageTireStats([...truenoTires(), ...DS3_TIRES()], { now: NOW });
    expect(s.total).toBe(18);
    expect(s.mounted).toBe(8);
    expect(s.spentDop).toBe(62000 + 4 * 7500);
  });
});

describe('edge cases', () => {
  it('no tires: zeros, no pace, one message', () => {
    const s = tireStats([], [], 'x', { now: NOW });
    expect(s).toMatchObject({ total: 0, burned: 0, setsPerMonth: 0, nextSetInDays: null, perTire: [] });
    expect(messagesFor(s)).toEqual(['Todavía no hay gomas registradas']);
    expect(badgesFor(s).every((b) => !b.earned)).toBe(true);
  });

  it('a busy car is due now; no costs means no money line', () => {
    const tires = Array.from({ length: 8 }, (_, i) => tire('drift', i < 4 ? '2026-06-01' : '2026-07-01', 'quemada', { costDop: null }));
    const s = tireStats(tires, [], 'drift', { now: NOW });
    expect(s.nextSetInDays).toBe(0);
    expect(messagesFor(s)).toEqual(['8 gomas · 8 este año', 'Al ritmo actual, ya toca otro juego', 'Faltan 2 para «Quemagomas»']);
  });
});

describe('counting rules: status changes and consumables', () => {
  it('a mounted tire later sold or burned counts once, retired, aged to its last edit', () => {
    const sold = tire('x', '2025-01-10', 'vendida', { updatedAt: '2025-04-10T12:00:00.000Z' });
    const burned = tire('x', '2025-01-10', 'quemada', { updatedAt: '2025-02-09T12:00:00.000Z' });
    const s = tireStats([sold, burned], [], 'x', { now: NOW });
    expect(s).toMatchObject({ total: 2, retired: 2, burned: 1, mounted: 0, active: 0 });
    expect(s.perTire.map((p) => p.ageDays).sort((a, b) => a - b)).toEqual([30, 90]);
  });

  it('a goma_quemada usage on a tire already marked quemada is not counted twice', () => {
    const burned = tire('x', '2026-05-01', 'quemada');
    const s = tireStats([burned], [], 'x', {
      now: NOW,
      consumables: [{ id: 'u1', kind: 'goma_quemada', tireId: burned.id, wheelSetId: null, qty: 1, createdAt: '2026-05-20T00:00:00Z' }],
    });
    expect(s).toMatchObject({ total: 1, burned: 1 });
  });

  it('a heat warning only for a mounted tire past the limit', () => {
    const stored = tire('x', '2026-05-01', 'guardada', { heatCycles: 20 });
    const mounted = tire('x', '2026-05-01', 'en_uso', { heatCycles: 8 });
    expect(tireStats([stored, mounted], [], 'x', { now: NOW }).heatWarnings).toEqual([]);
    expect(tireStats([stored, mounted], [], 'x', { now: NOW, heatCycleLimit: 7 }).heatWarnings.map((w) => w.id)).toEqual([mounted.id]);
  });
});

describe('pace and badge dates', () => {
  it('4 tires in the last 6 months is 0.17 sets a month; the next set is due ~6 months after the last', () => {
    const s = tireStats(Array.from({ length: 4 }, () => tire('p', '2026-09-01', 'en_uso')), [], 'p', { now: NOW });
    expect(s.setsPerMonth).toBe(0.17);
    expect(s.nextSetInDays).toBeGreaterThan(150);
    expect(messagesFor(s)[2]).toBe('Al ritmo actual, próximo juego en ~5 meses');
  });

  it('tires older than 6 months set no pace', () => {
    expect(tireStats([tire('p', '2025-01-01', 'quemada')], [], 'p', { now: NOW }).nextSetInDays).toBeNull();
  });

  it('a badge is dated by the n-th tire, undated rows sort by when they were written down', () => {
    const rows = [
      tire('b', '2026-01-03', 'quemada'),
      tire('b', null, 'nueva', { createdAt: '2025-12-01T10:00:00.000Z' }),
      tire('b', '2025-11-02', 'quemada'),
      tire('b', '2026-02-10', 'quemada'),
    ];
    const s = tireStats(rows, [], 'b', { now: NOW });
    expect(badgesFor(s)[0]).toMatchObject({ id: 'primer_juego', earned: true, reachedAt: '2026-02-10' });
    expect(s.datedAsc).toEqual(['2025-11-02', '2025-12-01', '2026-01-03', '2026-02-10']);
    expect(nextBadge(s, 'en')).toMatchObject({ id: 'quemagomas', label: 'Tire burner', remaining: 6 });
  });
});
