// cg-ai-read — IMP 03112026 Phase 2 (SPEC-B). Photos to typed, validated fields; the registry is ./kinds.ts.
import { readFeature } from '../_shared/features.ts';
import { serveAi } from '../_shared/serve.ts';
import { readHandler } from './logic.ts';

serveAi('cg-ai-read', readHandler, { feature: readFeature });
