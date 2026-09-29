import { useRouter } from 'expo-router';
import { forwardRef, useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { T } from '@/components/T';
import { Badge, GhostButton, PrimaryButton } from '@/components/ui';
import { categoryColors, radius, space } from '@/constants/theme';
import { listEvents, trackLine, vehicleBests, type EventCard as Card, type PersonalBest } from '@/lib/db/trackQueries';
import type { TrackEvent, Venue } from '@/lib/db/types';
import { formatLap, isTimed, type EventSummary } from '@/lib/domain/track';
import { dateLabel, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

export const disciplineLabel = (d: string) => es.track.disciplines[d] ?? d.toUpperCase();

/** The venue's short name: "Autódromo de las Américas (Sunix)" → "Sunix" when it has one. */
export function venueShort(venue: Pick<Venue, 'name'> | null): string {
  if (!venue) return es.track.noVenue;
  const m = venue.name.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : venue.name;
}

/** "2 sesiones · 14 runs · 1 goma quemada" — or the best lap on a timed day. */
export function summaryLine(event: Pick<TrackEvent, 'discipline'>, s: EventSummary): string {
  const parts = [es.track.sessions(s.sessions)];
  if (isTimed(event.discipline)) {
    if (s.bestLapMs) parts.push(formatLap(s.bestLapMs));
    else if (s.laps) parts.push(es.track.laps(s.laps));
  } else if (s.runs) parts.push(es.track.runs(s.runs));
  if (s.tiresBurned) parts.push(es.track.burned(s.tiresBurned));
  return parts.join(' · ');
}

/** An event on the index: venue, date, discipline badge and the day in one line. */
export function EventCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const { theme } = useTheme();
  const { event, venue, summary } = card;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title || venueShort(venue)}, ${dateLabel(event.occurredAt)}`}
      style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, borderLeftColor: categoryColors.track }]}>
      <View style={styles.cardTop}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, flex: 1 }} numberOfLines={1}>
          {`${venueShort(venue).toUpperCase()} · ${dateLabel(event.occurredAt).toUpperCase()}`}
        </T>
        <Badge label={disciplineLabel(event.discipline)} tone={event.discipline === 'drift' || event.discipline === 'junte' ? 'red' : 'amber'} />
      </View>
      <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase' }} numberOfLines={1}>
        {event.title || venue?.name || es.track.noVenue}
      </T>
      <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
        {summaryLine(event, summary)}
      </T>
    </Pressable>
  );
}

export function BestsStrip({ bests }: { bests: PersonalBest[] }) {
  const { theme } = useTheme();
  if (!bests.length) return null;
  return (
    <View style={{ marginBottom: space.md }}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {es.track.bests}
      </T>
      <View style={styles.bests}>
        {bests.map((b) => (
          <View key={b.eventId} style={[styles.best, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }} numberOfLines={1}>
              {venueShort(b.venue).toUpperCase()}
            </T>
            <T face="monoBold" style={{ color: theme.accent, fontSize: 18 }}>
              {formatLap(b.bestLapMs)}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * RESUMEN DEL DÍA (Pista.dc.html): the card that gets shared. A forwardRef so
 * the share button can capture exactly this view.
 */
export const DaySummaryCard = forwardRef<View, { event: TrackEvent; venue: Venue | null; summary: EventSummary; vehicleName?: string }>(function DaySummaryCard(
  { event, venue, summary, vehicleName },
  ref,
) {
  const { theme } = useTheme();
  const stats: [string, string][] = [
    [String(summary.sessions), es.track.summary.sessions],
    isTimed(event.discipline) ? [summary.bestLapMs ? formatLap(summary.bestLapMs) : String(summary.laps || '—'), summary.bestLapMs ? es.track.summary.best : es.track.summary.laps] : [String(summary.runs || '—'), es.track.summary.runs],
    [String(summary.tiresBurned), es.track.summary.burned],
    [summary.kmOnTrack != null ? String(Math.round(summary.kmOnTrack)) : '—', es.track.summary.km],
    [summary.spendDop ? money(summary.spendDop) : '—', es.track.summary.spend],
  ];
  return (
    // collapsable={false}: Android must keep this View in the native tree to capture it.
    <View ref={ref} collapsable={false} style={[styles.summary, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View style={styles.cardTop}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11, flex: 1 }}>
          {es.track.summary.title}
        </T>
        <Badge label={disciplineLabel(event.discipline)} tone={event.discipline === 'drift' || event.discipline === 'junte' ? 'red' : 'amber'} />
      </View>
      <T face="title" style={{ color: theme.text.primary, fontSize: 16, textTransform: 'uppercase' }} numberOfLines={2}>
        {[venue?.name ?? es.track.noVenue, dateLabel(event.occurredAt)].join(' · ')}
      </T>
      {vehicleName ? (
        <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
          {vehicleName.toUpperCase()}
        </T>
      ) : null}
      <View style={styles.statGrid}>
        {stats.map(([value, label]) => (
          <View key={label} style={styles.stat}>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 20 }}>
              {value}
            </T>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
              {label}
            </T>
          </View>
        ))}
      </View>
      <T face="eyebrow" style={{ color: theme.text.disabled, fontSize: 9, textAlign: 'right' }}>
        CAR GUY · 走り
      </T>
    </View>
  );
});

/** The day as text, for WhatsApp. */
export function summaryText(event: TrackEvent, venue: Venue | null, s: EventSummary, vehicleName?: string): string {
  const lines = [
    `${disciplineLabel(event.discipline)} · ${venue?.name ?? es.track.noVenue} · ${dateLabel(event.occurredAt)}`,
    vehicleName ?? null,
    event.title || null,
    `${s.sessions} ${es.track.summary.sessions}`,
    isTimed(event.discipline) ? (s.bestLapMs ? `${es.track.summary.best}: ${formatLap(s.bestLapMs)}` : s.laps ? `${s.laps} ${es.track.summary.laps}` : null) : s.runs ? `${s.runs} ${es.track.summary.runs}` : null,
    s.tiresBurned ? es.track.burned(s.tiresBurned) : null,
    s.kmOnTrack != null ? `${Math.round(s.kmOnTrack)} ${es.track.summary.km}` : null,
    s.spendDop ? `${money(s.spendDop)} ${es.track.summary.spend}` : null,
  ].filter((l): l is string => Boolean(l));
  return es.track.summary.text(lines);
}

/** Shares the captured card: the share sheet on the phone, a PNG download on web. */
export async function shareCardImage(ref: React.RefObject<View | null>, name: string): Promise<void> {
  if (!ref.current) return;
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
  if (!uri) return;
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `${name}.png`;
    a.click();
    return;
  }
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
}

/** Shares text; on web without navigator.share it goes to the clipboard. Returns true when copied. */
export async function shareSummaryText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) await nav.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } else {
      await Share.share({ message: text });
    }
  } catch {
    // Dismissed.
  }
  return false;
}

/** The hub's Pista tab: the vehicle's events and bests, and the ways in. */
export function TrackTab({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [bests, setBests] = useState<PersonalBest[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listEvents(vehicleId), vehicleBests(vehicleId)]).then(([c, b]) => {
      if (cancelled) return;
      setCards(c);
      setBests(b);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);

  if (!cards) return null;
  return (
    <View style={{ gap: space.sm }}>
      <BestsStrip bests={bests} />
      {!cards.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {es.track.empty}
        </T>
      ) : null}
      {cards.slice(0, 3).map((c) => (
        <EventCard key={c.event.id} card={c} onPress={() => router.push({ pathname: '/pista/evento/[id]', params: { id: c.event.id } })} />
      ))}
      <PrimaryButton label={es.track.newEvent} onPress={() => router.push({ pathname: '/pista/evento/nuevo', params: { vehicleId } })} />
      {cards.length ? <GhostButton label={es.track.open} onPress={() => router.push({ pathname: '/pista', params: { vehicleId } })} /> : null}
    </View>
  );
}

/** "3 eventos · PB Sunix 1:23.456" on the hub's Resumen, when there is any. */
export function TrackSummaryLine({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [line, setLine] = useState<{ events: number; best: PersonalBest | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void trackLine(vehicleId).then((l) => !cancelled && setLine(l));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version]);

  if (!line || !line.events) return null;
  const text = [es.track.hubLine(line.events), line.best ? es.track.hubBest(venueShort(line.best.venue), formatLap(line.best.bestLapMs)) : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/pista', params: { vehicleId } })}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={[styles.line, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <T face="mono" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
        {text}
      </T>
      <Badge label="PISTA" tone="amber" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 3, borderRadius: radius.button, padding: space.md, gap: 4, marginBottom: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bests: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  best: { borderWidth: 1, borderRadius: radius.input, paddingVertical: space.sm, paddingHorizontal: space.md, minWidth: 120 },
  summary: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: 6 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, marginTop: space.sm },
  stat: { width: '50%' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space.md, marginBottom: space.md },
});
