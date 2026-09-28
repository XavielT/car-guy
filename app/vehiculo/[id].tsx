import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { MissingRecord } from '@/components/MissingRecord';
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
import { garageFacts, type GarageFacts } from '@/lib/db/garageQueries';
import {
  currentOdometer as currentOdometerQuery,
  documents as documentRepo,
  trackedDistance,
  expenses as expenseRepo,
  fuel as fuelRepo,
  serviceRecords as serviceRecordRepo,
  vehicleSpecs as specRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import type { Vehicle, VehicleDocument, VehicleSpec, VehicleStatus } from '@/lib/db/types';
import { sellVehicle, setVehicleStatus } from '@/lib/db/vehicleOps';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { isEx, ownershipLine, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import { vidaUtil, vidaUtilTone } from '@/lib/domain/legal-dr';
import { parseDecimal } from '@/lib/domain/economy';
import { FEATURE_ALBUM, FEATURE_BUILD, FEATURE_DIY, FEATURE_SHARE, FEATURE_TRACK } from '@/lib/flags';
import { dateLabel, isoFromDateInput, km as fmtKm, money, todayIsoDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { AlbumTab } from '@/components/album/AlbumTab';
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
type Tab = 'resumen' | 'album' | 'build' | 'ficha' | 'pista' | 'docs';

const TABS: { key: Tab; flag: boolean }[] = [
  { key: 'resumen', flag: true },
  { key: 'album', flag: FEATURE_ALBUM },
  { key: 'build', flag: FEATURE_BUILD },
  { key: 'ficha', flag: FEATURE_DIY },
  { key: 'pista', flag: FEATURE_TRACK },
  { key: 'docs', flag: true },
];

const STATUS_TONE: Record<VehicleStatus, Tone> = {
  activo: 'ok',
  proyecto: 'urgente',
  guardado: 'neutral',
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
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'resumen');
  const [statusOpen, setStatusOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  // An Ex opens read-only (its story is written); "Editar historia" unlocks it
  // for this visit. The album stays open to imports — that is the Jetta case.
  const [unlocked, setUnlocked] = useState(false);

  const coverUri = useMediaUri(vehicle?.heroMediaId ?? facts?.favoriteMediaId ?? vehicle?.photoMediaId);

  // Reloads on this screen's own mutations (`version`) and on the store's
  // `data`, which changes whenever anything else writes.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [v, s, km, fuels, services, expenses, driven, f, d] = await Promise.all([
        vehicleRepo.getById(id),
        specRepo.listWhere({ vehicleId: id }, { orderBy: 'sort_order', direction: 'ASC' }),
        currentOdometerQuery(id),
        fuelRepo.list(id),
        serviceRecordRepo.list(id),
        expenseRepo.list(id),
        trackedDistance(id),
        garageFacts(id),
        documentRepo.list(id),
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
          expenses.reduce((t, e) => t + e.amountDop, 0),
        fillups: fuels.length,
        services: services.length,
      });
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, version, data]);

  // undefined: still loading · null: looked, and it is gone.
  if (vehicle === null) return <MissingRecord />;
  if (!vehicle) return null;

  const badges = facts ? vehicleBadges(vehicle, facts) : [];
  const kana = toKatakana(vehicle.nickname);
  const readOnly = isEx(vehicle.status) && !unlocked;
  const ownedLine = ownershipLine(facts?.ownership ?? null);
  // An Ex carries its photo count: "2018 → vendido 2021 · 12 fotos".
  const owned = ownedLine && isEx(vehicle.status) && FEATURE_ALBUM ? `${ownedLine} · ${es.album.photos(facts?.photos ?? 0)}` : ownedLine;
  const subtitle = [es.vehicleTypes[vehicle.type], vehicle.year, vehicle.make, vehicle.model]
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
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <View style={styles.coverEmpty}>
                <T face="body" style={{ color: theme.text.muted }}>
                  {es.profile.noPhoto}
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
            <StatusPill status={STATUS_TONE[vehicle.status]} label={es.vehicleStatus[vehicle.status]} />
            {owned ? (
              <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, flexShrink: 1 }}>
                {owned}
              </T>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              setActiveVehicle(vehicle.id);
              router.push('/odometro');
            }}
            disabled={isEx(vehicle.status)}
            accessibilityRole="button"
            accessibilityLabel={`${es.profile.currentOdometer}: ${odometerKm == null ? '—' : fmtKm(Math.round(odometerKm))}. ${es.profile.addReading}`}
            style={[styles.odo, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
            <LcdDigits value={odometerKm} height={30} />
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: 6 }}>
              {es.cluster.caption}
            </T>
          </Pressable>
        </View>

        {/* 1 — the page tabs (sticky) */}
        <View style={{ backgroundColor: theme.bg.base, paddingVertical: space.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  aria-selected={on}
                  style={[
                    styles.tab,
                    { borderColor: on ? theme.accentFill : theme.lineStrong, backgroundColor: on ? theme.accentFill : theme.bg.surface },
                  ]}>
                  <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {es.hub.tabs[t.key]}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2 — the tab's content */}
        <View>
          {readOnly ? (
            <View style={[styles.readOnly, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
                {es.album.readOnly}
              </T>
              <GhostButton label={es.album.unlock} onPress={() => setUnlocked(true)} />
            </View>
          ) : null}
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
          ) : tab === 'docs' ? (
            <Docs docs={docs} onOpen={(docId) => router.push({ pathname: '/documento/[id]', params: { id: docId } })} onAll={() => router.push('/documentos')} />
          ) : (
            <EmptyState icon="construct-outline" message={es.hub.soon(es.hub.tabs[tab])} />
          )}

          <View style={{ height: space.xl }} />
          {readOnly ? null : (
            <>
              <PrimaryButton
                label={es.profile.edit}
                onPress={() => router.push({ pathname: '/vehiculo/[id]/editar', params: { id: vehicle.id } })}
              />
              <GhostButton label={es.hub.changeStatus} onPress={() => setStatusOpen(true)} />
            </>
          )}
          {FEATURE_SHARE ? (
            <>
              <GhostButton label={es.hub.share} onPress={() => {}} />
              <GhostButton label={es.hub.book} onPress={() => {}} />
            </>
          ) : null}
          {activeVehicle?.id === vehicle.id || vehicle.isArchived ? null : (
            <GhostButton label={es.profile.makeActive} onPress={() => setActiveVehicle(vehicle.id)} />
          )}
          {readOnly ? null : <GhostButton
            danger
            label={es.profile.remove}
            onPress={() =>
              Alert.alert(es.profile.removeConfirmTitle, es.profile.removeConfirmBody(vehicle.name), [
                { text: es.common.cancel, style: 'cancel' },
                {
                  text: es.profile.remove,
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
          {es.hub.story}
        </T>
        {vehicle.story ? (
          <T face="body" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 21 }}>
            {vehicle.story}
          </T>
        ) : (
          <T face="body" style={{ color: theme.text.muted, fontSize: 14, lineHeight: 20 }}>
            {es.hub.storyEmpty}
          </T>
        )}
        {readOnly ? null : <GhostButton label={vehicle.story ? es.hub.editStory : es.hub.writeStory} onPress={onWriteStory} />}
      </Surface>

      <View style={styles.tiles}>
        <Tile label={es.profile.totalSpend} value={money(totals.spend)} />
        <Tile label={es.profile.kmLogged} value={distance != null ? fmtKm(Math.round(distance)) : '—'} />
        <Tile label={es.profile.fillupCount} value={String(totals.fillups)} />
        <Tile label={es.profile.serviceCount} value={String(totals.services)} />
      </View>

      <Surface style={{ marginBottom: space.md }}>
        <T face="eyebrow" style={[styles.eyebrow, { color: theme.text.muted }]}>
          {es.legal.vidaUtilTitle}
        </T>
        <StatusPill status={vidaUtilTone(lifespan)} label={es.legal.vidaUtil(lifespan.limitYears, lifespan.remainingYears)} />
        {lifespan.age == null ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
            {es.legal.vidaUtilNoYear}
          </T>
        ) : null}
        <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
          {es.legal.revisionTecnica}
        </T>
      </Surface>

      <T face="eyebrow" style={[styles.section, { color: theme.text.muted }]}>
        {es.profile.specs}
      </T>
      {specs.length === 0 ? (
        <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
          {es.profile.specsEmpty}
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
              accessibilityLabel={es.common.removeItem(spec.name)}
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
        {es.specSuggestions.filter((s) => !specs.some((x) => x.name === s)).map((s) => (
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
          <Field label={es.profile.specName} value={specName} onChangeText={setSpecName} />
        </View>
        <View style={styles.half}>
          <Field label={es.profile.specValue} value={specValue} onChangeText={setSpecValue} />
        </View>
      </View>
      <GhostButton label={es.profile.addSpec} onPress={() => void addSpec()} />
        </>
      )}
    </View>
  );
}

function Docs({ docs, onOpen, onAll }: { docs: VehicleDocument[]; onOpen: (id: string) => void; onAll: () => void }) {
  const { theme } = useTheme();
  const today = todayIso();
  if (!docs.length) {
    return <EmptyState icon="document-text-outline" message={es.hub.docsEmpty} actionLabel={es.hub.docsAll} onAction={onAll} />;
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
                {d.title || es.documents.kinds[d.kind]}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {d.expiresAt ? es.hub.docExpires(dateLabel(d.expiresAt)) : es.documents.kinds[d.kind]}
              </T>
            </View>
            {days != null ? (
              <StatusPill status={days < 0 ? 'vencido' : days <= 45 ? 'proximo' : 'ok'} label={days < 0 ? es.hub.expired : `${days} d`} />
            ) : null}
          </Pressable>
        );
      })}
      <GhostButton label={es.hub.docsAll} onPress={onAll} />
    </View>
  );
}

// ---------------------------------------------------------------- sheets ---

const PICKABLE: VehicleStatus[] = ['activo', 'proyecto', 'guardado', 'vendido'];

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
    <Sheet visible={visible} onClose={onClose} title={es.hub.changeStatus}>
      {PICKABLE.filter((s) => s !== current).map((s) => (
        <Pressable
          key={s}
          onPress={() => onPick(s)}
          accessibilityRole="button"
          style={[styles.option, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
            {es.vehicleStatus[s]}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: 2 }}>
            {es.hub.statusHint[s as keyof typeof es.hub.statusHint]}
          </T>
        </Pressable>
      ))}
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
    if (km.trim() && parsedKm == null) return setError(es.common.invalidNumber(es.hub.saleKm));
    if (parsedKm != null && odometerKm != null && parsedKm < odometerKm) return setError(es.hub.saleKmBelow(fmtKm(Math.round(odometerKm))));
    const parsedPrice = price.trim() ? parseDecimal(price) : null;
    if (price.trim() && parsedPrice == null) return setError(es.common.invalidNumber(es.hub.salePrice));
    setError(null);
    onSave({ soldAt: isoFromDateInput(date), soldKm: parsedKm, soldPrice: parsedPrice, soldTo: to.trim() || null, reason: reason.trim() || null });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={es.hub.saleTitle}>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md, lineHeight: 19 }}>
        {es.hub.saleBody}
      </T>
      <DateField label={es.hub.saleDate} value={date} onChange={setDate} noFuture />
      <Field label={es.hub.saleKm} keyboardType="number-pad" placeholder={odometerKm != null ? String(Math.round(odometerKm)) : ''} value={km} onChangeText={setKm} />
      <Field label={es.hub.salePrice} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <Field label={es.hub.saleTo} value={to} onChangeText={setTo} />
      <Field label={es.hub.saleReason} value={reason} onChangeText={setReason} />
      {error ? (
        <T face="body" accessibilityRole="alert" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.md }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={es.hub.saleSave} onPress={save} />
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
    <Sheet visible={visible} onClose={onClose} title={es.hub.storyTitle}>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.md, lineHeight: 19 }}>
        {sold ? es.hub.storyPromptSold : es.hub.storyPrompt}
      </T>
      <Field label={es.vehicle.story} placeholder={es.vehicle.storyPlaceholder} value={story} onChangeText={setStory} multiline />
      <PrimaryButton label={es.hub.storySave} onPress={() => onSave(story.trim())} />
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
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.sm },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  name: { fontSize: 28 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, flexWrap: 'wrap' },
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
