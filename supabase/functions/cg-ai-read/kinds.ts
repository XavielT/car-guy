/**
 * The registry of what `cg-ai-read` can read (IMP 03112026 SPEC-B §B1/§B7, ADR-67/68). A kind is THREE things in one
 * place: the fields (which become the forced tool's JSON schema), the Spanish prompt, and the post-validator that
 * makes the output strictly typed. Adding a kind in a later phase (SPEC-C documents, SPEC-D OBD) is one entry here.
 *
 *   · Every field comes back as { value, confidence } — null with confidence 0 when it is not visible.
 *   · The validator, not the model, decides what is acceptable: ranges, formats, enums. A value that fails is dropped
 *     to null (never "fixed"): the person types it. AI proposes, the person disposes.
 *   · Prompts are ported in spirit from SGC's `leer-recibo` (RD receipts, NCF/RNC, thousands separators), kept in
 *     Spanish, with per-field confidence and forced tool use instead of "return only JSON".
 * Pure: no Deno, no network.
 */

import { normalizeField, type Field, type FieldSpec, type FieldType } from '../_shared/fields.ts';
import { DOC_KINDS } from './docKinds.ts';
import { OBD_KINDS } from './obdKinds.ts';
import { WORKFLOW_KINDS } from './workflowKinds.ts';
export { normalizeField };
export type { Field, FieldSpec, FieldType };

/** `key` is the field an item must have to count (default `description`, the invoice's); items without it are dropped. */
export type ItemSpec = { fields: Record<string, FieldSpec>; max: number; key?: string };

export type KindDef = {
  /** What the person sees named in logs and errors (never shown as text to the model's output). */
  id: string;
  /** Max images per call for this kind. */
  maxImages: number;
  system: string;
  /** One instruction per image position, for kinds where the order matters; extra images use the last one. */
  imageHints: string[];
  fields: Record<string, FieldSpec>;
  /** Optional list of line items (invoice). */
  items?: ItemSpec;
  /** fuel_express: the model classifies each image. */
  perImage?: boolean;
  /** Documents and VIN plates: the answer goes through the privacy post-filter (privacy.ts) before it leaves. */
  privacy?: boolean;
};

const DIGITS = (s: string) => s.replace(/\D/g, '');
const UPPER = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** NCF: B01/B02/B14/B15… + 8 digits, or E31/E32… + 10 digits (RD "e-CF"). */
const NCF = /^(?:B\d{2}\d{8}|E\d{2}\d{10})$/;

const COMMON_RULES = `Reglas (siempre):
- Números con punto decimal, sin separador de miles y sin símbolo de moneda: "RD$ 2,583.00" es 2583.00; "1.234,50" en un recibo dominicano normalmente es 1234.50 (el punto de miles y la coma decimal casi nunca se usan en RD).
- Fechas en formato YYYY-MM-DD (en RD el orden suele ser DD/MM/AAAA). Horas en HH:MM de 24 h.
- Si un campo no se ve o no aplica, devuélvelo con value null y confidence 0.
- "confidence" va de 0 a 1 y dice qué tan seguro estás de ESE valor exacto.
- NO inventes ni "corrijas" números. Si dudas, baja la confianza. Copia placas, RNC y NCF carácter por carácter.
- Si la foto no es de lo que se pide o no se puede leer, pon readable=false y deja todo en null.
- Responde SOLO llamando a la herramienta.`;

const RECEIPT_FIELDS: Record<string, FieldSpec> = {
  total: { type: 'number', desc: 'Monto total pagado en RD$', min: 1, max: 200_000 },
  gallons: { type: 'number', desc: 'Galones despachados (QTY)', min: 0.1, max: 300 },
  unit_price: { type: 'number', desc: 'Precio por galón en RD$ (UNIT PRICE)', min: 1, max: 3_000 },
  product: { type: 'string', desc: 'Combustible tal como lo dice el recibo (gasolina premium, regular, diesel, glp…)', maxLen: 40 },
  station: { type: 'string', desc: 'Nombre de la estación', maxLen: 60 },
  date: { type: 'date', desc: 'Fecha del recibo' },
  time: { type: 'time', desc: 'Hora del recibo' },
  ncf: { type: 'string', desc: 'Número de Comprobante Fiscal (B0100000001 o E310000000001)', clean: UPPER, pattern: NCF, maxLen: 13 },
  pump: { type: 'string', desc: 'Número de bomba (PUMP)', maxLen: 6 },
};

