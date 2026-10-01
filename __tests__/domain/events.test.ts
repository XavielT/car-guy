import ionicons from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import {
  EVENT_TYPES,
  SEVERITIES,
  eventCostDop,
  eventCostRows,
  eventFieldsFromDraft,
  eventFromFeed,
  type EventDraft,
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

describe('eventCostDop — the merge rule', () => {
  it('a hito with a cost adds nothing (its money is the purchase, mod or service)', () => {
    const rows = [ev('pintura', '2026-01-01', { costDop: 30000 }), ev('multa2', '2026-02-01', { eventType: 'multa', costDop: 2000 })];
    expect(eventCostDop(rows, 'trueno')).toBe(2000);
  });

  it('eventCostRows lists exactly what the total sums, newest first', () => {
    expect(eventCostRows(ROWS, 'trueno').map((m) => m.id)).toEqual(['multa', 'choque']);
    const sum = eventCostRows(ROWS, 'trueno').reduce((a, m) => a + (m.costDop ?? 0), 0);
    expect(sum).toBeCloseTo(eventCostDop(ROWS, 'trueno'));
  });

  it('tombstones, other cars and zero costs stay out', () => {
    const rows = [
      ev('gone', '2026-01-01', { eventType: 'averia', costDop: 900, deletedAt: '2026-01-02' }),
      ev('zero', '2026-01-01', { eventType: 'averia', costDop: 0 }),
      ev('other', '2026-01-01', { vehicleId: 'ds3', eventType: 'averia', costDop: 700 }),
    ];
    expect(eventCostDop(rows, 'trueno')).toBe(0);
  });
});

describe('pendingEvents — the hub banner list', () => {
  it('resolving one takes it off; re-opening puts it back', () => {
    const open = ev('p1', '2026-03-01', { eventType: 'dano_menor', pending: 'cambiar el retrovisor' });
    expect(pendingEvents([open], 'trueno')).toHaveLength(1);
    expect(pendingEvents([{ ...open, resolvedAt: '2026-03-05' }], 'trueno')).toHaveLength(0);
    expect(pendingEvents([{ ...open, resolvedAt: null }], 'trueno')).toHaveLength(1);
  });
});

describe('eventFromFeed', () => {
  it('unpacks history_feed v6’s subtitle', () => {
    expect(eventFromFeed('accidente|accidente|moderado|pintar el guardafango|')).toEqual({
      kind: 'accidente',
      eventType: 'accidente',
      severity: 'moderado',
      pending: 'pintar el guardafango',
      resolvedAt: null,
    });
    expect(eventFromFeed('otro|multa|leve|pagar|2026-09-15T00:00:00.000Z').resolvedAt).toBe('2026-09-15T00:00:00.000Z');
  });

  it('unknown or missing parts fall back', () => {
    expect(eventFromFeed(null)).toEqual({ kind: '', eventType: 'otro', severity: null, pending: '', resolvedAt: null });
    expect(eventFromFeed('otro|cohete|feo')).toMatchObject({ eventType: 'otro', severity: null });
  });
});

describe('eventFieldsFromDraft', () => {
  const TODAY = '2026-09-30T12:00:00.000Z';
  const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
    eventType: 'dano_menor',
    severity: 'leve',
    cost: '',
    pending: '',
    resolved: false,
    resolvedAt: null,
    linkedServiceId: null,
    linkedModId: null,
    linkedInspectionId: null,
    locationLabel: '',
    ...over,
  });

  it('a hito carries no severity; an event without one is leve', () => {
    expect(eventFieldsFromDraft(draft({ eventType: 'hito', severity: 'grave' }), TODAY).severity).toBeNull();
    expect(eventFieldsFromDraft(draft({ severity: null }), TODAY).severity).toBe('leve');
  });

  it('cost parses what people type; empty or zero is null', () => {
    expect(eventFieldsFromDraft(draft({ cost: 'RD$ 45,000' }), TODAY).costDop).toBe(45000);
    expect(eventFieldsFromDraft(draft({ cost: '1250.50' }), TODAY).costDop).toBe(1250.5);
    expect(eventFieldsFromDraft(draft({ cost: '' }), TODAY).costDop).toBeNull();
    expect(eventFieldsFromDraft(draft({ cost: '0' }), TODAY).costDop).toBeNull();
  });

  it('Resuelto stamps today, keeps an earlier date, and needs something pending', () => {
    expect(eventFieldsFromDraft(draft({ pending: ' pintar ', resolved: true }), TODAY)).toMatchObject({ pending: 'pintar', resolvedAt: TODAY });
    expect(eventFieldsFromDraft(draft({ pending: 'pintar', resolved: true, resolvedAt: '2026-08-01' }), TODAY).resolvedAt).toBe('2026-08-01');
    expect(eventFieldsFromDraft(draft({ pending: 'pintar', resolved: false, resolvedAt: '2026-08-01' }), TODAY).resolvedAt).toBeNull();
    expect(eventFieldsFromDraft(draft({ pending: '   ', resolved: true }), TODAY)).toMatchObject({ pending: '', resolvedAt: null });
  });

  it('links and the place pass through (place trimmed)', () => {
    expect(eventFieldsFromDraft(draft({ linkedServiceId: 's1', locationLabel: '  Av. Kennedy ' }), TODAY)).toMatchObject({ linkedServiceId: 's1', locationLabel: 'Av. Kennedy' });
  });
});
