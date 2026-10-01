/**
 * content/legal/*.md → the public pages and the app's copy (IMP 30092026 note 15, ADR-47).
 *
 *   public/terminos.html, public/privacidad.html, public/eliminar-cuenta.html
 *     static, both languages, served at /terminos, /privacidad, /eliminar-cuenta (vercel.json
 *     cleanUrls; `expo export` copies public/ into dist/). No JS needed to read them.
 *   lib/legal/content.generated.ts
 *     the same Markdown as strings for Más → Legal (components/legal/LegalMarkdown.tsx).
 *
 * Run after editing a text:   node tools/build-legal.mjs
 * The outputs are committed; __tests__/legal/markdown.test.ts fails when they are stale. The parser
 * and renderer are lib/legal/markdown.ts (erasable TypeScript; Node ≥ 22.18 strips the types).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = await import('../lib/legal/markdown.ts');
const indexSource = await readFile(join(root, 'lib', 'legal', 'index.ts'), 'utf8');
const version = /LEGAL_VERSION = '([^']+)'/.exec(indexSource)?.[1];
const date = /LEGAL_DATE = '([^']+)'/.exec(indexSource)?.[1];
if (!version || !date) {
  console.error('[build-legal] LEGAL_VERSION / LEGAL_DATE not found in lib/legal/index.ts');
  process.exit(1);
}

const sources = {};
for (const id of md.LEGAL_DOC_IDS) {
  sources[id] = {
    es: await readFile(join(root, 'content', 'legal', `${id}.es.md`), 'utf8'),
    en: await readFile(join(root, 'content', 'legal', `${id}.en.md`), 'utf8'),
  };
  for (const lang of ['es', 'en']) {
    if (!sources[id][lang].includes(version)) {
      console.error(`[build-legal] content/legal/${id}.${lang}.md does not state version ${version}`);
      process.exit(1);
    }
  }
  await writeFile(join(root, 'public', `${id}.html`), md.renderLegalPage(id, sources[id], version, date));
}
await writeFile(join(root, 'lib', 'legal', 'content.generated.ts'), md.renderContentModule(sources));
console.log(`[build-legal] ${md.LEGAL_DOC_IDS.length} pages · version ${version} · ${date}`);
