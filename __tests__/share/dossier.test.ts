import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName } from 'pdf-lib';

import { bookFileName, renderBook } from '@/lib/book/render';
import { isSlug, publicDossier, publicPhotoUrl, slug, SLUG_ALPHABET, type RawDossier } from '@/lib/share/dossier';
import { esc, renderDossierHtml, renderNotFoundHtml } from '@/lib/share/html';

const BASE = 'https://nakgrkcqyuycadeuenuw.supabase.co';

function raw(over: Partial<RawDossier> = {}): RawDossier {
  return {
    slug: 'ae85hchg',
    visibility: 'link',
    show: { plate: false, vin: false, costs: false, odometer: true, maintenance: true, mods: true, track: true, story: true },
    vehicle: {
      name: 'Trueno AE85',
      make: 'Toyota',
      model: 'Sprinter Trueno',
      year: 1985,
      color: 'Panda',
      nickname: 'hachi-gō',
      chassis_code: 'AE85',
      engine_code: '4A-GE 20V',
      transmission: 'manual',
      drivetrain: 'rwd',
      origin: 'jdm',
      hero_media_id: 'm_hero',
      plate: 'A70••••',
      vin: null,
      story: 'Preparado para drift y ceritos. <script>alert(1)</script>',
    },
    odometer_km: 52286,
    specsheet: { stock: JSON.stringify({ engine_code: '3A-U', wheel_f: '13x5' }), overrides: '{}' },
    mods: [
      { id: 'm1', name: 'Swap 4A-GE 20V', brand: null, variant: 'blacktop', category_id: 'motor', category: 'Motor', status: 'instalado', installed_at: '2025-08-15T12:00:00Z', affects_specs: true, spec_effects: JSON.stringify({ engine_code: '4A-GE 20V', hp: 160 }), tags: '["SWAP"]', cost_dop: null },
      { id: 'm2', name: 'Aros 15x8 ET0', brand: null, category_id: 'ruedas', category: 'Ruedas', status: 'instalado', installed_at: '2026-03-12T12:00:00Z', affects_specs: true, spec_effects: JSON.stringify({ wheel_f: '15x8 ET0' }), tags: '[]', cost_dop: null },
    ],
    services: [{ kind: 'mantenimiento', occurred_at: '2026-09-01T12:00:00Z', title: 'Aceite y filtro', odometer_km: 52000, total_dop: null }],
    track: [
      { id: 'e1', occurred_at: '2026-09-21T12:00:00Z', title: 'Drift day Sunix', discipline: 'drift', venue_id: 'autodromo_americas', venue: 'Autódromo de las Américas (Sunix)', sessions: 2, runs: 14, best_lap_ms: null },
      { id: 'e2', occurred_at: '2026-06-01T12:00:00Z', title: 'Track day', discipline: 'track_day', venue_id: 'autodromo_americas', venue: 'Autódromo de las Américas (Sunix)', sessions: 3, runs: null, best_lap_ms: 83456 },
    ],
    milestones: [{ kind: 'swap', occurred_at: '2025-08-15T12:00:00Z', title: 'Swap 4A-GE 20V', story: 'Adiós 3A-U.' }],
    photos: ['p1', 'p2'],
    ...over,
  };
}

describe('slug', () => {
  it('is 8 characters from the look-alike-free alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const s = slug();
      expect(s).toHaveLength(8);
      expect([...s].every((c) => SLUG_ALPHABET.includes(c))).toBe(true);
      expect(isSlug(s)).toBe(true);
    }
    expect(isSlug('AE85HCHG')).toBe(false);
    expect(isSlug('ae85hc1g')).toBe(false); // 1 is not in the alphabet
    expect(isSlug('../etc')).toBe(false);
  });
});

describe('publicDossier', () => {
  it('orders the page like the build: facts, STOCK → ACTUAL, mods by category, track PB', () => {
    const d = publicDossier(raw(), { storageBase: BASE });
    expect(d.title).toBe('1985 Toyota Sprinter Trueno');
    expect(d.badges.map((b) => b.label)).toEqual(['4AGE 20V', 'DRIFT', 'SWAP']);
    expect(d.facts).toContainEqual({ label: 'Placa', value: 'A70••••' });
    expect(d.facts).toContainEqual({ label: 'Odómetro', value: '52,286 km' });
    expect(d.facts.find((f) => f.label === 'VIN')).toBeUndefined();
    expect(d.specs).toContainEqual({ label: 'Motor', stock: '3A-U', value: '4A-GE 20V', changed: true });
    expect(d.mods!.map((g) => g.category)).toEqual(['Motor', 'Ruedas']);
    expect(d.modsTotal).toBeNull();
    expect(d.track!.bests).toEqual([{ venue: 'Autódromo de las Américas (Sunix)', lap: '1:23.456' }]);
    expect(d.track!.recent[0].line).toBe('Drift · Autódromo de las Américas (Sunix) · 2 sesiones · 14 runs');
    expect(d.heroUrl).toBe(publicPhotoUrl(BASE, 'ae85hchg', 'm_hero'));
    expect(d.photos[0].thumb).toBe(`${BASE}/storage/v1/object/public/carguy-public/ae85hchg/p1.thumb.jpg`);
    expect(d.indexable).toBe(false);
  });

  it('sections the owner hid are simply absent (the SQL left them out)', () => {
    const d = publicDossier(raw({ mods: undefined, specsheet: undefined, services: undefined, track: undefined, milestones: [], vehicle: { ...raw().vehicle, story: null } }), { storageBase: BASE });
    expect(d.mods).toBeNull();
    expect(d.specs).toBeNull();
    expect(d.maintenance).toBeNull();
    expect(d.track).toBeNull();
    const html = renderDossierHtml(d, { url: 'https://car-guy.vercel.app/c/ae85hchg' });
    expect(html).not.toMatch(/Stock → Actual|Mantenimiento|Pista 走り|Historia/);
    expect(html).toContain('<h2>Fotos</h2>');
  });
});

