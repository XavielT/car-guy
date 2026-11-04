/**
 * Document and vehicle-identity kinds of `cg-ai-read` (IMP 03112026 SPEC-C §C1/§C2, PROMPT-03).
 *
 *   document        classifies the paper (matrícula, seguro, marbete, licencia, revisión, garantía) AND extracts, in ONE
 *                   call: a second "classification pass" would pay for the image twice (decision D-27).
 *   doc_*           the same extraction when the person already chose the kind.
 *   vin_plate       the VIN / chassis sticker (windshield, door jamb, engine bay).
 *
 * PRIVACY BY DESIGN (SPEC-C §C1): these papers carry the owner's name, cédula and address. There is NO field for any of
 * them, the prompt forbids them, and `privacy.ts` filters what is left (a cédula-shaped value in any text field is dropped
 * and counted). Only plate, VIN/chassis, vehicle description, dates, insurer, policy number and coverage come back. The
 * licence number is not extracted at all: it can be the cédula.
 */
import type { FieldSpec } from '../_shared/fields.ts';
import type { KindDef } from './kinds.ts';

const alnum = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const DOC_KIND_VALUES = ['matricula', 'seguro', 'marbete', 'licencia', 'revision', 'garantia', 'other'] as const;
export const FUELS = ['gasolina', 'diesel', 'glp', 'gnv', 'electrico', 'hibrido'] as const;

const PLATE: FieldSpec = { type: 'string', desc: 'Placa del vehículo (por ejemplo A123456), sin guiones ni espacios', clean: alnum, pattern: /^[A-Z0-9]{5,8}$/, maxLen: 8 };
/** Loose on purpose: a JDM frame number ("AE85-5012345") is not a 17-character VIN; the app tells them apart (checkVin). */
const VIN: FieldSpec = { type: 'string', desc: 'VIN o número de chasis tal como está impreso (17 caracteres, sin I, O ni Q, o el número de chasis japonés con guion)', clean: (s) => s.replace(/\s+/g, '').toUpperCase(), pattern: /^[A-Z0-9-]{6,20}$/, maxLen: 20 };

const VEHICLE: Record<string, FieldSpec> = {
  plate: PLATE,
  vin: VIN,
  make: { type: 'string', desc: 'Marca del vehículo', maxLen: 40 },
  model: { type: 'string', desc: 'Modelo del vehículo', maxLen: 40 },
  year: { type: 'number', desc: 'Año del vehículo', min: 1950, max: 2100 },
  color: { type: 'string', desc: 'Color del vehículo', maxLen: 30 },
};

const DATES: Record<string, FieldSpec> = {
  issued_date: { type: 'date', desc: 'Fecha de emisión o de inicio de vigencia' },
  expires_date: { type: 'date', desc: 'Fecha de vencimiento (hasta cuándo vale)' },
};

const MATRICULA_EXTRA: Record<string, FieldSpec> = {
  engine_cc: { type: 'number', desc: 'Cilindrada del motor en cc', min: 50, max: 20_000 },
  fuel: { type: 'enum', desc: 'Combustible: gasolina, diesel, glp, gnv, electrico o hibrido', values: FUELS },
  seats: { type: 'number', desc: 'Cantidad de asientos o pasajeros', min: 1, max: 60 },
  doc_number: { type: 'string', desc: 'Número del documento o de la matrícula', clean: alnum, maxLen: 24 },
};

const SEGURO_EXTRA: Record<string, FieldSpec> = {
  insurer: { type: 'string', desc: 'Nombre de la aseguradora', maxLen: 60 },
  policy_number: { type: 'string', desc: 'Número de póliza', clean: alnum, maxLen: 24 },
  coverage_type: { type: 'string', desc: 'Tipo de cobertura (ley, completo, de ley + daños…)', maxLen: 60 },
  premium: { type: 'number', desc: 'Prima en RD$ si se ve', min: 0, max: 10_000_000 },
};

const MARBETE_EXTRA: Record<string, FieldSpec> = {
  doc_number: MATRICULA_EXTRA.doc_number,
};

const LICENCIA_EXTRA: Record<string, FieldSpec> = {
  license_category: { type: 'string', desc: 'Categoría de la licencia (1, 2, 3, 4…)', maxLen: 10 },
};

const REVISION_EXTRA: Record<string, FieldSpec> = {
  center: { type: 'string', desc: 'Centro o estación de inspección', maxLen: 60 },
  result: { type: 'string', desc: 'Resultado (aprobado, rechazado…)', maxLen: 30 },
};

const GARANTIA_EXTRA: Record<string, FieldSpec> = {
  issuer: { type: 'string', desc: 'Empresa que da la garantía (marca, concesionario o tienda)', maxLen: 60 },
  item: { type: 'string', desc: 'Qué está garantizado (batería, gomas, motor…)', maxLen: 80 },
  expiry_km: { type: 'number', desc: 'Kilometraje límite de la garantía si lo dice', min: 0, max: 1_000_000 },
};

