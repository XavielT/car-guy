/**
 * IMP 29092026 Phase 1 (note 13): a user never reads an env var, a file name or
 * a Supabase setting. Technical hints live under `es.dev` and are appended only
 * in development or "modo diagnóstico".
 */
import { es } from '@/lib/i18n/es';

const DEVELOPER_TEXT = /EXPO_PUBLIC|\.env\b|\.example\b|sql\/\d|\bschema\b|Supabase|x-core|PGRST|Exposed schemas/i;

function strings(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === 'string') out.push([path, node]);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) strings(v, `${path}.${k}`, out);
  }
}

it('no user-facing string carries developer text', () => {
  const found: [string, string][] = [];
  const { dev: _dev, ...userFacing } = es;
  strings(userFacing, 'es', found);
  const offenders = found.filter(([, text]) => DEVELOPER_TEXT.test(text));
  expect(offenders).toEqual([]);
});

it('the developer hints exist for the three cases', () => {
  expect(es.dev.notConfigured).toMatch(/EXPO_PUBLIC_SUPABASE_URL/);
  expect(es.dev.inviteOnly).toMatch(/sql\/001/);
  expect(es.dev.schemaNotExposed).toMatch(/Exposed schemas/);
});
