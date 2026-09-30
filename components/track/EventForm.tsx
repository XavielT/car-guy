import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import {
  addVenue,
  burnTire,
  deleteEvent,
  eventDetail,
  eventPhotos,
  listVenues,
  measurePads,
  padStatus,
  saveEvent,
  setTireUsed,
  usableTires,
  type Axle,
  type EventDetail,
} from '@/lib/db/trackQueries';
import { tires as tireRepo } from '@/lib/db/repos';
import type { Tire, TrackDiscipline, TrackEvent, Venue } from '@/lib/db/types';
import { parseDecimal } from '@/lib/domain/economy';
import { formatLap, isTimed, type PadLife } from '@/lib/domain/track';
import { dateInputFromIso, id as newId, isoFromDateInput, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { importCandidates, pickCandidates } from '@/lib/media';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { DaySummaryCard, shareCardImage, shareSummaryText, summaryText } from './TrackPieces';

const DISCIPLINES: TrackDiscipline[] = ['track_day', 'drift', 'drag', 'autocross', 'junte', 'prueba'];
const WEATHERS = ['soleado', 'nublado', 'lluvia', 'noche'];
const CONDITIONS = ['seca', 'con_goma', 'humeda', 'mojada', 'polvo'];
const VENUE_TYPES: Venue['type'][] = ['circuito', 'drift', 'drag', 'autocross', 'calle', 'otro'];

const numOrNull = (s: string): number | null => (s.trim() ? parseDecimal(s) : null);
const str = (n: number | null | undefined): string => (n == null ? '' : String(n));

/**
 * The event (03-screens.md Block E): where, when, what, the costs — and once
 * saved, its sessions, the tires and pads it used, the day's summary and its
 * photos (album items owned by the event, so they show on the Álbum timeline
 * under a PISTA/JUNTE card).
 */
export function EventForm({ eventId, vehicleId: givenVehicle, onDone }: { eventId?: string; vehicleId?: string; onDone: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle, refresh } = useStore();
  const [id] = useState(eventId ?? newId());
  const [saved, setSaved] = useState(Boolean(eventId));
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const [vehicleId, setVehicleId] = useState<string | null>(givenVehicle ?? activeVehicle?.id ?? null);
  const [venueId, setVenueId] = useState<string | null>('autodromo_americas');
  const [addingVenue, setAddingVenue] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueType, setVenueType] = useState<Venue['type']>('circuito');
  const [layout, setLayout] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [discipline, setDiscipline] = useState<TrackDiscipline>('drift');
  const [weather, setWeather] = useState<string | null>(null);
  const [ambient, setAmbient] = useState('');
  const [trackTemp, setTrackTemp] = useState('');
  const [condition, setCondition] = useState<string | null>(null);
  const [odoStart, setOdoStart] = useState('');
  const [odoEnd, setOdoEnd] = useState('');
  const [entry, setEntry] = useState('');
  const [fuel, setFuel] = useState('');
  const [other, setOther] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  const reload = useCallback(async () => {
    const [d, p] = await Promise.all([eventDetail(id), eventPhotos(id)]);
    setDetail(d);
    setPhotos(p);
    return d;
  }, [id]);

  useEffect(() => {
    void listVenues().then(setVenues);
    if (!eventId) return;
    void Promise.all([eventDetail(eventId), eventPhotos(eventId)]).then(([d, p]) => {
      setDetail(d);
      setPhotos(p);
      if (!d) return;
      const e = d.event;
      setVehicleId(e.vehicleId);
      setVenueId(e.venueId);
      setLayout(e.layout ?? '');
      setDate(dateInputFromIso(e.occurredAt));
      setTitle(e.title);
      setOrganizer(e.organizer ?? '');
      setDiscipline(e.discipline);
      setWeather(e.weather);
      setAmbient(str(e.ambientC));
      setTrackTemp(str(e.trackTempC));
      setCondition(e.trackCondition);
      setOdoStart(str(e.odometerStartKm));
      setOdoEnd(str(e.odometerEndKm));
      setEntry(str(e.entryFeeDop));
      setFuel(str(e.fuelCostDop));
      setOther(str(e.otherCostDop));
      setNotes(e.notes);
    });
  }, [eventId]);

  async function createVenue() {
    if (!venueName.trim()) return;
    const v = await addVenue({ name: venueName.trim(), city: venueCity.trim() || null, type: venueType });
    setVenues(await listVenues());
    setVenueId(v.id);
    setAddingVenue(false);
    setVenueName('');
    setVenueCity('');
  }

  function draft(): (Partial<TrackEvent> & Pick<TrackEvent, 'vehicleId' | 'occurredAt' | 'discipline'>) | null {
    if (!vehicleId) {
      setError(t.track.event.needVehicle);
      return null;
    }
    return {
      id,
      vehicleId,
      venueId,
      layout: layout.trim() || null,
      occurredAt: isoFromDateInput(date),
      title: title.trim(),
      organizer: organizer.trim() || null,
      discipline,
      weather,
      ambientC: numOrNull(ambient),
      trackTempC: numOrNull(trackTemp),
      trackCondition: condition,
      odometerStartKm: numOrNull(odoStart),
      odometerEndKm: numOrNull(odoEnd),
      entryFeeDop: numOrNull(entry),
      fuelCostDop: numOrNull(fuel),
      otherCostDop: numOrNull(other),
      notes: notes.trim(),
    };
  }

  async function save(): Promise<boolean> {
    const d = draft();
    if (!d) return false;
    await saveEvent(d);
    await refresh();
    return true;
  }

  async function saveAndStay() {
    if (!(await save())) return;
    if (!saved) {
      setSaved(true);
      // The detail route, so back returns to the index rather than to "nuevo".
      router.replace({ pathname: '/pista/evento/[id]', params: { id } });
      return;
    }
    await reload();
    onDone();
  }

  async function newSession() {
    if (!(await save())) return;
    setSaved(true);
    router.push({ pathname: '/pista/sesion/nueva', params: { eventId: id } });
  }

  async function addPhotos() {
    if (!vehicleId) return;
    const picked = await pickCandidates({ multiple: true });
    if (!picked.length) return;
    if (!saved && !(await save())) return;
    setSaved(true);
    const fallback = isoFromDateInput(date);
    await importCandidates(
      picked.map((c) => ({ ...c, takenAt: c.takenAt ?? fallback, precision: 'day' as const })),
      { vehicleId, trackEventId: id },
    );
    setPhotos(await eventPhotos(id));
  }

  function remove() {
    Alert.alert(t.track.event.delete, t.track.event.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void deleteEvent(id).then(refresh).then(onDone) },
    ]);
  }

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
  const vehicles = data.vehicles.filter((v) => !v.isArchived);
  const vehicleName = vehicles.find((v) => v.id === vehicleId)?.name;
  const venue = venues.find((v) => v.id === venueId) ?? null;

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.track.eyebrow}
      </T>
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.sm }}>
        {saved ? title || venue?.name || t.track.event.editTitle : t.track.event.newTitle}
      </T>

      {vehicles.length > 1 ? (
        <>
          {eyebrow(t.track.event.vehicle)}
          <View style={styles.chips}>
            {vehicles.map((v) => (
              <Chip key={v.id} label={v.name} selected={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
            ))}
          </View>
        </>
      ) : null}

      {eyebrow(t.track.event.venue)}
      <View style={styles.chips}>
        {venues.map((v) => (
          <Chip key={v.id} label={v.name} selected={venueId === v.id} onPress={() => setVenueId(v.id)} />
        ))}
        <Chip label={t.track.event.addVenue} selected={addingVenue} onPress={() => setAddingVenue((a) => !a)} />
      </View>
      {addingVenue ? (
        <View style={[styles.box, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
          <Field label={t.track.event.venueName} value={venueName} onChangeText={setVenueName} />
          <Field label={t.track.event.venueCity} value={venueCity} onChangeText={setVenueCity} />
          <View style={styles.chips}>
            {VENUE_TYPES.map((x) => (
              <Chip key={x} label={t.track.event.venueTypes[x]} selected={venueType === x} onPress={() => setVenueType(x)} />
            ))}
          </View>
          <GhostButton label={t.track.event.venueSave} disabled={!venueName.trim()} onPress={() => void createVenue()} />
        </View>
      ) : null}

      <Field label={t.track.event.layout} placeholder={t.track.event.layoutPlaceholder} value={layout} onChangeText={setLayout} hint={t.track.event.layoutHint} />
      <DateField label={t.track.event.date} value={date} onChange={setDate} />
      <Field label={t.track.event.title} placeholder={t.track.event.titlePlaceholder} value={title} onChangeText={setTitle} />
      <Field label={t.track.event.organizer} value={organizer} onChangeText={setOrganizer} />

      {eyebrow(t.track.event.discipline)}
      <View style={styles.chips}>
        {DISCIPLINES.map((d) => (
          <Chip key={d} label={t.track.disciplines[d]} selected={discipline === d} onPress={() => setDiscipline(d)} />
        ))}
      </View>

      {eyebrow(t.track.event.weather)}
      <View style={styles.chips}>
        {WEATHERS.map((w) => (
          <Chip key={w} label={t.track.event.weathers[w]} selected={weather === w} onPress={() => setWeather(weather === w ? null : w)} />
        ))}
      </View>
      {pair(
        <Field label={t.track.event.ambient} keyboardType="decimal-pad" value={ambient} onChangeText={setAmbient} />,
        <Field label={t.track.event.trackTemp} keyboardType="decimal-pad" value={trackTemp} onChangeText={setTrackTemp} />,
      )}
      {eyebrow(t.track.event.condition)}
      <View style={styles.chips}>
        {CONDITIONS.map((c) => (
          <Chip key={c} label={t.track.event.conditions[c]} selected={condition === c} onPress={() => setCondition(condition === c ? null : c)} />
        ))}
      </View>

      {pair(
        <Field label={t.track.event.odoStart} keyboardType="number-pad" value={odoStart} onChangeText={setOdoStart} />,
        <Field label={t.track.event.odoEnd} keyboardType="number-pad" value={odoEnd} onChangeText={setOdoEnd} hint={t.track.event.odoHint} />,
      )}

      {eyebrow(t.track.event.costs)}
      {pair(
        <Field label={t.track.event.entry} keyboardType="decimal-pad" value={entry} onChangeText={setEntry} />,
        <Field label={t.track.event.fuel} keyboardType="decimal-pad" value={fuel} onChangeText={setFuel} />,
      )}
      <Field label={t.track.event.other} keyboardType="decimal-pad" value={other} onChangeText={setOther} />
      <Field label={t.track.event.notes} value={notes} onChangeText={setNotes} multiline />

      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.track.event.save} onPress={() => void saveAndStay()} />

      {/* Sessions */}
      {eyebrow(t.track.event.sessions)}
      {(detail?.sessions ?? []).map((s) => (
        <Pressable
          key={s.id}
          onPress={() => router.push({ pathname: '/pista/sesion/[id]', params: { id: s.id } })}
          accessibilityRole="button"
          style={[styles.row, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
          <T face="monoBold" style={{ color: theme.accent, fontSize: 18, width: 28 }}>
            {s.seq}
          </T>
          <View style={{ flex: 1 }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
              {t.track.session.kinds[s.kind] ?? s.kind}
            </T>
            <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
              {[
                isTimed(discipline) ? (s.bestLapMs ? formatLap(s.bestLapMs) : s.laps ? t.track.laps(s.laps) : null) : s.runs ? t.track.runs(s.runs) : null,
                s.carFeel ? t.track.session.feels[s.carFeel] : null,
                s.incident ? '⚠' : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </T>
          </View>
        </Pressable>
      ))}
      <GhostButton label={t.track.event.newSession} onPress={() => void newSession()} />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
        {t.track.event.newSessionHint}
      </T>

      {saved && vehicleId ? <Consumables eventId={id} vehicleId={vehicleId} usage={detail?.usage ?? []} onChanged={() => void reload()} /> : null}

      {detail ? (
        <>
          <View style={{ height: space.md }} />
          <DaySummaryCard ref={shotRef} event={detail.event} venue={detail.venue} summary={detail.summary} vehicleName={vehicleName} />
          <View style={[styles.pair, { marginTop: space.sm }]}>
            <GhostButton style={{ flex: 1 }} label={t.track.summary.shareImage} onPress={() => void shareCardImage(shotRef, `pista-${dateInputFromIso(detail.event.occurredAt)}`)} />
            <GhostButton
              style={{ flex: 1 }}
              label={t.track.summary.shareText}
              onPress={() => void shareSummaryText(summaryText(detail.event, detail.venue, detail.summary, vehicleName)).then((copied) => copied && setNotice(t.track.summary.copied))}
            />
          </View>
          {notice ? (
            <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
              {notice}
            </T>
          ) : null}
        </>
      ) : null}

      {eyebrow(t.track.event.photos)}
      {photos.length ? (
        <View style={styles.photos}>
          {photos.map((m) => (
            <PhotoThumb key={m} mediaId={m} size={96} onPress={() => router.push({ pathname: '/foto/[id]', params: { id: m } })} />
          ))}
        </View>
      ) : null}
      <GhostButton label={t.track.event.addPhotos} onPress={() => void addPhotos()} />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
        {t.track.event.videoHint}
      </T>

      {saved ? <GhostButton danger label={t.track.event.delete} onPress={remove} /> : null}
      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

/** GOMAS Y PASTILLAS: heat cycles, a burned tire, a pad measurement. */
function Consumables({ eventId, vehicleId, usage, onChanged }: { eventId: string; vehicleId: string; usage: EventDetail['usage']; onChanged: () => void }) {
  const { theme } = useTheme();
  const [tires, setTires] = useState<Tire[]>([]);
  const measured = (axle: Axle) => str(usage.find((u) => u.kind === 'medida_pastilla' && u.unit === `mm_${axle}`)?.padThicknessMm);
  const [padF, setPadF] = useState(() => measured('f'));
  const [padR, setPadR] = useState(() => measured('r'));
  const [pads, setPads] = useState<Record<Axle, PadLife | null>>({ f: null, r: null });

  useEffect(() => {
    let cancelled = false;
    const burnedIds = usage.filter((u) => u.kind === 'goma_quemada' && u.tireId).map((u) => u.tireId as string);
    void Promise.all([usableTires(vehicleId), Promise.all(burnedIds.map((x) => tireRepo.getById(x))), padStatus(vehicleId)]).then(([usable, gone, p]) => {
      if (cancelled) return;
      setTires([...usable, ...gone.filter((x): x is Tire => x != null && !usable.some((u) => u.id === x.id))]);
      setPads(p);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, usage]);

  // The day's tick is the event-scoped row; per-session ticks live on the session screen.
  const used = new Set(usage.filter((u) => u.kind === 'ciclo_goma' && u.tireId && !u.sessionId).map((u) => u.tireId as string));
  const burned = new Set(usage.filter((u) => u.kind === 'goma_quemada' && u.tireId).map((u) => u.tireId as string));
  const burnedAt = new Map(usage.filter((u) => u.kind === 'goma_quemada' && u.tireId).map((u) => [u.tireId as string, u.unit]));
  const tireName = (x: Tire) => {
    const corner = (burnedAt.get(x.id) ?? x.position) as keyof typeof t.corners;
    return [corner in t.corners && corner !== 'long' ? t.corners[corner as 'fl'] : null, x.brand, x.size].filter(Boolean).join(' · ') || t.inventory.tire.editTitle;
  };

  function burn(x: Tire) {
    Alert.alert(t.track.consumables.burn, t.track.consumables.burnConfirm(tireName(x)), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.track.consumables.burn, style: 'destructive', onPress: () => void burnTire(eventId, x).then(onChanged) },
    ]);
  }

  async function savePads() {
    await measurePads(eventId, { f: numOrNull(padF), r: numOrNull(padR) });
    onChanged();
  }

  const padLine = (axle: Axle, label: string) => {
    const p = pads[axle];
    if (!p) return null;
    return (
      <T face="mono" style={{ color: p.due ? theme.statusText.urgente : theme.text.secondary, fontSize: 12 }}>
        {t.track.consumables.padLine(label, String(p.lastMm), p.sessionsLeft != null ? String(p.sessionsLeft) : null)}
      </T>
    );
  };
  const anyDue = Boolean(pads.f?.due || pads.r?.due);

  return (
    <View style={[styles.box, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface, marginTop: space.md }]}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {t.track.consumables.title}
      </T>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
        {t.track.consumables.used}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
        {t.track.consumables.usedHint}
      </T>
      {!tires.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.track.consumables.noTires}
        </T>
      ) : null}
      {tires.map((x) => (
        <View key={x.id} style={styles.tireRow}>
          <View style={{ flex: 1 }}>
            <T face="semibold" style={{ color: burned.has(x.id) ? theme.text.muted : theme.text.primary, fontSize: 14 }}>
              {tireName(x)}
            </T>
            <T face="mono" style={{ color: burned.has(x.id) ? theme.redlineText : theme.text.muted, fontSize: 11 }}>
              {burned.has(x.id) ? t.track.consumables.burned : t.track.consumables.cycles(x.heatCycles)}
            </T>
          </View>
          {burned.has(x.id) ? null : (
            <>
              <Chip label={used.has(x.id) ? '✓ USADA' : 'USADA'} selected={used.has(x.id)} onPress={() => void setTireUsed(eventId, x, !used.has(x.id)).then(onChanged)} />
              <Chip label="🔥" onPress={() => burn(x)} />
            </>
          )}
        </View>
      ))}

      <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, marginTop: space.md }}>
        {t.track.consumables.pads}
      </T>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.track.consumables.padsF} keyboardType="decimal-pad" value={padF} onChangeText={setPadF} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.track.consumables.padsR} keyboardType="decimal-pad" value={padR} onChangeText={setPadR} />
        </View>
      </View>
      <GhostButton label={t.track.consumables.padsSave} disabled={!padF.trim() && !padR.trim()} onPress={() => void savePads()} />
      {padLine('f', t.track.consumables.front)}
      {padLine('r', t.track.consumables.rear)}
      {pads.f || pads.r ? (
        <T face="body" style={{ color: anyDue ? theme.statusText.urgente : theme.text.muted, fontSize: 12, marginTop: 4 }}>
          {anyDue ? t.track.consumables.padDue : t.track.consumables.padOk}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
  box: { borderWidth: 1, borderRadius: radius.button, padding: space.md, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm },
  tireRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
});
