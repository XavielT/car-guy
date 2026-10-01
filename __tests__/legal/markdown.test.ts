import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LEGAL_CONTACT, LEGAL_DATE, LEGAL_DOC_IDS, LEGAL_VERSION, legalMarkdown } from '@/lib/legal';
import { LEGAL_MARKDOWN } from '@/lib/legal/content.generated';
import {
  blocksToHtml,
  escapeHtml,
  inlineText,
  parseInline,
  parseMarkdown,
  renderContentModule,
  renderLegalPage,
  safeHref,
  titleOf,
  type LegalDocId,
  type LegalLang,
} from '@/lib/legal/markdown';

const root = join(__dirname, '..', '..');
const source = (id: LegalDocId, lang: LegalLang) => readFileSync(join(root, 'content', 'legal', `${id}.${lang}.md`), 'utf8');

describe('the tiny Markdown parser', () => {
  it('headings, paragraphs joined across lines, lists, notices and rules', () => {
    const blocks = parseMarkdown('# Title\n\nOne line\nand the next.\n\n## Part\n\n- a\n- b with\n  more\n\n1. first\n2. second\n\n> **Careful.** Now.\n\n---\n');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'heading', 'list', 'list', 'quote', 'rule']);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, children: [{ type: 'text', text: 'Title' }] });
    expect(blocks[1]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: 'One line and the next.' }] });
    const ul = blocks[3];
    expect(ul.type === 'list' && !ul.ordered && ul.items.map(inlineText)).toEqual(['a', 'b with more']);
    const ol = blocks[4];
    expect(ol.type === 'list' && ol.ordered && ol.items.length).toBe(2);
  });

  it('inline: bold, emphasis, code and links; unclosed markers stay text', () => {
    expect(parseInline('a **b** *c* `d` [e](/terminos)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'd' },
      { type: 'text', text: ' ' },
      { type: 'link', href: '/terminos', children: [{ type: 'text', text: 'e' }] },
    ]);
    expect(parseInline('2 * 3 and **open')).toEqual([{ type: 'text', text: '2 * 3 and **open' }]);
  });

  it('HTML is escaped, and only site, web and mail links survive', () => {
    expect(blocksToHtml(parseMarkdown('<script>alert(1)</script> & "x"'))).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>');
    expect(blocksToHtml(parseMarkdown('[x](javascript:alert(1))'))).not.toContain('href');
    expect(safeHref('/privacidad?lang=en')).toBe('/privacidad?lang=en');
    expect(safeHref('https://openfreemap.org')).toBe('https://openfreemap.org');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeHref('//evil.example')).toBeNull();
    expect(escapeHtml(`'`)).toBe('&#39;');
  });
});

describe('the legal texts (content/legal)', () => {
  it.each(LEGAL_DOC_IDS.flatMap((id) => (['es', 'en'] as const).map((lang) => [id, lang] as const)))('%s.%s: title, version, date, contact', (id, lang) => {
    const md = source(id, lang);
    expect(titleOf(md)).not.toBe('');
    expect(md).toContain(LEGAL_VERSION);
    expect(md).toMatch(lang === 'es' ? /1 de octubre de 2026/ : /October 1, 2026/);
    expect(md).toContain(LEGAL_CONTACT);
    // No real address: the contact is the placeholder until Xaviel sets it (and then the test follows LEGAL_CONTACT).
    const emails = md.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) ?? [];
    expect(emails.every((e) => e === LEGAL_CONTACT)).toBe(true);
    // The "not legal advice" caveat lives in the docs folder, never on the published texts.
    expect(md.toLowerCase()).not.toMatch(/asesor[ií]a legal|legal advice/);
  });

  it('every text names the facts the stores need: the developer, US storage, the 18+ account age', () => {
    const privacy = source('privacidad', 'es');
    expect(privacy).toMatch(/Xaviel Terrero/);
    expect(privacy).toMatch(/us-west-2/);
    expect(privacy).toMatch(/Estados Unidos/);
    expect(privacy).toMatch(/segundo plano/);
    expect(privacy).toMatch(/172-13/);
    expect(privacy).toMatch(/30 días/);
    expect(privacy).toMatch(/OpenFreeMap/);
    expect(source('terminos', 'es')).toMatch(/18 años/);
    expect(source('terminos', 'es')).toMatch(/no sustituyen los instrumentos/);
    expect(source('terminos', 'en')).toMatch(/do not replace the vehicle's instruments/);
    expect(source('eliminar-cuenta', 'es')).toMatch(/ELIMINAR/);
    expect(source('eliminar-cuenta', 'en')).toMatch(/DELETE/);
  });
});

describe('generated outputs (node tools/build-legal.mjs)', () => {
  const sources = Object.fromEntries(LEGAL_DOC_IDS.map((id) => [id, { es: source(id, 'es'), en: source(id, 'en') }])) as Record<LegalDocId, Record<LegalLang, string>>;

  it('lib/legal/content.generated.ts is current', () => {
    expect(readFileSync(join(root, 'lib', 'legal', 'content.generated.ts'), 'utf8')).toBe(renderContentModule(sources));
    expect(LEGAL_MARKDOWN.terminos.es).toBe(sources.terminos.es);
    expect(legalMarkdown('privacidad', 'en')).toBe(sources.privacidad.en);
  });

  it.each(LEGAL_DOC_IDS)('public/%s.html is current, has both languages and the version in the raw HTML', (id) => {
    const html = readFileSync(join(root, 'public', `${id}.html`), 'utf8');
    expect(html).toBe(renderLegalPage(id, sources[id], LEGAL_VERSION, LEGAL_DATE));
    expect(html).toContain(`content="${LEGAL_VERSION}"`);
    expect(html).toContain('data-lang="es"');
    expect(html).toContain('data-lang="en"');
    expect(html).toContain(`<title>${escapeHtml(titleOf(sources[id].es))} · Car Guy</title>`);
    expect(html).not.toMatch(/<script src=/);
  });
});
