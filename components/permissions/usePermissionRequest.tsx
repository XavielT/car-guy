import { useCallback, useRef, useState, type ReactNode } from 'react';

import { markPrimerSeen } from '@/lib/permissions/primer';
import { canAskInApp, needsSettings } from '@/lib/permissions/map';
import { checkPermission, requestPermission, usePermission } from '@/lib/permissions/store';
import type { PermissionId } from '@/lib/permissions/types';

import { PermissionPrimerSheet } from './PermissionPrimerSheet';
import { PermissionStepsSheet } from './PermissionStepsSheet';

/**
 * "Make sure I can use this" for a screen (IMP 16102026 ADR-59). `ensure()` is what a button handler awaits before
 * the function that needs the permission:
 *
 *  - already granted (or the phone cannot tell, so the function tries): resolves `true` at once;
 *  - never asked / can ask again: shows the primer; "Permitir" shows the system dialog; resolves with the outcome;
 *  - blocked or location services off: shows the steps (and, on Android, the button to the settings); resolves `false`;
 *  - "Ahora no": resolves `false`, asks nothing.
 *
 * `outcome()` is the same flow with a finer answer, for flows that go on while Android's settings page is open
 * ("Permitir todo el tiempo"): `granted` · `declined` ("Ahora no", or it needs the settings first) · `not_granted`
 * (the person allowed, the system has not granted yet).
 *
 * Render \`sheet\` once in the screen. Nothing is ever requested without the primer in front of it.
 */
export type PermissionOutcome = 'granted' | 'declined' | 'not_granted';

export function usePermissionRequest(id: PermissionId) {
  const live = usePermission(id);
  const [ui, setUi] = useState<'none' | 'primer' | 'steps'>('none');
  const pending = useRef<((o: PermissionOutcome) => void) | null>(null);

  const finish = useCallback((o: PermissionOutcome) => {
    const resolve = pending.current;
    pending.current = null;
    resolve?.(o);
  }, []);

  const outcome = useCallback(async (): Promise<PermissionOutcome> => {
    const now = await checkPermission(id);
    if (now.status === 'granted' || now.status === 'unknown') return 'granted';
    if (now.status === 'unavailable') return 'declined';
    if (needsSettings(now.status)) {
      setUi('steps');
      return 'declined';
    }
    if (!canAskInApp(now.status)) return 'declined';
    setUi('primer');
    return new Promise<PermissionOutcome>((resolve) => {
      pending.current = resolve;
    });
  }, [id]);

  const ensure = useCallback(async (): Promise<boolean> => (await outcome()) === 'granted', [outcome]);

  const allow = useCallback(async () => {
    setUi('none');
    void markPrimerSeen(id);
    const after = await requestPermission(id);
    finish(after.status === 'granted' ? 'granted' : 'not_granted');
  }, [id, finish]);

  const notNow = useCallback(() => {
    setUi('none');
    finish('declined');
  }, [finish]);

  const sheet: ReactNode = (
    <>
      <PermissionPrimerSheet id={id} visible={ui === 'primer'} onAllow={() => void allow()} onNotNow={notNow} />
      <PermissionStepsSheet id={id} status={live.status} visible={ui === 'steps'} onClose={() => setUi('none')} />
    </>
  );

  return { ensure, outcome, sheet, status: live.status, detail: live.detail, loaded: live.loaded, recheck: live.recheck };
}
