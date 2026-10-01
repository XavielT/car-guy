/**
 * The tab bar's logic, pure and tested (IMP 30092026 Phase 4, ADR-43): where
 * the centre button sits among the tabs, and what it shows for the trip state.
 */

/** The slot the CONDUCIR disc takes in the row. */
export const CENTRE = '__conducir__';

/**
 * The tabs in order with the centre slot in the middle: Inicio · Garaje · ● ·
 * Historial · Más. An odd count leaves the extra tab on the left half.
 */
export function tabSlots(routeNames: readonly string[]): string[] {
  const at = Math.ceil(routeNames.length / 2);
  return [...routeNames.slice(0, at), CENTRE, ...routeNames.slice(at)];
}

export type CentreState = {
  recording: boolean;
  /** The amber ring: none (idle), a 1 Hz loop, or static (reduced motion). */
  ring: 'none' | 'pulse' | 'static';
  /** The tiny "REC" under the disc. */
  showRec: boolean;
  /** Which accessibility label the disc reads (t.drive[labelKey]). */
  labelKey: 'open' | 'openRecording';
};

/**
 * The disc for the live trip store's state. The pulse loop is the only one
 * allowed on the bar and exists only while a trip records; reduced motion
 * keeps the ring but never animates it.
 */
export function centreState(recording: boolean, reducedMotion: boolean): CentreState {
  if (!recording) return { recording: false, ring: 'none', showRec: false, labelKey: 'open' };
  return { recording: true, ring: reducedMotion ? 'static' : 'pulse', showRec: true, labelKey: 'openRecording' };
}
