import { PDFDocument } from 'pdf-lib';

import { renderBook } from '@/lib/book/render';
import { flagsOf, flagsPatch, DEFAULT_FLAGS } from '@/lib/db/shareQueries';
import { TIRE_BADGES } from '@/lib/domain/tireStats';
import { es } from '@/lib/i18n/es';
import { publicDossier, TIRE_BADGE_NAMES, type RawDossier } from '@/lib/share/dossier';
import { renderDossierHtml } from '@/lib/share/html';

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(), enqueue: jest.fn(), now: () => '2026-09-30T00:00:00.000Z' }));

/** The page's tires block (sql/025 show_tires, ADR-45) and the "Lo que uso" block (note 6). */
function raw(over: Partial<RawDossier> = {}): RawDossier {
  return {
    slug: 'ae85hchg',
    visibility: 'link',
    show: { plate: false, vin: false, costs: false, odometer: false, maintenance: false, mods: false, track: false, story: false, status: false },
    vehicle: {
      name: 'Trueno AE85',
      make: 'Toyota',
      model: 'Sprinter Trueno',
      year: 1985,
      color: 'Panda',
      nickname: null,
      chassis_code: 'AE85',
      engine_code: null,
      hero_media_id: null,
      plate: 'A70••••',
      vin: null,
      story: null,
    },
    photos: [],
    ...over,
  };
}

const TIRES: RawDossier['tires'] = {
  count: 14,
  badges: [
    { status: 'quemada', count: 6 },
    { status: 'en_uso', count: 4 },
    { status: 'vendida', count: 2 },
    { status: 'guardada', count: 1 },
    { status: 'nueva', count: 1 },
  ],
};

describe('tires block', () => {
  it('is absent unless the cloud (or the phone) sends it', () => {
    expect(publicDossier(raw(), { storageBase: '' }).tires).toBeNull();
    expect(publicDossier(raw({ tires: { count: 0, badges: [] } }), { storageBase: '' }).tires).toBeNull();
  });

  it('counts only, in the page’s words, with the highest badge earned', () => {
    const d = publicDossier(raw({ tires: TIRES }), { storageBase: '' });
    expect(d.tires).toEqual({
      count: 14,
      line: '14 gomas · 6 quemadas · 2 vendidas · 4 montadas · 1 guardada · 1 nueva',
      badge: 'Quemagomas',
    });
    const html = renderDossierHtml(d, { url: 'https://car-guy.vercel.app/c/ae85hchg' });
    expect(html).toContain('Gomas quemadas');
    expect(html).toContain('Quemagomas');
    expect(publicDossier(raw({ tires: { count: 3, badges: [{ status: 'en_uso', count: 3 }] } }), { storageBase: '' }).tires!.badge).toBeNull();
  });

  it('the page’s badge names are tireStats’ thresholds with es.ts’s names', () => {
    expect(TIRE_BADGE_NAMES).toEqual(TIRE_BADGES.map((b) => ({ threshold: b.threshold, name: es.tireStats.badges[b.id] })));
  });
});

describe('memory block', () => {
  const memory: RawDossier['memory'] = [
    { section: 'aceite', title: 'Aceite y filtros', label: 'Aceite (marca)', value: 'Castrol Edge' },
    { section: 'aceite', title: 'Aceite y filtros', label: 'Filtro de aceite', value: 'PH6607' },
    { section: 'electrico', title: 'Eléctrico', label: 'Código de radio', value: '4471' },
  ];

  it('groups the rows by section in order', () => {
    const d = publicDossier(raw({ memory }), { storageBase: '' });
    expect(d.memory).toEqual([
      { title: 'Aceite y filtros', rows: [{ label: 'Aceite (marca)', value: 'Castrol Edge' }, { label: 'Filtro de aceite', value: 'PH6607' }] },
      { title: 'Eléctrico', rows: [{ label: 'Código de radio', value: '4471' }] },
    ]);
    expect(renderDossierHtml(d, { url: 'x' })).toContain('Lo que uso');
    expect(publicDossier(raw(), { storageBase: '' }).memory).toBeNull();
  });

  it('the book renders both chapters', async () => {
    const d = publicDossier(raw({ memory, tires: TIRES }), { storageBase: '' });
    const bytes = await renderBook(
      { dossier: d, heroId: null, photos: [], documents: null, generatedAt: '2026-09-30T12:00:00Z', periodLabel: null },
      { fonts: null, image: async () => null },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe('share flags', () => {
  it('tires is off by default and round-trips through vehicle_share', () => {
    expect(DEFAULT_FLAGS.tires).toBe(false);
    const patch = flagsPatch({ ...DEFAULT_FLAGS, tires: true });
    expect(patch.showTires).toBe(true);
    expect(flagsOf({ ...(patch as object), showTires: true } as never).tires).toBe(true);
    expect(flagsOf(null).tires).toBe(false);
  });
});
