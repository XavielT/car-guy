/**
 * Workflow kinds of `cg-ai-read` (IMP 03112026 SPEC-G §G2/§G6/§G7, PROMPT-06):
 *
 *   check_photo   a photo for ONE item of the weekly check (the item type is passed in, from a closed list) → what is visible plus a
 *                 pass / watch / fail SUGGESTION. Hedged by construction: no measurement is ever stated (a photo does not measure
 *                 tread depth or oil level), an unsure read can never say "pass", and the person accepts or overrides it.
 *   damage_photos 1–4 photos of damage after an accident → a short neutral description, the areas, and a leve/moderado/grave GUESS.
 *                 Never fault, liability, cost or claim advice: the server drops any text that goes there.
 *   album_batch   up to 12 album photos (768 px, ONE call) → per photo: angle, a caption, and whether it looks like a change since
 *                 the previous photo of the batch (new wheels, paint, aero, exhaust, lowered). Suggestions only.
 *
 * A prompt is a request; `finalizeWorkflow` is the guarantee. Pure: no Deno, no network. The closed lists MUST match
 * lib/domain/workflowPhotos.ts (a test pins it).
 */
import type { Field, FieldSpec } from '../_shared/fields.ts';
import type { KindDef } from './kinds.ts';
import { looksLikeCedula } from './privacy.ts';

export const CHECK_ITEMS = ['tire_tread', 'oil_dipstick', 'coolant', 'brake_fluid', 'leak', 'battery', 'belts', 'lights', 'wipers', 'other'] as const;
export type CheckItem = (typeof CHECK_ITEMS)[number];
export const CHECK_SUGGESTIONS = ['pass', 'watch', 'fail'] as const;

export const DAMAGE_AREAS = ['front', 'rear', 'left', 'right', 'roof', 'hood', 'trunk', 'bumper_front', 'bumper_rear', 'door', 'fender', 'windshield', 'window', 'light', 'wheel', 'mirror', 'interior', 'undercarriage', 'other'] as const;
export const DAMAGE_SEVERITY = ['leve', 'moderado', 'grave'] as const;

export const ALBUM_ANGLES = ['front', 'rear', 'side', 'interior', 'engine_bay', 'wheels', 'detail', 'other'] as const;
export const ALBUM_CHANGES = ['none', 'wheels', 'paint', 'aero', 'exhaust', 'stance', 'interior', 'other'] as const;
export const ALBUM_MAX = 12;

/** What to look for per item: the model is told what a photo can and cannot show. */
export const CHECK_GUIDE: Record<CheckItem, string> = {
  tire_tread: 'banda de rodamiento de una goma: desgaste visible, parejo o disparejo, grietas. Una foto NO mide la profundidad; nunca des milímetros.',
  oil_dipstick: 'varilla del aceite: dónde llega el nivel y el color/aspecto del aceite. Una foto no prueba el nivel exacto ni el estado interno del motor.',
  coolant: 'depósito de refrigerante: nivel respecto a las marcas y color. No juzgues la condición interna del motor.',
  brake_fluid: 'depósito del líquido de frenos: nivel respecto a las marcas y color.',
  leak: 'zona bajo el carro o el motor: manchas o goteo visibles y su color aproximado. No afirmes de qué líquido es con seguridad.',
  battery: 'batería y bornes: corrosión visible, cables flojos, hinchazón. Una foto no mide el voltaje.',
  belts: 'correas visibles: grietas, deshilachado, brillo. Una foto no sustituye la revisión del taller.',
  lights: 'luces: si se ven encendidas, opacas o rotas.',
  wipers: 'plumas del limpiaparabrisas: goma partida o despegada.',
  other: 'lo que se vea del elemento revisado.',
};

const COMMON = `Reglas:
- Describe SOLO lo que se ve y NO inventes nada. Si la foto no es de lo que se pide o no se puede ver bien, readable=false.
- "confidence" va de 0 a 1 y dice qué tan seguro estás de ESE valor. Si dudas, baja la confianza.
- Lenguaje prudente: "parece", "se ve", "podría". Nada de certezas ni de diagnósticos.
- Responde SOLO llamando a la herramienta.`;

const STR = (desc: string, maxLen: number): FieldSpec => ({ type: 'string', desc, maxLen });

