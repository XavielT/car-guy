/**
 * The server-side privacy post-filter (IMP 03112026 SPEC-C §C1, PROMPT-03 step 1). The prompt asks the model not to
 * return personal data and the schema has no field for it; this is the second wall, because a prompt is a request, not a
 * guarantee. Applied to the `privacy` kinds (documents, VIN plate) AFTER validation, BEFORE the answer leaves.
 *
 *   · Any text field that LOOKS like a cédula (000-0000000-0, or 11 digits in a row) is dropped. Plate (≤ 8), VIN
 *     (≥ 17 / chassis with a dash) cannot be 11 plain digits, so nothing legitimate is lost; a policy or document number
 *     that happens to be 11 digits is dropped too, on purpose: the person types it, a leak cannot be taken back.
 *   · A free-text field that mentions identity or contact words (cédula, propietario, titular, dirección, teléfono, @) or
 *     reads like an address (calle, avenida, sector, residencial…) is dropped.
 *   · It returns HOW MANY values it removed, never what they were. Nothing is logged.
 * What no pattern can catch is a bare personal name inside a free-text field: that is why no such field is asked for.
 * Pure: no Deno, no network.
 */
import type { Field } from '../_shared/fields.ts';

const CEDULA_DASHED = /(?<!\d)\d{3}-\d{7}-\d(?!\d)/;
const CEDULA_PLAIN = /(?<!\d)\d{11}(?!\d)/;
const IDENTITY_WORDS = /c[eé]dula|identidad|propietario|titular|domicilio|direcci[oó]n|tel[eé]fono|celular|correo|@/i;
const ADDRESS_WORDS = /(?<![a-z])(calle|avenida|av\.|sector|residencial|res\.|apto|apartamento|edificio|edif\.|urbanizaci[oó]n|urb\.|manzana|carretera|km\s*\d)(?![a-z])/i;

/** A value that carries a cédula, whatever field it is in. */
export function looksLikeCedula(s: string): boolean {
  return CEDULA_DASHED.test(s) || CEDULA_PLAIN.test(s.replace(/[\s.]/g, ''));
}

/** A free-text value that talks about the person or where they live. */
export function looksPersonal(s: string): boolean {
  return IDENTITY_WORDS.test(s) || ADDRESS_WORDS.test(s);
}

/** Fields that are identifiers or enumerations, not prose: only the cédula rule applies to them. */
const IDENTIFIER_FIELDS = new Set(['plate', 'vin', 'doc_number', 'policy_number', 'doc_kind', 'fuel', 'license_category']);

export function filterField(name: string, f: Field): { field: Field; removed: boolean } {
  if (typeof f.value !== 'string') return { field: f, removed: false };
  const bad = looksLikeCedula(f.value) || (!IDENTIFIER_FIELDS.has(name) && looksPersonal(f.value));
  return bad ? { field: { value: null, confidence: 0 }, removed: true } : { field: f, removed: false };
}

export function applyPrivacy<T extends { fields: Record<string, Field>; items?: Record<string, Field>[] }>(read: T): { read: T; removed: number } {
  let removed = 0;
  const fields: Record<string, Field> = {};
  for (const [k, f] of Object.entries(read.fields)) {
    const r = filterField(k, f);
    fields[k] = r.field;
    if (r.removed) removed++;
  }
  const items = read.items?.map((it) =>
    Object.fromEntries(
      Object.entries(it).map(([k, f]) => {
        const r = filterField(k, f);
        if (r.removed) removed++;
        return [k, r.field];
      }),
    ),
  );
  return { read: { ...read, fields, ...(items ? { items } : {}) }, removed };
}

/** True when at least one value survived (otherwise the whole read counts as unreadable). */
export function anyValueLeft(read: { fields: Record<string, Field>; items?: Record<string, Field>[] }): boolean {
  return Object.values(read.fields).some((f) => f.value !== null) || (read.items?.length ?? 0) > 0;
}