const ODOMETER_FIELDS: Record<string, FieldSpec> = {
  odometer: { type: 'number', desc: 'Odómetro total (no el parcial) como número', min: 0, max: 2_000_000 },
  unit: { type: 'enum', desc: 'Unidad que muestra el tablero: km o mi', values: ['km', 'mi'] },
  trip_a: { type: 'number', desc: 'Parcial A si se ve', min: 0, max: 99_999 },
  trip_b: { type: 'number', desc: 'Parcial B si se ve', min: 0, max: 99_999 },
};

export const KINDS: Record<string, KindDef> = {
  fuel_receipt: {
    id: 'fuel_receipt',
    maxImages: 2,
    system: `Eres un lector de recibos de estaciones de combustible de la República Dominicana. Lees la foto de un ticket y devuelves los campos con su confianza.\n${COMMON_RULES}`,
    imageHints: ['Foto de un RECIBO/TICKET de estación de combustible (RD).'],
    fields: RECEIPT_FIELDS,
  },

  pump: {
    id: 'pump',
    maxImages: 1,
    system: `Eres un lector del display de una bomba de combustible. Devuelves los galones y el monto mostrados.\n${COMMON_RULES}`,
    imageHints: ['Foto del DISPLAY DE LA BOMBA (dispensador).'],
    fields: {
      gallons: RECEIPT_FIELDS.gallons,
      amount: { type: 'number', desc: 'Monto mostrado en RD$', min: 1, max: 200_000 },
    },
  },

  odometer: {
    id: 'odometer',
    maxImages: 1,
    system: `Eres un lector de tableros de instrumentos de autos. Devuelves el odómetro TOTAL (no el parcial) y la unidad que muestra.\n${COMMON_RULES}\n- Si hay dos números (total y parcial), el odómetro es el más largo y no se reinicia. Si el tablero muestra "mi" o "MILES", la unidad es mi.`,
    imageHints: ['Foto del TABLERO / ODÓMETRO del vehículo.'],
    fields: ODOMETER_FIELDS,
  },

  invoice: {
    id: 'invoice',
    maxImages: 3,
    system: `Eres un lector de facturas de talleres y de piezas de la República Dominicana. Devuelves el taller, los datos fiscales, la fecha, cada línea y los totales. Una factura puede ocupar varias fotos.\n${COMMON_RULES}\n- "rnc" es el Registro Nacional del Contribuyente del PROVEEDOR (9 u 11 dígitos; devuélvelo solo con dígitos). Nunca devuelvas la cédula ni el nombre del cliente.\n- "ncf" es el Número de Comprobante Fiscal (B0100000001 o E310000000001).\n- Cada línea: descripción, cantidad, precio unitario y tipo: part (pieza/material), labour (mano de obra) u other.\n- "warranty_text" es la frase de garantía tal cual (por ejemplo "6 meses o 10,000 km"), sin interpretarla.`,
    imageHints: ['Foto de una FACTURA o recibo de taller / tienda de piezas.'],
    fields: {
      shop: { type: 'string', desc: 'Nombre del taller o tienda (proveedor)', maxLen: 80 },
      rnc: { type: 'string', desc: 'RNC del proveedor, solo dígitos', clean: DIGITS, pattern: /^(?:\d{9}|\d{11})$/, maxLen: 11 },
      ncf: RECEIPT_FIELDS.ncf,
      date: { type: 'date', desc: 'Fecha de la factura' },
      subtotal: { type: 'number', desc: 'Subtotal en RD$', min: 0, max: 5_000_000 },
      itbis: { type: 'number', desc: 'ITBIS en RD$', min: 0, max: 1_000_000 },
      total: { type: 'number', desc: 'Total en RD$', min: 1, max: 5_000_000 },
      warranty_text: { type: 'string', desc: 'Texto de garantía tal cual', maxLen: 120 },
    },
    items: {
      max: 30,
      fields: {
        description: { type: 'string', desc: 'Descripción de la línea', maxLen: 100 },
        qty: { type: 'number', desc: 'Cantidad', min: 0.01, max: 10_000 },
        unit_price: { type: 'number', desc: 'Precio unitario en RD$', min: 0, max: 5_000_000 },
        kind: { type: 'enum', desc: 'part, labour u other', values: ['part', 'labour', 'other'] },
      },
    },
  },

  part_label: {
    id: 'part_label',
    maxImages: 2,
    system: `Eres un lector de etiquetas de piezas, aceites y gomas. Devuelves marca, número de parte y especificación tal como están impresos.\n${COMMON_RULES}\n- Aceite: viscosidad como 5W-30 y la especificación API/ACEA si aparece. Goma: medida como 205/55R16 91V y el DOT (4 dígitos semana-año). Copia números de parte carácter por carácter.`,
    imageHints: ['Foto de la CAJA, ETIQUETA o FLANCO de una pieza, aceite o goma.'],
    fields: {
      category: { type: 'enum', desc: 'Tipo de pieza', values: ['oil', 'tire', 'filter', 'battery', 'brake', 'other'] },
      brand: { type: 'string', desc: 'Marca', maxLen: 40 },
      part_number: { type: 'string', desc: 'Número de parte', clean: (s) => s.replace(/\s+/g, ''), maxLen: 40 },
      spec: { type: 'string', desc: 'Especificación (5W-30, API SN, 205/55R16 91V…)', maxLen: 60 },
      dot: { type: 'string', desc: 'DOT de la goma: 4 dígitos semana y año (por ejemplo 2321)', clean: DIGITS, pattern: /^\d{4}$/, maxLen: 4 },
    },
  },

  // SPEC-B §B7 — Fuel Express: dashboard + receipt (+ pump) in ONE call; the model classifies each image.
  fuel_express: {
    id: 'fuel_express',
    maxImages: 4,
    perImage: true,
    system: `Eres un lector de cargas de combustible en la República Dominicana. Recibes de 1 a 4 fotos en cualquier orden: el TABLERO del auto, el RECIBO de la estación y/o la BOMBA. Clasifica cada foto (dashboard, receipt, pump u other) y devuelve UN solo objeto combinado con lo que leíste de cada una.\n${COMMON_RULES}\n- Del tablero: odómetro TOTAL y su unidad (km o mi), parciales si se ven, y la posición del medidor de combustible como fracción 0..1 (solo una pista; confianza baja).\n- Del recibo: total, galones, precio por galón, combustible, estación, fecha, hora, NCF, bomba.\n- Si una foto no se puede leer, léela como null y sigue con las demás; readable=false solo si NINGUNA se pudo leer.`,
    imageHints: ['Foto 1 (clasifícala: dashboard, receipt, pump u other).'],
    fields: {
      ...ODOMETER_FIELDS,
      fuel_level: { type: 'fraction', desc: 'Medidor de combustible del tablero como fracción 0..1 (0 vacío, 1 lleno); solo una pista' },
      ...RECEIPT_FIELDS,
      pump_gallons: { type: 'number', desc: 'Galones que muestra la bomba si hay foto de la bomba', min: 0.1, max: 300 },
      pump_amount: { type: 'number', desc: 'Monto que muestra la bomba en RD$', min: 1, max: 200_000 },
    },
  },

  // IMP 03112026 SPEC-C / PROMPT-03: vehicle documents and VIN plates (docKinds.ts).
  ...DOC_KINDS,

  // IMP 03112026 SPEC-D / PROMPT-04: warning-light photos and scanner screenshots (obdKinds.ts).
  ...OBD_KINDS,

  // IMP 03112026 SPEC-G / PROMPT-06: checklist photos, accident photos, album batches (workflowKinds.ts).
  ...WORKFLOW_KINDS,
};

