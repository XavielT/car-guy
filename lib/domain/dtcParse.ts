/**
 * Scanner text → trouble codes and freeze-frame values (IMP 03112026 SPEC-D §D3, PROMPT-04 step 4). Pure, deterministic,
 * offline. A pasted list, or the text read off a Torque / OBD Fusion / Car Scanner screenshot, is parsed HERE first: the
 * codes have a strict shape (`normalizeCode`), so no model is needed to find them, and the person never pays for it. The AI
 * only reads a screenshot's pixels into this text when there is no text to paste (cg-ai-read `scanner`).
 *
 * Every code found is validated with the same rule the rest of the app uses; anything else is ignored, never guessed.
 */
import { normalizeCode } from './dtc';

export const MAX_PARSED_CODES = 12;

const CODE_TOKEN = /(?<![A-Za-z0-9])[PBCUpbcu][0-3][0-9A-Fa-f]{3}(?![A-Za-z0-9])/g;

/** Well-formed codes in the text, in order of appearance, without repeats. */
export function extractCodes(text: string | null | undefined): string[] {
  const out: string[] = [];
  for (const token of (text ?? '').match(CODE_TOKEN) ?? []) {
    const code = normalizeCode(token);
    if (code && !out.includes(code)) out.push(code);
    if (out.length >= MAX_PARSED_CODES) break;
  }
  return out;
}

export type FreezeFrame = { rpm: number | null; coolantC: number | null; loadPct: number | null; speedKmh: number | null };

const MPH_TO_KMH = 1.609344;
const between = (n: number, lo: number, hi: number): number | null => (Number.isFinite(n) && n >= lo && n <= hi ? n : null);

/**
 * Labelled values only ("RPM 2,400", "Coolant temp 92 °C", "Engine load 35 %", "Vehicle speed 60 km/h", also in Spanish).
 * A number without its label is never taken: freeze-frame screens are full of numbers. Fahrenheit and mph are converted.
 */
export function extractFreezeFrame(text: string | null | undefined): FreezeFrame | null {
  const s = (text ?? '').replace(/,(?=\d{3}\b)/g, '');
  const grab = (re: RegExp) => re.exec(s);

  const rpmM = grab(/(?:engine\s*speed|rpm|r\.p\.m\.?|revoluciones)\D{0,14}(\d{3,5})/i) ?? grab(/(\d{3,5})\s*rpm/i);
  const rpm = rpmM ? between(Number(rpmM[1]), 0, 12_000) : null;

  const coolantM = grab(/(?:coolant(?:\s*temp(?:erature)?)?|ect|refrigerante|temp(?:eratura)?\s*(?:del\s*)?motor)\D{0,14}(-?\d{2,3})\s*°?\s*([CF])?/i);
  let coolantC: number | null = null;
  if (coolantM) {
    const v = Number(coolantM[1]);
    coolantC = between(coolantM[2]?.toUpperCase() === 'F' ? Math.round(((v - 32) * 5) / 9) : v, -40, 250);
  }

  const loadM = grab(/(?:(?:calculated|engine|abs\.?)\s*load|carga(?:\s*del\s*motor)?)\D{0,14}(\d{1,3}(?:\.\d+)?)\s*%/i);
  const loadPct = loadM ? between(Number(loadM[1]), 0, 100) : null;

  const speedM = grab(/(?:vehicle\s*speed|speed|velocidad)\D{0,14}(\d{1,3}(?:\.\d+)?)\s*(km\/h|kph|mph)/i);
  let speedKmh: number | null = null;
  if (speedM) speedKmh = between(Math.round(Number(speedM[1]) * (speedM[2].toLowerCase() === 'mph' ? MPH_TO_KMH : 1)), 0, 400);

  const ff = { rpm, coolantC, loadPct, speedKmh };
  return Object.values(ff).some((v) => v != null) ? ff : null;
}