const PRIVACY_RULES = `PRIVACIDAD (obligatoria): estos papeles traen datos personales. NUNCA devuelvas cédula, nombre del propietario o titular, dirección, teléfono ni correo, ni los pongas en ningún campo, aunque se vean claros. Devuelve solo lo que pide la herramienta: placa, VIN o chasis, descripción del vehículo, fechas, aseguradora, número de póliza y cobertura.`;

const COMMON = `Reglas:
- Fechas en YYYY-MM-DD (en RD el orden suele ser DD/MM/AAAA). Copia placas, VIN, chasis y números de póliza carácter por carácter.
- Si un campo no se ve o no aplica, value null y confidence 0. "confidence" va de 0 a 1 y dice qué tan seguro estás de ESE valor.
- NO inventes. Si dudas, baja la confianza. Si la foto no es de lo que se pide o no se puede leer, readable=false.
- Responde SOLO llamando a la herramienta.`;

const doc = (id: string, what: string, extra: Record<string, FieldSpec>, withVehicle: boolean, hint: string): KindDef => ({
  id,
  maxImages: 3,
  privacy: true,
  system: `Eres un lector de documentos de vehículos de la República Dominicana. Esta foto es ${what}. Devuelves los datos del vehículo y del documento con su confianza.\n${PRIVACY_RULES}\n${COMMON}`,
  imageHints: [hint],
  fields: { ...(withVehicle ? VEHICLE : { plate: PLATE }), ...DATES, ...extra },
});

export const DOC_KINDS: Record<string, KindDef> = {
  doc_matricula: doc('doc_matricula', 'la matrícula o certificado de propiedad del vehículo (DGII)', MATRICULA_EXTRA, true, 'Foto de la MATRÍCULA / certificado de propiedad.'),
  doc_seguro: doc('doc_seguro', 'una póliza o certificado de seguro de vehículo', SEGURO_EXTRA, true, 'Foto de la PÓLIZA o certificado de SEGURO.'),
  doc_marbete: doc('doc_marbete', 'el marbete (calcomanía o recibo de renovación anual)', MARBETE_EXTRA, false, 'Foto del MARBETE o su recibo.'),
  doc_licencia: doc('doc_licencia', 'una licencia de conducir. NO devuelvas el número de la licencia', LICENCIA_EXTRA, false, 'Foto de la LICENCIA de conducir.'),
  doc_revision: doc('doc_revision', 'un certificado de revisión técnica o inspección del vehículo', REVISION_EXTRA, true, 'Foto del certificado de REVISIÓN TÉCNICA.'),
  doc_garantia: doc('doc_garantia', 'una garantía (de una pieza, de una reparación o del vehículo)', GARANTIA_EXTRA, false, 'Foto de la GARANTÍA.'),

  document: {
    id: 'document',
    maxImages: 3,
    privacy: true,
    system: `Eres un lector de documentos de vehículos de la República Dominicana. Primero CLASIFICA el papel (doc_kind: matricula, seguro, marbete, licencia, revision, garantia u other si es otra cosa) y luego devuelve los datos que se vean, cada uno con su confianza. Si son varias fotos, son del MISMO documento.\n${PRIVACY_RULES}\n- Licencia: NO devuelvas el número de la licencia.\n${COMMON}`,
    imageHints: ['Foto de un documento del vehículo (clasifícalo).'],
    fields: {
      doc_kind: { type: 'enum', desc: 'Tipo de documento: matricula, seguro, marbete, licencia, revision, garantia u other', values: DOC_KIND_VALUES },
      ...VEHICLE,
      ...DATES,
      ...MATRICULA_EXTRA,
      ...SEGURO_EXTRA,
      ...LICENCIA_EXTRA,
      ...REVISION_EXTRA,
      ...GARANTIA_EXTRA,
    },
  },

  vin_plate: {
    id: 'vin_plate',
    maxImages: 2,
    privacy: true,
    system: `Eres un lector de placas e identificación de vehículos. Lees la etiqueta del VIN (parabrisas, marco de la puerta, compartimiento del motor) o el número de chasis grabado y devuelves el VIN tal como está impreso, y la marca, el año y el color si se ven.\n${PRIVACY_RULES}\n${COMMON}\n- El VIN tiene 17 caracteres y nunca usa I, O ni Q: si dudas entre 0 y O, es 0. Un chasis japonés es corto, con guion (por ejemplo AE85-5012345).`,
    imageHints: ['Foto de la etiqueta del VIN o del número de chasis.'],
    fields: {
      vin: VIN,
      make: VEHICLE.make,
      year: VEHICLE.year,
      color: VEHICLE.color,
    },
  },
};