export const WORKFLOW_KINDS: Record<string, KindDef> = {
  check_photo: {
    id: 'check_photo',
    maxImages: 1,
    system: `Eres un ayudante de revisión semanal de un carro. Miras UNA foto de un elemento y dices qué se ve y si parece estar bien, vale la pena vigilarlo o parece fallar. Es una SUGERENCIA: el dueño la acepta o la cambia.\n${COMMON}\n- suggestion: "pass" solo si se ve claramente bien; "watch" si hay algo que vigilar o no se ve con claridad; "fail" solo si se ve un problema evidente (goma lisa o con corte, fuga activa, corrosión fuerte, nivel por debajo de la marca).\n- Nunca des medidas (milímetros, voltios, litros) ni afirmes el estado interno del motor.`,
    imageHints: ['Foto del elemento a revisar.'],
    fields: {
      observation: STR('Qué se ve, en una frase prudente (máx. 160 caracteres)', 160),
      suggestion: { type: 'enum', desc: 'pass, watch o fail', values: CHECK_SUGGESTIONS },
    },
  },
  damage_photos: {
    id: 'damage_photos',
    maxImages: 4,
    system: `Eres un ayudante que describe daños visibles en un carro después de un accidente, para que el dueño lo anote. Devuelves una descripción corta y neutral, las zonas dañadas (lista cerrada) y una GUESS de gravedad: leve (rayones, abolladuras pequeñas), moderado (piezas deformadas o rotas, el carro se puede mover) o grave (daño estructural evidente, airbags, ruedas fuera de lugar).\n${COMMON}\n- NO digas quién tuvo la culpa, NO hables de responsabilidad, de seguros, de reclamos ni de costos, y NO afirmes que el carro es seguro o inseguro para manejar.\n- Describe daños, no personas: no menciones placas, caras ni nombres.`,
    imageHints: ['Foto del daño del carro.'],
    fields: {
      description: STR('Descripción neutral de los daños visibles (máx. 240 caracteres)', 240),
      severity: { type: 'enum', desc: 'Gravedad estimada: leve, moderado o grave', values: DAMAGE_SEVERITY },
    },
    items: { key: 'area', max: 8, fields: { area: { type: 'enum', desc: 'Zona dañada: ' + DAMAGE_AREAS.join(', '), values: DAMAGE_AREAS } } },
    // No `privacy` flag on purpose: its address-word list would drop "la dirección quedó torcida" (steering). Plates and cédulas are
    // removed by finalizeWorkflow instead.
  },
  album_batch: {
    id: 'album_batch',
    maxImages: ALBUM_MAX,
    system: `Eres un ayudante de álbum de un carro. Recibes fotos EN ORDEN (la primera es la más antigua). Para cada foto devuelves un ítem con su número (1 = primera): el ángulo (lista cerrada), un título corto y si la foto parece mostrar un CAMBIO respecto a la foto anterior del lote (ruedas nuevas, pintura, aerodinámica, escape, altura, interior). La primera foto nunca tiene cambio (change none).\n${COMMON}\n- Solo di que hay cambio si se ve claramente distinto entre una foto y la anterior; si dudas, none.\n- Títulos de máx. 60 caracteres, sin placas, nombres ni lugares exactos.`,
    imageHints: ['Foto del lote, en orden cronológico.'],
    fields: {},
    perImage: false,
    items: {
      key: 'index',
      max: ALBUM_MAX,
      fields: {
        index: { type: 'number', desc: 'Número de la foto en el lote (1 = la primera)', min: 1, max: ALBUM_MAX },
        angle: { type: 'enum', desc: 'Ángulo: ' + ALBUM_ANGLES.join(', '), values: ALBUM_ANGLES },
        caption: STR('Título corto de la foto (máx. 60 caracteres)', 60),
        change: { type: 'enum', desc: 'Cambio respecto a la foto anterior: ' + ALBUM_CHANGES.join(', '), values: ALBUM_CHANGES },
        change_note: STR('Qué cambió, en pocas palabras (máx. 60 caracteres)', 60),
      },
    },
    privacy: true,
  },
};

