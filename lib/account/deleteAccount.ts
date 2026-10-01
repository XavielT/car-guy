/**
 * "Eliminar cuenta" — the orchestration (IMP 30092026 note 15, ADR-47, sql/028, api/eliminar-cuenta.ts).
 * Pure: every effect is a dependency, so the order and the failure handling are tested without a
 * phone (__tests__/account/deleteAccount.test.ts); lib/account/deleteAccountClient.ts wires the real ones.
 *
 * The order, and why:
 *   1. a fresh access token — no token, nothing happens;
 *   2. wait for a running sync (a push in flight would put rows back behind the delete);
 *   3. carguy.delete_my_account() — the cloud rows go. If it fails, NOTHING else happens: the phone
 *      keeps its data and the person can retry;
 *   4. /api/eliminar-cuenta — the Storage objects and the login. 503 no-service-key (or no answer)
 *      is not a failure: the data is gone and the login is the admin's (Admin → Cuentas por eliminar);
 *   5. sign out locally, so the eager sync triggers cannot push anything back;
 *   6. wipe this phone (lib/db/reset.ts) and re-seed the catalogue.
 * The cloud goes before the phone on purpose: wiping first and then failing to reach the server
 * would lose the only copy the person still had, and an empty database with a live session pulls
 * everything back down on the next sync.
 */

export type RpcResult = { ok: true } | { ok: false; reason: 'not-carguy' | 'network' | 'failed' };
export type FunctionAnswer = { status: number; reason?: string | null } | null;

export type DeletionDeps = {
  accessToken(): Promise<string | null>;
  whenSyncIdle(): Promise<void>;
  callRpc(): Promise<RpcResult>;
  callFunction(token: string): Promise<FunctionAnswer>;
  signOutLocal(): Promise<void>;
  wipeLocal(): Promise<void>;
  /** Progress for the screen; optional. */
  onStep?(step: DeletionStep): void;
};

export type DeletionStep = 'cloud' | 'login' | 'local';

export type DeletionResult =
  | { ok: true; login: 'deleted' | 'manual'; manualReason?: string }
  | { ok: false; reason: 'not-signed-in' | 'not-carguy' | 'network' | 'failed' };

/** The typed word, compared without case or surrounding space. */
export function isConfirmWord(input: string, word: string): boolean {
  return input.trim().toUpperCase() === word.trim().toUpperCase() && word.trim().length > 0;
}

/** What /api/eliminar-cuenta's answer means for the login. */
export function loginOutcome(answer: FunctionAnswer): { login: 'deleted' | 'manual'; manualReason?: string } {
  if (answer && answer.status === 200) return { login: 'deleted' };
  if (!answer) return { login: 'manual', manualReason: 'unreachable' };
  return { login: 'manual', manualReason: answer.reason ?? `http-${answer.status}` };
}

export async function deleteAccount(deps: DeletionDeps): Promise<DeletionResult> {
  const token = await deps.accessToken();
  if (!token) return { ok: false, reason: 'not-signed-in' };

  await deps.whenSyncIdle();
  deps.onStep?.('cloud');
  const rpc = await deps.callRpc();
  if (!rpc.ok) return { ok: false, reason: rpc.reason };

  deps.onStep?.('login');
  let answer: FunctionAnswer = null;
  try {
    answer = await deps.callFunction(token);
  } catch {
    answer = null;
  }
  const outcome = loginOutcome(answer);

  // From here the cloud data is gone whatever happens: the phone follows.
  try {
    await deps.signOutLocal();
  } catch {
    // A deleted user's session cannot be revoked on the server; the local one is what matters.
  }
  deps.onStep?.('local');
  await deps.wipeLocal();
  return { ok: true, ...outcome };
}
