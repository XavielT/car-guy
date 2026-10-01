import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { MissingRecord } from '@/components/MissingRecord';
import { VehicleHubSkeleton } from '@/components/skeletons/VehicleSkeletons';
import { T } from '@/components/T';
import {
  Badge,
  CarbonFrame,
  EmptyState,
  GhostButton,
  LcdDigits,
  PrimaryButton,
  Sheet,
  StatusPill,
  Surface,
  type Tone,
} from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { garageFacts, type GarageFacts } from '@/lib/db/garageQueries';
import {
  currentOdometer as currentOdometerQuery,
  documents as documentRepo,
  mods as modRepo,
  trackedDistance,
  expenses as expenseRepo,
  fuel as fuelRepo,
  serviceRecords as serviceRecordRepo,
  vehicleSpecs as specRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import type { Vehicle, VehicleDocument, VehicleSpec, VehicleStatus } from '@/lib/db/types';
import { vehicleGallery } from '@/lib/db/tripOps';
import { statusLine } from '@/lib/domain/vehicleStatus';
import { sellVehicle, setVehicleStatus } from '@/lib/db/vehicleOps';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { isEx, ownershipLine, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import { vidaUtil, vidaUtilTone } from '@/lib/domain/legal-dr';
import { parseDecimal } from '@/lib/domain/economy';
import { FEATURE_ALBUM, FEATURE_BUILD, FEATURE_DIY, FEATURE_SHARE, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
import { dateLabel, isoFromDateInput, km as fmtKm, money, todayIsoDate } from '@/lib/format';
import { FEATURE_EVENTS } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { AlbumTab } from '@/components/album/AlbumTab';
import { EventsTab, PendingEventsBanner } from '@/components/album/EventsTab';
import { BuildSummary, BuildTab } from '@/components/build/BuildTab';
import { FichaTab } from '@/components/diy/FichaTab';
import { TrackSummaryLine, TrackTab } from '@/components/track/TrackPieces';
import { TripsHubTab } from '@/components/trips/TripPieces';
import { investedTotal } from '@/lib/domain/build';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The vehicle hub (IMP 28092026, 03-screens.md "Vehicle profile"): who the car
 * is — cover, name and nickname, badges, status, odometer, how long it has
 * been yours — and then everything about it in page tabs. Resumen and Docs
 * work now; Álbum, Build, Ficha and Pista fill in with their phases (flags).
 *
 * Selling goes through its own sheet: it closes the ownership period and asks
 * for the car's story, because an Ex is exactly the car you will want to
 * remember (the Jetta lesson).
 */
type Tab = 'resumen' | 'album' | 'eventos' | 'build' | 'ficha' | 'pista' | 'viajes' | 'docs';

const TABS: { key: Tab; flag: boolean }[] = [
  { key: 'resumen', flag: true },
  { key: 'album', flag: FEATURE_ALBUM },
  { key: 'eventos', flag: FEATURE_EVENTS },
  { key: 'build', flag: FEATURE_BUILD },
  { key: 'ficha', flag: FEATURE_DIY },
  { key: 'pista', flag: FEATURE_TRACK },
  { key: 'viajes', flag: FEATURE_TRIPS },
  { key: 'docs', flag: true },
];

const STATUS_TONE: Record<VehicleStatus, Tone> = {
  activo: 'ok',
  proyecto: 'urgente',
  en_taller: 'urgente',
  accidentado: 'urgente',
  guardado: 'neutral',
  restauracion: 'urgente',
  prestado: 'neutral',
  vendido: 'neutral',
  perdido: 'neutral',
};

export default function VehicleHubScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, setActiveVehicle, activeVehicle, data, deleteVehicle } = useStore();

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [facts, setFacts] = useState<GarageFacts | null>(null);
  const [specs, setSpecs] = useState<VehicleSpec[]>([]);
  const [docs, setDocs] = useState<VehicleDocument[]>([]);
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [totals, setTotals] = useState({ spend: 0, fillups: 0, services: 0 });
  const [specName, setSpecName] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.flag && t.key === tabParam) ? (tabParam as Tab) : 'resumen');
  const [statusOpen, setStatusOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  // An Ex opens read-only (its story is written); "Editar historia" unlocks it
  // for this visit. The album stays open to imports — that is the Jetta case.
  const [unlocked, setUnlocked] = useState(false);

  // v6: the gallery's cover (photo_media_id) leads; the older hero / favourite are the fallback.
  const coverId = vehicle?.photoMediaId ?? vehicle?.heroMediaId ?? facts?.favoriteMediaId ?? null;
  const coverUri = useMediaUri(coverId);

  // Reloads on this screen's own mutations (`version`) and on the store's
  // `data`, which changes whenever anything else writes.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const [galleryCount, setGalleryCount] = useState(0);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void vehicleGallery(id).then((items) => !cancelled && setGalleryCount(items.length));
    return () => {
      cancelled = true;
    };
  }, [id, version, data]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [v, s, km, fuels, services, expenses, driven, f, d, ms] = await Promise.all([
        vehicleRepo.getById(id),
        specRepo.listWhere({ vehicleId: id }, { orderBy: 'sort_order', direction: 'ASC' }),
        currentOdometerQuery(id),
        fuelRepo.list(id),
        serviceRecordRepo.list(id),
        expenseRepo.list(id),
        trackedDistance(id),
        garageFacts(id),
        documentRepo.list(id),
        modRepo.listWhere({ vehicleId: id }),
      ]);
      if (cancelled) return;

      setVehicle(v);
      setSpecs(s);
      setDistance(driven);
      setOdometerKm(km);
      setFacts(f);
      setDocs(d);
      setTotals({
        spend:
          fuels.reduce((t, x) => t + x.totalDop, 0) +
          services.reduce((t, r) => t + r.totalDop, 0) +
          expenses.reduce((t, e) => t + e.amountDop, 0) +
          // Mods count like Cifras does: a migrated one's record already carries its cost.
          investedTotal(ms.filter((m) => !m.serviceRecordId)),
        fillups: fuels.length,
        services: services.length,
      });
    })().catch(() => {
      // A read that failed before the first answer is a record we cannot show.
      if (!cancelled) setVehicle((prev) => (prev === undefined ? null : prev));
    });

    return () => {
      cancelled = true;
    };
  }, [id, version, data]);

  // undefined: still loading · null: looked, and it is gone. While loading,
  // the hub's outline after 150 ms (ADR-40); MissingRecord only once the read
  // answered empty. Reloads keep the loaded vehicle, so only the first load.
  const showSkeleton = useDelayedLoading(vehicle === undefined);
  if (showSkeleton) return <VehicleHubSkeleton />;
  if (vehicle === null) return <MissingRecord />;
  if (!vehicle) return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  const badges = facts ? vehicleBadges(vehicle, facts) : [];
  const kana = toKatakana(vehicle.nickname);
  // A shared car I may only view is read-only for good; an Ex until "unlocked".
  const viewer = vehicle.garageRole === 'viewer';
  const shared = vehicle.garageRole === 'editor' || viewer;
  const readOnly = viewer || (isEx(vehicle.status) && !unlocked);
  const ownedLine = ownershipLine(facts?.ownership ?? null);
  // An Ex carries its photo count: "2018 → vendido 2021 · 12 fotos".
  const owned = ownedLine && isEx(vehicle.status) && FEATURE_ALBUM ? `${ownedLine} · ${t.album.photos(facts?.photos ?? 0)}` : ownedLine;
  const subtitle = [t.vehicleTypes[vehicle.type], vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' · ');

  async function after() {
    await refresh();
    reload();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        {/* 0 — the header */}
        <View>
          <CarbonFrame style={[styles.cover, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
            {coverUri && coverId ? (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() =>
                  router.push({ pathname: '/foto/[id]', params: { id: coverId, vehicleId: vehicle.id, ...(galleryCount > 1 ? { gallery: '1' } : {}) } })
                }
                accessibilityRole="imagebutton"
                accessibilityLabel={galleryCount > 1 ? t.vehicleForm.photoN(1, galleryCount, true) : t.vehicleForm.cover}>
                <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                {galleryCount > 1 ? (
                  <View style={[styles.countPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <T face="mono" style={{ color: '#fff', fontSize: 11 }}>{`1/${galleryCount}`}</T>
                  </View>
                ) : null}
              </Pressable>
            ) : (
              <View style={styles.coverEmpty}>
                <T face="body" style={{ color: theme.text.muted }}>
                  {t.profile.noPhoto}
                </T>
              </View>
            )}
            <View style={styles.badgeRow}>
              {badges.slice(0, 2).map((b) => (
                <Badge key={b.label} label={b.label} tone={b.tone} />
              ))}
            </View>
          </CarbonFrame>

          <View style={styles.titleLine}>
            <T face="display" style={[styles.name, { color: theme.text.primary }]}>
              {vehicle.name.toUpperCase()}
            </T>
            {kana ? (
              <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
                {kana}
              </T>
            ) : null}
          </View>
          {vehicle.nickname ? (
            <T face="medium" style={{ color: theme.accent, fontSize: 14 }}>
              “{vehicle.nickname}”
            </T>
          ) : null}
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
            {subtitle}
          </T>

          <View style={styles.statusRow}>
            <StatusPill status={STATUS_TONE[vehicle.status]} label={t.vehicleStatus[vehicle.status]} />
            {/* v6: "desde 12 ago · esperando piezas" beside the pill. */}
            {vehicle.status !== 'activo' && (vehicle.statusSince || vehicle.statusNote) ? (
              <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, flexShrink: 1 }}>
                {statusLine(vehicle)?.split(' · ').slice(1).join(' · ')}
              </T>
            ) : null}
            {owned ? (
              <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, flexShrink: 1 }}>
                {owned}
              </T>
            ) : null}
          </View>

          <View style={styles.odoRow}>
          <Pressable
            onPress={() => {
              setActiveVehicle(vehicle.id);
              router.push('/odometro');
            }}
            disabled={isEx(vehicle.status)}
            accessibilityRole="button"
            accessibilityLabel={`${t.profile.currentOdometer}: ${odometerKm == null ? '—' : fmtKm(Math.round(odometerKm))}. ${t.profile.addReading}`}
            style={[styles.odo, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
            <LcdDigits value={odometerKm} height={30} />
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: 6 }}>
              {t.cluster.caption}
            </T>
          </Pressable>
          {/* Note 17: a clear way in — any status, a daily included; only a viewer cannot add. */}
          {FEATURE_BUILD && !viewer ? (
            <Pressable
              onPress={() => router.push({ pathname: '/mod/nuevo', params: { vehicleId: vehicle.id } })}
              accessibilityRole="button"
              accessibilityLabel={t.build.add}
              style={[styles.addMod, { borderColor: theme.accent }]}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 13 }}>
                {t.hub.addMod}
              </T>
            </Pressable>
          ) : null}
          </View>
        </View>

        {/* 1 — the page tabs (sticky) */}
        <View style={{ backgroundColor: theme.bg.base, paddingVertical: space.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
            {TABS.filter((tb) => tb.flag).map((tb) => {
              const on = tb.key === tab;
              return (
                <Pressable
                  key={tb.key}
                  onPress={() => setTab(tb.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  aria-selected={on}
                  style={[
                    styles.tab,
                    { borderColor: on ? theme.accentFill : theme.lineStrong, backgroundColor: on ? theme.accentFill : theme.bg.surface },
                  ]}>
                  <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t.hub.tabs[tb.key]}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2 — the tab's content */}
        <View>
          {/* Pending events: a small amber row each, over every tab (ADR-44, 03-screens.md Phase 5). */}
          {FEATURE_EVENTS ? <PendingEventsBanner vehicleId={vehicle.id} version={version} /> : null}
          {viewer ? (
            <View style={[styles.readOnly, { backgroundColor: theme.bg.surface, borderColor: theme.accent }]}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                {t.members.viewerBanner(null)}
              </T>
            </View>
          ) : readOnly ? (
            <View style={[styles.readOnly, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                {t.album.readOnly}
              </T>
              <GhostButton label={t.album.unlock} onPress={() => setUnlocked(true)} />
            </View>
          ) : shared ? (
            <View style={[styles.readOnly, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                {t.members.sharedBanner(t.members.roles.editor)}
              </T>
            </View>
          ) : null}
          {tab === 'resumen' && FEATURE_BUILD ? <BuildSummary vehicleId={vehicle.id} version={version} /> : null}
          {tab === 'resumen' && FEATURE_TRACK ? <TrackSummaryLine vehicleId={vehicle.id} version={version} /> : null}
          {tab === 'resumen' ? (
            <Resumen
              vehicle={vehicle}
              totals={totals}
              distance={distance}
              specs={specs}
              specName={specName}
              specValue={specValue}
              setSpecName={setSpecName}
              setSpecValue={setSpecValue}
              onSpecsChanged={reload}
              onWriteStory={() => setStoryOpen(true)}
              readOnly={readOnly}
            />
          ) : tab === 'album' && FEATURE_ALBUM ? (
            <AlbumTab vehicleId={vehicle.id} version={version} />
          ) : tab === 'eventos' && FEATURE_EVENTS ? (
            <EventsTab vehicleId={vehicle.id} version={version} readOnly={viewer} />
          ) : tab === 'build' && FEATURE_BUILD ? (
            <BuildTab vehicleId={vehicle.id} version={version} />
          ) : tab === 'ficha' && FEATURE_DIY ? (
            <FichaTab vehicleId={vehicle.id} version={version} />
          ) : tab === 'pista' && FEATURE_TRACK ? (
            <TrackTab vehicleId={vehicle.id} version={version} />
          ) : tab === 'viajes' && FEATURE_TRIPS ? (
            <TripsHubTab vehicleId={vehicle.id} version={version} />
          ) : tab === 'docs' ? (
            <Docs docs={docs} onOpen={(docId) => router.push({ pathname: '/documento/[id]', params: { id: docId } })} onAll={() => router.push('/documentos')} />
          ) : (
            <EmptyState icon="construct-outline" message={t.hub.soon(t.hub.tabs[tab])} />
          )}

          <View style={{ height: space.xl }} />
          {readOnly ? null : (
            <>
              <PrimaryButton
                label={t.profile.edit}
                onPress={() => router.push({ pathname: '/vehiculo/[id]/editar', params: { id: vehicle.id } })}
              />
              <GhostButton label={t.hub.changeStatus} onPress={() => setStatusOpen(true)} />
            </>
          )}
          {FEATURE_SHARE ? (
            <>
              {shared ? null : <GhostButton label={t.hub.share} onPress={() => router.push({ pathname: '/vehiculo/[id]/compartir', params: { id: vehicle.id } })} />}
              <GhostButton label={t.hub.book} onPress={() => router.push({ pathname: '/vehiculo/[id]/libro', params: { id: vehicle.id } })} />
              <GhostButton label={t.members.hub} onPress={() => router.push({ pathname: '/garaje/miembros', params: { vehicleId: vehicle.id } })} />
            </>
          ) : null}
          {activeVehicle?.id === vehicle.id || vehicle.isArchived ? null : (
            <GhostButton label={t.profile.makeActive} onPress={() => setActiveVehicle(vehicle.id)} />
          )}
          {readOnly || shared ? null : <GhostButton
            danger
            label={t.profile.remove}
            onPress={() =>
              Alert.alert(t.profile.removeConfirmTitle, t.profile.removeConfirmBody(vehicle.name), [
                { text: t.common.cancel, style: 'cancel' },
                {
                  text: t.profile.remove,
                  style: 'destructive',
                  onPress: () => {
                    // The store's delete cascades to everything the vehicle owns
                    // and moves "active" to another vehicle if needed.
                    deleteVehicle(vehicle.id);
                    router.back();
                  },
                },
              ])
            }
          />}
        </View>
      </ScrollView>

      <StatusSheet
        visible={statusOpen}
        current={vehicle.status}
        onClose={() => setStatusOpen(false)}
        onPick={(next) => {
          setStatusOpen(false);
          if (next === 'vendido') {
            setSaleOpen(true);
            return;
          }
          void setVehicleStatus(vehicle.id, next).then(after);
        }}
      />
      <SaleSheet
        visible={saleOpen}
        odometerKm={odometerKm}
        onClose={() => setSaleOpen(false)}
        onSave={(sale) => {
          setSaleOpen(false);
          void sellVehicle(vehicle.id, sale)
            .then(after)
            .then(() => setStoryOpen(true));
        }}
      />
      <StorySheet
        key={storyOpen ? 'story-open' : 'story-closed'}
        visible={storyOpen}
        initial={vehicle.story}
        sold={isEx(vehicle.status)}
        onClose={() => setStoryOpen(false)}
        onSave={(story) => {
          setStoryOpen(false);
          void vehicleRepo.upsertRaw({ id: vehicle.id, story }).then(after);
        }}
      />
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------ tabs ---

function Resumen({
  vehicle,
  totals,
  distance,
  specs,
  specName,
  specValue,
  setSpecName,
  setSpecValue,
  onSpecsChanged,
  onWriteStory,
  readOnly,
}: {
  vehicle: Vehicle;
  totals: { spend: number; fillups: number; services: number };
  distance: number | null;
  specs: VehicleSpec[];
  specName: string;
  specValue: string;
  setSpecName: (s: string) => void;
  setSpecValue: (s: string) => void;
  onSpecsChanged: () => void;
  onWriteStory: () => void;
  readOnly?: boolean;
}) {
  const { theme } = useTheme();
  // Ley 63-17 art. 41. Informational: nothing enforces it until INTRANT's
  // revisión técnica actually starts.
  const lifespan = vidaUtil(vehicle.type, vehicle.year, todayIso());

  async function addSpec() {
    if (!specName.trim() || !specValue.trim()) return;
    await specRepo.upsert({ vehicleId: vehicle.id, name: specName.trim(), value: specValue.trim(), sortOrder: specs.length });
    setSpecName('');
    setSpecValue('');
    onSpecsChanged();
  }

  return (
    <View>
      <Surface style={{ marginBottom: space.md }}>
        <T face="eyebrow" style={[styles.eyebrow, { color: theme.text.muted }]}>
          {t.hub.story}
        </T>
        {vehicle.story ? (
          <T face="body" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 21 }}>
            {vehicle.story}
          </T>
        ) : (
          <T face="body" style={{ color: theme.text.muted, fontSize: 14, lineHeight: 20 }}>
            {t.hub.storyEmpty}
          </T>
        )}
        {readOnly ? null : <GhostButton label={vehicle.story ? t.hub.editStory : t.hub.writeStory} onPress={onWriteStory} />}
      </Surface>

      <View style={styles.tiles}>
        <Tile label={t.profile.totalSpend} value={money(totals.spend)} />
        <Tile label={t.profile.kmLogged} value={distance != null ? fmtKm(Math.round(distance)) : '—'} />
        <Tile label={t.profile.fillupCount} value={String(totals.fillups)} />
        <Tile label={t.profile.serviceCount} value={String(totals.services)} />
      </View>

      <Surface style={{ marginBottom: space.md }}>
        <T face="eyebrow" style={[styles.eyebrow, { color: theme.text.muted }]}>
          {t.legal.vidaUtilTitle}
        </T>
        <StatusPill status={vidaUtilTone(lifespan)} label={t.legal.vidaUtil(lifespan.limitYears, lifespan.remainingYears)} />
        {lifespan.age == null ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
            {t.legal.vidaUtilNoYear}
          </T>
        ) : null}
        <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
          {t.legal.revisionTecnica}
        </T>
      </Surface>

      <T face="eyebrow" style={[styles.section, { color: theme.text.muted }]}>
        {t.profile.specs}
      </T>
      {specs.length === 0 ? (
        <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
          {t.profile.specsEmpty}
        </T>
      ) : (
        specs.map((spec) => (
          <View key={spec.id} style={[styles.specRow, { borderColor: theme.line }]}>
            <T face="body" style={{ color: theme.text.secondary, flex: 1 }}>
              {spec.name}
            </T>
            <T face="mono" style={{ color: theme.text.primary }}>
              {spec.value}
            </T>
            {readOnly ? null : <Pressable
              onPress={() => void specRepo.softDelete(spec.id).then(onSpecsChanged)}
              accessibilityRole="button"
              accessibilityLabel={t.common.removeItem(spec.name)}
              style={styles.specRemove}>
              <T face="body" style={{ color: theme.text.muted }}>
                ×
              </T>
            </Pressable>}
          </View>
        ))
      )}

      {readOnly ? null : (
        <>
      <View style={styles.suggestions}>
        {t.specSuggestions.filter((s) => !specs.some((x) => x.name === s)).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSpecName(s)}
            accessibilityRole="button"
            style={[styles.suggestion, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
              {s}
            </T>
          </Pressable>
        ))}
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={t.profile.specName} value={specName} onChangeText={setSpecName} />
        </View>
        <View style={styles.half}>
          <Field label={t.profile.specValue} value={specValue} onChangeText={setSpecValue} />
        </View>
      </View>
      <GhostButton label={t.profile.addSpec} onPress={() => void addSpec()} />
        </>
      )}
    </View>
  );
}

function Docs({ docs, onOpen, onAll }: { docs: VehicleDocument[]; onOpen: (id: string) => void; onAll: () => void }) {
  const { theme } = useTheme();
  const today = todayIso();
  if (!docs.length) {
    return <EmptyState icon="document-text-outline" message={t.hub.docsEmpty} actionLabel={t.hub.docsAll} onAction={onAll} />;
  }
  return (
    <View style={{ gap: space.sm }}>
      {docs.map((d) => {
        const days = d.expiresAt ? daysBetween(today, d.expiresAt) : null;
        return (
          <Pressable
            key={d.id}
            onPress={() => onOpen(d.id)}
            accessibilityRole="button"
            style={[styles.docRow, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {d.title || t.documents.kinds[d.kind]}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {d.expiresAt ? t.hub.docExpires(dateLabel(d.expiresAt)) : t.documents.kinds[d.kind]}
              </T>
            </View>
            {days != null ? (
              <StatusPill status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'} label={days < 0 ? t.hub.expired : `${days} d`} />
            ) : null}
          </Pressable>
        );
      })}
      <GhostButton label={t.hub.docsAll} onPress={onAll} />
    </View>
  );
}

// ---------------------------------------------------------------- sheets ---

const PICKABLE: VehicleStatus[] = ['activo', 'proyecto', 'en_taller', 'accidentado', 'guardado', 'restauracion', 'prestado', 'vendido'];

function StatusSheet({
  visible,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: VehicleStatus;
  onClose: () => void;
  onPick: (s: VehicleStatus) => void;
}) {
  const { theme } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t.hub.changeStatus}>
      <ScrollView style={{ maxHeight: 460 }}>
        {PICKABLE.filter((s) => s !== current).map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            accessibilityRole="button"
            style={[styles.option, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
              {t.vehicleStatus[s]}
            </T>
            <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: 2 }}>
              {t.hub.statusHint[s as keyof typeof t.hub.statusHint]}
            </T>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function SaleSheet({
  visible,
  odometerKm,
  onClose,
  onSave,
}: {
  visible: boolean;
  odometerKm: number | null;
  onClose: () => void;
  onSave: (sale: { soldAt: string; soldKm: number | null; soldPrice: number | null; soldTo: string | null; reason: string | null }) => void;
}) {
  const [date, setDate] = useState(todayIsoDate());
  const [km, setKm] = useState('');
  const [price, setPrice] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  function save() {
    const parsedKm = km.trim() ? parseDecimal(km) : null;
    if (km.trim() && parsedKm == null) return setError(t.common.invalidNumber(t.hub.saleKm));
    if (parsedKm != null && odometerKm != null && parsedKm < odometerKm) return setError(t.hub.saleKmBelow(fmtKm(Math.round(odometerKm))));
    const parsedPrice = price.trim() ? parseDecimal(price) : null;
    if (price.trim() && parsedPrice == null) return setError(t.common.invalidNumber(t.hub.salePrice));
    setError(null);
    onSave({ soldAt: isoFromDateInput(date), soldKm: parsedKm, soldPrice: parsedPrice, soldTo: to.trim() || null, reason: reason.trim() || null });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t.hub.saleTitle}>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md, lineHeight: 19 }}>
        {t.hub.saleBody}
      </T>
      <DateField label={t.hub.saleDate} value={date} onChange={setDate} noFuture />
      <Field label={t.hub.saleKm} keyboardType="number-pad" placeholder={odometerKm != null ? String(Math.round(odometerKm)) : ''} value={km} onChangeText={setKm} />
      <Field label={t.hub.salePrice} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <Field label={t.hub.saleTo} value={to} onChangeText={setTo} />
      <Field label={t.hub.saleReason} value={reason} onChangeText={setReason} />
      {error ? (
        <T face="body" accessibilityRole="alert" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.md }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.hub.saleSave} onPress={save} />
    </Sheet>
  );
}

function StorySheet({
  visible,
  initial,
  sold,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: string;
  sold: boolean;
  onClose: () => void;
  onSave: (story: string) => void;
}) {
  // Remounted on every open (see the `key` at its call site), so it always
  // starts from the saved story.
  const [story, setStory] = useState(initial);
  const { theme } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t.hub.storyTitle}>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md, lineHeight: 19 }}>
        {sold ? t.hub.storyPromptSold : t.hub.storyPrompt}
      </T>
      <Field label={t.vehicle.story} placeholder={t.vehicle.storyPlaceholder} value={story} onChangeText={setStory} multiline />
      <PrimaryButton label={t.hub.storySave} onPress={() => onSave(story.trim())} />
    </Sheet>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 16 }}>
        {value}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.md },
  pad: { padding: space.gutter, paddingBottom: 40 },
  cover: { width: '100%', height: 180, borderRadius: radius.card, borderWidth: 1, marginBottom: space.lg },
  countPill: { position: 'absolute', right: space.sm, bottom: space.sm, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.sm },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  name: { fontSize: 28 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, flexWrap: 'wrap' },
  odoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  addMod: { borderWidth: 1, borderRadius: radius.tag, paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center', marginBottom: space.sm },
  odo: { alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md, marginBottom: space.sm },
  tab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.tag, borderWidth: 1, marginRight: space.sm },
  eyebrow: { fontSize: 11, marginBottom: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: radius.input, padding: space.md },
  section: { fontSize: 11, marginTop: space.md, marginBottom: space.sm },
  empty: { fontSize: 13, lineHeight: 18, marginBottom: space.md },
  specRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1 },
  specRemove: { paddingHorizontal: space.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: space.md },
  suggestion: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.sm, paddingVertical: 4 },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, padding: space.md },
  option: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm, minHeight: 56 },
});
