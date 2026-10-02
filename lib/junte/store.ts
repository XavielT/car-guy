import { enqueue } from '../db/client';
import { myJuntes, type JunteSummary } from './api';

/**
 * My juntes, cached (IMP 01102026 Phase 6): the last my_juntes() answer in `junte_cache` (id 'list'), shown at
 * once and offline; positions are never cached anywhere.
 */
export async function cachedJuntes(): Promise<JunteSummary[]> {
  return enqueue(async (db) => {
    const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM junte_cache WHERE id = ?', ['list']);
    try {
      return row ? (JSON.parse(row.json) as JunteSummary[]) : [];
    } catch {
      return [];
    }
  });
}

export async function refreshJuntes(): Promise<{ list: JunteSummary[]; offline: boolean }> {
  const r = await myJuntes();
  if (!r.ok) return { list: await cachedJuntes(), offline: true };
  await enqueue((db) => db.runAsync('INSERT OR REPLACE INTO junte_cache (id, json, updated_at) VALUES (?, ?, ?)', ['list', JSON.stringify(r.data), new Date().toISOString()]));
  return { list: r.data, offline: false };
}

/** Live now / upcoming / past, by the junte's own window and status. */
export function sectionOf(j: JunteSummary, now: number): 'live' | 'upcoming' | 'past' {
  const start = new Date(j.starts_at).getTime();
  const end = j.ends_at ? new Date(j.ends_at).getTime() : start + 6 * 3_600_000;
  if (j.status === 'ended' || now > end) return 'past';
  if (now >= start - 30 * 60_000) return 'live';
  return 'upcoming';
}
