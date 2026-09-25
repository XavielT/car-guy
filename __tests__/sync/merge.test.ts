import {
  batch,
  decide,
  hasMore,
  isDirty,
  nextCursor,
  normaliseRow,
  normaliseTimestamp,
  selectDirty,
  toCloudRow,
  type RemoteRow,
  type SyncableRow,
} from '@/lib/sync/merge';
import {
  PULL_PAGE,
  PUSH_BATCH,
  SYNCED_SETTING_KEYS,
  SYNC_TABLES,
  conflictTarget,
  cursorKey,
} from '@/lib/sync/tables';

const T1 = '2026-09-18T12:00:00.000Z';
const T2 = '2026-09-18T13:00:00.000Z';
const T3 = '2026-09-18T14:00:00.000Z';

function local(over: Partial<SyncableRow> = {}): SyncableRow {
  return { id: 'r1', updatedAt: T2, deletedAt: null, syncedAt: T2, ...over };
}

function remote(over: Partial<RemoteRow> = {}): RemoteRow {
  return { id: 'r1', updatedAt: T2, deletedAt: null, serverUpdatedAt: T2, ...over };
}

describe('isDirty', () => {
  it('treats a row that has never been pushed as dirty', () => {
    expect(isDirty(local({ syncedAt: null }))).toBe(true);
    expect(isDirty(local({ syncedAt: undefined }))).toBe(true);
  });

  it('treats a row changed since the last push as dirty', () => {
    expect(isDirty(local({ updatedAt: T3, syncedAt: T2 }))).toBe(true);
  });

  it('treats an unchanged row as clean — equal is not dirty', () => {
    // `synced_at` is written after a push, so equal means "pushed, untouched".
    // Using >= here would make every row dirty forever.
    expect(isDirty(local({ updatedAt: T2, syncedAt: T2 }))).toBe(false);
  });

  it('treats a tombstone like any other change', () => {
    expect(isDirty(local({ deletedAt: T3, updatedAt: T3, syncedAt: T2 }))).toBe(true);
    expect(isDirty(local({ deletedAt: T2, updatedAt: T2, syncedAt: T2 }))).toBe(false);
  });
});

describe('selectDirty', () => {
  it('keeps only the rows that need pushing', () => {
    const rows = [
      local({ id: 'new', syncedAt: null }),
      local({ id: 'clean' }),
      local({ id: 'edited', updatedAt: T3 }),
    ];
    expect(selectDirty(rows).map((r) => r.id)).toEqual(['new', 'edited']);
  });
});

