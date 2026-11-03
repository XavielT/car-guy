/** @jest-environment node */
/**
 * IMP 03112026 SPEC-A §A2: the shape checks behind tools/set-ai-secrets.mjs. Fake values are assembled at run time.
 */
import { ALLOWED_SECRET_NAMES, checkReport, parseEnvVar, parseKeyFile, setLine, validateShape } from '../../tools/lib/secret-shapes.cjs';

const fakeAnthropic = () => 'sk-' + 'ant-' + 'api03-' + 'Z'.repeat(40);
const fakeGoogle = () => 'AI' + 'za' + 'Y'.repeat(35);

describe('parseKeyFile', () => {
  it('reads a raw value (SGC’s two loose files)', () => {
    expect(parseKeyFile(`${fakeAnthropic()}\n`)).toBe(fakeAnthropic());
  });
  it('strips BOM, CRLF, quotes, NAME= and export', () => {
    expect(parseKeyFile(`﻿${fakeGoogle()}\r\n`)).toBe(fakeGoogle());
    expect(parseKeyFile(`ANTHROPIC_API_KEY="${fakeAnthropic()}"`)).toBe(fakeAnthropic());
    expect(parseKeyFile(`export GOOGLE_MAPS_API_KEY='${fakeGoogle()}'`)).toBe(fakeGoogle());
  });
  it('skips comments and blank lines; empty means null', () => {
    expect(parseKeyFile(`# note\n\n${fakeGoogle()}`)).toBe(fakeGoogle());
    expect(parseKeyFile('')).toBeNull();
    expect(parseKeyFile('\n# only a comment\n')).toBeNull();
  });
});

describe('parseEnvVar', () => {
  it('finds one name in an env body and ignores the rest', () => {
    const body = `FOO=1\nAZURE_SPEECH_REGION="eastus"\nexport AZURE_SPEECH_KEY=abc123abc123abc123\n`;
    expect(parseEnvVar(body, 'AZURE_SPEECH_REGION')).toBe('eastus');
    expect(parseEnvVar(body, 'AZURE_SPEECH_KEY')).toBe('abc123abc123abc123');
    expect(parseEnvVar(body, 'MISSING')).toBeNull();
  });
});

describe('validateShape', () => {
  it('accepts well-formed values', () => {
    expect(validateShape('ANTHROPIC_API_KEY', fakeAnthropic())).toBeNull();
    expect(validateShape('GOOGLE_MAPS_API_KEY', fakeGoogle())).toBeNull();
    expect(validateShape('CG_MODEL_VISION', 'claude-haiku-5-5')).toBeNull();
    expect(validateShape('STT_PROVIDER', 'groq')).toBeNull();
  });
  it('rejects wrong shapes with a message that names the secret and NEVER contains the value', () => {
    const wrong = 'not-a-key-' + 'Q'.repeat(30);
    const m = validateShape('ANTHROPIC_API_KEY', wrong) as string;
    expect(m).toContain('ANTHROPIC_API_KEY');
    expect(m).not.toContain(wrong);
    expect(m).not.toContain('QQQQQ');
    expect(validateShape('GOOGLE_MAPS_API_KEY', 'AIzaShort')).toContain('GOOGLE_MAPS_API_KEY');
    expect(validateShape('CG_MODEL_VISION', 'gpt-4')).toContain('claude-*');
    expect(validateShape('STT_PROVIDER', 'azure')).toContain('openai or groq');
    expect(validateShape('ANTHROPIC_API_KEY', '')).toContain('empty');
  });
  it('refuses any name outside the allow-list (Music Hub’s secrets are on the same project)', () => {
    expect(validateShape('SUPABASE_SERVICE_ROLE_KEY', 'x'.repeat(40))).toContain('not a secret this tool may set');
    expect(validateShape('VAPID_PRIVATE_KEY', 'x'.repeat(40))).toContain('not a secret');
    expect(ALLOWED_SECRET_NAMES.some((n) => /SUPABASE|WHATSAPP|VAPID|GITHUB/.test(n))).toBe(false);
  });
});

describe('output', () => {
  it('setLine prints the name and the length only', () => {
    const v = fakeAnthropic();
    const line = setLine('ANTHROPIC_API_KEY', v);
    expect(line).toBe(`ANTHROPIC_API_KEY set (length ${v.length})`);
    expect(line).not.toContain('sk-');
  });
  it('checkReport flags the missing required names', () => {
    const r = checkReport(['ANTHROPIC_API_KEY', 'CG_MODEL_VISION', 'STT_API_KEY']);
    expect(r.missingRequired).toEqual(['CG_MODEL_REASON']);
    expect(r.optional.find((o: { name: string }) => o.name === 'STT_API_KEY')?.present).toBe(true);
    expect(r.optional.find((o: { name: string }) => o.name === 'GOOGLE_MAPS_API_KEY')?.present).toBe(false);
  });
});
