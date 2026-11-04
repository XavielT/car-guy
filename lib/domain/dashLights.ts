/**
 * Dashboard warning lights (IMP 03112026 SPEC-D §D2, PROMPT-04 step 4): what a photo of the cluster can name, how urgent
 * each light is, and which telltale / feature of the app it belongs to. Pure and deterministic: the model only NAMES the
 * lights from a closed list (cg-ai-read kind `dash_lights`); what each one MEANS and WHERE it leads is decided here, so a
 * misreading can only pick a wrong light, never invent advice. Urgency is a table, not a model opinion.
 */
import type { TelltaleId } from '../features/registry';

export const DASH_LIGHTS = [
  'check_engine', 'oil_pressure', 'coolant_temp', 'battery_charge', 'tire_pressure', 'brake_system', 'abs', 'airbag',
  'power_steering', 'fuel_low', 'transmission_temp', 'traction_control', 'glow_plug', 'dpf', 'seat_belt', 'door_ajar', 'other',
] as const;
export type DashLight = (typeof DASH_LIGHTS)[number];

export const LIGHT_COLORS = ['red', 'amber', 'green', 'blue', 'other'] as const;
export type LightColor = (typeof LIGHT_COLORS)[number];

/** stop: do not keep driving · soon: see to it in the next days · info: nothing is wrong. */
export type Urgency = 'stop' | 'soon' | 'info';

/** Lights where RED means "stop now". */
const RED_STOP: ReadonlySet<DashLight> = new Set(['oil_pressure', 'coolant_temp', 'battery_charge', 'brake_system', 'airbag', 'power_steering', 'transmission_temp']);
/** Lights that are about a system the app tracks as a telltale. */
const TELLTALE: Partial<Record<DashLight, TelltaleId>> = {
  check_engine: 'check',
  oil_pressure: 'oil',
  coolant_temp: 'coolant',
  battery_charge: 'battery',
  tire_pressure: 'tire',
  brake_system: 'brake',
  abs: 'brake',
  fuel_low: 'fuel',
};

export function telltaleOf(light: DashLight): TelltaleId | null {
  return TELLTALE[light] ?? null;
}

export function urgencyOf(light: DashLight, color: LightColor | null): Urgency {
  if (color === 'green' || color === 'blue') return 'info';
  if (light === 'door_ajar' || light === 'seat_belt') return 'info';
  if (color === 'red') return RED_STOP.has(light) || light === 'check_engine' ? 'stop' : 'soon';
  // amber / unknown colour
  if (light === 'fuel_low') return 'info';
  if (light === 'oil_pressure' || light === 'brake_system' || light === 'coolant_temp' || light === 'airbag') return 'soon';
  return 'soon';
}

export type LightAction = { kind: 'obd' } | { kind: 'telltale'; telltale: TelltaleId } | { kind: 'none' };

/** Where a light leads: check engine → OBD (read the code); the rest → the feature behind its telltale. */
export function actionOf(light: DashLight): LightAction {
  if (light === 'check_engine') return { kind: 'obd' };
  const t = telltaleOf(light);
  return t ? { kind: 'telltale', telltale: t } : { kind: 'none' };
}

export type RecognisedLight = { light: DashLight; color: LightColor | null; confidence: number };

const RANK: Record<Urgency, number> = { stop: 2, soon: 1, info: 0 };

/** Most urgent first; then the model's confidence. */
export function rankLights(lights: readonly RecognisedLight[]): (RecognisedLight & { urgency: Urgency })[] {
  return lights
    .map((l) => ({ ...l, urgency: urgencyOf(l.light, l.color) }))
    .sort((a, b) => RANK[b.urgency] - RANK[a.urgency] || b.confidence - a.confidence);
}
