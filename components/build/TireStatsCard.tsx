import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { HEAT_CYCLE_MAX, HEAT_CYCLE_MIN, setHeatCycleLimit, vehicleTireSummary, type VehicleTireSummary } from '@/lib/db/tireQueries';
import type { TireBadge } from '@/lib/domain/tireStats';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { shareCardImage } from '@/components/track/TrackPieces';

/** The badges row: earned in colour with the date, the next in outline with "faltan n". */
export function TireBadges({ badges }: { badges: TireBadge[] }) {
  const { theme } = useTheme();
  const next = badges.find((b) => !b.earned)?.id;
  return (
    <View style={styles.badges}>
      {badges.map((b) => {
        const detail = b.earned ? (b.reachedAt ? t.tiresUi.badgeEarned(dateLabel(b.reachedAt)) : '') : t.tiresUi.badgeToGo(b.remaining);
        const isNext = b.id === next;
        return (
          <View
            key={b.id}
            accessible
            accessibilityLabel={t.tiresUi.badgeA11y(b.label, b.earned, detail)}
            style={[
              styles.badge,
              b.earned
                ? { backgroundColor: theme.accentFill, borderColor: theme.accentFill }
                : { borderColor: isNext ? theme.accent : theme.line, borderStyle: isNext ? 'solid' : 'dashed' },
            ]}>
            <T face="title" style={{ color: b.earned ? theme.accentFillInk : isNext ? theme.text.primary : theme.text.muted, fontSize: 12, textTransform: 'uppercase' }} numberOfLines={1}>
              {b.label}
            </T>
            <T face="mono" style={{ color: b.earned ? theme.accentFillInk : theme.text.muted, fontSize: 10 }}>
              {b.earned ? `${b.threshold} · ${detail}` : isNext ? detail : String(b.threshold)}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** The capturable part: big numbers, the badges, the car's name — never the plate. */
export const TireShareCard = forwardRef<View, { summary: VehicleTireSummary; vehicleName: string }>(function TireShareCard({ summary, vehicleName }, ref) {
  const { theme } = useTheme();
  const s = summary.stats;
  const tiles: [string, string][] = [
    [String(s.total), t.tiresUi.cardTotal],
    [String(s.thisYear), t.tiresUi.cardYear],
    [String(s.burned), t.tiresUi.cardBurned],
  ];
  return (
    // collapsable={false}: Android must keep this View in the native tree to capture it.
    <View ref={ref} collapsable={false} testID="tire-share-card" style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View style={styles.cardTop}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11, flex: 1 }}>
          {t.tiresUi.cardTitle}
        </T>
        <T face="kana" style={{ color: theme.text.muted, fontSize: 11 }}>
          {'タイヤ'}
        </T>
      </View>
      <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
        {vehicleName.toUpperCase()}
      </T>
      <View style={styles.tiles}>
        {tiles.map(([v, l]) => (
          <View key={l} style={styles.tile}>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 26 }}>
              {v}
            </T>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
              {l}
            </T>
          </View>
        ))}
      </View>
      <TireBadges badges={summary.badges} />
      <T face="eyebrow" style={{ color: theme.text.disabled, fontSize: 9, textAlign: 'right', marginTop: space.sm }}>
        CAR GUY · 走り
      </T>
    </View>
  );
});

/**
 * Build → Gomas header card (IMP 30092026 note 3, ADR-45): the share card, the
 * sentences from messagesFor (headline, money, pace, next badge, heat-cycle
 * warnings), the heat-cycle limit setting and "Compartir".
 */
export function TireStatsCard({ vehicleId, vehicleName, version, onLimit }: { vehicleId: string; vehicleName: string; version?: unknown; onLimit?: (n: number) => void }) {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<VehicleTireSummary | null>(null);
  const ref = useRef<View>(null);

  const [bump, setBump] = useState(0);
  const load = useCallback(async () => setBump((b) => b + 1), []);
  useEffect(() => {
    let cancelled = false;
    vehicleTireSummary(vehicleId)
      .then((x) => {
        if (!cancelled) setSummary(x);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, bump]);

  if (!summary || summary.stats.total === 0) return null;
  const [headline, ...rest] = summary.messages;
  const heat = new Set(summary.stats.heatWarnings.map((w) => w.label));

  async function step(delta: number) {
    onLimit?.(await setHeatCycleLimit(summary!.limit + delta));
    await load();
  }

  return (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      <TireShareCard ref={ref} summary={summary} vehicleName={vehicleName} />
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
        {headline}
      </T>
      {rest.map((m) => {
        const warn = [...heat].some((l) => m.startsWith(l));
        return (
          <View key={m} style={styles.msg}>
            {warn ? <Ionicons name="flame" size={14} color={theme.dangerText} /> : null}
            <T face="body" style={{ color: warn ? theme.dangerText : theme.text.secondary, fontSize: 13, flex: 1 }}>
              {m}
            </T>
          </View>
        );
      })}
      <View style={[styles.limit, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
            {t.tiresUi.heatLimit}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {t.tiresUi.heatLimitHint(summary.limit)}
          </T>
        </View>
        <Pressable onPress={() => void step(-1)} disabled={summary.limit <= HEAT_CYCLE_MIN} accessibilityRole="button" accessibilityLabel={t.tiresUi.heatLess} hitSlop={6} style={[styles.stepper, { borderColor: theme.lineStrong }]}>
          <Ionicons name="remove" size={18} color={theme.text.primary} />
        </Pressable>
        <T face="monoBold" accessibilityLiveRegion="polite" style={{ color: theme.text.primary, fontSize: 16, minWidth: 24, textAlign: 'center' }}>
          {String(summary.limit)}
        </T>
        <Pressable onPress={() => void step(1)} disabled={summary.limit >= HEAT_CYCLE_MAX} accessibilityRole="button" accessibilityLabel={t.tiresUi.heatMore} hitSlop={6} style={[styles.stepper, { borderColor: theme.lineStrong }]}>
          <Ionicons name="add" size={18} color={theme.text.primary} />
        </Pressable>
      </View>
      <GhostButton label={t.tiresUi.share} onPress={() => void shareCardImage(ref, `gomas-${vehicleName.toLowerCase().replace(/\s+/g, '-')}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  tile: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderWidth: 1, borderRadius: radius.input, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '100%' },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  limit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, padding: space.sm },
  stepper: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
