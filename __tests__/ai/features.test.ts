/** @jest-environment node */
/**
 * IMP 03112026 SPEC-G §G10: the admin can switch each AI feature off; the server refuses it before any provider, an unknown or malformed
 * list switches nothing off, and sql/044 is the one that makes the gate report it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_FEATURES, withFeature } from '@/lib/ai/features';
import { AI_CONFIG_KEYS, configFromRows, DEFAULT_AI_CONFIG } from '@/lib/ai/limits';
import { FEATURE_IDS, fixedFeature, intentFeature, readFeature } from '../../supabase/functions/_shared/features.ts';
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { isFeatureOff } from '../../supabase/functions/_shared/gate.ts';
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import { handleStatus } from '../../supabase/functions/cg-ai-status/logic.ts';
import { placesConfigured, placesHandler } from '../../supabase/functions/cg-places/logic.ts';
import { readHandler } from '../../supabase/functions/cg-ai-read/logic.ts';

describe('the list', () => {
  it('app and server agree', () => expect([...AI_FEATURES]).toEqual([...FEATURE_IDS]));
  it('maps requests to features', () => {
    expect(readFeature({ kind: 'album_batch' })).toBe('album');
    expect(readFeature({ kind: 'part_label' })).toBe('album');
    expect(readFeature({ kind: 'check_photo' })).toBe('check_photo');
    expect(readFeature({ kind: 'damage_photos' })).toBe('accident');
    expect(readFeature({ kind: 'fuel_receipt' })).toBeNull();
    expect(readFeature(null)).toBeNull();
    expect(intentFeature({ feature: 'search' })).toBe('search');
    expect(intentFeature({ feature: 'delete' })).toBeNull();
    expect(intentFeature({})).toBeNull();
    expect(fixedFeature('sale')()).toBe('sale');
  });
});

describe('isFeatureOff', () => {
  it('only a real array naming it switches it off', () => {
    expect(isFeatureOff({ features_off: ['album'] }, 'album')).toBe(true);
    expect(isFeatureOff({ features_off: ['album'] }, 'places')).toBe(false);
    expect(isFeatureOff({ features_off: [] }, 'album')).toBe(false);
    expect(isFeatureOff({}, 'album')).toBe(false);
    expect(isFeatureOff({ features_off: 'album' as never }, 'album')).toBe(false);
    expect(isFeatureOff({ features_off: ['album'] }, null)).toBe(false);
  });
});

const OK: GateSnapshot = { enabled: true, consent: true, limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 }, used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 } };
function deps(snap: GateSnapshot, sent: string[], usage: UsageRow[]): Deps {
  return {
    env: (k) => (k === 'ANTHROPIC_API_KEY' ? 'k' : undefined), authUser: async () => 'u1', gateSnapshot: async () => snap, isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl: (async (_u: string, init: { body: string }) => (sent.push(init.body), new Response(JSON.stringify({ elements: [] }), { status: 200 }))) as unknown as typeof fetch, sleep: async () => {},
  };
}
const post = (body: unknown) => new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const img = { data: 'A'.repeat(64), mime: 'image/jpeg' };

describe('the gateway refuses a switched-off feature before any provider', () => {
  it('cg-ai-read: a switched-off kind is ai_disabled (503), nothing fetched, nothing recorded; the other kinds still pass the gate', async () => {
    const sent: string[] = [];
    const usage: UsageRow[] = [];
    const snap = { ...OK, features_off: ['album'] };
    const res = await handleAi(post({ kind: 'album_batch', images: [img] }), 'cg-ai-read', readHandler, deps(snap, sent, usage), { feature: readFeature });
    expect(res.status).toBe(503);
    expect((await res.json()).error_code).toBe('ai_disabled');
    expect(sent).toHaveLength(0);
    expect(usage).toHaveLength(0);
    // An unaffected kind reaches the handler (which then fails on the fake provider answer, but only AFTER the gate).
    const other = await handleAi(post({ kind: 'check_photo', item: 'tire_tread', images: [img] }), 'cg-ai-read', readHandler, deps(snap, sent, usage), { feature: readFeature });
    expect(sent.length).toBeGreaterThan(0);
    expect((await other.json()).error_code).not.toBe('ai_disabled');
  });
  it('cg-places: off means refused with no outbound call', async () => {
    const sent: string[] = [];
    const res = await handleAi(post({ kind: 'taller', lat: 18, lng: -69 }), 'cg-places', placesHandler, deps({ ...OK, features_off: ['places'] }, sent, []), { configured: placesConfigured, feature: fixedFeature('places') });
    expect(res.status).toBe(503);
    expect(sent).toHaveLength(0);
    const on = await handleAi(post({ kind: 'taller', lat: 18, lng: -69 }), 'cg-places', placesHandler, deps(OK, sent, []), { configured: placesConfigured, feature: fixedFeature('places') });
    expect(on.status).toBe(200);
  });
});

describe('cg-ai-status reports the switches so the app can hide the buttons', () => {
  it('signed in: features_off is part of the answer; a gate without the field reads as none', async () => {
    const req = () => new Request('https://x.test/s', { method: 'POST', headers: { authorization: 'Bearer t' } });
    const a = await (await handleStatus(req(), deps({ ...OK, features_off: ['sale', 'places'] }, [], []))).json();
    expect(a.features_off).toEqual(['sale', 'places']);
    const b = await (await handleStatus(req(), deps(OK, [], []))).json();
    expect(b.features_off).toEqual([]);
  });
});

describe('admin config', () => {
  it('configFromRows reads the list; anything that is not an array of strings is none', () => {
    expect(configFromRows({ [AI_CONFIG_KEYS.featuresOff]: ['album', 'sale', 7] }).featuresOff).toEqual(['album', 'sale']);
    expect(configFromRows({ [AI_CONFIG_KEYS.featuresOff]: 'album' }).featuresOff).toEqual([]);
    expect(configFromRows(null).featuresOff).toEqual(DEFAULT_AI_CONFIG.featuresOff);
  });
  it('withFeature flips one without touching the rest, and drops ids that are not features', () => {
    expect(withFeature([], 'album', false)).toEqual(['album']);
    expect(withFeature(['album'], 'album', false)).toEqual(['album']);
    expect(withFeature(['album', 'places'], 'album', true)).toEqual(['places']);
    expect(withFeature(['ghost', 'places'], 'sale', false)).toEqual(['places', 'sale']);
  });
});

describe('sql/044', () => {
  const sql = readFileSync(join(__dirname, '../../sql/044_ai_features.sql'), 'utf8');
  it('adds features_off to ai_gate, reads the key, only trusts an array, and keeps the service-role-only grants', () => {
    expect(sql).toMatch(/'features_off'/);
    expect(sql).toMatch(/'ai_features_off'/);
    expect(sql).toMatch(/jsonb_typeof\(cfg -> 'ai_features_off'\) = 'array'/);
    expect(sql).toMatch(/revoke all on function carguy\.ai_gate\(uuid, text\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function carguy\.ai_gate\(uuid, text\) to service_role/);
    // Every field 042 returned is still there.
    for (const k of ["'enabled'", "'consent'", "'limits'", "'used'", "'day_start'", "'user_hour'", "'function_user_day'"]) expect(sql).toContain(k);
  });
});
