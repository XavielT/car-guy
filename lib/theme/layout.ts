/**
 * Layout classes (IMP 03112026 SPEC-F §F1, ADR-70). Pure: the one place that says what "compact", "regular" and "wide" mean.
 *
 *   compact  < 768        the phone layout, exactly as it was (phones, the APK, an iPhone PWA and any narrow window)
 *   regular  768 – 1023   a centred column; the bottom tab bar stays
 *   wide     >= 1024      the side rail replaces the tab bar; dashboards and lists use the width
 *
 * Only the web can be anything but compact: a native build never changes layout (a tablet in landscape is still the phone UI).
 */
export const BREAKPOINTS = { regular: 768, wide: 1024 } as const;
export type LayoutClass = 'compact' | 'regular' | 'wide';

export function layoutClass(width: number, isWeb: boolean): LayoutClass {
  if (!isWeb || !Number.isFinite(width)) return 'compact';
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.regular) return 'regular';
  return 'compact';
}

/** The widest a page's content may be. Dashboards and lists use up to 1200; a form or a single record reads best at 760. */
export const CONTENT_MAX = { wide: 1200, narrow: 760, regular: 720 } as const;

/** Top-level screens that are dashboards or lists and make use of the whole content width. Everything else is a centred column. */
const WIDE_ROUTES = ['/', '/garaje', '/historial', '/cifras', '/herramientas', '/mas', '/reporte', '/documentos', '/contactos', '/recordatorios', '/obd'];

export function isWideRoute(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return WIDE_ROUTES.includes(p);
}

export function contentMax(cls: LayoutClass, pathname: string): number | null {
  if (cls === 'compact') return null;
  if (cls === 'regular') return CONTENT_MAX.regular;
  return isWideRoute(pathname) ? CONTENT_MAX.wide : CONTENT_MAX.narrow;
}

/** Sheets are a bottom sheet on a phone and a centred dialog from `regular` up. */
export type SheetPresentation = 'bottom' | 'dialog';
export const sheetPresentation = (cls: LayoutClass): SheetPresentation => (cls === 'compact' ? 'bottom' : 'dialog');

/** How many columns a card grid gets at a content width (garage cards, stat cards). Never more than the cards that fit at `minCard`. */
export function gridColumns(contentWidth: number, minCard = 260, gap = 12, max = 4): number {
  if (!Number.isFinite(contentWidth) || contentWidth <= 0) return 1;
  return Math.max(1, Math.min(max, Math.floor((contentWidth + gap) / (minCard + gap))));
}

/** Route → rail item that is "current" (a stack screen under Garaje keeps Garaje lit). */
export type RailId = 'inicio' | 'garaje' | 'conducir' | 'historial' | 'herramientas' | 'mas';
export function railActive(pathname: string): RailId | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'inicio';
  if (p === '/garaje' || p.startsWith('/vehiculo')) return 'garaje';
  if (p === '/conducir' || p.startsWith('/viaje')) return 'conducir';
  if (p === '/historial' || p.startsWith('/carga') || p.startsWith('/servicio') || p.startsWith('/gasto')) return 'historial';
  if (p === '/herramientas') return 'herramientas';
  if (p === '/mas') return 'mas';
  return null;
}
