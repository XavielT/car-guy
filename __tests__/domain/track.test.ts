import {
  copyForward,
  describeChanges,
  diffSheets,
  eventSummary,
  flagRearGrowth,
  formatLap,
  formatSeconds,
  heatCycles,
  isTimed,
  padLife,
  parseLap,
  personalBests,
  pressureDeltas,
} from '@/lib/domain/track';

describe('lap times', () => {
  it('parses m:ss.mmm, seconds, and partial fractions', () => {
    expect(parseLap('1:23.456')).toBe(83456);
    expect(parseLap('83.456')).toBe(83456);
    expect(parseLap('1:23')).toBe(83000);
    expect(parseLap('0:59.9')).toBe(59900);
    expect(parseLap('1:05,12')).toBe(65120);
    expect(parseLap(' 2:00.001 ')).toBe(120001);
  });

  it('rejects what is not a time', () => {
    expect(parseLap('')).toBeNull();
    expect(parseLap(null)).toBeNull();
    expect(parseLap('1:75.000')).toBeNull();
    expect(parseLap('rápido')).toBeNull();
    expect(parseLap('1:2:3')).toBeNull();
  });

  it('formats ms back the same way, round trip', () => {
    expect(formatLap(83456)).toBe('1:23.456');
    expect(formatLap(59900)).toBe('0:59.900');
    expect(formatLap(null)).toBe('—');
    for (const s of ['1:23.456', '0:07.010', '12:00.000']) expect(formatLap(parseLap(s))).toBe(s);
    expect(formatSeconds(8456)).toBe('8.456 s');
  });
});

const SESSION_1 = { psiColdFl: 30, psiColdFr: 30, psiColdRl: 40, psiColdRr: 40, psiHotFl: 34, psiHotFr: 34, psiHotRl: 49, psiHotRr: 48, steeringAngleDeg: 55, hydro: true, lsdType: 'soldado' };

describe('copy-forward', () => {
  it('copies the sheet and nothing marked as changed', () => {
    const next = copyForward({ ...SESSION_1, id: 's1', sessionId: 's1', changedFromPrevious: '["psiColdRl"]' });
    expect(next.psiColdRl).toBe(40);
    expect(next.hydro).toBe(true);
    expect(next.changedFromPrevious).toBe('[]');
    expect('id' in next).toBe(false);
    expect('sessionId' in next).toBe(false);
  });

  it('starts empty when there is no previous session', () => {
    expect(copyForward(null)).toEqual({ changedFromPrevious: '[]' });
  });

  it('diffs only what moved, and the note groups a pair', () => {
    const next = { ...copyForward(SESSION_1), psiColdRl: 42, psiColdRr: 42 };
    const changes = diffSheets(SESSION_1, next);
    expect(changes.map((c) => c.key)).toEqual(['psiColdRl', 'psiColdRr']);
    expect(describeChanges(changes)).toEqual(['TI/TD 40 → 42']);
  });

  it('lists a single corner and a non-corner field on their own', () => {
    const next = { ...SESSION_1, psiColdRl: 38, lsdType: '2-way' };
    expect(describeChanges(diffSheets(SESSION_1, next))).toEqual(['TI 40 → 38', 'LSD soldado → 2-way']);
  });

  it('treats null and missing (and hydro off) as the same', () => {
    expect(diffSheets({ camberFl: null, hydro: false }, {})).toEqual([]);
    expect(diffSheets(null, SESSION_1)).toEqual([]);
  });
});

describe('pressures', () => {
  it('hot − cold per corner', () => {
    expect(pressureDeltas(SESSION_1)).toEqual({ fl: 4, fr: 4, rl: 9, rr: 8 });
    expect(pressureDeltas({ psiColdFl: 30 })).toEqual({ fl: null, fr: null, rl: null, rr: null });
  });

  it('flags a rear that grew more than 8 psi', () => {
    expect(flagRearGrowth(SESSION_1)).toBe(true);
    expect(flagRearGrowth({ ...SESSION_1, psiHotRl: 48 })).toBe(false); // exactly 8 is fine
    expect(flagRearGrowth({ psiColdFl: 30, psiHotFl: 45 })).toBe(false); // fronts never flag
  });
});

