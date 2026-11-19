import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { affectsStore, STORE_TABLES } from '@/lib/storeTables';

describe('affectsStore', () => {
  it('reloads for the tables the store reads', () => {
    for (const t of ['vehicle', 'fuel_log', 'expense', 'reminder', 'service_record', 'setting', 'fuel_price', 'fuel_price_ref']) {
      expect(affectsStore(t)).toBe(true);
    }
  });

  it('ignores high-churn tables the store never reads', () => {
    for (const t of ['trip_point', 'trip_state', 'ai_queue', 'media', 'social_cache', 'junte_cache']) {
      expect(affectsStore(t)).toBe(false);
    }
  });

  it('an unknown or empty name reloads (safe default)', () => {
    expect(affectsStore('')).toBe(true);
    expect(affectsStore(undefined)).toBe(true);
    expect(affectsStore(null)).toBe(true);
  });

  it('stays in step with load(): every table named in lib/store.tsx repos is listed', () => {
    // load() reads these repos; if a new one is added there, this fails until the table is listed.
    const src = readFileSync(join(__dirname, '..', '..', 'lib', 'store.tsx'), 'utf8');
    const repos = [...new Set([...src.matchAll(/(\w+)Repo\.list\(/g)].map((m) => m[1]))].sort();
    expect(repos).toEqual(['expense', 'fuel', 'reminder', 'serviceRecord', 'vehicle']);
    expect(STORE_TABLES.size).toBe(8);
  });
});
