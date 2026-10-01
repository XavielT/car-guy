// Every Vercel function under api/ must load in plain Node: no react-native, expo-* or other app-only
// module may be reached at import time (a static one crashed every public page once — 2026-09-30).
//   node tools/check-api-load.mjs
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|js|mjs)$/.test(f)) files.push(p);
  }
})('api');
let failed = 0;
for (const f of files) {
  try {
    execSync(`npx tsx -e 'import(process.env.API_FILE).then(() => {}, (e) => { console.error(e.message.slice(0, 300)); process.exit(1); })'`, {
      stdio: 'pipe',
      env: { ...process.env, API_FILE: './' + f },
    });
    console.log(`ok    ${f}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${f}\n      ${String(e.stderr || e.message).trim().split('\n').slice(-2).join(' ')}`);
  }
}
console.log(failed ? `${failed} function(s) do not load in Node` : `${files.length} functions load`);
process.exit(failed ? 1 : 0);
