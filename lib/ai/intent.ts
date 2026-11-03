/**
 * Client side of `cg-ai-intent` (IMP 03112026 SPEC-B §B3): one sentence (typed or transcribed) in, one target and its
 * fields out. The context is MINIMAL on purpose: the cars' names and ids, today's date, the last odometer, the usual
 * fuel and the ids of the sections that can be opened. No history, no trips, no plates.
 */
import { callAi } from './client';
import type { IntentResult } from './intentRoute';

export type IntentContext = {
  vehicles: { id: string; name: string }[];
  /** YYYY-MM-DD, the person's today. */
  today: string;
  lastOdometer: number | null;
  fuelType: string | null;
  /** Feature ids the router may open (lib/features/ids.ts). */
  features: string[];
};

export async function askIntent(text: string, context: IntentContext): Promise<IntentResult> {
  return callAi<IntentResult>('cg-ai-intent', { text, context });
}
