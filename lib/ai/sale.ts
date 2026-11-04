/**
 * Sale-ready summary, the app side of `cg-ai-sale` (IMP 03112026 SPEC-G §G9). The sheet is built on the device
 * (lib/domain/saleSheet.ts) and is complete without this call; `askSale` only asks the model to improve the wording, and the
 * server returns just the paragraphs whose numbers it could verify. Nothing is stored here.
 */
import type { SaleAnswer, SaleFact } from '../../supabase/functions/cg-ai-sale/sale';
import { callAi } from './client';

export type { SaleAnswer };

export async function askSale(vehicleLabel: string, lang: 'es' | 'en', facts: readonly SaleFact[]): Promise<SaleAnswer> {
  return callAi<SaleAnswer>('cg-ai-sale', { vehicleLabel, lang, facts });
}
