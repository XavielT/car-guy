#!/usr/bin/env node
/**
 * `npm run web:desktop` (IMP 03112026 SPEC-F §F5): starts the Expo web dev server and opens it in a 1440×900 browser window, the size the
 * desktop layout is checked at. Needs only the PUBLIC env values (.env.local, see .env.example): never an AI key.
 *
 * The window is Playwright's Chromium when `playwright-core` can be found (a dev tool, not a dependency of the app; set CHROMIUM_PATH to
 * use an installed Chrome/Edge). Without it the server still starts and the address is printed, so any browser can be resized by hand.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const PORT = process.env.PORT || '8081';
const URL = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);

const server = spawn('npx', ['expo', 'start', '--web', '--port', PORT], { stdio: 'inherit', shell: true });
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('exit', stop);

async function up() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

if (!(await up())) {
  console.error(`\nThe dev server did not answer on ${URL} within 2 minutes.`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch {
  console.log(`\nOpen ${URL} in a browser and make the window 1440×900 (playwright-core is not installed, so no window was opened).`);
  await new Promise(() => {});
}

const browser = await chromium.launch({ headless: false, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL);
console.log(`\nDesktop window open at 1440×900 on ${URL}. Close the window to stop.`);
browser.on('disconnected', () => {
  stop();
  process.exit(0);
});
await new Promise(() => {});
