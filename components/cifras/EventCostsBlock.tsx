import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { SectionHeader, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { milestones as milestoneRepo } from '@/lib/db/repos';
import type { Milestone } from '@/lib/db/types';
import { EVENT_TYPE_LABEL, eventCostDop, eventCostRows, eventTypeOf } from '@/lib/domain/events';
import { FEATURE_EVENTS } from '@/lib/flagsV8';
import { dateLabel, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Cifras → "Lo que me ha costado", the events' part (ADR-44): what crashes,
 * tickets and breakdowns cost, one row each and the total — `eventCostDop`, so
 * an event linked to a service adds nothing (the service already carries the
 * bill in the card above). Nothing to show, nothing drawn.
 */
export function EventCostsBlock({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [rows, setRows] = useState<Milestone[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void milestoneRepo.listWhere({ vehicleId }).then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!FEATURE_EVENTS || !rows) return null;
  const counted = eventCostRows(rows, vehicleId);
  if (!counted.length) return null;
  const total = eventCostDop(counted, vehicleId);
  const linked = rows.some((m) => !m.deletedAt && m.linkedServiceId && (m.costDop ?? 0) > 0);

  return (
    <>
      <SectionHeader title={t.events.costsTitle} caption={t.events.costsCaption} />
      <Surface>
        {counted.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/evento/[id]', params: { id: m.id } })}
            style={styles.row}>
            <View style={{ flex: 1 }}>
              <T face="body" numberOfLines={1} style={{ color: theme.text.secondary, fontSize: 14 }}>
                {m.title}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                {`${EVENT_TYPE_LABEL[eventTypeOf(m)]} · ${dateLabel(m.occurredAt)}`}
              </T>
            </View>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
              {money(m.costDop ?? 0)}
            </T>
          </Pressable>
        ))}
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <View style={styles.row}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
            {t.events.costsTotal}
          </T>
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 16 }}>
            {money(total)}
          </T>
        </View>
        {linked ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
            {t.events.costsLinkedNote}
          </T>
        ) : null}
      </Surface>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingVertical: 4 },
  rule: { height: 1, marginVertical: space.sm },
});
