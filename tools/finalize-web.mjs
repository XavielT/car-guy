/**
 * Post-processes `expo export -p web`.
 *
 * expo-router renders its title through react-helmet, and during static
 * rendering that title comes out empty — no screen title reaches it. It is also
 * emitted ahead of anything written in +html.tsx, and the first <title> in a
 * document is the one the browser uses, so a static fallback there loses. The
 * result is a blank browser tab and a blank title in anything that unfurls a
 * link.
 *
 * Rather than delete helmet's element (runtime navigation still updates it),
 * fill it in.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const TITLE = 'Car Guy';
const EMPTY_HELMET_TITLE = '<title data-rh="true"></title>';

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const files = await htmlFiles(DIST);
let patched = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  if (!html.includes(EMPTY_HELMET_TITLE)) continue;
  await writeFile(file, html.replace(EMPTY_HELMET_TITLE, `<title data-rh="true">${TITLE}</title>`));
  patched += 1;
}

console.log(`finalize-web: titled ${patched}/${files.length} pages`);

if (patched === 0 && files.length > 0) {
  console.warn(
    'finalize-web: no empty helmet title found. If expo-router started emitting a ' +
      'real title, this step can go; if the markup merely changed shape, update it.',
  );
}
