/**
 * The MICM notice parser on the four notices published in September 2026,
 * as `pdftotext -layout` wrote them (docs/imp-30092026/fixtures/micm/).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { micmPdfLinks, parseMicmNotice, parseMicmRows, parseMicmWeek, priceFromRow, weekFromPdfUrl } from '@/lib/micm/parse';

const dir = join(__dirname, '../../docs/imp-30092026/fixtures/micm');
const fixture = (name: string) => readFileSync(join(dir, name), 'utf8');

const FIXTURES: [string, string, string, Record<string, number>][] = [
  [
    '2026-09-26_2026-10-02.txt',
    '2026-09-26',
    '2026-10-02',
    { premium: 353.1, regular: 317.5, gasoil_regular: 270.8, gasoil_optimo: 306.1, glp: 135.2 },
  ],
  [
    '2026-09-19_2026-09-25.txt',
    '2026-09-19',
    '2026-09-25',
    { premium: 350.1, regular: 315.5, gasoil_regular: 267.8, gasoil_optimo: 302.1, glp: 135.2 },
  ],
  [
    '2026-09-12_2026-09-18.txt',
    '2026-09-12',
    '2026-09-18',
    { premium: 341.1, regular: 310.5, gasoil_regular: 262.8, gasoil_optimo: 293.1, glp: 135.2 },
  ],
  [
    '2026-09-05_2026-09-11.txt',
    '2026-09-05',
    '2026-09-11',
    { premium: 341.1, regular: 310.5, gasoil_regular: 262.8, gasoil_optimo: 293.1, glp: 135.2 },
  ],
];

describe('parseMicmNotice on the four fixtures', () => {
  it.each(FIXTURES)('%s → week %s–%s and five prices', (file, start, end, prices) => {
    const result = parseMicmNotice(fixture(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notice.weekStart).toBe(start);
    expect(result.notice.weekEnd).toBe(end);
    expect(Object.fromEntries(result.notice.rows.map((r) => [r.fuelType, r.price]))).toEqual(prices);
  });

  it('skips the EGP-C/EGP-T gasoil rows, Avtur, Kerosene and Fuel Oil', () => {
    const rows = parseMicmRows(fixture('2026-09-26_2026-10-02.txt'));
    expect(rows.map((r) => r.fuelType)).toEqual(['premium', 'regular', 'gasoil_regular', 'gasoil_optimo', 'glp']);
    expect(rows.find((r) => r.fuelType === 'gasoil_regular')?.price).toBe(270.8); // not 351.10 (EGP-C)
  });

  it('reads the pdf.js line shape too (items joined by two spaces)', () => {
    const text = [
      'aviso los precios oficiales de los combustibles que regirán a partir de la 00:00 hora del sábado',
      'veintiséis (26) de septiembre al día viernes dos (02) de octubre de dos mil veintiséis (2026).',
      'Gasolina Premium  203.63  71.85  32.58  16.59  27.07  6.68  358.40  (5.30)  353.10  3.00',
      'Gas Licuado de Petróleo (GLP) **  84.58  0.00  13.53  11.71  17.90  6.68  134.40  0.00  0.80  135.20  0.00',
    ].join('\n');
    const result = parseMicmNotice(text);
    expect(result).toEqual({
      ok: true,
      notice: { weekStart: '2026-09-26', weekEnd: '2026-10-02', rows: [{ fuelType: 'premium', price: 353.1 }, { fuelType: 'glp', price: 135.2 }] },
    });
  });

  it('a GNV row is read if MICM ever prints one', () => {
    expect(parseMicmRows('Gas Natural Vehicular (GNV)  30.00  1.00  43.97  0.00')).toEqual([{ fuelType: 'gnv', price: 43.97 }]);
  });

  it('empty text (an image PDF) → empty-text', () => {
    expect(parseMicmNotice('')).toEqual({ ok: false, reason: 'empty-text' });
    expect(parseMicmNotice('\f\n  \f')).toEqual({ ok: false, reason: 'empty-text' });
  });

  it('no week sentence: the PDF file name is the fallback; neither → no-week', () => {
    const rows = 'Gasolina Premium  203.63  71.85  358.40  (5.30)  353.10  3.00\n'.repeat(2);
    const url = 'https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf';
    const a = parseMicmNotice(rows, url);
    expect(a.ok && a.notice.weekStart).toBe('2026-09-19');
    expect(parseMicmNotice(rows)).toMatchObject({ ok: false, reason: 'no-week' });
  });

  it('a week but no fuel rows → no-prices', () => {
    const text = 'regirán a partir de la 00:00 hora del sábado diecinueve (19) al día viernes veinticinco (25) de septiembre de dos mil veintiséis (2026).';
    expect(parseMicmNotice(text)).toMatchObject({ ok: false, reason: 'no-prices', partial: { weekStart: '2026-09-19' } });
  });
});

describe('parseMicmWeek', () => {
  it('both wordings, and a week across New Year', () => {
    expect(parseMicmWeek('a partir de la 00:00 hora del sábado doce (12) al día viernes dieciocho (18) de septiembre de dos mil veintiséis (2026).')).toEqual({
      weekStart: '2026-09-12',
      weekEnd: '2026-09-18',
    });
    expect(parseMicmWeek('a partir de la 00:00 hora del sábado veintiséis (26) de septiembre al día viernes dos (02) de octubre de dos mil veintiséis (2026).')).toEqual({
      weekStart: '2026-09-26',
      weekEnd: '2026-10-02',
    });
    expect(parseMicmWeek('a partir de la 00:00 hora del sábado veintiséis (26) de diciembre al día viernes uno (01) de enero de dos mil veintisiete (2027).')).toEqual({
      weekStart: '2026-12-26',
      weekEnd: '2027-01-01',
    });
    expect(
      parseMicmWeek('a partir de la 00:00 hora del sábado veintiséis (26) de diciembre de dos mil veintiséis (2026) al día viernes uno (01) de enero de dos mil veintisiete (2027).'),
    ).toEqual({ weekStart: '2026-12-26', weekEnd: '2027-01-01' });
  });

  it('ignores the law dates earlier in the notice', () => {
    const text = fixture('2026-09-19_2026-09-25.txt');
    expect(text).toContain('cuatro (4) de febrero');
    expect(parseMicmWeek(text)?.weekStart).toBe('2026-09-19');
  });

  it('an impossible date → null', () => {
    expect(parseMicmWeek('a partir de … del sábado (31) al día viernes (36) de febrero de (2026)')).toBeNull();
    expect(parseMicmWeek('nada')).toBeNull();
  });
});

describe('weekFromPdfUrl', () => {
  it.each([
    ['https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf', '2026-09-26', '2026-10-02'],
    ['https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-05-11-SEP-DE-2026.pdf', '2026-09-05', '2026-09-11'],
    ['https://x/AVISO-CORTE-27-DIC-02-ENE-DE-2027.pdf', '2026-12-27', '2027-01-02'],
  ])('%s', (url, start, end) => {
    expect(weekFromPdfUrl(url)).toEqual({ weekStart: start, weekEnd: end });
  });

  it('no dates in the name → null', () => {
    expect(weekFromPdfUrl('https://micm.gob.do/aviso.pdf')).toBeNull();
  });
});

describe('priceFromRow', () => {
  it('second number from the end; negatives in parentheses', () => {
    expect(priceFromRow('203.63 71.85 358.40 (5.30) 353.10 3.00')).toBe(353.1);
    expect(priceFromRow('268.21 351.10 0.00 351.10 (18.24)')).toBe(351.1);
    expect(priceFromRow('3.00')).toBeNull();
  });
});

describe('micmPdfLinks', () => {
  it('the notices page → its PDFs, newest first, no repeats', () => {
    const html = `
      <a href="https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf" target="_blank">Descargar .PDF</a>
      <a href="https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf">Descargar .PDF</a>
      <a href='/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-12-18-SEP-DE-2026.pdf'>x</a>
      <a href="https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf">again</a>
      <a href="/otra-pagina/">no</a>`;
    expect(micmPdfLinks(html)).toEqual([
      'https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf',
      'https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf',
      'https://micm.gob.do/wp-content/uploads/2026/09/AVISO-PRE.-SEM.CORTE-12-18-SEP-DE-2026.pdf',
    ]);
  });
});
