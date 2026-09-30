import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { useFormSkeleton } from '@/components/skeletons/FormLoading';
import { T } from '@/components/T';
import { Chip, CornerGrid, GhostButton, PrimaryButton } from '@/components/ui';
import type { Corner, CornerValues } from '@/components/ui/CornerGrid';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { wheelSets as wheelSetRepo } from '@/lib/db/repos';
import { copyToNextSession, deleteSession, eventDetail, saveSession, sessionDetail, sessionDraft, sessionTireIds, setTireUsed, usableTires, type EventDetail } from '@/lib/db/trackQueries';
import type { SetupSheet, Tire, TrackSession, WheelSet } from '@/lib/db/types';
import { parseDecimal } from '@/lib/domain/economy';
import { describeChanges, diffSheets, formatLap, isTimed, parseLap, pressureDeltas, type SheetValues } from '@/lib/domain/track';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { DaySummaryCard, disciplineLabel, shareCardImage, shareSummaryText, summaryText, venueShort } from './TrackPieces';

const KINDS: TrackSession['kind'][] = ['practica', 'clasificacion', 'batalla', 'cronometrada', 'prueba', 'pasada_drag'];
const FEELS = ['subvira', 'neutral', 'sobrevira', 'nervioso', 'lento'];

type NumKey = { [K in keyof SheetValues]-?: NonNullable<SheetValues[K]> extends number ? K : never }[keyof SheetValues];
type StrKey = { [K in keyof SheetValues]-?: NonNullable<SheetValues[K]> extends string ? K : never }[keyof SheetValues];

const cap = (c: Corner) => (c.charAt(0).toUpperCase() + c.slice(1)) as 'Fl' | 'Fr' | 'Rl' | 'Rr';
const corners = (sheet: SheetValues, prefix: 'psiCold' | 'psiHot' | 'camber'): CornerValues => ({
  fl: sheet[`${prefix}Fl`] ?? null,
  fr: sheet[`${prefix}Fr`] ?? null,
  rl: sheet[`${prefix}Rl`] ?? null,
  rr: sheet[`${prefix}Rr`] ?? null,
});
const heights = (sheet: SheetValues): CornerValues => ({ fl: sheet.rhFlMm ?? null, fr: sheet.rhFrMm ?? null, rl: sheet.rhRlMm ?? null, rr: sheet.rhRrMm ?? null });

