#!/usr/bin/env node
/**
 * Refuses an APK (or an exported bundle) that was built without the Supabase
 * project in it — the 2.1.0–2.1.2 mistake (IMP 29092026 note 13): the app then
 * says "cuenta no disponible" to every user.
 *
 *   node tools/check-bundle-env.mjs releases/car-guy-v2.1.3.apk
 *   node tools/check-bundle-env.mjs dist/            # after `npx expo export`
 *
 * The project ref comes from eas.json `build.base.env` (the public URL), so the
 * check needs no secrets. Hermes bytecode keeps string literals readable, so a
 * byte search on `assets/index.android.bundle` is enough. Exit 0 = found.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/check-bundle-env.mjs <file.apk | bundle | export-dir>');
  process.exit(2);
}

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const url = eas?.build?.base?.env?.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error('eas.json build.base.env.EXPO_PUBLIC_SUPABASE_URL is missing or not a supabase.co URL');
  process.exit(2);
}

/** Every JS/HBC bundle the target holds, as buffers. */
function bundles(path) {
  if (statSync(path).isDirectory()) {
    const out = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|hbc|bundle)$/.test(name)) out.push({ name: full, bytes: readFileSync(full) });
      }
    };
    walk(path);
    return out;
  }
  if (path.endsWith('.apk')) {
    const bytes = execFileSync('unzip', ['-p', path, 'assets/index.android.bundle'], { maxBuffer: 512 * 1024 * 1024 });
    return [{ name: `${path}!assets/index.android.bundle`, bytes }];
  }
  return [{ name: path, bytes: readFileSync(path) }];
}

const found = bundles(target).filter((b) => b.bytes.includes(Buffer.from(`${ref}.supabase.co`)));
if (!found.length) {
  console.error(`✗ ${target}: no "${ref}.supabase.co" in the bundle — built without EXPO_PUBLIC_SUPABASE_URL. Do not release it.`);
  process.exit(1);
}
console.log(`✓ ${target}: the bundle carries ${ref}.supabase.co (${found.map((b) => b.name).join(', ')})`);
