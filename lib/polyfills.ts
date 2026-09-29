// pdf-lib's fontkit reaches for a global Buffer, which React Native does not have.
import { Buffer } from 'buffer';

(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