/** A number typed as text: the text is kept while typing ("1." is not yet a number). */
function NumField({ label, value, onChange, integer }: { label: string; value: number | null | undefined; onChange: (n: number | null) => void; integer?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  return (
    <Field
      label={label}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      value={text}
      onChangeText={(x) => {
        setText(x);
        const n = x.trim() ? parseDecimal(x) : null;
        onChange(n == null || !Number.isFinite(n) ? null : integer ? Math.round(n) : n);
      }}
    />
  );
}

/** A time typed as m:ss.mmm (or seconds); invalid text keeps the old value and says how. */
function LapField({ label, value, onChange, seconds }: { label: string; value: number | null; onChange: (ms: number | null) => void; seconds?: boolean }) {
  const [text, setText] = useState(value == null ? '' : seconds ? (value / 1000).toFixed(3) : formatLap(value));
  const bad = text.trim() !== '' && parseLap(text) == null;
  return (
    <Field
      label={label}
      keyboardType="numbers-and-punctuation"
      value={text}
      error={bad ? t.track.session.lapInvalid : undefined}
      hint={bad ? t.track.session.lapInvalid : undefined}
      onChangeText={(x) => {
        setText(x);
        if (!x.trim()) onChange(null);
        else {
          const ms = parseLap(x);
          if (ms != null) onChange(ms);
        }
      }}
    />
  );
}

/**
 * A session (Pista.dc.html): the header, the setup sheet with the corner
 * grids (cold → hot, rear growth over 8 psi in red), the drift or timed block,
 * feel and notes, the live "Cambiaste desde la sesión N" note, and the day's
 * summary with COPIAR A SESIÓN N+1 · COMPARTIR RESUMEN.
 *
 * Until the session (or the new one's draft) and its event are read it is a
 * `skeleton` (the screen's twin) — at once when the screen was already showing
 * it (`skeletonContinued`).
 */
export function SessionForm({
  sessionId,
  eventId: givenEvent,
  onDone,
  skeleton,
  skeletonContinued,
}: {
  sessionId?: string;
  eventId?: string;
  onDone: () => void;
  skeleton?: ReactNode;
  skeletonContinued?: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, refresh } = useStore();
  const [loaded, setLoaded] = useState(0);
  const [eventId, setEventId] = useState(givenEvent ?? null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [previous, setPrevious] = useState<{ session: TrackSession; sheet: SetupSheet | null } | null>(null);
  const [sets, setSets] = useState<WheelSet[]>([]);
  const [count, setCount] = useState(0);
  const [tires, setTires] = useState<Tire[]>([]);
  const [usedHere, setUsedHere] = useState<Set<string>>(new Set());

  const [seq, setSeq] = useState(1);
  const [session, setSession] = useState<Partial<TrackSession>>({ kind: 'practica' });
  const [sheet, setSheet] = useState<SheetValues>({});
  const [sectors, setSectors] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let evId = givenEvent ?? null;
      if (sessionId) {
        const d = await sessionDetail(sessionId);
        if (!d || cancelled) return;
        evId = d.event.id;
        setSeq(d.session.seq);
        setSession(d.session);
        const { id: _i, sessionId: _s, createdAt: _c, updatedAt: _u, deletedAt: _d, syncedAt: _y, changedFromPrevious: _p, ...values } = d.sheet ?? ({} as SetupSheet);
        setSheet(values);
        setPrevious(d.previous);
        setCount(d.count);
        try {
          const arr = JSON.parse(d.session.sectorsMs || '[]') as unknown;
          setSectors(Array.isArray(arr) ? arr.map((ms) => formatLap(Number(ms))).join(', ') : '');
        } catch {
          setSectors('');
        }
      } else if (evId) {
        const draft = await sessionDraft(evId);
        if (cancelled) return;
        setSeq(draft.seq);
        setSheet(draft.sheet);
        setPrevious(draft.previous);
        setCount(draft.seq - 1);
        if (draft.previous) setSession({ kind: draft.previous.session.kind });
      }
      if (!evId) return;
      const ev = await eventDetail(evId);
      if (cancelled || !ev) return;
      setEventId(evId);
      setEvent(ev);
      setSets(await wheelSetRepo.listWhere({ vehicleId: ev.event.vehicleId }));
      setTires(await usableTires(ev.event.vehicleId));
      if (sessionId) setUsedHere(new Set(await sessionTireIds(sessionId)));
      setLoaded((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, givenEvent]);

  const loading = !loaded || !event || !eventId;
  const showSkeleton = useFormSkeleton(loading, skeletonContinued);
  if (loading) return showSkeleton ? (skeleton ?? <FormSkeleton />) : null;

  const discipline = event.event.discipline;
  const drift = discipline === 'drift' || discipline === 'junte';
  const timed = isTimed(discipline);
  const set = <K extends keyof SheetValues>(key: K, value: SheetValues[K]) => setSheet((s) => ({ ...s, [key]: value }));
  const num = (key: NumKey, label: string, integer?: boolean) => <NumField key={key} label={label} value={sheet[key] as number | null | undefined} onChange={(n) => set(key, n as never)} integer={integer} />;
  const text = (key: StrKey, label: string) => <Field key={key} label={label} value={(sheet[key] as string | null | undefined) ?? ''} onChangeText={(x) => set(key, (x.trim() ? x : null) as never)} />;
  const sess = <K extends keyof TrackSession>(key: K, value: TrackSession[K]) => setSession((s) => ({ ...s, [key]: value }));

  const deltas = pressureDeltas(sheet);
  const rearGrowth = Math.max(deltas.rl ?? -Infinity, deltas.rr ?? -Infinity);
  const changes = previous ? describeChanges(diffSheets(previous.sheet ?? {}, sheet)) : [];

  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
      {label}
    </T>
  );
  const pair = (a: React.ReactNode, b: React.ReactNode) => (
    <View style={styles.pair}>
      <View style={{ flex: 1 }}>{a}</View>
      <View style={{ flex: 1 }}>{b}</View>
    </View>
  );
  const card = (children: React.ReactNode) => <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>{children}</View>;

  function input(): Partial<TrackSession> & Pick<TrackSession, 'eventId' | 'seq'> {
    const sectorMs = sectors
      .split(/[,;\s]+/)
      .map((s) => parseLap(s))
      .filter((n): n is number => n != null);
    return { ...session, id: sessionId ?? session.id, eventId: eventId!, seq, sectorsMs: JSON.stringify(sectorMs), notes: (session.notes ?? '').trim() };
  }

  async function save(): Promise<TrackSession> {
    const saved = await saveSession(input(), sheet);
    setSession(saved);
    await refresh();
    return saved;
  }

  async function saveAndClose() {
    const saved = await save();
    if (!sessionId) router.replace({ pathname: '/pista/sesion/[id]', params: { id: saved.id } });
    else onDone();
  }

  async function copyNext() {
    const saved = await save();
    const next = await copyToNextSession(saved.id);
    if (next) router.replace({ pathname: '/pista/sesion/[id]', params: { id: next.id } });
  }

  async function share() {
    // Captured card first; the text goes along for WhatsApp.
    const fresh = await eventDetail(eventId!);
    if (fresh) setEvent(fresh);
    const d = fresh ?? event!;
    const vehicleName = data.vehicles.find((v) => v.id === d.event.vehicleId)?.name;
    await shareCardImage(shotRef, `pista-${d.event.occurredAt.slice(0, 10)}`);
    const copied = await shareSummaryText(summaryText(d.event, d.venue, d.summary, vehicleName));
    if (copied) setNotice(t.track.summary.copied);
  }

  function remove() {
    if (!sessionId) return;
    Alert.alert(t.track.session.delete, t.track.session.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void deleteSession(sessionId).then(refresh).then(onDone) },
    ]);
  }

  const ev = event.event;
  const stat = (label: string, value: string) => (
    <View style={[styles.stat, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
        {label}
      </T>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }} numberOfLines={2}>
        {value}
      </T>
    </View>
  );
  const weather = [ev.weather ? t.track.event.weathers[ev.weather] : null, ev.ambientC != null ? `${ev.ambientC} °C` : null].filter(Boolean).join(' · ') || '—';
  const condition = [ev.trackCondition ? t.track.event.conditions[ev.trackCondition] : null, ev.trackTempC != null ? `${ev.trackTempC} °C` : null].filter(Boolean).join(' · ') || '—';
  const vehicleName = data.vehicles.find((v) => v.id === ev.vehicleId)?.name;

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.track.session.eyebrow(venueShort(event.venue).toUpperCase(), dateLabel(ev.occurredAt).toUpperCase())}
      </T>
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.sm }}>
        {t.track.session.title(disciplineLabel(discipline), seq)}
      </T>
      <View style={styles.stats}>
        {stat(t.track.session.weather, weather)}
        {stat(t.track.session.track, condition)}
        {timed ? stat(t.track.session.best, session.bestLapMs ? formatLap(session.bestLapMs) : '—') : stat(t.track.session.runs, session.runs != null ? String(session.runs) : '—')}
      </View>

      {eyebrow(t.track.session.kind)}
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Chip key={k} label={t.track.session.kinds[k]} selected={session.kind === k} onPress={() => sess('kind', k)} />
        ))}
      </View>

      {/* Pressures, cold → hot */}
      {card(
        <>
          <View style={styles.cardHead}>
            <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 11, flex: 1 }}>
              {t.track.session.pressures}
            </T>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
              {t.track.session.coldToHot}
            </T>
          </View>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginBottom: 6 }}>
            {t.track.session.cold}
          </T>
          <CornerGrid values={corners(sheet, 'psiCold')} onChange={(c, v) => set(`psiCold${cap(c)}`, v)} />
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: space.md, marginBottom: 6 }}>
            {t.track.session.hot}
          </T>
          <CornerGrid values={corners(sheet, 'psiHot')} compare={corners(sheet, 'psiCold')} flagDelta={8} onChange={(c, v) => set(`psiHot${cap(c)}`, v)} />
          {rearGrowth > 8 ? (
            <T face="semibold" style={{ color: theme.redlineText, fontSize: 13, marginTop: space.md }}>
              {drift ? t.track.session.rearGrowth(String(Math.round(rearGrowth * 10) / 10)) : t.track.session.rearGrowthTimed(String(Math.round(rearGrowth * 10) / 10))}
            </T>
          ) : null}
          {previous ? (
            <T face="body" style={{ color: changes.length ? theme.accent : theme.text.muted, fontSize: 13, marginTop: 6 }}>
              {changes.length ? t.track.session.changed(previous.session.seq, changes.join(' · ')) : t.track.session.noChange(previous.session.seq)}
            </T>
          ) : null}
        </>,
      )}

      {eyebrow(t.track.session.tires)}
      {sets.length ? (
        <>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 4 }}>
            {t.track.session.tireSetF}
          </T>
          <View style={styles.chips}>
            {sets.map((w) => (
              <Chip key={w.id} label={w.name} selected={sheet.tireSetFId === w.id} onPress={() => set('tireSetFId', sheet.tireSetFId === w.id ? null : w.id)} />
            ))}
          </View>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 4 }}>
            {t.track.session.tireSetR}
          </T>
          <View style={styles.chips}>
            {sets.map((w) => (
              <Chip key={w.id} label={w.name} selected={sheet.tireSetRId === w.id} onPress={() => set('tireSetRId', sheet.tireSetRId === w.id ? null : w.id)} />
            ))}
          </View>
        </>
      ) : null}
      {pair(text('tireSizeF', t.track.session.sizeF), text('tireSizeR', t.track.session.sizeR))}
      {pair(text('compoundF', t.track.session.compoundF), text('compoundR', t.track.session.compoundR))}

      {sessionId && tires.length ? (
        <>
          {eyebrow(t.track.consumables.sessionTitle)}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
            {t.track.consumables.sessionHint}
          </T>
          <View style={styles.chips}>
            {tires.map((x) => {
              const on = usedHere.has(x.id);
              const label = [t.corners[x.position as 'fl'] ?? null, x.size].filter(Boolean).join(' · ') || t.inventory.tire.editTitle;
              return (
                <Chip
                  key={x.id}
                  label={on ? `✓ ${label}` : label}
                  selected={on}
                  onPress={() =>
                    void setTireUsed(ev.id, x, !on, sessionId).then(() =>
                      setUsedHere((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(x.id);
                        else next.add(x.id);
                        return next;
                      }),
                    )
                  }
                />
              );
            })}
          </View>
        </>
      ) : null}

      {eyebrow(t.track.session.alignment)}
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
        {t.track.session.camber}
      </T>
      <CornerGrid values={corners(sheet, 'camber')} unit="°" onChange={(c, v) => set(`camber${cap(c)}`, v)} />
      <View style={{ height: space.md }} />
      {pair(num('toeFMm', t.track.session.toeF), num('toeRMm', t.track.session.toeR))}
      {pair(num('casterL', t.track.session.casterL), num('casterR', t.track.session.casterR))}

      {eyebrow(t.track.session.heights)}
      <CornerGrid values={heights(sheet)} unit="mm" onChange={(c, v) => set(`rh${cap(c)}Mm`, v)} />

      {eyebrow(t.track.session.suspension)}
      {pair(num('springF', t.track.session.springF), num('springR', t.track.session.springR))}
      {pair(num('bumpF', t.track.session.bumpF, true), num('reboundF', t.track.session.reboundF, true))}
      {pair(num('bumpR', t.track.session.bumpR, true), num('reboundR', t.track.session.reboundR, true))}
      {num('clicksTotal', t.track.session.clicks, true)}
      {pair(text('swaybarF', t.track.session.swayF), text('swaybarR', t.track.session.swayR))}

      {eyebrow(t.track.session.brakes)}
      {pair(text('padF', t.track.session.padF), text('padR', t.track.session.padR))}
      {text('brakeBias', t.track.session.bias)}

      {drift ? (
        <>
          {eyebrow(t.track.session.drift)}
          {pair(num('steeringAngleDeg', t.track.session.angle), text('lsdType', t.track.session.lsd))}
          {text('lsdPreload', t.track.session.lsdPreload)}
          <View style={styles.switchRow}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
              {t.track.session.hydro}
            </T>
            <Switch value={Boolean(sheet.hydro)} onValueChange={(v) => set('hydro', v)} accessibilityLabel={t.track.session.hydro} />
          </View>
        </>
      ) : null}
      {discipline === 'drag' ? (
        <>
          {eyebrow(t.track.session.drag)}
          {pair(num('twoStepRpm', t.track.session.twoStep, true), num('revLimitRpm', t.track.session.revLimit, true))}
        </>
      ) : null}

      {timed ? (
        <>
          {eyebrow(t.track.session.timing)}
          <NumField label={t.track.session.lapsCount} value={session.laps} onChange={(n) => sess('laps', n)} integer />
          {pair(
            <LapField label={t.track.session.bestLap} value={session.bestLapMs ?? null} onChange={(ms) => sess('bestLapMs', ms)} />,
            <LapField label={t.track.session.secondLap} value={session.secondBestMs ?? null} onChange={(ms) => sess('secondBestMs', ms)} />,
          )}
          <Field label={t.track.session.sectors} value={sectors} onChangeText={setSectors} keyboardType="numbers-and-punctuation" />
          {pair(
            <LapField seconds label={t.track.session.zero100} value={session.zero100Ms ?? null} onChange={(ms) => sess('zero100Ms', ms)} />,
            <LapField seconds label={t.track.session.sixty} value={session.sixtyFootMs ?? null} onChange={(ms) => sess('sixtyFootMs', ms)} />,
          )}
          {pair(
            <LapField seconds label={t.track.session.quarter} value={session.quarterMileMs ?? null} onChange={(ms) => sess('quarterMileMs', ms)} />,
            <NumField label={t.track.session.trap} value={session.quarterMileTrapKmh} onChange={(n) => sess('quarterMileTrapKmh', n)} />,
          )}
        </>
      ) : (
        <>
          {eyebrow(t.track.session.runsBlock)}
          <NumField label={t.track.session.runsCount} value={session.runs} onChange={(n) => sess('runs', n)} integer />
        </>
      )}
      <Field label={t.track.session.incident} placeholder={t.track.session.incidentPlaceholder} value={session.incident ?? ''} onChangeText={(x) => sess('incident', x.trim() ? x : null)} />

      {eyebrow(t.track.session.feel)}
      <View style={styles.chips}>
        {FEELS.map((f) => (
          <Chip key={f} label={t.track.session.feels[f]} selected={session.carFeel === f} onPress={() => sess('carFeel', session.carFeel === f ? null : f)} />
        ))}
      </View>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => sess('rating', session.rating === n ? null : n)} accessibilityRole="button" accessibilityLabel={`${t.track.session.rating} ${n}`} accessibilityState={{ selected: (session.rating ?? 0) >= n }} hitSlop={4}>
            <Ionicons name={(session.rating ?? 0) >= n ? 'star' : 'star-outline'} size={26} color={(session.rating ?? 0) >= n ? theme.accentFill : theme.text.muted} />
          </Pressable>
        ))}
      </View>
      <Field label={t.track.session.notes} placeholder={t.track.session.notesPlaceholder} value={session.notes ?? ''} onChangeText={(x) => sess('notes', x)} multiline />
      {pair(
        <Field label={t.track.session.driver} value={session.driver ?? ''} onChangeText={(x) => sess('driver', x.trim() ? x : null)} />,
        <Field label={t.track.session.video} value={session.videoUrl ?? ''} onChangeText={(x) => sess('videoUrl', x.trim() ? x.trim() : null)} autoCapitalize="none" keyboardType="url" />,
      )}

      <PrimaryButton label={t.track.session.save} onPress={() => void saveAndClose()} />

      <View style={{ height: space.lg }} />
      <DaySummaryCard ref={shotRef} event={ev} venue={event.venue} summary={event.summary} vehicleName={vehicleName} />
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: 4 }}>
          {notice}
        </T>
      ) : null}
      <View style={[styles.pair, { marginTop: space.sm }]}>
        <GhostButton style={{ flex: 1 }} label={t.track.session.copyNext(Math.max(count, seq) + 1)} onPress={() => void copyNext()} />
        <GhostButton style={{ flex: 1 }} label={t.track.session.share} onPress={() => void share()} />
      </View>
      {sessionId ? <GhostButton danger label={t.track.session.delete} onPress={remove} /> : null}
      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.input, padding: space.sm, gap: 2 },
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, marginTop: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm },
  stars: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
});
