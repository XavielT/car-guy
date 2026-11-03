// cg-ai-status — IMP 03112026 Phase 1 (SPEC-A §A3). GET/POST, no provider call. Logic in ./logic.ts (unit-tested).
import { makeDeps } from '../_shared/serve.ts';
import { handleStatus } from './logic.ts';

Deno.serve((req) => handleStatus(req, makeDeps()));
