/**
 * evals/ux/registry-titles.json is what the browser task script compares "Todas las funciones" against. This keeps it honest:
 * it must list exactly the active registry functions with their Spanish titles (regenerate with WRITE_FIXTURE=1).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { es } from '@/lib/i18n/es';
import { activeFeatures } from '@/lib/features/registry';

const FILE = join(__dirname, '../../evals/ux/registry-titles.json');
const current = () => activeFeatures().map((f) => ({ id: f.id, title: es.features.items[f.id].title })).sort((a, b) => a.id.localeCompare(b.id));

it('the fixture lists every active function with its title', () => {
  if (process.env.WRITE_FIXTURE) writeFileSync(FILE, JSON.stringify(current(), null, 2) + '\n');
  expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(current());
});
