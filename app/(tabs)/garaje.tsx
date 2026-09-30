import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevokedPrompt } from '@/components/share/RevokedPrompt';
import { T } from '@/components/T';
import { Badge, CarbonFrame, Chip, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { garageFacts, type GarageFacts } from '@/lib/db/garageQueries';
import { currentOdometer } from '@/lib/db/repos';
import { evaluatedReminders } from '@/lib/db/reminderQueries';
import { DEFAULT_GARAGE_LAYOUT, garageLayout, setGarageLayout, vehicleGallery, type GarageLayout } from '@/lib/db/tripOps';
import type { Vehicle as VehicleRow } from '@/lib/db/types';
import { isEx, ownershipLine, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import { canMove, garageLayoutReducer, orderByLayout, type GarageLayoutAction, type GarageMode } from '@/lib/domain/garageLayout';
import { statusLine } from '@/lib/domain/vehicleStatus';
import { km as fmtKm } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { getMedia } from '@/lib/media';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useStore } from '@/lib/store';
import { FEATURE_GARAGE_V2, FEATURE_SHARE } from '@/lib/flags';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Garaje v2 (IMP 29092026 note 14, GarajeV2.dc.html): every car you have, had
 * or are building, as Portadas (one full-bleed cover per car), Cuadrícula
 * (two-up) or Lista (rows). The ones that are gone keep their own section at
 * the bottom in every mode — "Ya no está, pero aquí sigue."
 *
 * Ordenar: up/down arrows plus "Fijar arriba", on both platforms. Drag handles
 * were considered (Reanimated + gesture-handler are installed) and left out:
 * long-press drag is unreliable on web, a 2-up grid makes "up/down" ambiguous
 * while dragging, and a hand-rolled drag list could not be verified at 60 fps
 * on the Redmi here — so Ordenar shows the cars as a list with arrows, the
 * same on the phone and the web. The layout (mode, order, pin) is
 * `setting.garage_layout`, synced; the rules live in lib/domain/garageLayout.ts.
 *
 * Badges, lines and counts are all derived (lib/domain/garage.ts); tap any
 * card for the vehicle hub. With FEATURE_GARAGE_V2 off the screen is the grid
 * alone, without the view switcher or Ordenar.
 */
type Filter = 'activos' | 'proyecto' | 'ex';

type Card = {
  vehicle: VehicleRow;
  facts: GarageFacts;
  odometerKm: number | null;
  overdue: number;
  /** The gallery cover (v6), else hero_media_id, else the first favourite album photo. */
  coverId: string | null;
  coverBlurhash: string | null;
  /** Photos in the vehicle's gallery, for the "1/7" pill; 0 hides it. */
  gallery: number;
};

const MODES: { key: GarageMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'covers', icon: 'image-outline' },
  { key: 'grid', icon: 'grid-outline' },
  { key: 'list', icon: 'list-outline' },
];

