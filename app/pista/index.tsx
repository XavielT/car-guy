import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BestsStrip, EventCard } from '@/components/track/TrackPieces';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { TipCard } from '@/components/TipCard';
import { T } from '@/components/T';
import { Chip, EmptyState, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { listEvents, vehicleBests, type EventCard as Card, type PersonalBest } from '@/lib/db/trackQueries';
import { todayIso } from '@/lib/domain/dates';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Pista (03-screens.md Block E): upcoming and past events, the best lap per
 * venue, "Nuevo evento". Opened for one vehicle from its hub (or from Inicio),
 * or for the whole garage from Más.
 */
export default function TrackIndexScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [filter, setFilter] = useState<string | null>(vehicleId ?? null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [bests, setBests] = useState<PersonalBest[]>([]);
  // Settled once the first read answers (or fails): the skeleton is for that read only (ADR-40).
  const [settled, setSettled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([listEvents(filter ?? undefined), vehicleBests(filter ?? undefined)]).then(([c, b]) => {
        if (cancelled) return;
        setCards(c);
        setBests(b);
      }).finally(() => !cancelled && setSettled(true));
      return () => {
        cancelled = true;
      };
    }, [filter]),
  );

  const showSkeleton = useDelayedLoading(!settled);

  const today = todayIso().slice(0, 10);
  const upcoming = (showSkeleton ? [] : (cards ?? [])).filter((c) => c.event.occurredAt.slice(0, 10) > today).reverse();
  const past = (showSkeleton ? [] : (cards ?? [])).filter((c) => c.event.occurredAt.slice(0, 10) <= today);
  const vehicles = data.vehicles.filter((v) => !v.isArchived);
  const open = (id: string) => router.push({ pathname: '/pista/evento/[id]', params: { id } });

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.track.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.track.title}
      </T>
      <TipCard id="track" />
      {vehicles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <Chip label={t.history.all} selected={!filter} onPress={() => setFilter(null)} />
          {vehicles.map((v) => (
            <Chip key={v.id} label={v.name} selected={filter === v.id} onPress={() => setFilter(v.id)} />
          ))}
        </ScrollView>
      ) : null}
      {showSkeleton ? <ListCardsSkeleton section n={4} pad={space.md} r={radius.button} eyebrow lines={1} titleWidth="65%" /> : <BestsStrip bests={bests} />}
      {cards && !cards.length && !showSkeleton ? <EmptyState icon="speedometer-outline" message={t.track.empty} /> : null}
      {upcoming.length ? (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
          {t.track.upcoming}
        </T>
      ) : null}
      {upcoming.map((c) => (
        <EventCard key={c.event.id} card={c} onPress={() => open(c.event.id)} />
      ))}
      {past.length ? (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm, marginTop: upcoming.length ? space.md : 0 }}>
          {t.track.past}
        </T>
      ) : null}
      {past.map((c) => (
        <EventCard key={c.event.id} card={c} onPress={() => open(c.event.id)} />
      ))}
      <PrimaryButton label={t.track.newEvent} onPress={() => router.push({ pathname: '/pista/evento/nuevo', params: filter ? { vehicleId: filter } : {} })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
