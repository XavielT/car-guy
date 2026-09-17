/**
 * Compatibility barrel. The maths now lives in lib/domain/economy.ts (ADR-04:
 * domain logic is pure TypeScript, tested). Screens still import from
 * '@/lib/math', so this keeps them untouched.
 */
export * from './domain/economy';
