/** @jest-environment node */
/**
 * PROMPT-08 step 2: no `cg-*` Edge Function can run without the gateway. Every function entry point serves through `serveAi`
 * (JWT → admin → kill switch → consent → caps → usage row), except `cg-ai-status`, which makes NO provider call: it only reports the
 * person's own status and is built on `makeDeps` + `handleStatus` (tested in gateway.test.ts).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../supabase/functions');
const NO_PROVIDER_CALL = new Set(['cg-ai-status']);
const fns = readdirSync(ROOT).filter((d) => d.startsWith('cg-') && existsSync(join(ROOT, d, 'index.ts')));

describe('every cg-* function goes through the gateway', () => {
  it('finds the functions', () => expect(fns.length).toBeGreaterThanOrEqual(9));
  for (const name of fns) {
    it(`${name}`, () => {
      const src = readFileSync(join(ROOT, name, 'index.ts'), 'utf8');
      if (NO_PROVIDER_CALL.has(name)) {
        expect(src).toContain('makeDeps');
        expect(src).not.toMatch(/anthropic|callClaude|api\.openai|fetch\(/i);
      } else {
        expect(src).toContain('serveAi');
        // Nothing may bypass the gateway by serving directly.
        expect(src).not.toMatch(/Deno\.serve\(/);
      }
    });
  }
});
