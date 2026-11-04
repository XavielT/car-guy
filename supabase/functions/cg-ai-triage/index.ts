// cg-ai-triage — IMP 03112026 Phase 5 (SPEC-E §E6). ADMIN ONLY: drafts a triage + a reply for one feedback item. Never sends anything.
import { serveAi } from '../_shared/serve.ts';
import { triageHandler } from './logic.ts';

serveAi('cg-ai-triage', triageHandler, { adminOnly: true });