describe('batch', () => {
  it('splits into full batches plus a remainder', () => {
    const rows = Array.from({ length: 5 }, (_, i) => i);
    expect(batch(rows, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('produces no batches at all for an empty list', () => {
    // One empty batch would mean one pointless round trip per table per sync.
    expect(batch([], 200)).toEqual([]);
  });

  it('produces one batch when everything fits', () => {
    expect(batch([1, 2, 3], 200)).toEqual([[1, 2, 3]]);
  });

  it('refuses a non-positive size rather than looping forever', () => {
    expect(() => batch([1], 0)).toThrow();
  });
});

/**
 * The matrix the protocol is judged by. Each case is a sentence from
 * 02-supabase-carguy.md §5 turned into an assertion.
 */
describe('decide — the LWW matrix', () => {
  it('applies an incoming row the device has never seen', () => {
    expect(decide(null, remote())).toBe('apply');
    expect(decide(undefined, remote())).toBe('apply');
  });

  it('applies a newer incoming row over a clean local one', () => {
    expect(decide(local({ updatedAt: T1, syncedAt: T1 }), remote({ updatedAt: T2 }))).toBe('apply');
  });

  it('keeps a dirty local row even when the incoming one is newer', () => {
    // The local edit has never been sent, so the server's copy predates it by
    // definition. Applying would discard an edit the user watched succeed.
    expect(decide(local({ updatedAt: T2, syncedAt: T1 }), remote({ updatedAt: T3 }))).toBe(
      'keep-local-dirty',
    );
  });

  it('keeps the local row when the incoming one is older', () => {
    expect(decide(local({ updatedAt: T3, syncedAt: T3 }), remote({ updatedAt: T1 }))).toBe(
      'keep-local',
    );
  });

  it('keeps the local row when the timestamps are equal', () => {
    expect(decide(local({ updatedAt: T2, syncedAt: T2 }), remote({ updatedAt: T2 }))).toBe(
      'keep-local',
    );
  });

  it('keeps a local edit that came after an incoming tombstone', () => {
    const incomingDelete = remote({ updatedAt: T1, deletedAt: T1 });
    expect(decide(local({ updatedAt: T3, syncedAt: T3 }), incomingDelete)).toBe('keep-local');
  });

  it('applies an incoming tombstone that came after the local edit', () => {
    const incomingDelete = remote({ updatedAt: T3, deletedAt: T3 });
    expect(decide(local({ updatedAt: T1, syncedAt: T1 }), incomingDelete)).toBe('apply');
  });
});

describe('nextCursor', () => {
  it('advances to the greatest server_updated_at in the page', () => {
    const page = [
      remote({ id: 'a', serverUpdatedAt: T1 }),
      remote({ id: 'b', serverUpdatedAt: T3 }),
      remote({ id: 'c', serverUpdatedAt: T2 }),
    ];
    expect(nextCursor(T1, page)).toBe(T3);
  });

  it('never rewinds, even if a page arrives out of order', () => {
    const page = [remote({ serverUpdatedAt: T1 })];
    expect(nextCursor(T3, page)).toBe(T3);
  });

  it('leaves the cursor alone for an empty page', () => {
    expect(nextCursor(T2, [])).toBe(T2);
    expect(nextCursor(null, [])).toBeNull();
  });

  it('starts the cursor from the first page when there was none', () => {
    expect(nextCursor(null, [remote({ serverUpdatedAt: T2 })])).toBe(T2);
  });
});

describe('hasMore', () => {
  it('asks for another page only when this one was full', () => {
    expect(hasMore(new Array(500), 500)).toBe(true);
    expect(hasMore(new Array(499), 500)).toBe(false);
    expect(hasMore([], 500)).toBe(false);
  });
});

describe('toCloudRow', () => {
  it('drops the local-only columns', () => {
    const row = { id: 'm1', mime: 'image/jpeg', syncedAt: T1, blob: new Uint8Array([1, 2]) };
    const out = toCloudRow(row, ['syncedAt', 'blob'], 'user-1');
    expect(out).toEqual({ id: 'm1', mime: 'image/jpeg', userId: 'user-1' });
  });

  it('always sends user_id, because RLS checks it on the update path', () => {
    // The column defaults to auth.uid(), but a default only applies to an
    // INSERT; an upsert that takes the UPDATE branch without it fails 42501.
    expect(toCloudRow({ id: 'v1' }, [], 'user-1').userId).toBe('user-1');
  });

  it('overrides any user_id the local row happened to carry', () => {
    expect(toCloudRow({ id: 'v1', userId: 'someone-else' }, [], 'user-1').userId).toBe('user-1');
  });

  it('drops undefined so a partial row cannot null out a cloud column', () => {
    const out = toCloudRow({ id: 'v1', plate: undefined, name: 'Corolla' }, [], 'user-1');
    expect('plate' in out).toBe(false);
    expect(out.name).toBe('Corolla');
  });

  it('keeps an explicit null, which is a real value', () => {
    const out = toCloudRow({ id: 'v1', plate: null }, [], 'user-1');
    expect(out.plate).toBeNull();
  });
});

describe('normaliseTimestamp', () => {
  it('rewrites a +00:00 offset as Z so string comparison is valid', () => {
    // '2026-09-18T12:00:00+00:00' sorts BEFORE '2026-09-18T12:00:00.000Z' as a
    // string, which would silently invert a conflict.
    expect(normaliseTimestamp('2026-09-18T12:00:00+00:00')).toBe('2026-09-18T12:00:00.000Z');
  });

  it('pads a timestamp Postgres wrote without milliseconds', () => {
    expect(normaliseTimestamp('2026-09-18T12:00:00Z')).toBe('2026-09-18T12:00:00.000Z');
  });

  it('converts a non-UTC offset to UTC', () => {
    expect(normaliseTimestamp('2026-09-18T08:00:00-04:00')).toBe('2026-09-18T12:00:00.000Z');
  });

  it('returns null for nothing and for nonsense', () => {
    expect(normaliseTimestamp(null)).toBeNull();
    expect(normaliseTimestamp('')).toBeNull();
    expect(normaliseTimestamp('no soy una fecha')).toBeNull();
  });

  it('makes two representations of the same instant compare equal', () => {
    const a = normaliseTimestamp('2026-09-18T12:00:00+00:00');
    const b = normaliseTimestamp('2026-09-18T12:00:00.000Z');
    expect(a).toBe(b);
  });
});

describe('normaliseRow', () => {
  it('normalises both timestamps the merge rules read', () => {
    const row = normaliseRow({
      id: 'v1',
      updatedAt: '2026-09-18T12:00:00+00:00',
      deletedAt: '2026-09-18T13:00:00+00:00',
    });
    expect(row.updatedAt).toBe('2026-09-18T12:00:00.000Z');
    expect(row.deletedAt).toBe('2026-09-18T13:00:00.000Z');
  });

  it('leaves an unparseable updatedAt alone rather than nulling it', () => {
    const row = normaliseRow({ id: 'v1', updatedAt: 'basura' });
    expect(row.updatedAt).toBe('basura');
  });

  it('lets a decision survive the two formats', () => {
    const localRow = normaliseRow(local({ updatedAt: '2026-09-18T12:00:00.000Z', syncedAt: null }));
    const incoming = { ...remote({ updatedAt: '2026-09-18T12:00:00+00:00' }) };
    // Same instant, written two ways: equal, so the local row stays.
    expect(decide(localRow, normaliseRow(incoming) as RemoteRow)).toBe('keep-local');
  });
});

describe('the table declarations', () => {
  it('pushes every parent before its children', () => {
    const order = SYNC_TABLES.map((t) => t.name);
    const before = (a: string, b: string) => order.indexOf(a) < order.indexOf(b);

    expect(before('vehicle', 'fuel_log')).toBe(true);
    expect(before('vehicle', 'service_record')).toBe(true);
    expect(before('service_record', 'service_record_item')).toBe(true);
    expect(before('service_record', 'part')).toBe(true);
    expect(before('service_type', 'service_record_item')).toBe(true);
    expect(before('inspection_template', 'inspection_item')).toBe(true);
    expect(before('inspection', 'inspection_result')).toBe(true);
    expect(before('vehicle', 'document')).toBe(true);
  });

  it('never sends synced_at, and never sends media bytes', () => {
    for (const table of SYNC_TABLES) {
      if (table.name === 'setting') continue;
      expect(table.localOnly).toContain('syncedAt');
    }
    expect(SYNC_TABLES.find((t) => t.name === 'media')?.localOnly).toContain('blob');
  });

  it('keys `setting` by user and key rather than by id', () => {
    expect(SYNC_TABLES.find((t) => t.name === 'setting')?.keyedBy).toBe('user_key');
  });

  it('keys the seeded catalogue tables by account as well as id (sql/008)', () => {
    // Every device seeds `aceite_motor`, `carro_semanal`, `carro_semanal__0`
    // with the same ids; keyed by id alone, a second account could never push them.
    const target = (name: string) => conflictTarget(SYNC_TABLES.find((t) => t.name === name)!);
    expect(target('service_type')).toBe('user_id,id');
    expect(target('inspection_template')).toBe('user_id,id');
    expect(target('inspection_item')).toBe('user_id,id');
    expect(target('vehicle')).toBe('id');
    expect(target('setting')).toBe('user_id,key');
  });

  it('leaves the device-local settings out of the synced set', () => {
    // Syncing the active vehicle would make picking a car on one phone switch
    // it on another; the sync bookkeeping describes one device's progress.
    expect(SYNCED_SETTING_KEYS).not.toContain('active_vehicle_id');
    expect(SYNCED_SETTING_KEYS).not.toContain('last_sync_at');
    expect(SYNCED_SETTING_KEYS).not.toContain('auth_user_id');
    expect(SYNCED_SETTING_KEYS).toEqual(['reference_prices', 'price_week_label', 'theme']);
  });

  it('lists every table exactly once', () => {
    const names = SYNC_TABLES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses the batch sizes the protocol specifies', () => {
    expect(PUSH_BATCH).toBe(200);
    expect(PULL_PAGE).toBe(500);
  });

  it('namespaces the cursor keys per table', () => {
    expect(cursorKey('fuel_log')).toBe('sync_cursor.fuel_log');
  });
});
