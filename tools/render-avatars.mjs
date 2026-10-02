#!/usr/bin/env node
/**
 * Renders the 16 drawn avatars (components/avatars, react-native-svg) to public/avatars/<id>.png — the web
 * profile's og:image when a photo is not public (IMP 01102026 Phase 5). Run once after an avatar changes, with
 * the web dev server up (`npx expo start --web`):
 *
 *   PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs node tools/render-avatars.mjs [http://localhost:8081]
 *
 * Playwright is deliberately not a dependency (like sharp in make-icons.mjs). It screenshots each avatar in
 * Perfil's grid (same order as AVATAR_IDS) at 4× scale.
 */
import { mkdirSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:8081';
const core = process.env.PLAYWRIGHT_CORE ?? '/home/xaviel/dev2/music-hub/node_modules/playwright-core/index.mjs';
const { chromium } = await import(core);
const ids = [...readFileSync(new URL('../lib/avatars.ts', import.meta.url), 'utf8').matchAll(/^  '([a-z_]+)',$/gm)].map((m) => m[1]);
if (ids.length !== 16) throw new Error(`expected 16 avatar ids, found ${ids.length}`);
mkdirSync(new URL('../public/avatars/', import.meta.url), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 4, locale: 'es-DO', colorScheme: 'dark' });
  await page.goto(`${base}/perfil`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 4; i++) {
    const b = page.getByText(/^(acepto|entendido)$/i).first();
    if ((await b.count()) && (await b.isVisible().catch(() => false))) await b.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const cells = page.locator('[role="radio"]');
  const n = await cells.count();
  if (n < 16) throw new Error(`found ${n} avatar cells`);
  for (let i = 0; i < 16; i++) {
    const svg = cells.nth(i).locator('svg').first();
    await svg.scrollIntoViewIfNeeded();
    await svg.screenshot({ path: new URL(`../public/avatars/${ids[i]}.png`, import.meta.url).pathname, omitBackground: true });
    console.log(`✓ ${ids[i]}.png`);
  }
} finally {
  await browser.close();
}