export const KIND_IDS = Object.keys(KINDS);

// ------------------------------------------------------------------------------------------------ tool schema
function fieldSchema(f: FieldSpec): Record<string, unknown> {
  const valueType =
    f.type === 'number' || f.type === 'fraction' ? 'number' : 'string';
  const value: Record<string, unknown> = { type: [valueType, 'null'], description: f.desc };
  if (f.type === 'enum' && f.values) value.enum = [...f.values, null];
  return {
    type: 'object',
    properties: {
      value,
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Seguridad 0..1 de este valor exacto' },
    },
    required: ['value', 'confidence'],
  };
}

export const TOOL_NAME = 'report_reading';

export function toolFor(def: KindDef) {
  const properties: Record<string, unknown> = {
    readable: { type: 'boolean', description: 'false si ninguna foto es de lo que se pide o no se puede leer' },
  };
  const required = ['readable'];
  for (const [k, f] of Object.entries(def.fields)) {
    properties[k] = fieldSchema(f);
    required.push(k);
  }
  if (def.items) {
    properties.items = {
      type: 'array',
      maxItems: def.items.max,
      items: {
        type: 'object',
        properties: {
          ...Object.fromEntries(Object.entries(def.items.fields).map(([k, f]) => [k, fieldSchema(f)])),
        },
        required: Object.keys(def.items.fields),
      },
    };
    required.push('items');
  }
  if (def.perImage) {
    properties.per_image = {
      type: 'array',
      maxItems: def.maxImages,
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Posición de la foto, empezando en 0' },
          kind: { type: 'string', enum: ['dashboard', 'receipt', 'pump', 'other'] },
          readable: { type: 'boolean' },
        },
        required: ['index', 'kind', 'readable'],
      },
    };
    required.push('per_image');
  }
  return {
    name: TOOL_NAME,
    description: 'Devuelve lo leído en las fotos, cada campo con value y confidence.',
    input_schema: { type: 'object', properties, required },
  };
}

