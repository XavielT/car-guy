/**
 * Client side of `cg-ai-read` (IMP 03112026 SPEC-B): photos in, validated typed fields out. The types mirror the
 * server's `ReadResult` (supabase/functions/cg-ai-read/kinds.ts). Nothing here writes data: the result PRE-FILLS a
 * form and the person saves with the normal Save (ADR-67).
 */
import { callAi } from './client';

export type ReadKind =
  | 'fuel_receipt'
  | 'pump'
  | 'odometer'
  | 'invoice'
  | 'part_label'
  | 'fuel_express'
  // IMP 03112026 SPEC-C / PROMPT-03: vehicle documents (`document` classifies the paper itself) and the VIN plate.
  | 'document'
  | 'doc_matricula'
  | 'doc_seguro'
  | 'doc_marbete'
  | 'doc_licencia'
  | 'doc_revision'
  | 'doc_garantia'
  | 'vin_plate';

export type ReadField = { value: string | number | null; confidence: number };
export type ReadItem = Record<string, ReadField>;
export type PerImage = { index: number; kind: 'dashboard' | 'receipt' | 'pump' | 'other'; readable: boolean };

export type ReadResult = {
  ok: true;
  kind: ReadKind;
  fields: Record<string, ReadField>;
  items?: ReadItem[];
  per_image?: PerImage[];
  /** Documents only: how many personal values the server removed (a count, never the values). */
  privacy_removed?: number;
  model: string | null;
};

/** A prepared photo: base64 without the data: prefix, and its mime. */
export type PreparedImage = { data: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' };

/** Below this a field is shown with the amber "check this" outline (SPEC-B §B2). */
export const LOW_CONFIDENCE = 0.6;

export async function readImages(kind: ReadKind, images: PreparedImage[]): Promise<ReadResult> {
  return callAi<ReadResult>('cg-ai-read', { kind, images });
}

/** Typed accessors: null when the field is absent or not a number/string of that type. */
export function num(r: ReadResult | null | undefined, key: string): number | null {
  const v = r?.fields[key]?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
export function str(r: ReadResult | null | undefined, key: string): string | null {
  const v = r?.fields[key]?.value;
  return typeof v === 'string' && v ? v : null;
}
export function conf(r: ReadResult | null | undefined, key: string): number {
  return r?.fields[key]?.confidence ?? 0;
}