describe('the page HTML', () => {
  const html = renderDossierHtml(publicDossier(raw(), { storageBase: BASE }), { url: 'https://car-guy.vercel.app/c/ae85hchg' });

  it('carries the OG and Twitter tags crawlers read, with the hero', () => {
    expect(html).toContain('<meta property="og:title" content="Trueno AE85 “hachi-gō” · 1985 Toyota Sprinter Trueno">');
    expect(html).toContain(`<meta property="og:image" content="${BASE}/storage/v1/object/public/carguy-public/ae85hchg/m_hero.jpg">`);
    expect(html).toContain('<meta property="og:url" content="https://car-guy.vercel.app/c/ae85hchg">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('noindex');
  });

  it('escapes what the owner typed and has no script', () => {
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc(`"a" & 'b'`)).toBe('&quot;a&quot; &amp; &#39;b&#39;');
  });

  it('a public page may be indexed; the 404 never', () => {
    const pub = renderDossierHtml(publicDossier(raw({ visibility: 'public' }), { storageBase: BASE }), { url: 'x' });
    expect(pub).not.toContain('noindex');
    expect(renderNotFoundHtml()).toContain('noindex');
  });

  it('shows costs only when the flag let them through', () => {
    const withCosts = raw({ show: { ...raw().show, costs: true }, mods: raw().mods!.map((m) => ({ ...m, cost_dop: 14500 })) });
    const d = publicDossier(withCosts, { storageBase: BASE });
    expect(d.modsTotal).toBe('RD$ 29,000');
    expect(renderDossierHtml(d, { url: 'x' })).toContain('RD$ 14,500');
    expect(html).not.toContain('RD$');
  });
});

describe('car book', () => {
  const jpg = readFileSync(join(__dirname, '../fixtures/photo-400.jpg'));

  it('renders cover, content and photo pages with the standard fonts', async () => {
    const d = publicDossier(raw(), { storageBase: '' });
    const progress: number[] = [];
    const bytes = await renderBook(
      {
        dossier: d,
        heroId: 'm_hero',
        photos: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, takenAt: i < 10 ? '2026-05-01T12:00:00Z' : '2025-05-01T12:00:00Z' })),
        documents: [{ title: 'Marbete 2026', kind: 'marbete', issuedAt: '2026-01-10T12:00:00Z', expiresAt: '2027-01-10T12:00:00Z' }],
        generatedAt: '2026-09-28T12:00:00Z',
        periodLabel: null,
      },
      { fonts: null, image: async () => new Uint8Array(jpg), onProgress: (done) => progress.push(done) },
    );
    const doc = await PDFDocument.load(bytes);
    // cover + content (≥ 1) + 2026 (10 photos → 2 pages) + 2025 (1 page)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
    expect(doc.getTitle()).toBe('Trueno AE85 — Libro del carro');
    expect(progress.at(-1)).toBe(13);
  });

  it('embeds the house fonts when fontkit and the TTFs are there', async () => {
    const font = (p: string) => new Uint8Array(readFileSync(join(__dirname, '../../', p)));
    const fonts = {
      display: font('node_modules/@expo-google-fonts/saira-condensed/800ExtraBold/SairaCondensed_800ExtraBold.ttf'),
      title: font('node_modules/@expo-google-fonts/saira-condensed/600SemiBold/SairaCondensed_600SemiBold.ttf'),
      body: font('assets/fonts/Rajdhani-Latin_500Medium.ttf'),
      bold: font('assets/fonts/Rajdhani-Latin_700Bold.ttf'),
      mono: font('node_modules/@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    };
    const bytes = await renderBook(
      { dossier: publicDossier(raw(), { storageBase: '' }), heroId: null, photos: [], documents: null, generatedAt: '2026-09-28T12:00:00Z', periodLabel: '2026' },
      { fonts, fontkit, image: async () => null },
    );
    const doc = await PDFDocument.load(bytes);
    const names = doc.context
      .enumerateIndirectObjects()
      .map(([, obj]) => (obj as { get?: (k: PDFName) => unknown }).get?.(PDFName.of('BaseFont')))
      .filter(Boolean)
      .map(String);
    expect(names.some((n) => /SairaCondensed/.test(n))).toBe(true);
    expect(names.some((n) => /Rajdhani/.test(n))).toBe(true);
    expect(doc.getPageCount()).toBe(2);
  });

  it('names the file car-guy_<nick>_<yyyymmdd>.pdf', () => {
    expect(bookFileName('Trueno AE85', 'hachi-gō', new Date(2026, 8, 28))).toBe('car-guy_hachi-go_20260928.pdf');
    expect(bookFileName('DS3', null, new Date(2026, 0, 5))).toBe('car-guy_ds3_20260105.pdf');
  });
});
