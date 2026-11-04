// cg-places — IMP 03112026 Phase 6 (SPEC-G §G4). Nearby gomera/taller/gasolinera/lavado as a LIST. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { placesConfigured, placesHandler } from './logic.ts';

serveAi('cg-places', placesHandler, { configured: placesConfigured });
