/**
 * App-level trip upkeep (IMP 29092026 Phase 5B): on open and on every return
 * to the foreground, (re)arm Automático — Android does not restart a
 * terminated app, and only the foreground may start the service — then put a
 * trip the background task opened back on the cluster, and let a parked
 * automatic trip notice it ended.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { recordError } from '../diagnostics';
import { FEATURE_TRIPS } from '../flags';
import { armAuto } from './auto';
import { hydrateLive, machineState, tick } from './engine';
import { resumeManualTrip } from './live';

async function upkeep(): Promise<void> {
  const armed = await armAuto();
  const state = await machineState();
  if (armed && state.phase === 'recording' && state.trip?.source === 'auto') await tick();
  else await hydrateLive();
  // A manual trip the app was closed in the middle of: keep measuring it.
  if (!armed && state.phase === 'recording' && state.trip?.source === 'manual') await resumeManualTrip();
}

export function useTripService(): void {
  useEffect(() => {
    if (!FEATURE_TRIPS) return;
    const run = () => void upkeep().catch((e) => recordError('trip-upkeep', e));
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, []);
}
