#!/usr/bin/env node
/**
 * The OTA gate (IMP 01102026 Phase 4, ADR-52): may this release go out as an EAS Update, or does it need a
 * new APK? An OTA only reaches APKs with the same runtime — the fingerprint (fingerprint.config.js) of the
 * last APK we released, kept in releases/fingerprint.json by tools/release-apk.sh.
 *
 *   node tools/ota-gate.cjs check        → prints "ota" or "apk <reason>", exit 0 (ota) / 3 (apk)
 *   node tools/ota-gate.cjs record <ver> → after an APK release: store this fingerprint as the released one
 */
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const FILE = join(__dirname, '..', 'releases', 'fingerprint.json');

/** Pure: the decision from the current fingerprint and the stored record. */
function decide(current, record) {
  if (!current) return { kind: 'apk', reason: 'no-fingerprint' };
  if (!record || typeof record.android !== 'string') return { kind: 'apk', reason: 'no-released-fingerprint' };
  if (record.android !== current) return { kind: 'apk', reason: `native changed since ${record.version ?? 'the last APK'}` };
  return { kind: 'ota', reason: `same runtime as ${record.version ?? 'the last APK'}` };
}

function readRecord(file = FILE) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function currentFingerprint() {
  const out = execFileSync('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'android'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, APP_VARIANT: '' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.slice(out.indexOf('{'))).runtimeVersion ?? null;
}

module.exports = { decide, readRecord, FILE };

if (require.main === module) {
  const [cmd, version] = process.argv.slice(2);
  if (cmd === 'record') {
    if (!version) {
      console.error('usage: ota-gate.cjs record <version>');
      process.exit(2);
    }
    const android = currentFingerprint();
    if (!existsSync(dirname(FILE))) mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, `${JSON.stringify({ version, android, recordedAt: new Date().toISOString() }, null, 2)}\n`);
    console.log(`recorded ${version} ${android}`);
  } else if (cmd === 'check') {
    const d = decide(currentFingerprint(), readRecord());
    console.log(d.kind === 'ota' ? `ota (${d.reason})` : `apk (${d.reason})`);
    process.exit(d.kind === 'ota' ? 0 : 3);
  } else {
    console.error('usage: ota-gate.cjs check | record <version>');
    process.exit(2);
  }
}
