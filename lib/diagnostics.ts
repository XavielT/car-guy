/**
 * The last few technical errors, kept in memory for the feedback form
 * (IMP 29092026 ADR on developer text): the user sees Spanish copy, the raw
 * message lands here and in the `__DEV__` console, never on screen.
 */
export type DiagnosticEntry = { at: string; where: string; message: string };

const LIMIT = 20;
const entries: DiagnosticEntry[] = [];

export function recordError(where: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  entries.push({ at: new Date().toISOString(), where, message });
  if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
  if (__DEV__) console.warn(`[car-guy] ${where}:`, error);
}

/** Newest last, as a copy. */
export function recentErrors(): DiagnosticEntry[] {
  return entries.map((e) => ({ ...e }));
}

export function clearDiagnostics(): void {
  entries.length = 0;
}

/**
 * An error whose message was written for the user (Spanish, from es.ts) — a
 * backup file that is not a backup, say. Anything else is technical and is
 * never shown as is.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/**
 * What to put on screen for a caught error: its own text when it is a
 * UserError, else the fallback sentence (the raw error goes to the diagnostics).
 */
export function userMessage(where: string, error: unknown, fallback: string): string {
  if (error instanceof UserError) return error.message;
  recordReportable(where, error);
  return fallback;
}

let reportArmedAt = 0;

/**
 * An error the screen is about to tell the user about: recorded, and the next
 * alert (within 1.5 s) offers "Reportar". Background errors (sync, trips, the
 * outbox) use plain recordError and never put the link on an unrelated dialog.
 */
export function recordReportable(where: string, error: unknown): void {
  recordError(where, error);
  reportArmedAt = Date.now();
}

/** True once per recordReportable, for the alert that follows it. */
export function takeReportable(now = Date.now(), windowMs = 1500): boolean {
  const armed = reportArmedAt > 0 && now - reportArmedAt < windowMs;
  reportArmedAt = 0;
  return armed;
}
