import { StatusPill, type Tone } from '@/components/ui/StatusPill';
import { es } from '@/lib/i18n/es';
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
  const { status, pending, running } = useSync();

  const [tone, label]: [Tone, string] = running
    ? ['neutral', es.sync.syncing]
    : status.state === 'error'
      ? ['vencido', es.sync.errors.generic]
      : pending > 0
        ? ['proximo', es.sync.pending(pending)]
        : ['ok', es.sync.upToDate];

  return <StatusPill status={tone} label={label} />;
}
