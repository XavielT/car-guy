// cg-ai-obd — IMP 03112026 Phase 4 (SPEC-D §D1). Explain OBD codes for THIS car. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { obdHandler } from './logic.ts';

serveAi('cg-ai-obd', obdHandler);
