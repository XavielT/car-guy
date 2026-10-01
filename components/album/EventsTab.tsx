import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { EmptyState, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { milestones as milestoneRepo } from '@/lib/db/repos';
import type { Milestone } from '@/lib/db/types';
import { eventTimeline, pendingEvents, type TimelineMarker } from '@/lib/domain/events';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** The vehicle's milestones, re-read on the hub's own writes (`version`) and on any store write. */
function useMilestones(vehicleId: string, version: number): Milestone[] | null {
  const { data } = useStore();
  const [rows, setRows] = useState<Milestone[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void milestoneRepo.listWhere({ vehicleId }).then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);
  return rows;
}

function useMarkerColor(): (marker: TimelineMarker) => string {
  const { theme } = useTheme();
  return (marker) =>
    marker === 'grave' ? theme.danger : marker === 'serious' ? theme.status.urgente : marker === 'pending' ? theme.status.proximo : theme.text.muted;
}

/**
 * The amber rows on the vehicle hub (03-screens.md Phase 5): "Pendiente: pintar
 * el guardafango · desde 12 ago", one per unresolved event; a tap opens it.
 */
export function PendingEventsBanner({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const rows = useMilestones(vehicleId, version);
  const pending = rows ? pendingEvents(rows, vehicleId) : [];
  if (!pending.length) return null;
  return (
    <View style={{ gap: 6, marginBottom: space.sm }}>
      {pending.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => router.push({ pathname: '/evento/[id]', params: { id: m.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pending, { borderColor: theme.status.proximo, backgroundColor: `${theme.status.proximo}1F`, opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.statusText.proximo} />
          <T face="semibold" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
            {t.events.pendingRow(m.pending.trim(), dateLabel(m.occurredAt))}
          </T>
          <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The hub's Eventos tab (ADR-44): every milestone and event of the car, newest
 * first, on a rail whose dot says how bad it was — red for grave, orange for
 * moderado, amber while something is pending. Status changes stay out.
 */
export function EventsTab({ vehicleId, version, readOnly }: { vehicleId: string; version: number; readOnly?: boolean }) {
  const router = useRouter();
  const { theme } = useTheme();
  const rows = useMilestones(vehicleId, version);
  const markerColor = useMarkerColor();
  const add = () => router.push({ pathname: '/evento/nuevo', params: { vehicleId } });
  if (!rows) return null;
  const items = eventTimeline(rows, vehicleId);
  if (!items.length) {
    return <EmptyState icon="flag-outline" message={t.events.tabEmpty} actionLabel={readOnly ? undefined : t.events.add} onAction={readOnly ? undefined : add} />;
  }
  return (
    <View>
      {items.map((item, i) => {
        const m = item.milestone;
        const meta = [dateLabel(m.occurredAt), m.odometerKm != null ? fmtKm(Math.round(m.odometerKm)) : null, m.locationLabel || null].filter(Boolean).join(' · ');
        const dot = item.eventType === 'hito' && item.marker === 'normal' ? theme.accent : markerColor(item.marker);
        return (
          <Pressable
            key={m.id}
            onPress={() => router.push({ pathname: '/evento/[id]', params: { id: m.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${m.title}`}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.railCol}>
              <View style={[styles.rail, { backgroundColor: theme.lineStrong }, i === 0 && { top: 18 }, i === items.length - 1 && { bottom: undefined, height: 18 }]} />
              <View style={[styles.dot, { backgroundColor: dot, borderColor: theme.bg.base }]}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={13} color={theme.bg.base} />
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: item.marker === 'grave' ? theme.danger : theme.line }]}>
              <T face="eyebrow" style={{ color: item.marker === 'normal' ? theme.text.muted : dot, fontSize: 11 }}>
                {item.label}
              </T>
              <T face="semibold" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 15, marginTop: 2 }}>
                {m.title}
              </T>
              <T face="body" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {meta}
              </T>
              {item.subtitle ? (
                <T face="mono" numberOfLines={2} style={{ color: item.marker === 'pending' ? theme.statusText.proximo : theme.text.secondary, fontSize: 12, marginTop: 4 }}>
                  {item.subtitle}
                </T>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {readOnly ? null : <PrimaryButton label={t.events.add} onPress={add} />}
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: 10 },
  item: { flexDirection: 'row', gap: space.sm },
  railCol: { width: 26, alignItems: 'center' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dot: { marginTop: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm },
});
