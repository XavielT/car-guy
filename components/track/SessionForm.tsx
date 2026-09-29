import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, CornerGrid, GhostButton, PrimaryButton } from '@/components/ui';
import type { Corner, CornerValues } from '@/components/ui/CornerGrid';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { wheelSets as wheelSetRepo } from '@/lib/db/repos';
import { copyToNextSession, deleteSession, eventDetail, saveSession, sessionDetail, sessionDraft, sessionTireIds, setTireUsed, usableTires, type EventDetail } from '@/lib/db/trackQueries';
import type { SetupSheet, Tire, TrackSession, WheelSet } from '@/lib/db/types';
import { parseDecimal } from '@/lib/domain/economy';
import { describeChanges, diffSheets, formatLap, isTimed, parseLap, pressureDeltas, type SheetValues } from '@/lib/domain/track';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
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
      onChangeText={(t) => {
        setText(t);
        const n = t.trim() ? parseDecimal(t) : null;
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
      error={bad ? es.track.session.lapInvalid : undefined}
      hint={bad ? es.track.session.lapInvalid : undefined}
      onChangeText={(t) => {
        setText(t);
        if (!t.trim()) onChange(null);
        else {
          const ms = parseLap(t);
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
 */
export function SessionForm({ sessionId, eventId: givenEvent, onDone }: { sessionId?: string; eventId?: string; onDone: () => void }) {
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

  if (!loaded || !event || !eventId) return null;

  const discipline = event.event.discipline;
  const drift = discipline === 'drift' || discipline === 'junte';
  const timed = isTimed(discipline);
  const set = <K extends keyof SheetValues>(key: K, value: SheetValues[K]) => setSheet((s) => ({ ...s, [key]: value }));
  const num = (key: NumKey, label: string, integer?: boolean) => <NumField key={key} label={label} value={sheet[key] as number | null | undefined} onChange={(n) => set(key, n as never)} integer={integer} />;
  const text = (key: StrKey, label: string) => <Field key={key} label={label} value={(sheet[key] as string | null | undefined) ?? ''} onChangeText={(t) => set(key, (t.trim() ? t : null) as never)} />;
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
    if (copied) setNotice(es.track.summary.copied);
  }

  function remove() {
    if (!sessionId) return;
    Alert.alert(es.track.session.delete, es.track.session.deleteBody, [
      { text: es.common.cancel, style: 'cancel' },
      { text: es.common.delete, style: 'destructive', onPress: () => void deleteSession(sessionId).then(refresh).then(onDone) },
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
  const weather = [ev.weather ? es.track.event.weathers[ev.weather] : null, ev.ambientC != null ? `${ev.ambientC} °C` : null].filter(Boolean).join(' · ') || '—';
  const condition = [ev.trackCondition ? es.track.event.conditions[ev.trackCondition] : null, ev.trackTempC != null ? `${ev.trackTempC} °C` : null].filter(Boolean).join(' · ') || '—';
  const vehicleName = data.vehicles.find((v) => v.id === ev.vehicleId)?.name;

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.track.session.eyebrow(venueShort(event.venue).toUpperCase(), dateLabel(ev.occurredAt).toUpperCase())}
      </T>
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.sm }}>
        {es.track.session.title(disciplineLabel(discipline), seq)}
      </T>
      <View style={styles.stats}>
        {stat(es.track.session.weather, weather)}
        {stat(es.track.session.track, condition)}
        {timed ? stat(es.track.session.best, session.bestLapMs ? formatLap(session.bestLapMs) : '—') : stat(es.track.session.runs, session.runs != null ? String(session.runs) : '—')}
      </View>

      {eyebrow(es.track.session.kind)}
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Chip key={k} label={es.track.session.kinds[k]} selected={session.kind === k} onPress={() => sess('kind', k)} />
        ))}
      </View>

      {/* Pressures, cold → hot */}
      {card(
        <>
          <View style={styles.cardHead}>
            <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 11, flex: 1 }}>
              {es.track.session.pressures}
            </T>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
              {es.track.session.coldToHot}
            </T>
          </View>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginBottom: 6 }}>
            {es.track.session.cold}
          </T>
          <CornerGrid values={corners(sheet, 'psiCold')} onChange={(c, v) => set(`psiCold${cap(c)}`, v)} />
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: space.md, marginBottom: 6 }}>
            {es.track.session.hot}
          </T>
          <CornerGrid values={corners(sheet, 'psiHot')} compare={corners(sheet, 'psiCold')} flagDelta={8} onChange={(c, v) => set(`psiHot${cap(c)}`, v)} />
          {rearGrowth > 8 ? (
            <T face="semibold" style={{ color: theme.redlineText, fontSize: 13, marginTop: space.md }}>
              {drift ? es.track.session.rearGrowth(String(Math.round(rearGrowth * 10) / 10)) : es.track.session.rearGrowthTimed(String(Math.round(rearGrowth * 10) / 10))}
            </T>
          ) : null}
          {previous ? (
            <T face="body" style={{ color: changes.length ? theme.accent : theme.text.muted, fontSize: 13, marginTop: 6 }}>
              {changes.length ? es.track.session.changed(previous.session.seq, changes.join(' · ')) : es.track.session.noChange(previous.session.seq)}
            </T>
          ) : null}
        </>,
      )}

      {eyebrow(es.track.session.tires)}
      {sets.length ? (
        <>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 4 }}>
            {es.track.session.tireSetF}
          </T>
          <View style={styles.chips}>
            {sets.map((w) => (
              <Chip key={w.id} label={w.name} selected={sheet.tireSetFId === w.id} onPress={() => set('tireSetFId', sheet.tireSetFId === w.id ? null : w.id)} />
            ))}
          </View>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 4 }}>
            {es.track.session.tireSetR}
          </T>
          <View style={styles.chips}>
            {sets.map((w) => (
              <Chip key={w.id} label={w.name} selected={sheet.tireSetRId === w.id} onPress={() => set('tireSetRId', sheet.tireSetRId === w.id ? null : w.id)} />
            ))}
          </View>
        </>
      ) : null}
      {pair(text('tireSizeF', es.track.session.sizeF), text('tireSizeR', es.track.session.sizeR))}
      {pair(text('compoundF', es.track.session.compoundF), text('compoundR', es.track.session.compoundR))}

      {sessionId && tires.length ? (
        <>
          {eyebrow(es.track.consumables.sessionTitle)}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
            {es.track.consumables.sessionHint}
          </T>
          <View style={styles.chips}>
            {tires.map((t) => {
              const on = usedHere.has(t.id);
              const label = [es.corners[t.position as 'fl'] ?? null, t.size].filter(Boolean).join(' · ') || es.inventory.tire.editTitle;
              return (
                <Chip
                  key={t.id}
                  label={on ? `✓ ${label}` : label}
                  selected={on}
                  onPress={() =>
                    void setTireUsed(ev.id, t, !on, sessionId).then(() =>
                      setUsedHere((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(t.id);
                        else next.add(t.id);
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

      {eyebrow(es.track.session.alignment)}
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
        {es.track.session.camber}
      </T>
      <CornerGrid values={corners(sheet, 'camber')} unit="°" onChange={(c, v) => set(`camber${cap(c)}`, v)} />
      <View style={{ height: space.md }} />
      {pair(num('toeFMm', es.track.session.toeF), num('toeRMm', es.track.session.toeR))}
      {pair(num('casterL', es.track.session.casterL), num('casterR', es.track.session.casterR))}

      {eyebrow(es.track.session.heights)}
      <CornerGrid values={heights(sheet)} unit="mm" onChange={(c, v) => set(`rh${cap(c)}Mm`, v)} />

      {eyebrow(es.track.session.suspension)}
      {pair(num('springF', es.track.session.springF), num('springR', es.track.session.springR))}
      {pair(num('bumpF', es.track.session.bumpF, true), num('reboundF', es.track.session.reboundF, true))}
      {pair(num('bumpR', es.track.session.bumpR, true), num('reboundR', es.track.session.reboundR, true))}
      {num('clicksTotal', es.track.session.clicks, true)}
      {pair(text('swaybarF', es.track.session.swayF), text('swaybarR', es.track.session.swayR))}

      {eyebrow(es.track.session.brakes)}
      {pair(text('padF', es.track.session.padF), text('padR', es.track.session.padR))}
      {text('brakeBias', es.track.session.bias)}

      {drift ? (
        <>
          {eyebrow(es.track.session.drift)}
          {pair(num('steeringAngleDeg', es.track.session.angle), text('lsdType', es.track.session.lsd))}
          {text('lsdPreload', es.track.session.lsdPreload)}
          <View style={styles.switchRow}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
              {es.track.session.hydro}
            </T>
            <Switch value={Boolean(sheet.hydro)} onValueChange={(v) => set('hydro', v)} accessibilityLabel={es.track.session.hydro} />
          </View>
        </>
      ) : null}
      {discipline === 'drag' ? (
        <>
          {eyebrow(es.track.session.drag)}
          {pair(num('twoStepRpm', es.track.session.twoStep, true), num('revLimitRpm', es.track.session.revLimit, true))}
        </>
      ) : null}

      {timed ? (
        <>
          {eyebrow(es.track.session.timing)}
          <NumField label={es.track.session.lapsCount} value={session.laps} onChange={(n) => sess('laps', n)} integer />
          {pair(
            <LapField label={es.track.session.bestLap} value={session.bestLapMs ?? null} onChange={(ms) => sess('bestLapMs', ms)} />,
            <LapField label={es.track.session.secondLap} value={session.secondBestMs ?? null} onChange={(ms) => sess('secondBestMs', ms)} />,
          )}
          <Field label={es.track.session.sectors} value={sectors} onChangeText={setSectors} keyboardType="numbers-and-punctuation" />
          {pair(
            <LapField seconds label={es.track.session.zero100} value={session.zero100Ms ?? null} onChange={(ms) => sess('zero100Ms', ms)} />,
            <LapField seconds label={es.track.session.sixty} value={session.sixtyFootMs ?? null} onChange={(ms) => sess('sixtyFootMs', ms)} />,
          )}
          {pair(
            <LapField seconds label={es.track.session.quarter} value={session.quarterMileMs ?? null} onChange={(ms) => sess('quarterMileMs', ms)} />,
            <NumField label={es.track.session.trap} value={session.quarterMileTrapKmh} onChange={(n) => sess('quarterMileTrapKmh', n)} />,
          )}
        </>
      ) : (
        <>
          {eyebrow(es.track.session.runsBlock)}
          <NumField label={es.track.session.runsCount} value={session.runs} onChange={(n) => sess('runs', n)} integer />
        </>
      )}
      <Field label={es.track.session.incident} placeholder={es.track.session.incidentPlaceholder} value={session.incident ?? ''} onChangeText={(t) => sess('incident', t.trim() ? t : null)} />

      {eyebrow(es.track.session.feel)}
      <View style={styles.chips}>
        {FEELS.map((f) => (
          <Chip key={f} label={es.track.session.feels[f]} selected={session.carFeel === f} onPress={() => sess('carFeel', session.carFeel === f ? null : f)} />
        ))}
      </View>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => sess('rating', session.rating === n ? null : n)} accessibilityRole="button" accessibilityLabel={`${es.track.session.rating} ${n}`} accessibilityState={{ selected: (session.rating ?? 0) >= n }} hitSlop={4}>
            <Ionicons name={(session.rating ?? 0) >= n ? 'star' : 'star-outline'} size={26} color={(session.rating ?? 0) >= n ? theme.accentFill : theme.text.muted} />
          </Pressable>
        ))}
      </View>
      <Field label={es.track.session.notes} placeholder={es.track.session.notesPlaceholder} value={session.notes ?? ''} onChangeText={(t) => sess('notes', t)} multiline />
      {pair(
        <Field label={es.track.session.driver} value={session.driver ?? ''} onChangeText={(t) => sess('driver', t.trim() ? t : null)} />,
        <Field label={es.track.session.video} value={session.videoUrl ?? ''} onChangeText={(t) => sess('videoUrl', t.trim() ? t.trim() : null)} autoCapitalize="none" keyboardType="url" />,
      )}

      <PrimaryButton label={es.track.session.save} onPress={() => void saveAndClose()} />

      <View style={{ height: space.lg }} />
      <DaySummaryCard ref={shotRef} event={ev} venue={event.venue} summary={event.summary} vehicleName={vehicleName} />
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: 4 }}>
          {notice}
        </T>
      ) : null}
      <View style={[styles.pair, { marginTop: space.sm }]}>
        <GhostButton style={{ flex: 1 }} label={es.track.session.copyNext(Math.max(count, seq) + 1)} onPress={() => void copyNext()} />
        <GhostButton style={{ flex: 1 }} label={es.track.session.share} onPress={() => void share()} />
      </View>
      {sessionId ? <GhostButton danger label={es.track.session.delete} onPress={remove} /> : null}
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
