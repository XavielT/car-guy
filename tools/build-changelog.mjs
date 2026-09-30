/**
 * CHANGELOG.md → lib/changelog.generated.ts, for "Novedades y versiones".
 *
 * Runs before `npm start`, `npm run prebuild` and the web build. The generated
 * file is committed, so a build that skips this script (EAS, an old Node) still
 * ships the notes; __tests__/changelog/parse.test.ts fails when it is stale.
 *
 * The parser is TypeScript shared with the app's tests (lib/changelog/parse.ts);
 * Node ≥ 22.18 runs it directly by stripping the types. On an older Node the
 * import fails, and the script says so and keeps the committed file rather than
 * failing the build.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'CHANGELOG.md');
const target = join(root, 'lib', 'changelog.generated.ts');

let parser;
try {
  parser = await import('../lib/changelog/parse.ts');
} catch (error) {
  console.warn(
    `[build-changelog] Could not load lib/changelog/parse.ts (${error?.code ?? error?.message}); ` +
      'keeping the committed lib/changelog.generated.ts.',
  );
  process.exit(0);
}

const markdown = await readFile(source, 'utf8');
const entries = parser.parseChangelog(markdown);
const next = parser.renderGenerated(entries);
const current = await readFile(target, 'utf8').catch(() => null);

if (current === next) {
  console.log(`[build-changelog] up to date (${entries.length} versions)`);
} else {
  await writeFile(target, next);
  console.log(`[build-changelog] wrote lib/changelog.generated.ts (${entries.length} versions)`);
}
