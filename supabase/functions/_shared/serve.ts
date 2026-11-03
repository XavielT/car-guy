/**
 * Deno wiring for the gateway (the only `_shared` file that touches Deno / supabase-js; excluded from tsc and jest).
 * Two clients, the SGC pattern: the USER's client (their JWT, RLS applies) and a SERVICE client used only for
 * carguy.ai_gate() and the ai_usage insert. The service key never leaves the function.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { envRequired } from './env.ts';
import { handleAi, type Deps, type Handler, type Options } from './handler.ts';

const get = (name: string) => Deno.env.get(name);

export function makeDeps(): Deps {
  const url = envRequired(get, 'SUPABASE_URL');
  const anon = envRequired(get, 'SUPABASE_ANON_KEY');
  const service = envRequired(get, 'SUPABASE_SERVICE_ROLE_KEY');
  const svc = createClient(url, service, { auth: { persistSession: false } });
  const userClient = (token: string) =>
    createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });

  return {
    env: get,
    async authUser(token) {
      const { data, error } = await userClient(token).auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    async gateSnapshot(userId, fn) {
      const { data, error } = await svc.schema('carguy').rpc('ai_gate', { p_user: userId, p_function: fn });
      if (error || !data) throw new Error('gate');
      return data;
    },
    async isAdmin(token) {
      const { data, error } = await userClient(token).schema('carguy').rpc('is_admin');
      return !error && data === true;
    },
    async insertUsage(row) {
      const { error } = await svc.schema('carguy').from('ai_usage').insert(row);
      if (error) throw new Error('usage');
    },
  };
}

export function serveAi(fn: string, handler: Handler, opts: Options = {}) {
  Deno.serve((req) => handleAi(req, fn, handler, makeDeps(), opts));
}
