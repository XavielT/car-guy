/**
 * IMP 03112026 ADR-65 / SPEC-A §A2: the bundle guard refuses a client bundle that carries a server secret.
 * The fake secrets are assembled at run time so this file itself holds nothing a scanner would flag.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', '..', 'tools', 'check-bundle-env.mjs');
const REF_HOST = 'nakgrkcqyuycadeuenuw.supabase.co'; // the public project URL from eas.json

function b64url(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
const fake = {
  anthropic: () => 'sk-' + 'ant-' + 'api03-' + 'A'.repeat(40),
  google: () => 'AI' + 'za' + 'B'.repeat(35),
  serviceRole: () => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', role: 'service_role' })}.${'c'.repeat(20)}`,
  anon: () => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', role: 'anon' })}.${'c'.repeat(20)}`,
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-bundle-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(body: string, extra: string[] = []) {
  writeFileSync(join(dir, 'index.js'), body);
  const r = spawnSync(process.execPath, [SCRIPT, dir, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('tools/check-bundle-env.mjs', () => {
  it('passes a bundle with the Supabase URL and the public anon key', () => {
    const r = run(`var u="https://${REF_HOST}";var k="${fake.anon()}";`);
    expect(r.code).toBe(0);
  });

  it('FAILS on a planted Anthropic key, and never prints the value', () => {
    const key = fake.anthropic();
    const r = run(`var u="https://${REF_HOST}";var k="${key}";`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('Anthropic key');
    expect(r.out).not.toContain(key);
    expect(r.out).not.toContain('A'.repeat(20));
  });

  it('FAILS on a Google key shape', () => {
    const r = run(`var u="https://${REF_HOST}";var k="${fake.google()}";`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('Google API key');
  });

  it('FAILS on a service-role JWT but not on an anon JWT', () => {
    expect(run(`var u="https://${REF_HOST}";var k="${fake.serviceRole()}";`).code).toBe(1);
    expect(run(`var u="https://${REF_HOST}";var k="${fake.anon()}";`).code).toBe(0);
  });

  it.each(['ANTHROPIC_API_KEY', 'GOOGLE_MAPS_API_KEY', 'STT_API_KEY', 'AZURE_SPEECH_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])(
    'FAILS when the secret NAME %s is referenced from the client',
    (name) => {
      const r = run(`var u="https://${REF_HOST}";var n="${name}";`);
      expect(r.code).toBe(1);
      expect(r.out).toContain('secret name');
    },
  );

  it('still enforces the Supabase URL (check 1) unless --forbidden-only', () => {
    expect(run('var x=1;').code).toBe(1);
    expect(run('var x=1;', ['--forbidden-only']).code).toBe(0);
  });

  it('--forbidden-only still refuses a planted key', () => {
    expect(run(`var k="${fake.anthropic()}";`, ['--forbidden-only']).code).toBe(1);
  });
});