// ----------------------------------------------------------------------------------------------- validation
export type ReadItem = Record<string, Field>;
export type ReadResult = {
  kind: string;
  fields: Record<string, Field>;
  items?: ReadItem[];
  per_image?: { index: number; kind: 'dashboard' | 'receipt' | 'pump' | 'other'; readable: boolean }[];
};

/** The validated result, or null when nothing at all could be read (the caller answers `unreadable`). */
export function normalizeRead(kindId: string, input: unknown): ReadResult | null {
  const def = KINDS[kindId];
  if (!def || !input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.readable === false) return null;

  const fields: Record<string, Field> = {};
  for (const [k, spec] of Object.entries(def.fields)) fields[k] = normalizeField(raw[k], spec);

  const out: ReadResult = { kind: kindId, fields };

  if (def.items) {
    const list = Array.isArray(raw.items) ? raw.items.slice(0, def.items.max) : [];
    out.items = list
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return Object.fromEntries(Object.entries(def.items!.fields).map(([k, spec]) => [k, normalizeField(o[k], spec)])) as ReadItem;
      })
      .filter((it) => it[def.items!.key ?? 'description']?.value != null);
  }

  if (def.perImage) {
    const list = Array.isArray(raw.per_image) ? raw.per_image.slice(0, def.maxImages) : [];
    const kinds = ['dashboard', 'receipt', 'pump', 'other'];
    out.per_image = list
      .map((p) => p as { index?: unknown; kind?: unknown; readable?: unknown })
      .filter((p) => Number.isInteger(p.index) && typeof p.kind === 'string' && kinds.includes(p.kind))
      .map((p) => ({ index: p.index as number, kind: p.kind as 'dashboard' | 'receipt' | 'pump' | 'other', readable: p.readable !== false }));
  }

  const anyValue = Object.values(fields).some((f) => f.value !== null) || (out.items?.length ?? 0) > 0;
  return anyValue ? out : null;
}
