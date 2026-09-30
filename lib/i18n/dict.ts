import type { es } from './es';

/**
 * The shape every language must have: es.ts's tree with its literal strings
 * widened to `string` (es is `as const`), functions keeping their parameters.
 * `en: Dict` fails the build on a missing key, an extra key, or a function with
 * different arguments (ADR-39).
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

export type Dict = Widen<typeof es>;
export type Lang = 'es' | 'en';