describe('eventSummary', () => {
  it('adds sessions, runs, laps, burned tires, km and costs', () => {
    const s = eventSummary(
      { odometerStartKm: 50_100, odometerEndKm: 50_162, entryFeeDop: 2500, fuelCostDop: 3000, otherCostDop: null },
      [
        { runs: 6, laps: null, bestLapMs: null, deletedAt: null },
        { runs: 8, laps: null, bestLapMs: null, deletedAt: null },
        { runs: 99, laps: null, bestLapMs: null, deletedAt: '2026-09-21' },
      ],
      [{ kind: 'goma_quemada', deletedAt: null }, { kind: 'ciclo_goma', deletedAt: null }],
    );
    expect(s).toEqual({ sessions: 2, runs: 14, laps: 0, bestLapMs: null, tiresBurned: 1, kmOnTrack: 62, spendDop: 5500 });
  });

  it('takes the best lap of the day, and no km when the odometer went backwards', () => {
    const s = eventSummary(
      { odometerStartKm: 100, odometerEndKm: 90, entryFeeDop: null, fuelCostDop: null, otherCostDop: null },
      [
        { runs: null, laps: 8, bestLapMs: 84_120, deletedAt: null },
        { runs: null, laps: 6, bestLapMs: 83_456, deletedAt: null },
      ],
      [],
    );
    expect(s.bestLapMs).toBe(83_456);
    expect(s.laps).toBe(14);
    expect(s.kmOnTrack).toBeNull();
  });
});

describe('personalBests', () => {
  const events = [
    { id: 'e1', venueId: 'sunix', occurredAt: '2026-05-01', discipline: 'track_day' as const, deletedAt: null },
    { id: 'e2', venueId: 'sunix', occurredAt: '2026-08-01', discipline: 'track_day' as const, deletedAt: null },
    { id: 'e3', venueId: 'sunix', occurredAt: '2026-09-01', discipline: 'drift' as const, deletedAt: null },
    { id: 'e4', venueId: 'otro', occurredAt: '2026-09-02', discipline: 'autocross' as const, deletedAt: null },
  ];
  const sessions = [
    { eventId: 'e1', bestLapMs: 85_000, deletedAt: null },
    { eventId: 'e2', bestLapMs: 83_456, deletedAt: null },
    { eventId: 'e2', bestLapMs: 82_000, deletedAt: '2026-08-02' },
    { eventId: 'e3', bestLapMs: 10_000, deletedAt: null },
    { eventId: 'e4', bestLapMs: 45_000, deletedAt: null },
  ];

  it('keeps the best timed lap per venue, fastest venue first; drift does not count', () => {
    expect(personalBests(events, sessions)).toEqual([
      { venueId: 'otro', bestLapMs: 45_000, eventId: 'e4', occurredAt: '2026-09-02' },
      { venueId: 'sunix', bestLapMs: 83_456, eventId: 'e2', occurredAt: '2026-08-01' },
    ]);
    expect(isTimed('drift')).toBe(false);
    expect(isTimed('junte')).toBe(false);
    expect(isTimed('drag')).toBe(true);
  });
});

describe('consumables', () => {
  it('counts heat cycles of one tire', () => {
    const usage = [
      { kind: 'ciclo_goma' as const, tireId: 't1', deletedAt: null },
      { kind: 'ciclo_goma' as const, tireId: 't1', deletedAt: null },
      { kind: 'ciclo_goma' as const, tireId: 't1', deletedAt: 'x' },
      { kind: 'ciclo_goma' as const, tireId: 't2', deletedAt: null },
      { kind: 'goma_quemada' as const, tireId: 't1', deletedAt: null },
    ];
    expect(heatCycles(usage, 't1')).toBe(2);
  });

  it('projects pad wear per session and fires under 5 mm', () => {
    const life = padLife([
      { at: '2026-05-01', mm: 10, sessionsBefore: 0 },
      { at: '2026-09-01', mm: 7, sessionsBefore: 6 },
    ]);
    expect(life).toEqual({ lastMm: 7, wearPerSession: 0.5, sessionsLeft: 4, due: false });

    const low = padLife([
      { at: '2026-05-01', mm: 8, sessionsBefore: 0 },
      { at: '2026-09-01', mm: 5.4, sessionsBefore: 4 },
    ]);
    expect(low?.due).toBe(true); // 5.4 − 0.65 < 5
  });

  it('a single reading only says "due" when it is already under the line', () => {
    expect(padLife([{ at: '2026-09-01', mm: 6, sessionsBefore: 3 }])).toEqual({ lastMm: 6, wearPerSession: null, sessionsLeft: null, due: false });
    expect(padLife([{ at: '2026-09-01', mm: 4, sessionsBefore: 3 }])?.due).toBe(true);
    expect(padLife([{ at: '2026-09-01', mm: 4, sessionsBefore: 3 }], 3)?.due).toBe(false); // street threshold
    expect(padLife([])).toBeNull();
  });

  it('new pads (thicker than before) reset the rate instead of going negative', () => {
    const life = padLife([
      { at: '2026-05-01', mm: 4, sessionsBefore: 0 },
      { at: '2026-09-01', mm: 11, sessionsBefore: 4 },
    ]);
    expect(life).toEqual({ lastMm: 11, wearPerSession: null, sessionsLeft: null, due: false });
    const after = padLife([
      { at: '2026-05-01', mm: 4, sessionsBefore: 0 },
      { at: '2026-06-01', mm: 11, sessionsBefore: 4 },
      { at: '2026-09-01', mm: 9, sessionsBefore: 8 },
    ]);
    expect(after?.wearPerSession).toBe(0.5);
  });
});
