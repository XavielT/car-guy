import { reportHtml, type ReportInput } from '@/lib/report/html';
import type { VehicleStats } from '@/lib/db/statsQueries';
import type { HistoryEntry, Vehicle } from '@/lib/db/types';

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    name: 'Corolla',
    type: 'carro',
    make: 'Toyota',
    model: 'Corolla',
    year: 2015,
    trim: null,
    color: null,
    plate: 'A123456',
    vin: null,
    defaultFuelType: 'regular',
    tankVolume: 13,
    initialOdometerKm: null,
    purchaseDate: null,
    purchasePrice: null,
    soldDate: null,
    soldPrice: null,
    photoMediaId: null,
    notes: '',
    isArchived: false,
    sortOrder: 0,
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
    deletedAt: null,
    syncedAt: null,
    ...over,
  };
}

function stats(over: Partial<VehicleStats> = {}): VehicleStats {
  return {
    vehicle: vehicle(),
    period: {
      key: 'trimestre',
      label: '3 meses',
      from: '2026-06-20T12:00:00.000Z',
      to: '2026-09-18T12:00:00.000Z',
      previous: { from: '2026-03-22T12:00:00.000Z', to: '2026-06-20T12:00:00.000Z' },
    },
    kpis: {
      spend: 15345.2,
      distanceKm: 897,
      costPerKm: 17.11,
      spendDelta: null,
      distanceDelta: null,
    },
    byCategory: [
      { category: 'combustible', total: 9625.2, share: 0.63 },
      { category: 'mantenimiento', total: 4700, share: 0.31 },
    ],
    monthly: [],
    monthlyDistance: [],
    ownership: null,
    upcoming: { items: [], total: 0 },
    rowsInPeriod: [],
    ...over,
  };
}

const history: HistoryEntry[] = [
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
];

function build(over: Partial<ReportInput> = {}): string {
  return reportHtml({
    stats: stats(),
    history,
    economy: [],
    photoDataUri: null,
    generatedAt: '2026-09-18T12:00:00.000Z',
    ...over,
  });
}

describe('reportHtml', () => {
  it('is a complete standalone document with no external requests', () => {
    const html = build();
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
    // Nothing to fetch: expo-print renders this in an offline WebView.
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('carries the vehicle, the period and the figures', () => {
    const html = build();
    expect(html).toContain('Corolla');
    expect(html).toContain('Toyota Corolla 2015 · A123456');
    expect(html).toContain('RD$ 15,345.20');
    expect(html).toContain('897 km');
    expect(html).toContain('RD$ 17.11');
  });

  it('lists the history rows it was given', () => {
    const html = build();
    expect(html).toContain('Gasolina Regular');
    expect(html).toContain('Texaco');
    expect(html).toContain('51,000 km');
  });

  it('says so when the period has no records rather than printing an empty table', () => {
    const html = build({ history: [] });
    expect(html).toContain('Sin registros en este período.');
    expect(html).not.toContain('<tbody>\n    <tr>\n      <td class="mono">');
  });

  it('embeds the photo only when one was supplied', () => {
    expect(build()).not.toContain('<img');
    expect(build({ photoDataUri: 'data:image/jpeg;base64,AAAA' })).toContain(
      '<img src="data:image/jpeg;base64,AAAA"',
    );
  });

  it('includes the ownership block only when there is a purchase price', () => {
    expect(build()).not.toContain('Costo de tener el carro');
    const withTco = build({
      stats: stats({
        ownership: {
          purchasePrice: 875000,
          soldPrice: null,
          spend: 90004.8,
          total: 965004.8,
          monthsOwned: 23,
          costPerMonth: 41956.73,
        },
      }),
    });
    expect(withTco).toContain('Costo de tener el carro');
    expect(withTco).toContain('RD$ 965,004.80');
  });

  it('prints "Todo" rather than a date range for the unbounded period', () => {
    const html = build({
      stats: stats({
        period: { key: 'todo', label: 'Todo', from: null, to: '2026-09-18T12:00:00.000Z', previous: null },
      }),
    });
    expect(html).toContain('Todo');
  });

  it('always closes with the footer', () => {
    expect(build()).toContain('Generado con Car Guy');
  });

  /**
   * A shop called `Taller & Hijos` and a note with a stray `<` are ordinary
   * data. They must not be able to close a tag in the printed document.
   */
  it('escapes every interpolated value', () => {
    const html = build({
      history: [
        {
          ...history[0],
          title: '<script>alert(1)</script>',
          subtitle: 'Taller & Hijos "El Che"',
        },
      ],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Taller &amp; Hijos &quot;El Che&quot;');
  });

  it('escapes the vehicle name too', () => {
    const html = build({
      stats: stats({ vehicle: vehicle({ name: 'El <b>bueno</b>' }) }),
    });
    expect(html).toContain('El &lt;b&gt;bueno&lt;/b&gt;');
    expect(html).not.toContain('El <b>bueno</b>');
  });
});
