// cg-ai-insights — IMP 03112026 Phase 5 (SPEC-E §E2). Facts in, validated insights out. Logic in ./logic.ts.
import { serveAi } from '../_shared/serve.ts';
import { insightsHandler } from './logic.ts';

serveAi('cg-ai-insights', insightsHandler);
