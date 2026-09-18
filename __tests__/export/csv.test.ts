import { BOM, exportFileName, fuelCsv, historyCsv, toCsv } from '@/lib/export/csv';
import type { FuelLog, HistoryEntry } from '@/lib/db/types';

function log(over: Partial<FuelLog> = {}): FuelLog {
  return {
    id: 'f1',
    vehicleId: 'v1',
    occurredAt: '2026-09-03T12:00:00.000Z',
    odometerKm: 51000,
    volume: 10,
    pricePerUnit: 307.5,
    totalDop: 3075,
    fuelType: 'regular',
    isFullTank: true,
    missedPrevious: false,
    station: 'Texaco',
    notes: '',
    createdAt: '2026-09-03T12:05:00.000Z',
    updatedAt: '2026-09-03T12:05:00.000Z',
    deletedAt: null,
    syncedAt: null,
    ...over,
  };
}

describe('toCsv', () => {
  it('starts with a BOM so Excel reads the accents', () => {
    expect(toCsv(['a'], [['x']]).startsWith(BOM)).toBe(true);
  });

  it('uses CRLF and ends with one', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']]);
    expect(csv).toBe(`${BOM}a,b\r\n1,2\r\n`);
  });

  it('quotes only the fields that need it, and doubles inner quotes', () => {
    const csv = toCsv(['a'], [['sin coma'], ['con, coma'], ['con "comillas"'], ['con\nsalto']]);
    expect(csv).toContain('\r\nsin coma\r\n');
    expect(csv).toContain('"con, coma"');
    expect(csv).toContain('"con ""comillas"""');
    expect(csv).toContain('"con\nsalto"');
  });

  it('writes an empty cell for null rather than the word null', () => {
    expect(toCsv(['a', 'b'], [[null, 'x']])).toContain('\r\n,x\r\n');
  });
});

describe('historyCsv', () => {
  const entries: HistoryEntry[] = [
    {
      id: '1',
      vehicleId: 'v1',
      kind: 'combustible',
      occurredAt: '2026-09-03T12:00:00.000Z',
      odometerKm: 51000,
      title: 'Gasolina Regular',
      subtitle: 'Texaco',
      amountDop: 3075,
    },
    {
      id: '2',
      vehicleId: 'v1',
      kind: 'chequeo',
      occurredAt: '2026-09-05T12:00:00.000Z',
      odometerKm: null,
      title: 'completo',
      subtitle: null,
      amountDop: null,
    },
  ];

  it('writes a date a spreadsheet recognises', () => {
    expect(historyCsv(entries)).toContain('2026-09-03,combustible,Gasolina Regular,Texaco,51000,3075.00');
  });

  it('writes the readable title, not the enum the view stores', () => {
    // history_feed puts the fuel type in `title` for a fill-up and the
    // inspection status for a check; both get translated on the way out.
    const csv = historyCsv(entries);
    expect(csv).toContain('Gasolina Regular');
    expect(csv).not.toContain(',combustible,regular,');
    expect(csv).toContain('Chequeo · con fallas');
  });

  it('leaves the odometer and the amount blank when the record has none', () => {
    expect(historyCsv(entries)).toContain('2026-09-05,chequeo,Chequeo · con fallas,,,\r\n');
  });
});

describe('fuelCsv', () => {
  it('fills the economy columns only on the tanks that were measured', () => {
    const csv = fuelCsv([
      log({ id: 'base', occurredAt: '2026-09-01T12:00:00.000Z', odometerKm: 51000 }),
      log({ id: 'next', occurredAt: '2026-09-15T12:00:00.000Z', odometerKm: 51400, volume: 10 }),
    ]);
    const [, first, second] = csv.trim().split('\r\n');
    // The baseline tank has nothing to measure against, so three blank cells.
    expect(first.endsWith(',,,')).toBe(true);
    // 400 km on 10 gal.
    expect(second).toContain(',400,40.000,');
  });

  it('records the two flags as si/no', () => {
    const csv = fuelCsv([log({ isFullTank: false, missedPrevious: true })]);
    expect(csv).toContain(',no,si,Texaco,');
  });

  it('leaves the economy blank on a fill-up that broke the chain', () => {
    const csv = fuelCsv([
      log({ id: 'base', occurredAt: '2026-09-01T12:00:00.000Z', odometerKm: 51000 }),
      log({
        id: 'gap',
        occurredAt: '2026-09-15T12:00:00.000Z',
        odometerKm: 51900,
        missedPrevious: true,
      }),
    ]);
    // Without the flag this row would have claimed 90 km/gal.
    expect(csv).not.toContain('90.000');
    for (const line of csv.trim().split('\r\n').slice(1)) {
      expect(line.endsWith(',,,')).toBe(true);
    }
  });

  it('sorts oldest first, whatever order the rows arrived in', () => {
    const csv = fuelCsv([
      log({ id: 'b', occurredAt: '2026-09-15T12:00:00.000Z', odometerKm: 51400 }),
      log({ id: 'a', occurredAt: '2026-09-01T12:00:00.000Z', odometerKm: 51000 }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[1].startsWith('2026-09-01')).toBe(true);
    expect(lines[2].startsWith('2026-09-15')).toBe(true);
  });
});

describe('exportFileName', () => {
  it('strips accents and spaces out of the vehicle name', () => {
    expect(exportFileName('historial', 'La Jeepeta Vieja', '2026-09-18T12:00:00.000Z')).toBe(
      'car-guy-historial-la-jeepeta-vieja-2026-09-18.csv',
    );
    expect(exportFileName('combustible', 'Citroën DS3', '2026-09-18T12:00:00.000Z')).toBe(
      'car-guy-combustible-citroen-ds3-2026-09-18.csv',
    );
  });

  it('copes with a name that is entirely punctuation', () => {
    expect(exportFileName('historial', '???', '2026-09-18T12:00:00.000Z')).toBe(
      'car-guy-historial-2026-09-18.csv',
    );
  });
});
