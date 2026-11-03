// cg-ai-intent — IMP 03112026 Phase 2 (SPEC-B §B3). One sentence in, one pre-filled form out. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { intentHandler } from './logic.ts';

serveAi('cg-ai-intent', intentHandler);
