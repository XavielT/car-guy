// cg-ai-sale — IMP 03112026 Phase 6 (SPEC-G §G9). Facts in, validated sale-sheet paragraphs out. Logic in ./logic.ts.
import { fixedFeature } from '../_shared/features.ts';
import { serveAi } from '../_shared/serve.ts';
import { saleHandler } from './logic.ts';

serveAi('cg-ai-sale', saleHandler, { feature: fixedFeature('sale') });
