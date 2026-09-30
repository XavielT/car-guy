import { useState } from 'react';

import { useDelayedLoading } from '@/hooks/useDelayedLoading';

/**
 * Whether a form that loads its initial values shows its skeleton (ADR-40).
 *
 * Like useDelayedLoading, except when the screen around the form was already
 * showing a skeleton while it looked the record up (mod, hito, pista): then
 * the form keeps it on from its first frame, instead of a blank 150 ms gap
 * between the screen's skeleton and its own. `continued` is read once, at mount.
 */
export function useFormSkeleton(loading: boolean, continued = false): boolean {
  const [handedOn] = useState(continued);
  const delayed = useDelayedLoading(loading && !handedOn);
  return handedOn ? loading : delayed;
}
