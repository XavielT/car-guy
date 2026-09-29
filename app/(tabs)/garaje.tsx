import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevokedPrompt } from '@/components/share/RevokedPrompt';
import { T } from '@/components/T';
import { Badge, CarbonFrame, Chip, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { garageFacts, type GarageFacts } from '@/lib/db/garageQueries';
import { currentOdometer } from '@/lib/db/repos';
import { evaluatedReminders } from '@/lib/db/reminderQueries';
import type { Vehicle as VehicleRow } from '@/lib/db/types';
import { isEx, ownershipLine, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import { km as fmtKm } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useStore } from '@/lib/store';
import { FEATURE_SHARE } from '@/lib/flags';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Garaje (IMP 28092026, Garaje.dc.html): every car you have, had or are
 * building. The active one leads as a hero card; the rest sit two-up; the ones
 * that are gone keep their own section — "Ya no está, pero aquí sigue."
 *
 * Badges, lines and counts are all derived (lib/domain/garage.ts); tap any
 * card for the vehicle hub.
 */
type Filter = 'activos' | 'proyecto' | 'ex';

type Card = {
  vehicle: VehicleRow;
  facts: GarageFacts;
  odometerKm: number | null;
  overdue: number;
};

export default function GarajeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle } = useStore();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);

  const rows = useMemo(
    () => data.vehicles.map((v) => v.detail).filter((v): v is VehicleRow => Boolean(v)),
    [data.vehicles],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      rows.map(async (vehicle) => {
        const [facts, odometerKm, reminders] = await Promise.all([
          garageFacts(vehicle.id),
          currentOdometer(vehicle.id),
          isEx(vehicle.status) ? Promise.resolve([]) : evaluatedReminders(vehicle.id),
        ]);
        return {
          vehicle,
          facts,
          odometerKm,
          overdue: reminders.filter((r) => r.status.status === 'vencido' && !r.status.snoozed).length,
        };
      }),
    ).then((next) => {
      if (!cancelled) setCards(next);
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const all = cards ?? [];
  const ex = all.filter((c) => isEx(c.vehicle.status));
  const inGarage = all.filter((c) => !isEx(c.vehicle.status));
  const matches = (c: Card) =>
    filter == null ||
    (filter === 'ex' ? isEx(c.vehicle.status) : filter === 'proyecto' ? c.vehicle.status === 'proyecto' : !isEx(c.vehicle.status) && c.vehicle.status !== 'proyecto');

  const hero = inGarage.find((c) => c.vehicle.id === activeVehicle?.id && matches(c)) ?? null;
  const others = inGarage.filter((c) => c !== hero && matches(c));
  const exShown = ex.filter(matches);
  const activeCount = inGarage.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        {FEATURE_SHARE ? <RevokedPrompt /> : null}
        <View style={styles.brandRow}>
          <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
            {es.garage.eyebrow}
          </T>
          <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
            車
          </T>
        </View>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.garage.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.lg }}>
          {es.garage.counts(activeCount, ex.length)}
        </T>

        <View style={styles.filters} accessibilityRole="tablist">
          {(['activos', 'proyecto', 'ex'] as Filter[]).map((f) => (
            <Chip
              key={f}
              label={es.garage.filters[f]}
              selected={filter === f}
              onPress={() => setFilter(filter === f ? null : f)}
            />
          ))}
        </View>

        {hero ? <HeroCard card={hero} onPress={() => open(router, hero.vehicle.id)} /> : null}

        {others.length ? (
          <View style={styles.grid}>
            {others.map((c) => (
              <SmallCard key={c.vehicle.id} card={c} onPress={() => open(router, c.vehicle.id)} />
            ))}
          </View>
        ) : null}

        {exShown.length ? (
          <>
            <View style={[styles.brandRow, { marginTop: space.xl, marginBottom: space.sm }]}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {es.garage.exSection}
              </T>
            </View>
            {exShown.map((c) => (
              <ExCard key={c.vehicle.id} card={c} onPress={() => open(router, c.vehicle.id)} />
            ))}
          </>
        ) : null}

        {cards && !hero && !others.length && !exShown.length ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 14, marginVertical: space.xl, textAlign: 'center' }}>
            {es.garage.emptyFilter}
          </T>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <PrimaryButton label={es.garage.add} onPress={() => router.push('/vehiculo/nuevo')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function open(router: ReturnType<typeof useRouter>, id: string) {
  router.push({ pathname: '/vehiculo/[id]', params: { id } });
}

function title(v: VehicleRow): string {
  return [v.make, v.model].filter(Boolean).join(' ').toUpperCase() || v.name.toUpperCase();
}

/** "2015 · 1.6 NA · AT" — year, engine, gearbox. */
function specLine(v: VehicleRow): string {
  const box = v.transmission === 'manual' ? 'MT' : v.transmission === 'automatica' ? 'AT' : v.transmission === 'cvt' ? 'CVT' : null;
  return [v.year, v.engineCode, box].filter(Boolean).join(' · ');
}

/** hero_media_id, else the first favourite album photo, else the v2.0 vehicle photo. */
function Cover({ vehicle, favoriteMediaId, height }: { vehicle: VehicleRow; favoriteMediaId: string | null; height: number }) {
  const { theme } = useTheme();
  const uri = useMediaUri(vehicle.heroMediaId ?? favoriteMediaId ?? vehicle.photoMediaId);
  return (
    <CarbonFrame style={[styles.cover, { height, backgroundColor: theme.bg.well }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.coverEmpty}>
          <Ionicons name="car-sport-outline" size={height * 0.3} color={theme.text.disabled} />
        </View>
      )}
    </CarbonFrame>
  );
}

function HeroCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const badges = vehicleBadges(vehicle, facts);
  const kana = toKatakana(vehicle.nickname);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${vehicle.year ?? ''}`}
      style={[styles.hero, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View>
        <Cover vehicle={vehicle} favoriteMediaId={facts.favoriteMediaId} height={170} />
        <View style={styles.badgeRow}>
          {badges.slice(0, 2).map((b) => (
            <Badge key={b.label} label={b.label} tone={b.tone} />
          ))}
        </View>
      </View>
      <View style={styles.heroBody}>
        <View style={styles.titleLine}>
          <T face="display" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 22, flexShrink: 1 }}>
            {title(vehicle)}
          </T>
          {kana ? (
            <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
              {kana}
            </T>
          ) : null}
        </View>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {specLine(vehicle) || vehicle.name}
        </T>
        <View style={styles.stats}>
          <Stat value={card.odometerKm != null ? fmtKm(Math.round(card.odometerKm)) : '—'} />
          <Stat value={es.garage.mods(facts.installedMods)} />
          <Stat
            value={card.overdue ? es.garage.overdue(card.overdue) : es.garage.allGood}
            color={card.overdue ? theme.statusText.vencido : theme.statusText.ok}
          />
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ value, color }: { value: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <T face="mono" style={{ color: color ?? theme.text.primary, fontSize: 13 }}>
      {value}
    </T>
  );
}

function SmallCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const badge = vehicleBadges(vehicle, facts).at(-1);
  const line =
    vehicle.status === 'proyecto'
      ? es.garage.projectLine(facts.openTasks)
      : vehicle.status === 'guardado'
        ? es.vehicleStatus.guardado
        : card.overdue
          ? es.garage.overdue(card.overdue)
          : es.garage.allGood;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${line}`}
      style={[styles.small, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      {badge ? <Badge label={badge.label} tone={badge.tone} style={{ marginBottom: space.sm }} /> : null}
      <T face="title" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 16, letterSpacing: 0.5 }}>
        {title(vehicle)}
      </T>
      <T face="body" numberOfLines={1} style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2 }}>
        {specLine(vehicle)}
      </T>
      <T
        face="medium"
        style={{
          color: vehicle.status === 'proyecto' ? theme.statusText.urgente : card.overdue ? theme.statusText.vencido : theme.text.muted,
          fontSize: 12,
          marginTop: space.sm,
        }}>
        {line}
      </T>
    </Pressable>
  );
}

function ExCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const own = ownershipLine(facts.ownership);
  const line = [own, es.garage.photos(facts.photos)].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${line}`}
      style={[styles.ex, { borderColor: theme.lineStrong }]}>
      <View style={styles.exThumb}>
        <Cover vehicle={vehicle} favoriteMediaId={facts.favoriteMediaId} height={64} />
      </View>
      <View style={{ flex: 1 }}>
        <T face="title" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 15, letterSpacing: 0.5 }}>
          {[title(vehicle), vehicle.engineCode].filter(Boolean).join(' ')}
          {vehicle.year ? ` · ${vehicle.year}` : ''}
        </T>
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2 }}>
          {line}
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
          {es.garage.exCaption}
        </T>
      </View>
      <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
        記憶
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  h: { fontSize: 34, textTransform: 'uppercase', marginTop: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  hero: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden', marginBottom: space.md },
  cover: { width: '100%', borderRadius: 0 },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.sm },
  heroBody: { padding: space.lg },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  small: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: radius.card, padding: space.lg },
  ex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.sm,
  },
  exThumb: { width: 88, borderRadius: radius.input, overflow: 'hidden' },
});
