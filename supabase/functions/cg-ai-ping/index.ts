// cg-ai-ping — IMP 03112026 Phase 1. Admin only; 5-token model call through the shared gateway. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { pingHandler } from './logic.ts';

serveAi('cg-ai-ping', pingHandler, { adminOnly: true });
