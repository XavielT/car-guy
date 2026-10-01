/** The MICM import flow (ADR-46) with the network injected, and /api/precios's answers. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import handler, { CACHE_FAIL, CACHE_OK, statusFor, writerHeaders } from '../../api/precios';
import { MICM_NOTICES_URL, previousPrices, runMicmImport, validateMicm, type ImportDeps, type StoredRefRow, type UpsertRow } from '@/lib/micm/importer';

const dir = join(__dirname, '../../docs/imp-30092026/fixtures/micm');
const NEWEST = 'https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf';
const PAGE = `<a href="${NEWEST}">Descargar .PDF</a><a href="https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf">Descargar .PDF</a>`;
const TEXT = readFileSync(join(dir, '2026-09-26_2026-10-02.txt'), 'utf8');

function storedWeek(weekStart: string, weekEnd: string, prices: Record<string, number>, over: Partial<StoredRefRow> = {}): StoredRefRow[] {
  return Object.entries(prices).map(([fuel_type, price]) => ({ week_start: weekStart, week_end: weekEnd, fuel_type, price: String(price), pdf_url: 'prev.pdf', stale: false, ...over }));
}
const PREV = storedWeek('2026-09-19', '2026-09-25', { premium: 350.1, regular: 315.5, gasoil_regular: 267.8, gasoil_optimo: 302.1, glp: 135.2 });

function deps(over: Partial<ImportDeps> = {}): ImportDeps & { writes: UpsertRow[][] } {
  const writes: UpsertRow[][] = [];
  return {
    writes,
    fetchText: async (url) => {
      expect(url).toBe(MICM_NOTICES_URL);
      return PAGE;
    },
    fetchBytes: async () => new Uint8Array([1, 2, 3]),
    pdfToText: async () => TEXT,
    lastStored: async () => PREV,
    upsert: async (rows) => {
      writes.push(rows);
      return rows.length;
    },
    ...over,
  };
}

describe('runMicmImport', () => {
  it('imports the newest notice: five rows, pdf url and raw text, not stale', async () => {
    const d = deps();
    const r = await runMicmImport(d);
    expect(r).toMatchObject({ ok: true, stale: false, imported: 5, weekStart: '2026-09-26', weekEnd: '2026-10-02', pdfUrl: NEWEST });
    expect(d.writes).toHaveLength(1);
    expect(d.writes[0][0]).toMatchObject({ week_start: '2026-09-26', fuel_type: 'premium', price: 353.1, source: 'micm', pdf_url: NEWEST, stale: false });
    expect(d.writes[0][0].raw_text).toContain('Gasolina Premium');
  });

  it('the newest link already stored → up to date, no download, no write', async () => {
    const fetchBytes = jest.fn();
    const d = deps({ lastStored: async () => storedWeek('2026-09-26', '2026-10-02', { premium: 353.1 }, { pdf_url: NEWEST }), fetchBytes });
    const r = await runMicmImport(d);
    expect(r).toMatchObject({ ok: true, upToDate: true, imported: 0, weekStart: '2026-09-26' });
    expect(fetchBytes).not.toHaveBeenCalled();
    expect(d.writes).toHaveLength(0);
  });

  it('an image PDF (no text) → pdf-not-text, the last good week flagged stale', async () => {
    const d = deps({ pdfToText: async () => '\f\f' });
    const r = await runMicmImport(d);
    expect(r).toMatchObject({ ok: false, stale: true, reason: 'pdf-not-text', weekStart: '2026-09-19' });
    expect(d.writes).toHaveLength(1);
    expect(d.writes[0].every((w) => w.stale && w.week_start === '2026-09-19')).toBe(true);
  });

  it('a jump over 20 % → validation-failed, nothing new written', async () => {
    const d = deps({ lastStored: async () => storedWeek('2026-09-19', '2026-09-25', { premium: 250, regular: 315.5, gasoil_regular: 267.8, gasoil_optimo: 302.1, glp: 135.2 }) });
    const r = await runMicmImport(d);
    expect(r.reason).toBe('validation-failed');
    expect(r.problems).toEqual(['jump:premium:250->353.1']);
    expect(d.writes.flat().every((w) => w.stale)).toBe(true);
  });

  it('a stale week is not marked twice', async () => {
    const d = deps({ lastStored: async () => PREV.map((r) => ({ ...r, stale: true })), pdfToText: async () => '' });
    await runMicmImport(d);
    expect(d.writes).toHaveLength(0);
  });

  it('MICM unreachable → notices-unreachable, nothing written', async () => {
    const d = deps({
      fetchText: async () => {
        throw new Error('down');
      },
    });
    expect(await runMicmImport(d)).toMatchObject({ ok: false, stale: true, reason: 'notices-unreachable' });
    expect(d.writes).toHaveLength(0);
  });

  it('no writer key → parsed rows in the answer, no-writer-key', async () => {
    const r = await runMicmImport(deps({ upsert: undefined }));
    expect(r).toMatchObject({ ok: false, reason: 'no-writer-key', weekStart: '2026-09-26' });
    expect(r.rows).toHaveLength(5);
  });

  it('the table not there yet (read fails) → imports with nothing to compare', async () => {
    const r = await runMicmImport(
      deps({
        lastStored: async () => {
          throw new Error('404');
        },
      }),
    );
    expect(r).toMatchObject({ ok: true, imported: 5 });
  });
});

describe('validateMicm', () => {
  const notice = {
    weekStart: '2026-09-26',
    weekEnd: '2026-10-02',
    rows: [
      { fuelType: 'premium' as const, price: 353.1 },
      { fuelType: 'regular' as const, price: 317.5 },
    ],
  };
  it('missing core fuels, wrong span and an older week are problems', () => {
    expect(validateMicm(notice, PREV)).toEqual(['missing:gasoil_regular', 'missing:gasoil_optimo', 'missing:glp']);
    expect(validateMicm({ ...notice, weekEnd: '2026-10-20' }, [])[0]).toBe('week-span:24');
    expect(validateMicm(notice, storedWeek('2026-10-03', '2026-10-09', { premium: 350 }))).toContain('older-than-stored:2026-10-03');
  });
  it('previousPrices: the newest week before the notice, same-week rows ignored', () => {
    const p = previousPrices([...PREV, ...storedWeek('2026-09-26', '2026-10-02', { premium: 999 }), ...storedWeek('2026-09-12', '2026-09-18', { premium: 341.1 })], '2026-09-26');
    expect(p.get('premium')).toBe(350.1);
  });
});

describe('/api/precios', () => {
  function res() {
    const headers: Record<string, string> = {};
    const out = { statusCode: 0, body: '', headers, setHeader: (k: string, v: string) => (headers[k] = v), end: (b: string) => (out.body = b) };
    return out;
  }

  it('success → 200, an hour at the CDN, CORS open', async () => {
    const r = res();
    await handler({} as never, r as never, {}, deps());
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toBe(CACHE_OK);
    expect(CACHE_OK).toContain('s-maxage=3600');
    expect(r.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, weekStart: '2026-09-26' });
  });

  it('image PDF → 422 with reason, short cache', async () => {
    const r = res();
    await handler({} as never, r as never, {}, deps({ pdfToText: async () => '' }));
    expect(r.statusCode).toBe(422);
    expect(r.headers['Cache-Control']).toBe(CACHE_FAIL);
    expect(r.headers['X-Car-Guy-Error']).toBe('pdf-not-text');
    expect(JSON.parse(r.body)).toMatchObject({ stale: true, reason: 'pdf-not-text' });
  });

  it('no Supabase env → 503 not-configured', async () => {
    const r = res();
    await handler({} as never, r as never, {});
    expect(r.statusCode).toBe(503);
    expect(JSON.parse(r.body).reason).toBe('not-configured');
  });

  it('status per reason', () => {
    expect(statusFor({ ok: false, stale: true, reason: 'store-failed', imported: 0, weekStart: null, weekEnd: null, pdfUrl: null, rows: [] })).toBe(502);
    expect(statusFor({ ok: false, stale: true, reason: 'no-writer-key', imported: 0, weekStart: null, weekEnd: null, pdfUrl: null, rows: [] })).toBe(503);
  });

  it('writer: the importer JWT first (with the anon apikey), else the service key', () => {
    expect(writerHeaders({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon', CARGUY_IMPORTER_JWT: 'jwt', SUPABASE_SERVICE_ROLE_KEY: 'svc' })).toEqual({ apikey: 'anon', Authorization: 'Bearer jwt' });
    expect(writerHeaders({ SUPABASE_SERVICE_ROLE_KEY: 'eyJsvc' })).toEqual({ apikey: 'eyJsvc', Authorization: 'Bearer eyJsvc' });
    expect(writerHeaders({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' })).toEqual({ apikey: 'sb_secret_x' });
    expect(writerHeaders({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toBeNull();
  });
});
