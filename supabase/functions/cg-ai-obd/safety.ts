/**
 * The SAFETY OVERRIDE table of `cg-ai-obd` (IMP 03112026 SPEC-D §D1/§D5, PROMPT-04 step 2). A model is not allowed to tell
 * someone a car is fine to drive when the code belongs to a system where that could hurt them. The prompt says so; this
 * table makes it true whatever the model answers: it is a FLOOR on `can_drive`, applied server-side after validation.
 *
 *   can_drive order:  yes < careful < no.   A floor of `careful` means "yes" is not allowed; `no` means only "no".
 *
 * The ranges are deliberately coarse (whole SAE blocks, not individual codes I would have to invent a meaning for): wrong in
 * the cautious direction is acceptable, wrong in the other direction is not. A multi-code scan takes the HIGHEST floor.
 * Pure: no Deno, no network. Add a range here, with its reason, and the test pins it.
 */
export type CanDrive = 'yes' | 'careful' | 'no';
export const CAN_DRIVE: readonly CanDrive[] = ['yes', 'careful', 'no'];
const RANK: Record<CanDrive, number> = { yes: 0, careful: 1, no: 2 };

export type SafetyRule = { id: string; from: string; to: string; floor: Exclude<CanDrive, 'yes'>; reason: string };

/** Inclusive ranges over the normalised code (same letter, then the 4 hex digits). */
export const SAFETY_RULES: SafetyRule[] = [
  // Overheating and oil pressure: the engine can be destroyed (or the car stop) within minutes.
  { id: 'overheat', from: 'P0217', to: 'P0218', floor: 'no', reason: 'sobrecalentamiento del motor o de la transmisión' },
  { id: 'oil_pressure', from: 'P0520', to: 'P0524', floor: 'no', reason: 'presión de aceite' },
  // Airbags and restraints (SAE B00xx): the car moves, but it will not protect you in a crash.
  { id: 'airbag', from: 'B0001', to: 'B0099', floor: 'careful', reason: 'bolsas de aire y cinturones' },
  // Generic chassis block (SAE C0xxx): ABS, traction, stability and brake systems.
  { id: 'chassis', from: 'C0000', to: 'C0299', floor: 'careful', reason: 'frenos, ABS o estabilidad' },
  // Misfire (a flashing light can ruin the catalyst and make the car lurch), crank/cam position (it can stall).
  { id: 'misfire', from: 'P0300', to: 'P0312', floor: 'careful', reason: 'fallo de encendido (misfire)' },
  { id: 'crank', from: 'P0335', to: 'P0339', floor: 'careful', reason: 'sensor de posición del cigüeñal (el motor puede apagarse)' },
  // Charging system voltage: the car can die with no warning, taking steering/brake assist with it.
  { id: 'voltage', from: 'P0562', to: 'P0563', floor: 'careful', reason: 'voltaje del sistema de carga' },
  // Lost communication with the engine/transmission module or the ABS module.
  { id: 'comms', from: 'U0100', to: 'U0199', floor: 'careful', reason: 'comunicación perdida con un módulo importante' },
];

const parse = (code: string): { letter: string; n: number } | null => {
  const m = /^([PBCU])([0-3][0-9A-F]{3})$/.exec(code);
  return m ? { letter: m[1], n: parseInt(m[2], 16) } : null;
};

/** The rules that apply to one normalised code. */
export function rulesFor(code: string): SafetyRule[] {
  const c = parse(code);
  if (!c) return [];
  return SAFETY_RULES.filter((r) => {
    const a = parse(r.from)!;
    const b = parse(r.to)!;
    return a.letter === c.letter && c.n >= a.n && c.n <= b.n;
  });
}

/** The strictest floor over a set of codes, with the reasons that set it. `null` = no rule applies. */
export function safetyFloor(codes: readonly string[]): { floor: Exclude<CanDrive, 'yes'>; reasons: string[] } | null {
  let floor: CanDrive = 'yes';
  const hit: SafetyRule[] = [];
  for (const code of codes) {
    for (const r of rulesFor(code)) {
      hit.push(r);
      if (RANK[r.floor] > RANK[floor]) floor = r.floor;
    }
  }
  if (floor === 'yes') return null;
  return { floor: floor as Exclude<CanDrive, 'yes'>, reasons: [...new Set(hit.filter((r) => RANK[r.floor] === RANK[floor]).map((r) => r.reason))] };
}

/** `answer` raised to the floor of `codes`; says whether it had to be raised. Never lowers an answer. */
export function applySafetyFloor(answer: CanDrive, codes: readonly string[]): { canDrive: CanDrive; overridden: boolean; reasons: string[] } {
  const f = safetyFloor(codes);
  if (!f || RANK[answer] >= RANK[f.floor]) return { canDrive: answer, overridden: false, reasons: f?.reasons ?? [] };
  return { canDrive: f.floor, overridden: true, reasons: f.reasons };
}
