// The background trip task must be defined before anything else runs: Android
// can start the app just to deliver a batch of fixes, with no screen mounted
// (IMP 29092026 Phase 5B, lib/trips/task.ts). Web gets task.web.ts, a no-op.
import './lib/trips/task';
import 'expo-router/entry';
