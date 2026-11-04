import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { listAiJobs, type AiJob } from '@/lib/db/aiQueueOps';
import { processAiQueue } from '@/lib/ai/queueRunner';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Fuel Express photos taken without a connection (IMP 03112026 SPEC-B §B7.6). Each time Hoy comes into focus the queue
 * gets one pass (free when it is empty: one local query); a read that finished waits here as "lista para confirmar" and
 * a photo still waiting for a connection says so. Nothing is ever saved by the queue: Abrir opens the confirmation card.
 */
export function QueueNotice() {
  const focused = useIsFocused();
  const router = useRouter();
  const { theme } = useTheme();
  const [jobs, setJobs] = useState<AiJob[]>([]);

  useEffect(() => {
    if (!focused) return;
    let live = true;
    const load = () =>
      listAiJobs(['queued', 'ready'])
        .then((rows) => live && setJobs(rows))
        .catch(() => {});
    void load();
    processAiQueue()
      .then(load)
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [focused]);

  const ready = jobs.filter((j) => j.status === 'ready');
  const waiting = jobs.filter((j) => j.status === 'queued');
  if (!ready.length && !waiting.length) return null;

  return (
    <View style={styles.wrap}>
      {ready.length ? (
        <Pressable
          onPress={() => router.push({ pathname: '/carga/express', params: { job: ready[0].id } })}
          accessibilityRole="button"
          accessibilityLabel={`${t.ai.express.ready(ready.length)}. ${t.ai.express.open}`}
          style={[styles.row, { borderColor: theme.accent, backgroundColor: theme.bg.raised }]}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
            {t.ai.express.ready(ready.length)}
          </T>
          <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
            {t.ai.express.open}
          </T>
        </Pressable>
      ) : null}
      {waiting.length ? (
        <View accessibilityLiveRegion="polite" style={[styles.row, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
            {t.ai.express.pending(waiting.length)}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: space.md, minHeight: 48 },
});
