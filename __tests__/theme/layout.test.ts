import { BREAKPOINTS, CONTENT_MAX, contentMax, gridColumns, isWideRoute, layoutClass, railActive, sheetPresentation } from '@/lib/theme/layout';

describe('layoutClass (SPEC-F §F1)', () => {
  it.each([
    [390, 'compact'], [767, 'compact'], [768, 'regular'], [1023, 'regular'], [1024, 'wide'], [1440, 'wide'], [3840, 'wide'],
  ] as const)('web %d → %s', (w, cls) => expect(layoutClass(w, true)).toBe(cls));
  it('a native build is always compact, whatever the width (a tablet is still the phone UI)', () => {
    for (const w of [390, 800, 1280, 2000]) expect(layoutClass(w, false)).toBe('compact');
  });
  it('a nonsense width is compact, never wide', () => {
    expect(layoutClass(Number.NaN, true)).toBe('compact');
  });
  it('the breakpoints are the spec’s', () => expect(BREAKPOINTS).toEqual({ regular: 768, wide: 1024 }));
});

describe('content width', () => {
  it('compact has no cap (the phone layout is untouched)', () => expect(contentMax('compact', '/')).toBeNull());
  it('regular is a centred column; wide lets dashboards use 1200 and a form stay at 760', () => {
    expect(contentMax('regular', '/garaje')).toBe(CONTENT_MAX.regular);
    expect(contentMax('wide', '/')).toBe(1200);
    expect(contentMax('wide', '/historial/')).toBe(1200);
    expect(contentMax('wide', '/carga/nueva')).toBe(760);
    expect(contentMax('wide', '/servicio/nuevo')).toBe(760);
  });
  it('isWideRoute', () => {
    expect(isWideRoute('/')).toBe(true);
    expect(isWideRoute('/cifras')).toBe(true);
    expect(isWideRoute('/carga/nueva')).toBe(false);
  });
});

describe('sheets and grids', () => {
  it('a sheet is a bottom sheet on a phone and a dialog otherwise', () => {
    expect(sheetPresentation('compact')).toBe('bottom');
    expect(sheetPresentation('regular')).toBe('dialog');
    expect(sheetPresentation('wide')).toBe('dialog');
  });
  it('gridColumns fits whole cards and caps', () => {
    expect(gridColumns(0)).toBe(1);
    expect(gridColumns(300)).toBe(1);
    expect(gridColumns(560)).toBe(2);
    expect(gridColumns(1100)).toBe(4);
    expect(gridColumns(3000)).toBe(4);
    expect(gridColumns(1100, 260, 12, 3)).toBe(3);
    expect(gridColumns(Number.NaN)).toBe(1);
  });
});

describe('railActive keeps the right item lit', () => {
  it.each([
    ['/', 'inicio'], ['/garaje', 'garaje'], ['/vehiculo/v1/ficha', 'garaje'], ['/conducir', 'conducir'], ['/historial', 'historial'],
    ['/carga/abc', 'historial'], ['/herramientas', 'herramientas'], ['/mas', 'mas'], ['/cuenta', null],
  ] as const)('%s → %s', (p, id) => expect(railActive(p)).toBe(id));
});
