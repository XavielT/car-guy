import ionicons from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import {
  EVENT_TYPES,
  SEVERITIES,
  eventCostDop,
  eventSubtitle,
  eventTimeline,
  eventTypeOf,
  isEvent,
  pendingEvents,
  type EventRow,
} from '@/lib/domain/events';

function ev(id: string, occurredAt: string, over: Partial<EventRow> = {}): EventRow {
  return { id, vehicleId: 'trueno', kind: 'otro', occurredAt, title: id, deletedAt: null, eventType: 'hito', ...over };
}

const ROWS: EventRow[] = [
  ev('compra', '2024-03-02T12:00:00.000Z', { kind: 'compra' }),
  ev('choque', '2026-08-12T12:00:00.000Z', {
    eventType: 'accidente',
    severity: 'grave',
    costDop: 45000,
    pending: 'pintar el guardafango',
    resolvedAt: null,
  }),
  ev('calentón', '2026-06-01T12:00:00.000Z', { eventType: 'sobrecalentamiento', severity: 'moderado', costDop: 3500, linkedServiceId: 'svc-1', pending: 'cambiar el termostato' }),
  ev('multa', '2026-09-10T12:00:00.000Z', { eventType: 'multa', severity: 'leve', costDop: 1250.5, pending: 'pagar en la DIGESETT', resolvedAt: '2026-09-15' }),
  ev('estado', '2026-07-01T12:00:00.000Z', { kind: 'estado' }),
  ev('borrado', '2026-09-20T12:00:00.000Z', { eventType: 'averia', pending: 'x', deletedAt: '2026-09-21T00:00:00.000Z' }),
  ev('ds3', '2026-09-25T12:00:00.000Z', { vehicleId: 'ds3', eventType: 'dano_menor', pending: 'retocar el bumper' }),
];

describe('catalogues', () => {
  it('ten event types, three severities, Spanish labels', () => {
    expect(EVENT_TYPES.map((t) => t.id)).toEqual([
      'hito', 'accidente', 'dano_menor', 'averia', 'sobrecalentamiento', 'robo', 'multa', 'viaje_largo', 'junte', 'otro',
    ]);
    expect(EVENT_TYPES.find((t) => t.id === 'dano_menor')?.label).toBe('Daño menor');
    expect(SEVERITIES.map((s) => s.label)).toEqual(['Leve', 'Moderado', 'Grave']);
  });

  it('every icon is an Ionicons glyph (the app’s icon set)', () => {
    for (const t of EVENT_TYPES) expect(ionicons).toHaveProperty([t.icon]);
  });
});

describe('isEvent / eventTypeOf', () => {
  it('hito is not an event; anything else is', () => {
    expect(isEvent(ROWS[0])).toBe(false);
    expect(isEvent(ROWS[1])).toBe(true);
  });

  it('a pre-v8 row falls back to its kind', () => {
    const { eventType: _e, ...old } = ev('viejo', '2025-01-01', { kind: 'accidente' });
    expect(eventTypeOf(old)).toBe('accidente');
    const { eventType: _f, ...nice } = ev('swap', '2025-01-01', { kind: 'swap' });
    expect(eventTypeOf(nice)).toBe('hito');
  });
});

describe('pendingEvents', () => {
  it('only this car, live, with a pending text and no resolved date, newest first', () => {
    expect(pendingEvents(ROWS, 'trueno').map((m) => m.id)).toEqual(['choque', 'calentón']);
    expect(pendingEvents(ROWS, 'ds3').map((m) => m.id)).toEqual(['ds3']);
  });

  it('blank pending text is not pending', () => {
    expect(pendingEvents([ev('a', '2026-01-01', { eventType: 'averia', pending: '   ' })], 'trueno')).toEqual([]);
  });
});

describe('eventTimeline', () => {
  it('newest first, status changes and tombstones out, markers by severity', () => {
    const items = eventTimeline(ROWS, 'trueno');
    expect(items.map((i) => [i.milestone.id, i.marker])).toEqual([
      ['multa', 'normal'],
      ['choque', 'grave'],
      ['calentón', 'serious'],
      ['compra', 'normal'],
    ]);
    expect(items[1]).toMatchObject({ eventType: 'accidente', label: 'Accidente', icon: 'car-outline' });
  });

  it('includeStatus keeps the estado rows', () => {
    expect(eventTimeline(ROWS, 'trueno', { includeStatus: true }).map((i) => i.milestone.id)).toContain('estado');
  });

  it('a leve event with something pending gets the pending marker', () => {
    const [item] = eventTimeline([ev('p', '2026-01-01', { eventType: 'dano_menor', severity: 'leve', pending: 'pulir' })], 'trueno');
    expect(item.marker).toBe('pending');
  });
});

describe('eventSubtitle', () => {
  it('severity · money · pending', () => {
    expect(eventSubtitle(ROWS[1])).toBe('Grave · RD$ 45,000 · pendiente: pintar el guardafango');
  });

  it('cents stay; a resolved pending reads resuelto', () => {
    expect(eventSubtitle(ROWS[3])).toBe('Leve · RD$ 1,250.50 · resuelto');
  });

  it('a hito shows no severity, and an empty row an empty line', () => {
    expect(eventSubtitle(ev('h', '2026-01-01', { severity: 'grave', costDop: 800 }))).toBe('RD$ 800');
    expect(eventSubtitle(ev('h', '2026-01-01'))).toBe('');
  });
});

describe('eventCostDop', () => {
  it('sums costs, skipping events linked to a service (the service carries the bill)', () => {
    expect(eventCostDop(ROWS, 'trueno')).toBeCloseTo(45000 + 1250.5);
  });
});
