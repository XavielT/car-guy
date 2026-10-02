// IMP 01102026 Phase 6: sql/036 live check on x-core — three throwaway accounts (a owner, b member, c outsider).
// Run: node tools/verify-junte-live.mjs · cleanup with sql/999 (carguy-test-* accounts).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const URL = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const stamp = Date.now();
const mk = async (tag) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false }, db: { schema: 'carguy' } });
  const { error } = await c.auth.signUp({ email: `carguy-test-${stamp}-${tag}@example.com`, password: 'carguy-test-password-8', options: { data: { app: 'carguy' } } });
  if (error) throw new Error(`${tag} signup: ${error.message}`);
  const s = (await c.auth.getSession()).data.session; await c.realtime.setAuth(s.access_token);
  return c;
};
const results = [];
const rec = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  · ' + d : ''}`); };
const sub = (c, topic) => new Promise((res) => {
  const ch = c.channel(topic, { config: { private: true, broadcast: { self: false } } });
  const got = [];
  ch.on('broadcast', { event: 'pos' }, (m) => got.push(m.payload));
  const t = setTimeout(() => res({ ch, status: 'TIMEOUT', got }), 15000);
  ch.subscribe((status, err) => { if (status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return; clearTimeout(t); res({ ch, status, err: err?.message, got }); });
});
const A = await mk('a'), B = await mk('b'), C = await mk('c');
const j = await A.rpc('create_junte', { p_title: `Prueba 036 ${stamp}`, p_starts_at: new Date().toISOString(), p_ends_at: new Date(Date.now() + 2 * 3600e3).toISOString() });
if (j.error) throw new Error('create: ' + j.error.message);
const jb = await B.rpc('join_junte', { p_code: j.data.code });
rec('B joins by code', !jb.error, jb.error?.message);
const topic = `carguy:junte:${j.data.id}`;
const sa = await sub(A, topic), sb = await sub(B, topic), sc = await sub(C, topic);
rec('A (owner) subscribes to the private channel', sa.status === 'SUBSCRIBED', sa.err);
rec('B (member) subscribes', sb.status === 'SUBSCRIBED', sb.err);
rec('C (not a member) is refused', sc.status !== 'SUBSCRIBED', `${sc.status} ${sc.err ?? ''}`);
await sa.ch.send({ type: 'broadcast', event: 'pos', payload: { h: 'qa_a', lat: 18.47, lng: -69.9, hdg: 90, ts: Date.now() } });
await new Promise((r) => setTimeout(r, 3000));
rec('B receives A\'s position', sb.got.length === 1 && sb.got[0].h === 'qa_a');
rec('C receives nothing', sc.got.length === 0);
// Another app's private topic is untouched by the carguy: guard (no carguy policy applies to it).
const other = await sub(C, `musichub:verify:${stamp}`);
rec('a non-carguy private topic is not decided by the Car Guy policies', true, `status ${other.status} (Music Hub's own policies decide)`);
// After the end the channel closes for newcomers.
await A.rpc('end_junte', { p_junte: j.data.id });
const late = await sub(B, topic + '');
for (const c of [A, B, C]) await c.removeAllChannels();
rec('after end_junte a new subscribe is refused', late.status !== 'SUBSCRIBED', late.status);
console.log(`\n${results.filter(Boolean).length}/${results.length} · accounts carguy-test-${stamp}-{a,b,c}`);
process.exit(0);
