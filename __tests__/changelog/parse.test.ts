import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findEntry, parseChangelog, renderGenerated } from '@/lib/changelog/parse';
import { shouldShowNovedades } from '@/lib/changelog/novedades';

const FIXTURE = `# Changelog

## 3.0.0 (sin publicar)

- **Uno**: primera línea
  que sigue aquí.
- Dos con [un link](https://example.com).

## 2.5.0 — Kaidō (2026-10-01)

Un párrafo de
introducción.

### Nuevo

- Padre:
  - hijo uno
  - hijo dos
    continúa
- Otro.

---

### Antes de publicar (2026-09-30)

Pruebas en el teléfono:

- Probado.

## [2.4.1] - 2026-09-20

### Fixed
* Arreglo con asterisco.
1. Numerado.

## No es una versión

## 2.4.0 (2026-09-01)
`;

describe('parseChangelog', () => {
  const entries = parseChangelog(FIXTURE);

  it('reads every version heading style', () => {
    expect(entries.map((e) => [e.version, e.name, e.date, e.unreleased])).toEqual([
      ['3.0.0', null, null, true],
      ['2.5.0', 'Kaidō', '2026-10-01', false],
      ['2.4.1', null, '2026-09-20', false],
      ['2.4.0', null, '2026-09-01', false],
    ]);
  });

  it('puts bullets before any ### in an untitled section and joins continuation lines', () => {
    expect(entries[0].sections).toEqual([
      { title: null, intro: [], items: ['**Uno**: primera línea que sigue aquí.', 'Dos con un link.'] },
    ]);
  });

  it('folds nested items into their parent and keeps paragraphs as intro', () => {
    const e = entries[1];
    expect(e.intro).toEqual(['Un párrafo de introducción.']);
    expect(e.sections).toEqual([
      { title: 'Nuevo', intro: [], items: ['Padre: hijo uno; hijo dos continúa', 'Otro.'] },
      { title: 'Antes de publicar (2026-09-30)', intro: ['Pruebas en el teléfono:'], items: ['Probado.'] },
    ]);
  });

  it('reads * and numbered bullets, and drops empty entries’ sections', () => {
    expect(entries[2].sections).toEqual([
      { title: 'Fixed', intro: [], items: ['Arreglo con asterisco.', 'Numerado.'] },
    ]);
    expect(entries[3].sections).toEqual([]);
  });

  it('finds an entry by version, with or without a v or a suffix', () => {
    expect(findEntry(entries, 'v2.5.0')?.name).toBe('Kaidō');
    expect(findEntry(entries, '3.0.0-dev')?.version).toBe('3.0.0');
    expect(findEntry(entries, '9.9.9')).toBeNull();
    expect(findEntry(entries, null)).toBeNull();
  });
});

describe('lib/changelog.generated.ts', () => {
  it('matches CHANGELOG.md (run `npm run changelog` if this fails)', () => {
    const root = join(__dirname, '..', '..');
    const markdown = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    const generated = readFileSync(join(root, 'lib', 'changelog.generated.ts'), 'utf8');
    expect(generated).toBe(renderGenerated(parseChangelog(markdown)));
  });

  it('has the versions the app has shipped', () => {
    const markdown = readFileSync(join(__dirname, '..', '..', 'CHANGELOG.md'), 'utf8');
    const versions = parseChangelog(markdown).map((e) => e.version);
    expect(versions).toEqual(expect.arrayContaining(['2.1.3', '2.1.0', '2.0.0']));
  });
});

describe('shouldShowNovedades', () => {
  const entries = parseChangelog(FIXTURE);
  it('stays quiet on a first install, and just remembers the version', () => {
    expect(shouldShowNovedades({ lastSeen: null, current: '2.5.0', hasData: false, entries })).toEqual({
      show: false,
      store: true,
    });
  });
  it('shows once after an update', () => {
    expect(shouldShowNovedades({ lastSeen: '2.4.1', current: '2.5.0', hasData: true, entries })).toEqual({
      show: true,
      store: true,
    });
    expect(shouldShowNovedades({ lastSeen: '2.5.0', current: '2.5.0', hasData: true, entries })).toEqual({
      show: false,
      store: false,
    });
  });
  it('treats an existing garage without the setting as an update (2.1.x never stored it)', () => {
    expect(shouldShowNovedades({ lastSeen: null, current: '2.5.0', hasData: true, entries }).show).toBe(true);
  });
  it('does not show a sheet for a version the changelog does not describe', () => {
    expect(shouldShowNovedades({ lastSeen: '2.4.1', current: '9.0.0', hasData: true, entries })).toEqual({
      show: false,
      store: true,
    });
  });
});