export default function GarajeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [layout, setLayout] = useState<GarageLayout | null>(FEATURE_GARAGE_V2 ? null : DEFAULT_GARAGE_LAYOUT);
  const [sorting, setSorting] = useState(false);

  const rows = useMemo(
    () => data.vehicles.map((v) => v.detail).filter((v): v is VehicleRow => Boolean(v)),
    [data.vehicles],
  );

  // Re-read on focus: a sync may have brought the other device's layout.
  useFocusEffect(
    useCallback(() => {
      if (!FEATURE_GARAGE_V2) return;
      let cancelled = false;
      void garageLayout()
        .then((next) => {
          if (!cancelled) setLayout(next);
        })
        .catch(() => {
          if (!cancelled) setLayout(DEFAULT_GARAGE_LAYOUT);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      rows.map(async (vehicle) => {
        const [facts, odometerKm, reminders, gallery] = await Promise.all([
          garageFacts(vehicle.id),
          currentOdometer(vehicle.id),
          isEx(vehicle.status) ? Promise.resolve([]) : evaluatedReminders(vehicle.id),
          FEATURE_GARAGE_V2 ? vehicleGallery(vehicle.id) : Promise.resolve([]),
        ]);
        const coverId = vehicle.photoMediaId ?? vehicle.heroMediaId ?? facts.favoriteMediaId;
        const cover = await getMedia(coverId).catch(() => null);
        return {
          vehicle,
          facts,
          odometerKm,
          overdue: reminders.filter((r) => r.status.status === 'vencido' && !r.status.snoozed).length,
          coverId,
          coverBlurhash: cover?.blurhash ?? null,
          gallery: gallery.length,
        };
      }),
    ).then((next) => {
      if (!cancelled) setCards(next);
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const current = layout ?? DEFAULT_GARAGE_LAYOUT;
  const dispatch = (action: GarageLayoutAction) => {
    const next = garageLayoutReducer(current, action);
    if (next === current) return;
    setLayout(next);
    void setGarageLayout(next);
  };

  const all = cards ?? [];
  const idOf = (c: Card) => c.vehicle.id;
  const allIds = rows.map((v) => v.id);
  const matches = (c: Card) =>
    filter == null ||
    (filter === 'ex' ? isEx(c.vehicle.status) : filter === 'proyecto' ? c.vehicle.status === 'proyecto' : !isEx(c.vehicle.status) && c.vehicle.status !== 'proyecto');

  const inGarage = orderByLayout(all.filter((c) => !isEx(c.vehicle.status)), idOf, current);
  const ex = orderByLayout(all.filter((c) => isEx(c.vehicle.status)), idOf, current, { pin: false });
  const shown = inGarage.filter(matches);
  const exShown = ex.filter(matches);
  const ready = cards != null && layout != null;
  const mode = current.mode;

  const openCard = (c: Card) => router.push({ pathname: '/vehiculo/[id]', params: { id: c.vehicle.id } });
  const move = (section: Card[], c: Card, delta: -1 | 1) =>
    dispatch({ type: 'move', id: c.vehicle.id, delta, section: section.map(idOf), all: allIds });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        {FEATURE_SHARE ? <RevokedPrompt /> : null}
        <View style={styles.headRow}>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.brandRow}>
              <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
                {es.garage.eyebrow}
              </T>
              <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
                車庫
              </T>
            </View>
            <T face="display" style={[styles.h, { color: theme.text.primary }]}>
              {es.garage.title}
            </T>
          </View>
          {FEATURE_GARAGE_V2 ? (
            <View style={styles.tools}>
              {!sorting ? (
                <View style={styles.tools} accessibilityRole="tablist">
                  {MODES.map((m) => {
                    const on = mode === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => dispatch({ type: 'mode', mode: m.key })}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        aria-selected={on}
                        accessibilityLabel={es.garageV2.modeLabel(es.garageV2.modes[m.key])}
                        hitSlop={4}
                        style={[styles.toolBtn, { backgroundColor: theme.bg.surface, borderColor: on ? theme.accent : theme.lineStrong }]}>
                        <Ionicons name={m.icon} size={15} color={on ? theme.accent : theme.text.muted} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Pressable
                onPress={() => setSorting((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ selected: sorting }}
                hitSlop={4}
                style={[styles.sortBtn, { borderColor: sorting ? theme.accent : theme.lineStrong, backgroundColor: theme.bg.surface }]}>
                <T face="title" style={{ color: sorting ? theme.accent : theme.text.secondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  {sorting ? es.garageV2.done : es.garageV2.sort}
                </T>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.countRow}>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
            {es.garage.counts(inGarage.length, ex.length)}
          </T>
          {sorting ? (
            <T face="title" style={{ color: theme.accent, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {es.garageV2.sortHint}
            </T>
          ) : null}
        </View>

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

        {!ready ? null : sorting ? (
          <View style={{ gap: space.sm }}>
            {shown.map((c) => (
              <SortRow
                key={c.vehicle.id}
                card={c}
                pinned={current.pinned === c.vehicle.id}
                canUp={canMove(current, c.vehicle.id, -1, shown.map(idOf))}
                canDown={canMove(current, c.vehicle.id, 1, shown.map(idOf))}
                onUp={() => move(shown, c, -1)}
                onDown={() => move(shown, c, 1)}
                onPin={() => dispatch({ type: 'pin', id: c.vehicle.id })}
              />
            ))}
          </View>
        ) : mode === 'covers' ? (
          shown.map((c) => (
            <CoverCard key={c.vehicle.id} card={c} pinned={current.pinned === c.vehicle.id} onPress={() => openCard(c)} />
          ))
        ) : mode === 'list' ? (
          <View style={{ gap: space.sm }}>
            {shown.map((c) => (
              <ListRow key={c.vehicle.id} card={c} pinned={current.pinned === c.vehicle.id} onPress={() => openCard(c)} />
            ))}
          </View>
        ) : shown.length ? (
          <View style={styles.grid}>
            {shown.map((c) => (
              <GridCard key={c.vehicle.id} card={c} pinned={current.pinned === c.vehicle.id} onPress={() => openCard(c)} />
            ))}
          </View>
        ) : null}

        {ready && exShown.length ? (
          <>
            <View style={[styles.brandRow, { marginTop: space.xl, marginBottom: space.sm }]}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {es.garage.exSection}
              </T>
              <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
                元愛車
              </T>
            </View>
            {exShown.map((c) =>
              sorting ? (
                <View key={c.vehicle.id} style={{ marginBottom: space.sm }}>
                  <SortRow
                    card={c}
                    canUp={canMove(current, c.vehicle.id, -1, exShown.map(idOf))}
                    canDown={canMove(current, c.vehicle.id, 1, exShown.map(idOf))}
                    onUp={() => move(exShown, c, -1)}
                    onDown={() => move(exShown, c, 1)}
                  />
                </View>
              ) : (
                <ExCard key={c.vehicle.id} card={c} onPress={() => openCard(c)} />
              ),
            )}
          </>
        ) : null}

        {ready && !shown.length && !exShown.length ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 14, marginVertical: space.xl, textAlign: 'center' }}>
            {es.garage.emptyFilter}
          </T>
        ) : null}

        {!sorting ? (
          <View style={{ marginTop: space.xl }}>
            <PrimaryButton label={es.garage.add} onPress={() => router.push('/vehiculo/nuevo')} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function title(v: VehicleRow): string {
  return [v.make, v.model].filter(Boolean).join(' ').toUpperCase() || v.name.toUpperCase();
}

/** "2015 · 1.6 NA · AT" — year, engine, gearbox. */
function specLine(v: VehicleRow): string {
  const box = v.transmission === 'manual' ? 'MT' : v.transmission === 'automatica' ? 'AT' : v.transmission === 'cvt' ? 'CVT' : null;
  return [v.year, v.engineCode, box].filter(Boolean).join(' · ');
}

/**
 * The line under the name. v6: any non-active status speaks for itself
 * ("ACCIDENTADO · desde 12 ago · esperando piezas"); a project with nothing
 * noted still counts its open tasks; an active car says what is overdue.
 */
function cardLine(card: Card): { text: string; tone: 'status' | 'overdue' | 'ok' } {
  const { vehicle, facts } = card;
  if (vehicle.status === 'proyecto' && !vehicle.statusNote && !vehicle.statusSince) {
    return { text: es.garage.projectLine(facts.openTasks), tone: 'status' };
  }
  const status = statusLine(vehicle);
  if (status) return { text: status, tone: 'status' };
  return card.overdue ? { text: es.garage.overdue(card.overdue), tone: 'overdue' } : { text: es.garage.allGood, tone: 'ok' };
}

function useLineColor(tone: ReturnType<typeof cardLine>['tone']): string {
  const { theme } = useTheme();
  return tone === 'status' ? theme.statusText.urgente : tone === 'overdue' ? theme.statusText.vencido : theme.statusText.ok;
}

/** "88 120 km · 0 mods". */
function kmLine(card: Card): string {
  const km = card.odometerKm != null ? fmtKm(Math.round(card.odometerKm)) : '—';
  return es.garageV2.km(km, es.garage.mods(card.facts.installedMods));
}

/**
 * The cover, on every card: expo-image with the blurhash while the file
 * resolves and `recyclingKey` so a reused view never flashes another car.
 * `full` for Portadas only; grid, list and Ex use the 400 px thumb.
 */
const Cover = memo(function Cover({
  card,
  height,
  full,
  children,
}: {
  card: Card;
  height: number;
  full?: boolean;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  const uri = useMediaUri(card.coverId, { thumb: !full });
  return (
    <CarbonFrame style={[styles.cover, { height, backgroundColor: theme.bg.well }]}>
      {uri || card.coverBlurhash ? (
        <Image
          source={uri ? { uri } : undefined}
          placeholder={card.coverBlurhash ? { blurhash: card.coverBlurhash } : undefined}
          placeholderContentFit="cover"
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={card.coverId ?? card.vehicle.id}
          transition={150}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.coverEmpty}>
          <Ionicons name="car-sport-outline" size={height * 0.3} color={theme.text.disabled} />
        </View>
      )}
      {children}
    </CarbonFrame>
  );
});

function PinMark() {
  const { theme } = useTheme();
  return (
    <View style={[styles.pinMark, { backgroundColor: theme.bg.base }]} accessibilityLabel={es.garageV2.pinned}>
      <Ionicons name="pin" size={12} color={theme.accent} />
    </View>
  );
}

function GalleryPill({ n }: { n: number }) {
  const { theme } = useTheme();
  if (n < 2) return null;
  return (
    <View style={[styles.galleryPill, { backgroundColor: theme.bg.base }]}>
      <T face="mono" style={{ color: theme.text.secondary, fontSize: 10 }}>
        {es.garageV2.coverCount(n)}
      </T>
    </View>
  );
}

/** Portadas: one card per car, the cover full-bleed. */
const CoverCard = memo(function CoverCard({ card, pinned, onPress }: { card: Card; pinned: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const badges = vehicleBadges(vehicle, facts);
  const kana = toKatakana(vehicle.nickname);
  const line = cardLine(card);
  const lineColor = useLineColor(line.tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${line.text}`}
      style={[styles.hero, { backgroundColor: theme.bg.surface, borderColor: pinned ? theme.accent : theme.lineStrong }]}>
      <Cover card={card} height={180} full>
        <View style={styles.badgeRow}>
          {badges.slice(0, 2).map((b) => (
            <Badge key={b.label} label={b.label} tone={b.tone} />
          ))}
        </View>
        {pinned ? <PinMark /> : null}
        <GalleryPill n={card.gallery} />
      </Cover>
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
        {/* The stats row already says what is overdue; the line is for a status. */}
        {line.tone === 'status' ? (
          <T face="medium" numberOfLines={1} style={{ color: lineColor, fontSize: 12, marginTop: 2 }}>
            {line.text}
          </T>
        ) : null}
        <View style={styles.stats}>
          <T face="mono" style={{ color: theme.text.primary, fontSize: 13 }}>
            {card.odometerKm != null ? fmtKm(Math.round(card.odometerKm)) : '—'}
          </T>
          <T face="mono" style={{ color: theme.text.primary, fontSize: 13 }}>
            {es.garage.mods(facts.installedMods)}
          </T>
          <T face="mono" style={{ color: card.overdue ? theme.statusText.vencido : theme.statusText.ok, fontSize: 13 }}>
            {card.overdue ? es.garage.overdue(card.overdue) : es.garage.allGood}
          </T>
        </View>
      </View>
    </Pressable>
  );
});

/** Cuadrícula: two-up, each with its cover thumb and one badge. */
const GridCard = memo(function GridCard({ card, pinned, onPress }: { card: Card; pinned: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const badge = vehicleBadges(vehicle, facts).at(-1);
  const line = cardLine(card);
  const lineColor = useLineColor(line.tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${line.text}`}
      style={[styles.small, { backgroundColor: theme.bg.surface, borderColor: pinned ? theme.accent : theme.lineStrong }]}>
      <Cover card={card} height={110}>
        {badge ? (
          <View style={styles.badgeRowSmall}>
            <Badge label={badge.label} tone={badge.tone} />
          </View>
        ) : null}
        {pinned ? <PinMark /> : null}
        <GalleryPill n={card.gallery} />
      </Cover>
      <View style={styles.smallBody}>
        <T face="title" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 16, letterSpacing: 0.5 }}>
          {title(vehicle)}
        </T>
        <T face="medium" numberOfLines={2} style={{ color: lineColor, fontSize: 12 }}>
          {line.text}
        </T>
        <T face="mono" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 11 }}>
          {kmLine(card)}
        </T>
      </View>
    </Pressable>
  );
});

/** Lista: a row per car — thumb, name, line, km and what is overdue. */
const ListRow = memo(function ListRow({ card, pinned, onPress }: { card: Card; pinned: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { vehicle, facts } = card;
  const badge = vehicleBadges(vehicle, facts).at(-1);
  const line = cardLine(card);
  const lineColor = useLineColor(line.tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title(vehicle)}, ${line.text}`}
      style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: pinned ? theme.accent : theme.lineStrong }]}>
      <View style={styles.rowThumb}>
        <Cover card={card} height={54} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleLine}>
          <T face="title" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 15, letterSpacing: 0.5, flexShrink: 1 }}>
            {title(vehicle)}
          </T>
          {pinned ? <Ionicons name="pin" size={11} color={theme.accent} accessibilityLabel={es.garageV2.pinned} /> : null}
        </View>
        <T face="medium" numberOfLines={1} style={{ color: lineColor, fontSize: 12 }}>
          {line.text}
        </T>
        <T face="mono" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 11 }}>
          {kmLine(card)}
        </T>
      </View>
      {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
    </Pressable>
  );
});

/** Ordenar: the same row with arrows and, in the garage section, the pin. */
function SortRow({
  card,
  pinned,
  canUp,
  canDown,
  onUp,
  onDown,
  onPin,
}: {
  card: Card;
  pinned?: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onPin?: () => void;
}) {
  const { theme } = useTheme();
  const name = title(card.vehicle);
  const arrow = (icon: 'chevron-up' | 'chevron-down', enabled: boolean, onPress: () => void, label: string) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      aria-disabled={!enabled}
      hitSlop={4}
      style={[styles.arrow, { borderColor: theme.lineStrong, backgroundColor: theme.bg.raised, opacity: enabled ? 1 : 0.35 }]}>
      <Ionicons name={icon} size={18} color={enabled ? theme.accent : theme.text.disabled} />
    </Pressable>
  );

  return (
    <View style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: pinned ? theme.accent : theme.lineStrong }]}>
      <View style={styles.sortThumb}>
        <Cover card={card} height={42} />
      </View>
      <View style={{ flex: 1 }}>
        <T face="title" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 15, letterSpacing: 0.5 }}>
          {name}
        </T>
        {onPin ? (
          <Pressable
            onPress={onPin}
            accessibilityRole="button"
            accessibilityState={{ selected: Boolean(pinned) }}
            hitSlop={6}
            style={styles.pinBtn}>
            <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={12} color={pinned ? theme.accent : theme.text.muted} />
            <T face="title" style={{ color: pinned ? theme.accent : theme.text.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              {pinned ? es.garageV2.unpin : es.garageV2.pin}
            </T>
          </Pressable>
        ) : null}
      </View>
      {pinned ? null : (
        <View style={styles.arrows}>
          {arrow('chevron-up', canUp, onUp, es.garageV2.moveUp(name))}
          {arrow('chevron-down', canDown, onDown, es.garageV2.moveDown(name))}
        </View>
      )}
    </View>
  );
}

const ExCard = memo(function ExCard({ card, onPress }: { card: Card; onPress: () => void }) {
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
        <Cover card={card} height={64} />
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
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  h: { fontSize: 34, textTransform: 'uppercase', marginTop: 2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  toolBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sortBtn: { height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  hero: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden', marginBottom: space.md },
  cover: { width: '100%', borderRadius: 0 },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.sm },
  badgeRowSmall: { position: 'absolute', top: space.sm, left: space.sm },
  pinMark: { position: 'absolute', top: space.sm, right: space.sm, width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  galleryPill: { position: 'absolute', left: space.sm, bottom: space.sm, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, opacity: 0.85 },
  heroBody: { padding: space.lg },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, gap: space.sm },
  // Fixed half width (not flexGrow), so an odd last card stays a half, not a banner.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  small: { width: '48%', borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  smallBody: { padding: space.md, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, padding: space.sm },
  rowThumb: { width: 72, borderRadius: 8, overflow: 'hidden' },
  sortThumb: { width: 56, borderRadius: 6, overflow: 'hidden' },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  arrows: { flexDirection: 'row', gap: 6 },
  arrow: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
