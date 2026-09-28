/**
 * Contacts (IMP 28092026 Phase 5): the mechanic, the parts guy, the tow truck.
 * Pure helpers for the call and WhatsApp buttons.
 */

import type { ContactKind } from '../db/types';

/** The schema's kinds (lib/db/types.ts ContactKind), in picker order. */
export const CONTACT_KINDS: ContactKind[] = ['mecanico', 'electrico', 'gomera', 'pintor', 'dealer', 'grua', 'otro'];

/** DR area codes: a 10-digit local number starting with one of these gets the country code 1. */
const DR_AREA = ['809', '829', '849'];

/**
 * Digits only, in international form without "+": "(809) 555-1234" →
 * "18095551234". A 10-digit DR number gains the leading 1 (WhatsApp needs the
 * country code); a number already international is left as it is; anything
 * too short to dial is null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10 && DR_AREA.includes(digits.slice(0, 3))) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

/** `https://wa.me/18095551234` — opens the chat in the app or on the web. */
export function whatsappLink(raw: string | null | undefined, text?: string): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** `tel:+18095551234`. */
export function telLink(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `tel:+${n}` : null;
}

/** "(809) 555-1234" for display; other numbers as "+<digits>". */
export function formatPhone(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  if (n.length === 11 && n.startsWith('1')) return `(${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}`;
  return `+${n}`;
}
