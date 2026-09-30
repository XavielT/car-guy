/**
 * The background location task (IMP 29092026 Phase 5B, ADR-27; research 01
 * §1.7, §2.2). Imported by index.ts before expo-router/entry: TaskManager
 * needs the task defined at module scope, and when Android wakes the app for
 * a batch of fixes no screen is mounted.
 *
 * The body is glue only: fixes → engine.feed() (state from trip_state, points
 * and trips into SQLite, finalize with the same code as a manual trip) → the
 * intensity the machine asks for. The database opens lazily through getDb().
 */
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { recordError } from '../diagnostics';
import { switchIntensity, TRIP_TASK } from './auto';
import { feed } from './engine';
import { fixFromLocation } from './machine';

export type TripTaskData = { locations?: Location.LocationObject[] };

export async function handleTripTask({ data, error }: { data?: TripTaskData | null; error?: { message: string } | null }): Promise<void> {
  if (error) {
    recordError('trip-task', error.message);
    return;
  }
  const locations = data?.locations ?? [];
  if (!locations.length) return;
  try {
    const result = await feed(locations.map(fixFromLocation));
    if (result.switchTo) await switchIntensity(result.switchTo);
  } catch (e) {
    recordError('trip-task', e);
  }
}

if (!TaskManager.isTaskDefined(TRIP_TASK)) {
  TaskManager.defineTask<TripTaskData>(TRIP_TASK, (body) => handleTripTask(body));
}
