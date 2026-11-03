/**
 * Pure helpers for tools/set-ai-secrets.mjs (CommonJS so jest and Node can both load it) (IMP 03112026, SPEC-A §A2). No I/O, so the shapes are unit-tested without
 * touching a key file. Nothing here ever returns or logs a value except to hand it to the caller that sets the secret;
 * every message built here names the secret and its LENGTH only.
 */

/** The only secret names this tool may ever set. Anything else is refused, so a typo cannot overwrite Music Hub's. */
const ALLOWED_SECRET_NAMES = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'STT_API_KEY',
  'STT_PROVIDER',
  'STT_MODEL',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION',
  'CG_MODEL_VISION',
  'CG_MODEL_REASON',
  'CG_ALLOWED_ORIGINS',
];

/** Needed for the gateway to work at all / optional families, for --check. */
const REQUIRED = ['ANTHROPIC_API_KEY', 'CG_MODEL_VISION', 'CG_MODEL_REASON'];
const OPTIONAL = ['GOOGLE_MAPS_API_KEY', 'STT_API_KEY', 'STT_PROVIDER', 'STT_MODEL', 'CG_ALLOWED_ORIGINS'];

const SHAPES = {
  ANTHROPIC_API_KEY: { re: /^sk-ant-[A-Za-z0-9_-]{20,}$/, hint: 'must start with sk-ant-' },
  GOOGLE_MAPS_API_KEY: { re: /^AIza[0-9A-Za-z_-]{35}$/, hint: 'must start with AIza and be 39 characters' },
  STT_API_KEY: { re: /^\S{16,}$/, hint: 'must be a single token of 16+ characters' },
  STT_PROVIDER: { re: /^(openai|groq)$/i, hint: 'must be openai or groq' },
  STT_MODEL: { re: /^[A-Za-z0-9._-]{3,60}$/, hint: 'must be a model id' },
  AZURE_SPEECH_KEY: { re: /^\S{16,}$/, hint: 'must be a single token of 16+ characters' },
  AZURE_SPEECH_REGION: { re: /^[a-z0-9]{3,30}$/, hint: 'must be a region like eastus' },
  CG_MODEL_VISION: { re: /^claude-[a-z0-9.-]{3,60}$/, hint: 'must be a claude-* model id' },
  CG_MODEL_REASON: { re: /^claude-[a-z0-9.-]{3,60}$/, hint: 'must be a claude-* model id' },
  CG_ALLOWED_ORIGINS: { re: /^https?:\/\/\S+$/, hint: 'must be comma separated http(s) origins' },
};

/**
 * A key file holds the raw value (SGC's two loose files), or `NAME=value`, or `export NAME="value"`, possibly with a
 * BOM, quotes, comments and CRLF. Returns the value or null. The raw text is never kept.
 */
function parseKeyFile(raw) {
  if (typeof raw !== 'string') return null;
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) return null;
  let v = lines[0].replace(/^export\s+/, '');
  const eq = v.match(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/);
  if (eq) v = eq[1];
  v = v.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  return v || null;
}

/** Looks up KEY in an env-file body (`KEY=value` lines). Used for SGC's `.env.local` optional Azure names. */
function parseEnvVar(raw, name) {
  for (const line of String(raw).replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^(['"])(.*)\1$/, '$2').trim() || null;
  }
  return null;
}

/** null when the value fits the secret's shape, otherwise a message that names the secret and the rule, never the value. */
function validateShape(name, value) {
  if (!ALLOWED_SECRET_NAMES.includes(name)) return `${name} is not a secret this tool may set`;
  if (typeof value !== 'string' || value.length === 0) return `${name} is empty`;
  const s = SHAPES[name];
  if (s && !s.re.test(value)) return `${name} does not look right (${s.hint}; length ${value.length})`;
  return null;
}

/** The one line printed per secret: name and length, nothing else. */
function setLine(name, value) {
  return `${name} set (length ${String(value).length})`;
}

/** Splits the names present in x-core into what --check reports. `present` = names only. */
function checkReport(present) {
  const has = new Set(present);
  return {
    required: REQUIRED.map((n) => ({ name: n, present: has.has(n) })),
    optional: OPTIONAL.map((n) => ({ name: n, present: has.has(n) })),
    missingRequired: REQUIRED.filter((n) => !has.has(n)),
  };
}

module.exports = { ALLOWED_SECRET_NAMES, REQUIRED, OPTIONAL, parseKeyFile, parseEnvVar, validateShape, setLine, checkReport };
