/**
 * Terms and privacy acceptance (IMP 30092026 note 15, data model v8 §1.5, ADR-47). Pure.
 *
 * `legal_acceptance` is synced, so a signed-in person who accepted on one phone
 * is not asked again on the next. Bumping LEGAL_VERSION (a real change to the
 * terms or the privacy notice) asks everyone once more.
 *
 * The texts are content/legal/*.md; tools/build-legal.mjs turns them into the
 * public pages and lib/legal/content.generated.ts (run it after editing a text
 * or the constants below).
 */
import { LEGAL_MARKDOWN } from './content.generated';
import type { LegalDocId, LegalLang } from './markdown';

export type { LegalDocId, LegalLang } from './markdown';
export { LEGAL_DOC_IDS } from './markdown';

/** The terms/privacy version the app ships; the public pages print the same one. */
export const LEGAL_VERSION = '2026-10';
/** When that version takes effect (the texts say it in words). */
export const LEGAL_DATE = '2026-10-01';
/**
 * The contact for privacy requests and deletion without the app. A placeholder until Xaviel
 * chooses the address: replace it here AND in content/legal/*.md, then `node tools/build-legal.mjs`
 * (__tests__/legal/markdown.test.ts checks the texts use this same value).
 */
export const LEGAL_CONTACT = 'CONTACTO@EJEMPLO';

/** The Markdown of one text in one language. */
export function legalMarkdown(doc: LegalDocId, lang: LegalLang): string {
  return LEGAL_MARKDOWN[doc][lang];
}

/** In-app route of a text (Más → Legal); the public web page is `/<doc>`. */
export function legalRoute(doc: LegalDocId): `/legal/${LegalDocId}` {
  return `/legal/${doc}`;
}

/** A link inside a text, as the app should follow it: the three texts open in-app, the rest leaves. */
export function inAppHref(href: string): { kind: 'doc'; doc: LegalDocId } | { kind: 'external'; url: string } | { kind: 'route'; path: string } {
  const path = href.split(/[?#]/)[0];
  const doc = (['terminos', 'privacidad', 'eliminar-cuenta'] as const).find((d) => path === `/${d}`);
  if (doc) return { kind: 'doc', doc };
  if (href.startsWith('/')) return { kind: 'route', path };
  return { kind: 'external', url: href };
}

export type LegalAcceptanceRow = {
  id: string;
  version: string;
  acceptedAt: string;
  locale: string;
  platform: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/** The newest live acceptance (by acceptedAt), any version; null when none. */
export function latestAcceptance<T extends LegalAcceptanceRow>(acceptances: readonly T[]): T | null {
  let best: T | null = null;
  for (const a of acceptances) {
    if (a.deletedAt) continue;
    if (!best || a.acceptedAt.localeCompare(best.acceptedAt) > 0) best = a;
  }
  return best;
}

/** True until a live acceptance of exactly `version` exists — the first-launch sheet shows while this holds. */
export function needsAcceptance(acceptances: readonly LegalAcceptanceRow[], version: string = LEGAL_VERSION): boolean {
  return !acceptances.some((a) => !a.deletedAt && a.version === version);
}

/** True when an earlier version was accepted (the sheet then says "we updated the terms"). */
export function isUpdate(acceptances: readonly LegalAcceptanceRow[], version: string = LEGAL_VERSION): boolean {
  return needsAcceptance(acceptances, version) && latestAcceptance(acceptances) != null;
}

/**
 * Where the first-launch sheet must not appear: the public pages themselves, the welcome flow (it
 * has its own steps), the account deletion flow, and the legal screens (reading the texts is the point).
 */
export function sheetAllowedOn(pathname: string): boolean {
  return !/^\/(bienvenida|legal|terminos|privacidad|eliminar-cuenta|borrar-cuenta)(\/|$)/.test(pathname);
}

/** The row to record an acceptance now (legal_acceptance, synced). */
export function acceptanceRow(input: { locale: string; platform: string; deviceId: string; now: string; version?: string }): {
  version: string;
  acceptedAt: string;
  locale: string;
  platform: string;
  deviceId: string;
} {
  return {
    version: input.version ?? LEGAL_VERSION,
    acceptedAt: input.now,
    locale: input.locale,
    platform: input.platform,
    deviceId: input.deviceId,
  };
}
