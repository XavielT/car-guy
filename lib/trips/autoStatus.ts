/**
 * What stops Automático from recording on this phone, if anything (IMP 01102026 Phase 1, from Phase 0's Redmi
 * finding: no location permission, MIUI autostart off, battery-optimised — and nothing on Inicio said so).
 * Pure: the screens pass in what they read; the first blocker in order of importance wins.
 */
import type { AutoReadiness } from './auto';

export type AutoBlocker = 'foreground' | 'background' | 'approximate' | 'unavailable' | 'autostart' | 'battery';

export function autoBlocker(input: {
  mode: 'auto' | 'manual' | 'off' | null;
  readiness: AutoReadiness | null;
  /** MIUI only; 'unknown' elsewhere. */
  autostart: 'enabled' | 'disabled' | 'unknown';
  battery: 'unrestricted' | 'optimized' | 'unknown';
}): AutoBlocker | null {
  if (input.mode !== 'auto' || input.readiness == null || input.readiness === 'web') return null;
  if (input.readiness !== 'ready') return input.readiness;
  if (input.autostart === 'disabled') return 'autostart';
  if (input.battery === 'optimized') return 'battery';
  return null;
}

/** "12 s", "5 min", "3 h", "2 d" — the same in both languages. */
export function agoShort(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 172_800) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
}

/** The newest fix the machine has seen — idle (start window) or recording (the open trip's last). */
export function lastFixTime(state: { recent: { t: number }[]; trip: { last: { t: number } | null } | null } | null): number | null {
  if (!state) return null;
  const a = state.recent.at(-1)?.t ?? null;
  const b = state.trip?.last?.t ?? null;
  return a == null ? b : b == null ? a : Math.max(a, b);
}
