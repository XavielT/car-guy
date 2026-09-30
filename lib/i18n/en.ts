import type { Dict } from './dict';
import { enPart1 } from './en/part1';
import { enPart2 } from './en/part2';
import { enPart3 } from './en/part3';
import { enPart4 } from './en/part4';
import { enPart5 } from './en/part5';
import { enPart6 } from './en/part6';

/**
 * English (IMP 30092026 note 2, ADR-39). Same tree as es.ts, split in five files
 * only to keep each one readable; `Dict` makes a missing or misshapen key a
 * build error, and __tests__/i18n/parity.test.ts checks the rest.
 */
export const en: Dict = { ...enPart1, ...enPart2, ...enPart3, ...enPart4, ...enPart5, ...enPart6 };