// ───────────────────────────────────────────────────────────────────────────────────────────── filters
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A photo cannot measure: a figure in mm / volts / litres / psi is the model pretending to. */
const MEASURE = /\b\d+([.,]\d+)?\s*(mm|milimetros?|v|volts?|voltios?|l|lts?|litros?|psi|bar|km)\b/;
/** Certainty words a photo cannot back. */
const CERTAIN = /\b(seguro que|con seguridad|sin duda|definitivamente|garantizo|garantizado|es un hecho|no hay problema|esta perfecto|esta en perfecto)\b/;
/** Fault, liability, money and claims: not ours to say about an accident. */
const LIABILITY = /\b(culpa|culpable|responsab\w*|negligen\w*|imprudenc\w*|infraccion\w*|multa|demanda|reclamo|reclamar|indemniz\w*|cobertura|cubre|cubierto|asegurador\w*|poliza|perdida total|siniestro total|costo\w*|cuesta|vale|presupuesto|pagar|fault|liable|liability|negligen\w*|claim|insurance|covered|coverage|total loss|cost\w*|worth|sue|lawsuit)\b/;
/** A verdict on whether the car may be driven. */
const DRIVABLE = /\b(se puede manejar|no se puede manejar|es seguro manejar|inseguro|no es seguro|no manejes|safe to drive|unsafe|not safe|do not drive)\b/;

export type TextProblem = 'measure' | 'certain' | 'liability' | 'drivable' | null;

export function textProblem(text: string, kind: 'check' | 'damage' | 'album'): TextProblem {
  const f = fold(text);
  if (kind === 'check') return MEASURE.test(f) ? 'measure' : CERTAIN.test(f) ? 'certain' : null;
  if (kind === 'damage') return LIABILITY.test(f) ? 'liability' : DRIVABLE.test(f) ? 'drivable' : CERTAIN.test(f) ? 'certain' : null;
  return CERTAIN.test(f) ? 'certain' : null;
}

/** A Dominican plate written out (one or two letters, five or six digits): never part of a description. */
const PLATE = /(?<![A-Z0-9])[A-Z]{1,2} ?\d{5,6}(?![A-Z0-9])/;

const NONE: Field = { value: null, confidence: 0 };

type Read = { fields: Record<string, Field>; items?: Record<string, Field>[] };

/**
 * The guarantee behind the prompts, applied after validation and before the answer leaves. Returns how many values it removed or
 * changed (a count, never the text). Mutates a copy, not the input.
 */
export function finalizeWorkflow<T extends Read>(kindId: string, read: T): { read: T; adjusted: number } {
  let adjusted = 0;
  const fields = { ...read.fields };
  let items = read.items?.map((it) => ({ ...it }));
  const dropText = (name: string, kind: 'check' | 'damage' | 'album') => {
    const f = fields[name];
    if (f && typeof f.value === 'string' && textProblem(f.value, kind)) {
      fields[name] = { ...NONE };
      adjusted++;
    }
  };

  if (kindId === 'check_photo') {
    dropText('observation', 'check');
    const s = fields.suggestion;
    // An unsure read can never say "pass": a photo is weak evidence of good, and a wrong "ok" is the costly mistake.
    if (s && s.value === 'pass' && s.confidence < 0.75) {
      fields.suggestion = { value: 'watch', confidence: s.confidence };
      adjusted++;
    }
    // A suggestion with a text we had to remove still stands, but only as "watch" at best: nothing explains it.
    if (fields.observation && fields.observation.value === null && fields.suggestion?.value === 'pass') {
      fields.suggestion = { value: 'watch', confidence: fields.suggestion.confidence };
      adjusted++;
    }
  }
  if (kindId === 'damage_photos') {
    dropText('description', 'damage');
    const d = fields.description;
    if (d && typeof d.value === 'string' && (PLATE.test(d.value.toUpperCase()) || looksLikeCedula(d.value))) {
      fields.description = { ...NONE };
      adjusted++;
    }
  }
  if (kindId === 'album_batch' && items) {
    items = items
      .map((it) => {
        const out = { ...it };
        for (const name of ['caption', 'change_note']) {
          const f = out[name];
          if (f && typeof f.value === 'string' && textProblem(f.value, 'album')) {
            out[name] = { ...NONE };
            adjusted++;
          }
        }
        // The first photo of a batch has nothing before it to have changed from; a change with no note is a guess with no reason.
        if (out.index?.value === 1 && out.change?.value && out.change.value !== 'none') {
          out.change = { value: 'none', confidence: out.change.confidence };
          adjusted++;
        }
        return out;
      })
      // One entry per photo number: a repeated number is the model losing count.
      .filter((it, i, all) => all.findIndex((x) => x.index?.value === it.index?.value) === i);
  }
  return { read: { ...read, fields, ...(items ? { items } : {}) }, adjusted };
}
