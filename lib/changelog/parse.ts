/**
 * CHANGELOG.md → data for "Novedades y versiones" (IMP 29092026, note 5).
 *
 * Shared by tools/build-changelog.mjs (which Node runs with its built-in type
 * stripping, so this file must stay erasable TypeScript: no enums, no imports)
 * and by the jest test that checks lib/changelog.generated.ts is current.
 *
 * The format it reads is the one CHANGELOG.md already uses:
 *
 *   ## 2.1.0 — Hachi-Gō (2026-09-29)      version, optional name, date
 *   ## 2.2.0 (sin publicar)               unreleased
 *   ## [2.3.0] - 2026-10-10               keep-a-changelog style also works
 *   ### Pista                             a section; bullets before any ### go
 *                                         to an untitled section
 *   - item, with continuation lines       one item
 *     - nested item                       folded into its parent
 *
 * Paragraphs become `intro` (of the version, or of the section they sit in);
 * `---` rules and the `# Changelog` title are skipped. Markdown links keep only
 * their text; **bold**, *emphasis* and `code` stay for the screen to render.
 */

export type ChangelogSection = {
  /** `null` for the bullets that come before any `###` heading. */
  title: string | null;
  intro: string[];
  items: string[];
};

export type ChangelogEntry = {
  version: string;
  /** The release's name ("Hachi-Gō"), when the heading has one. */
  name: string | null;
  /** `YYYY-MM-DD`, or null while unreleased. */
  date: string | null;
  unreleased: boolean;
  intro: string[];
  sections: ChangelogSection[];
};

const VERSION_HEADING =
  /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\]?(?:\s+(.*))?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

/** `[text](url)` → `text`; collapses runs of whitespace. */
export function cleanInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits "Hachi-Gō (2026-09-29)" / "(sin publicar)" / "2026-10-10" into name,
 * date and whether it is unreleased.
 */
function parseHeadingTail(tail: string): Pick<ChangelogEntry, 'name' | 'date' | 'unreleased'> {
  let rest = tail.trim().replace(/^[—–-]\s*/, '');
  let date: string | null = null;
  let unreleased = false;
  const paren = rest.match(/\(([^()]*)\)\s*$/);
  if (paren) {
    const inside = paren[1].trim();
    if (DATE.test(inside)) date = inside;
    else if (/sin publicar|unreleased|en desarrollo/i.test(inside)) unreleased = true;
    if (date || unreleased) rest = rest.slice(0, paren.index).trim();
  }
  if (!date && DATE.test(rest)) {
    date = rest;
    rest = '';
  }
  if (/^(unreleased|sin publicar)$/i.test(rest)) {
    unreleased = true;
    rest = '';
  }
  rest = rest.replace(/^[—–-]\s*/, '').trim();
  return { name: rest ? cleanInline(rest) : null, date, unreleased: unreleased || !date };
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;

  // What the current open block is, so continuation lines know where to go.
  let item: { parent: string; children: string[] } | null = null;
  let child: number | null = null; // index into item.children being continued
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!entry || !paragraph.length) {
      paragraph = [];
      return;
    }
    const text = cleanInline(paragraph.join(' '));
    paragraph = [];
    if (!text) return;
    if (section) section.intro.push(text);
    else entry.intro.push(text);
  };

  const flushItem = () => {
    if (!item || !entry) {
      item = null;
      child = null;
      return;
    }
    const parent = cleanInline(item.parent);
    const children = item.children.map(cleanInline).filter(Boolean);
    // Nested bullets fold into their parent: "Parent: child one; child two".
    let text = parent;
    if (children.length) {
      const base = parent.replace(/[.:]$/, '');
      text = base ? `${base}: ${children.join('; ')}` : children.join('; ');
    }
    if (!section) {
      section = { title: null, intro: [], items: [] };
      entry.sections.push(section);
    }
    if (text) section.items.push(text);
    item = null;
    child = null;
  };

  const flushAll = () => {
    flushItem();
    flushParagraph();
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');

    const version = line.match(VERSION_HEADING);
    if (version) {
      flushAll();
      entry = { version: version[1], ...parseHeadingTail(version[2] ?? ''), intro: [], sections: [] };
      entries.push(entry);
      section = null;
      continue;
    }
    if (/^#\s/.test(line) || /^##\s/.test(line)) {
      // The document title, or a level-2 heading that is not a version: what
      // follows belongs to no release.
      flushAll();
      entry = null;
      section = null;
      continue;
    }
    if (!entry) continue;

    const sub = line.match(/^#{3,6}\s+(.*)$/);
    if (sub) {
      flushAll();
      section = { title: cleanInline(sub[1]), intro: [], items: [] };
      entry.sections.push(section);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      continue;
    }
    if (line.trim() === '') {
      // A blank line ends a paragraph; a list item may continue after it only
      // with another bullet, so it is closed too.
      flushAll();
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const indent = bullet[1].replace(/\t/g, '  ').length;
      if (indent >= 2 && item) {
        item.children.push(bullet[2]);
        child = item.children.length - 1;
      } else {
        flushItem();
        item = { parent: bullet[2], children: [] };
      }
      continue;
    }

    if (item) {
      if (child !== null) item.children[child] += ` ${line.trim()}`;
      else item.parent += ` ${line.trim()}`;
      continue;
    }
    paragraph.push(line.trim());
  }
  flushAll();

  // Sections that ended up with nothing in them say nothing.
  for (const e of entries) e.sections = e.sections.filter((s) => s.items.length || s.intro.length);
  return entries;
}

/** The entry for `version`, ignoring a leading "v" and any "-dev"/build suffix mismatch. */
export function findEntry(entries: readonly ChangelogEntry[], version: string | null | undefined): ChangelogEntry | null {
  if (!version) return null;
  const want = version.replace(/^v/, '');
  return (
    entries.find((e) => e.version === want) ??
    entries.find((e) => e.version.split('-')[0] === want.split('-')[0]) ??
    null
  );
}

/** The whole file the build script writes. Deterministic, so the test can compare it byte for byte. */
export function renderGenerated(entries: readonly ChangelogEntry[]): string {
  return [
    '// Generated by tools/build-changelog.mjs from CHANGELOG.md — do not edit by hand.',
    '// Run `node tools/build-changelog.mjs` (npm start / build do it for you).',
    "import type { ChangelogEntry } from './changelog/parse';",
    '',
    `export const CHANGELOG: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};`,
    '',
  ].join('\n');
}
