/**
 * OBD-side kinds of `cg-ai-read` (IMP 03112026 SPEC-D §D2/§D3, PROMPT-04 step 4).
 *
 *   dash_lights  a photo of the instrument cluster → the lights that are ON, each NAMED from a closed list with its colour.
 *                What a light means and where it leads is decided by the app (lib/domain/dashLights.ts), not by the model:
 *                a misreading can only pick a wrong light, never invent advice.
 *   scanner      a screenshot of a scanner app (Torque, OBD Fusion, Car Scanner…) → trouble codes (strict shape) and any
 *                freeze-frame values that are LABELLED on screen. Pasted text never comes here: lib/domain/dtcParse.ts reads it
 *                offline for free.
 * Pure: no Deno, no network. The light list MUST match lib/domain/dashLights.ts (a test pins it).
 */
import type { FieldSpec } from '../_shared/fields.ts';
import type { KindDef } from './kinds.ts';

export const DASH_LIGHT_VALUES = [
  'check_engine', 'oil_pressure', 'coolant_temp', 'battery_charge', 'tire_pressure', 'brake_system', 'abs', 'airbag',
  'power_steering', 'fuel_low', 'transmission_temp', 'traction_control', 'glow_plug', 'dpf', 'seat_belt', 'door_ajar', 'other',
] as const;
export const LIGHT_COLOR_VALUES = ['red', 'amber', 'green', 'blue', 'other'] as const;

const COMMON = `Reglas:
- Si un campo no se ve o no aplica, value null y confidence 0. "confidence" va de 0 a 1 y dice qué tan seguro estás de ESE valor.
- NO inventes. Si dudas, baja la confianza. Si la foto no es de lo que se pide o no se puede leer, readable=false.
- Responde SOLO llamando a la herramienta.`;

const NUM = (desc: string, min: number, max: number): FieldSpec => ({ type: 'number', desc, min, max });

export const OBD_KINDS: Record<string, KindDef> = {
  dash_lights: {
    id: 'dash_lights',
    maxImages: 2,
    system: `Eres un lector de tableros de instrumentos. Miras la foto de un tablero con luces de advertencia ENCENDIDAS y devuelves una línea por cada luz encendida: cuál es (de la lista cerrada) y de qué color. NO interpretes ni des consejos: solo di qué luz es.\n${COMMON}\n- Solo luces ENCENDIDAS. Las luces apagadas del tablero no cuentan, ni los indicadores normales (direccionales, luces altas, velocímetro).\n- Si una luz no está en la lista, usa "other".\n- Color: red, amber (amarillo o naranja), green, blue u other.`,
    imageHints: ['Foto del TABLERO con luces de advertencia encendidas.'],
    fields: {},
    items: {
      key: 'light',
      max: 8,
      fields: {
        light: { type: 'enum', desc: 'Cuál luz es: ' + DASH_LIGHT_VALUES.join(', '), values: DASH_LIGHT_VALUES },
        color: { type: 'enum', desc: 'Color de la luz: ' + LIGHT_COLOR_VALUES.join(', '), values: LIGHT_COLOR_VALUES },
      },
    },
  },

  scanner: {
    id: 'scanner',
    maxImages: 3,
    system: `Eres un lector de capturas de pantalla de aplicaciones de escáner OBD-II (Torque, OBD Fusion, Car Scanner…). Devuelves los códigos de falla que se ven y los valores de "datos congelados" (freeze frame) que estén ROTULADOS en pantalla.\n${COMMON}\n- Un código tiene la forma de una letra P, B, C o U seguida de 4 dígitos o letras A-F (por ejemplo P0301). Cópialo carácter por carácter.\n- Datos congelados: solo si el valor está rotulado (RPM, temperatura del refrigerante, carga del motor, velocidad). Un número sin rótulo no cuenta.`,
    imageHints: ['Captura de pantalla de un escáner OBD-II.'],
    fields: {
      rpm: NUM('RPM del motor en los datos congelados', 0, 12_000),
      coolant_c: NUM('Temperatura del refrigerante en °C', -40, 250),
      load_pct: NUM('Carga del motor en %', 0, 100),
      speed_kmh: NUM('Velocidad en km/h', 0, 400),
    },
    items: {
      key: 'code',
      max: 12,
      fields: {
        code: { type: 'string', desc: 'Código de falla, por ejemplo P0301', clean: (s) => s.replace(/\s+/g, '').toUpperCase(), pattern: /^[PBCU][0-3][0-9A-F]{3}$/, maxLen: 5 },
      },
    },
  },
};
