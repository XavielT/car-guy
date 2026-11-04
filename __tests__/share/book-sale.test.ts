/** @jest-environment node */
/** SPEC-G §G9: the owner's edited sale-ready summary is printed first in the Libro, only when handed in. */
import { PDFDocument } from 'pdf-lib';

import { renderBook } from '@/lib/book/render';
import { publicDossier, type RawDossier } from '@/lib/share/dossier';

const raw: RawDossier = {
  slug: null,
  visibility: 'link',
  show: { plate: false, vin: false, costs: false, odometer: true, maintenance: true, mods: true, track: false, story: false, status: false },
  vehicle: { name: 'Corolla', make: 'Toyota', model: 'Corolla', year: 2018, color: null, nickname: null, chassis_code: null, engine_code: null, hero_media_id: null, plate: null, vin: null, story: null },
  photos: [],
};
const base = { dossier: publicDossier(raw, { storageBase: '' }), heroId: null, photos: [], documents: null, generatedAt: '2026-11-04T12:00:00Z', periodLabel: null };
const deps = { fonts: null, image: async () => null };

describe('book: sale-ready summary page', () => {
  it('without it the book is unchanged; with it the text lands on the first white page', async () => {
    const without = await PDFDocument.load(await renderBook(base, deps));
    const withSale = await PDFDocument.load(
      await renderBook({ ...base, saleSheet: { title: 'Hoja de venta: 2018 Toyota Corolla', sections: [{ heading: 'Resumen', text: 'Un párrafo. '.repeat(400) }] } }, deps),
    );
    expect(withSale.getPageCount()).toBeGreaterThan(without.getPageCount());
  });
  it('an empty sheet adds nothing', async () => {
    const a = await PDFDocument.load(await renderBook(base, deps));
    const b = await PDFDocument.load(await renderBook({ ...base, saleSheet: { title: 'x', sections: [] } }, deps));
    expect(b.getPageCount()).toBe(a.getPageCount());
  });
});
