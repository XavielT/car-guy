import { deleteAccount, isConfirmWord, loginOutcome, type DeletionDeps } from '@/lib/account/deleteAccount';

function deps(over: Partial<DeletionDeps> = {}): { d: DeletionDeps; calls: string[] } {
  const calls: string[] = [];
  const d: DeletionDeps = {
    accessToken: async () => {
      calls.push('token');
      return 'jwt';
    },
    whenSyncIdle: async () => void calls.push('idle'),
    callRpc: async () => {
      calls.push('rpc');
      return { ok: true };
    },
    callFunction: async (token) => {
      calls.push(`function:${token}`);
      return { status: 200 };
    },
    signOutLocal: async () => void calls.push('signout'),
    wipeLocal: async () => void calls.push('wipe'),
    onStep: (s) => calls.push(`step:${s}`),
    ...over,
  };
  return { d, calls };
}

describe('Eliminar cuenta — orchestration', () => {
  it('the typed word: case and spaces do not matter, anything else does', () => {
    expect(isConfirmWord(' eliminar ', 'ELIMINAR')).toBe(true);
    expect(isConfirmWord('ELIMINA', 'ELIMINAR')).toBe(false);
    expect(isConfirmWord('DELETE', 'DELETE')).toBe(true);
    expect(isConfirmWord('', '')).toBe(false);
  });

  it('happy path: cloud first, then the login, sign out, and only then this phone', async () => {
    const { d, calls } = deps();
    await expect(deleteAccount(d)).resolves.toEqual({ ok: true, login: 'deleted' });
    expect(calls).toEqual(['token', 'idle', 'step:cloud', 'rpc', 'step:login', 'function:jwt', 'signout', 'step:local', 'wipe']);
  });

  it('no session: nothing at all happens', async () => {
    const { d, calls } = deps({ accessToken: async () => null });
    await expect(deleteAccount(d)).resolves.toEqual({ ok: false, reason: 'not-signed-in' });
    expect(calls).toEqual([]);
  });

  it.each(['not-carguy', 'network', 'failed'] as const)('the RPC fails (%s): the phone keeps its data and the session', async (reason) => {
    const { d, calls } = deps({ callRpc: async () => ({ ok: false, reason }) });
    await expect(deleteAccount(d)).resolves.toEqual({ ok: false, reason });
    expect(calls).not.toContain('wipe');
    expect(calls).not.toContain('signout');
    expect(calls.some((c) => c.startsWith('function'))).toBe(false);
  });

  it('the function has no service key (503): the data is gone, the login is the admin\'s — still a success', async () => {
    const { d, calls } = deps({ callFunction: async () => ({ status: 503, reason: 'no-service-key' }) });
    await expect(deleteAccount(d)).resolves.toEqual({ ok: true, login: 'manual', manualReason: 'no-service-key' });
    expect(calls.slice(-2)).toEqual(['step:local', 'wipe']);
  });

  it('the function is unreachable or throws: manual, and the phone is still wiped', async () => {
    const { d, calls } = deps({
      callFunction: async () => {
        throw new Error('offline');
      },
      signOutLocal: async () => {
        throw new Error('already gone');
      },
    });
    await expect(deleteAccount(d)).resolves.toEqual({ ok: true, login: 'manual', manualReason: 'unreachable' });
    expect(calls).toContain('wipe');
  });

  it('loginOutcome maps answers', () => {
    expect(loginOutcome({ status: 200 })).toEqual({ login: 'deleted' });
    expect(loginOutcome(null)).toEqual({ login: 'manual', manualReason: 'unreachable' });
    expect(loginOutcome({ status: 502, reason: 'storage-failed' })).toEqual({ login: 'manual', manualReason: 'storage-failed' });
    expect(loginOutcome({ status: 500 })).toEqual({ login: 'manual', manualReason: 'http-500' });
  });
});
