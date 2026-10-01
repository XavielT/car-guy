import { acceptanceRow, inAppHref, isUpdate, LEGAL_VERSION, legalRoute, sheetAllowedOn, type LegalAcceptanceRow } from '@/lib/legal';

const acc = (version: string, acceptedAt: string, deletedAt: string | null = null): LegalAcceptanceRow => ({
  id: `${version}-${acceptedAt}`,
  version,
  acceptedAt,
  locale: 'es',
  platform: 'android',
  deviceId: 'd',
  createdAt: acceptedAt,
  updatedAt: acceptedAt,
  deletedAt,
});

describe('legal acceptance rules (ADR-47)', () => {
  it('a first acceptance is not an "update"; an older version is', () => {
    expect(isUpdate([])).toBe(false);
    expect(isUpdate([acc('2026-01', '2026-01-02T00:00:00Z')])).toBe(true);
    expect(isUpdate([acc(LEGAL_VERSION, '2026-10-02T00:00:00Z'), acc('2026-01', '2026-01-02T00:00:00Z')])).toBe(false);
    expect(isUpdate([acc('2026-01', '2026-01-02T00:00:00Z', '2026-02-01T00:00:00Z')])).toBe(false);
  });

  it('the sheet stays off the welcome, the legal screens, the public pages and the deletion flow', () => {
    for (const p of ['/bienvenida', '/legal', '/legal/terminos', '/terminos', '/privacidad', '/eliminar-cuenta', '/borrar-cuenta']) {
      expect(sheetAllowedOn(p)).toBe(false);
    }
    for (const p of ['/', '/mas', '/cuenta', '/vehiculo/x', '/legalidad']) expect(sheetAllowedOn(p)).toBe(true);
  });

  it('records the current version with the device facts', () => {
    expect(acceptanceRow({ locale: 'en', platform: 'web', deviceId: 'dev', now: '2026-10-02T10:00:00.000Z' })).toEqual({
      version: LEGAL_VERSION,
      acceptedAt: '2026-10-02T10:00:00.000Z',
      locale: 'en',
      platform: 'web',
      deviceId: 'dev',
    });
  });

  it('links inside a text: the three texts stay in-app, other paths are routes, the rest leaves', () => {
    expect(inAppHref('/eliminar-cuenta')).toEqual({ kind: 'doc', doc: 'eliminar-cuenta' });
    expect(inAppHref('/privacidad?lang=en')).toEqual({ kind: 'doc', doc: 'privacidad' });
    expect(inAppHref('/cuenta')).toEqual({ kind: 'route', path: '/cuenta' });
    expect(inAppHref('https://openfreemap.org')).toEqual({ kind: 'external', url: 'https://openfreemap.org' });
    expect(legalRoute('terminos')).toBe('/legal/terminos');
  });
});
