import {
  engineBadge,
  isArchivedFor,
  lampStates,
  ownershipLine,
  statusBadge,
  toKatakana,
  vehicleBadges,
} from '@/lib/domain/garage';

describe('toKatakana', () => {
  it.each([
    ['hachi-gō', 'ハチゴー'],
    ['hachiroku', 'ハチロク'],
    ['Hachi Go', 'ハチゴ'],
    ['sanpachi', 'サンパチ'],
    ['kitto', 'キット'],
  ])('%s → %s', (input, out) => expect(toKatakana(input)).toBe(out));

  it('leaves Spanish nicknames alone', () => {
    expect(toKatakana('el daily')).toBeNull();
    expect(toKatakana('la jeepeta')).toBeNull();
    expect(toKatakana('')).toBeNull();
    expect(toKatakana(null)).toBeNull();
  });
});

describe('badges', () => {
  it('writes the engine like the cam cover', () => {
    expect(engineBadge('4A-GE 20V')).toEqual({ label: '4AGE 20V', tone: 'red' });
    expect(engineBadge('  ')).toBeNull();
  });

  it('matches the Garaje artboard for the real garage', () => {
    expect(vehicleBadges({ status: 'activo', engineCode: '4A-GE 20V' }, { installedMods: 5, tags: ['SWAP', 'drift'] }).map((b) => b.label)).toEqual([
      '4AGE 20V',
      'DRIFT',
    ]);
    expect(vehicleBadges({ status: 'activo', engineCode: '1.6 NA' }, { installedMods: 0 }).map((b) => b.label)).toEqual(['DAILY']);
    expect(vehicleBadges({ status: 'proyecto', engineCode: '1.6 NA' }, { installedMods: 0 }).map((b) => b.label)).toEqual(['PROYECTO']);
    expect(statusBadge('vendido', 0)?.label).toBe('EX');
  });

  it('prefers the last track event over tags for the discipline', () => {
    expect(vehicleBadges({ status: 'activo', engineCode: null }, { installedMods: 1, lastDiscipline: 'drag', tags: ['drift'] }).map((b) => b.label)).toEqual(['DRAG']);
  });

  it('keeps status and is_archived consistent', () => {
    expect(isArchivedFor('guardado')).toBe(true);
    expect(isArchivedFor('vendido')).toBe(true);
    expect(isArchivedFor('proyecto')).toBe(false);
    expect(isArchivedFor('activo')).toBe(false);
  });
});

describe('ownershipLine', () => {
  const today = new Date(2026, 8, 28);
  it('an Ex', () => expect(ownershipLine({ acquiredAt: '2018-01-01', soldAt: '2021-01-01' }, today)).toBe('2018 → vendido 2021'));
  it('an Ex with no purchase date', () => expect(ownershipLine({ acquiredAt: null, soldAt: '2026-09-01' }, today)).toBe('Vendido 2026'));
  it('a car you have', () => expect(ownershipLine({ acquiredAt: '2019-06-15T12:00:00.000Z', soldAt: null }, today)).toBe('Desde jun 2019 · 7 años contigo'));
  it('year-only purchase', () => expect(ownershipLine({ acquiredAt: '2024-01-01', soldAt: null }, today)).toBe('Desde 2024 · 2 años contigo'));
  it('recent', () => expect(ownershipLine({ acquiredAt: '2026-07-10T12:00:00.000Z', soldAt: null }, today)).toBe('Desde jul 2026 · 2 meses contigo'));
  it('nothing known', () => expect(ownershipLine({ acquiredAt: null, soldAt: null }, today)).toBeNull());
});

describe('lampStates', () => {
  const today = new Date('2026-09-28T12:00:00.000Z');
  const r = (serviceTypeId: string | null, status: string, legalKind: string | null = null) => ({
    reminder: { serviceTypeId, legalKind, isEnabled: true },
    status: { status, snoozed: false },
  });

  it('lights the worst reminder of each system, off when none', () => {
    const lamps = lampStates(
      [r('aceite_motor', 'proximo'), r('rotacion_gomas', 'ok'), r('alineacion', 'vencido'), r(null, 'urgente', 'marbete')] as never,
      { lastAt: '2026-09-26T12:00:00.000Z', lastHadFailures: false },
      today,
    );
    expect(Object.fromEntries(lamps.map((l) => [l.icon, l.state]))).toEqual({
      oil: 'proximo',
      coolant: 'off',
      tire: 'vencido',
      battery: 'off',
      document: 'urgente',
      checklist: 'ok',
    });
  });

  it('the weekly lamp ages', () => {
    const at = (d: string, f = false) => lampStates([], { lastAt: d, lastHadFailures: f }, today).at(-1)!.state;
    expect(at('2026-09-18T12:00:00.000Z')).toBe('proximo');
    expect(at('2026-09-01T12:00:00.000Z')).toBe('urgente');
    expect(at('2026-09-27T12:00:00.000Z', true)).toBe('urgente');
    expect(lampStates([], { lastAt: null, lastHadFailures: false }, today).at(-1)!.state).toBe('proximo');
  });
});
