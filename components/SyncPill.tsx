import { Pressable } from 'react-native';

import { StatusPill, type Tone } from '@/components/ui/StatusPill';
import { Alert } from '@/lib/alert';
import { dateTimeLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSync } from '@/lib/sync/useSync';

/**
 * Whether this device is in step with the cloud, in the same pill language the
 * rest of the app uses for everything else that has a state.
 *
 * "Sin subir" is `proximo`, not `vencido`: unsynced rows are on the phone and
 * perfectly safe, so they are something to get to, not something wrong. Only a
 * failed sync earns the red.
 */
export function SyncPill() {
  const { status, pending, running, lastSyncAt } = useSync();

  const [tone, label]: [Tone, string] = running
    ? ['neutral', t.sync.syncing]
    : status.state === 'error'
      ? ['vencido', t.sync.errors.generic]
      : pending > 0
        ? ['proximo', t.sync.pending(pending)]
        : ['ok', t.sync.upToDate];

  // Long-press (and the screen reader) tell when it last synced — the same moment Cuenta shows (note 5).
  const when = lastSyncAt ? dateTimeLabel(lastSyncAt) : t.sync.never;
  return (
    <Pressable
      onLongPress={() => Alert.alert(t.account.lastSync, when)}
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${t.account.lastSync}: ${when}`}
      hitSlop={6}>
      <StatusPill status={tone} label={label} />
    </Pressable>
  );
}
