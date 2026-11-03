// cg-stt — IMP 03112026 Phase 2 (SPEC-B §B3). A short clip to a transcript, through the shared gateway. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { sttConfigured, sttHandler } from './logic.ts';

serveAi('cg-stt', sttHandler, { configured: sttConfigured });
