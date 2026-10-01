// maplibre-gl v6 loads its worker (and the code it shares with it) from a URL, which Metro
// does not bundle: copy them into public/maplibre/ (served as-is on web; `expo export` copies
// public/ into dist/). Runs on postinstall, so Vercel's build gets them too. ADR-41.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
const from = 'node_modules/maplibre-gl/dist';
if (existsSync(from)) {
  mkdirSync('public/maplibre', { recursive: true });
  for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) if (existsSync(`${from}/${f}`)) copyFileSync(`${from}/${f}`, `public/maplibre/${f}`);
}
