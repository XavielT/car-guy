import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckPhotoStrip } from '@/components/checks/CheckPhotoStrip';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { BoostRing, PrimaryButton, Segmented, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  inspectionItems as itemRepo,
  inspectionTemplates as templateRepo,
} from '@/lib/db/repos';
import { resultIdFor, saveInspection, type Answer } from '@/lib/db/inspectionOps';
import type { FluidGuideItem, InspectionItem, InspectionTemplate, OnFail } from '@/lib/db/types';
import { listFluids, readFicha } from '@/lib/db/diyQueries';
import { fluidForItem, fluidInfo, isTirePressureItem } from '@/lib/domain/fluids';
import { defaultActionFor, needsDetail, VERDICTS, type Verdict } from '@/lib/domain/inspections';
import { FEATURE_DIY } from '@/lib/flags';
import { PhotoThumb } from '@/components/album/PhotoThumb';
import { id as newId } from '@/lib/format';
import { todayIso } from '@/lib/domain/dates';
import { es } from '@/lib/i18n/es';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The runner. Designed for one thumb, standing next to the car.
 *
 * Every answer is a full-width segmented control rather than a small toggle,
 * the "¿Cómo?" text is one tap away instead of hidden in a tooltip, and the
 * cold-engine warning is a banner at the top — that sentence is the lesson the
 * whole app was built around, so it does not get to be a footnote.
 */
export default function RunScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, Verdict>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Every photo per item, in strip order (IMP 29092026 note 3).
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actions, setActions] = useState<Record<string, OnFail>>({});
  // Chosen now so a photo taken mid-run can name the result that will own it.
  const [inspectionId] = useState(() => newId());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The DIY block (IMP 28092026 Phase 5): the owner's fluid photos and the OEM pressures.
  const [fluidCards, setFluidCards] = useState<Record<string, FluidGuideItem>>({});
  const [psi, setPsi] = useState<{ f: number | null; r: number | null }>({ f: null, r: null });
  // Lazy initialiser, not a bare Date.now() in the render body: the clock is
  // impure and the lint rightly refuses to have it read on every render.
  const [startedAt] = useState(() => Date.now());

  // The timer is a gentle one: it shows the check really is two minutes, and
  // feeds duration_sec. It never hurries anyone.
  useEffect(() => {
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!FEATURE_DIY || !vehicleId) return;
    let cancelled = false;
    void Promise.all([listFluids(vehicleId), readFicha(vehicleId)]).then(([cards, ficha]) => {
      if (cancelled) return;
      setFluidCards(Object.fromEntries(cards.filter((c) => c.mediaId || c.notes).map((c) => [c.kind, c])));
      setPsi({ f: (ficha.values.psi_oem_f as number | null) ?? null, r: (ficha.values.psi_oem_r as number | null) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  useEffect(() => {
    if (!templateId || !vehicleId) return;
    let cancelled = false;
    (async () => {
      const [tpl, rows, km] = await Promise.all([
        templateRepo.getById(templateId),
        itemRepo.listWhere({ templateId }, { orderBy: 'sort_order', direction: 'ASC' }),
        currentOdometerQuery(vehicleId),
      ]);
      if (cancelled) return;
      setTemplate(tpl);
      setItems(rows);
      if (km != null) setOdometer(String(Math.round(km)));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [templateId, vehicleId]);

  if (!template || !activeVehicle) return null;

  const answered = items.filter((i) => answers[i.id]).length;
  const remaining = items.length - answered;
  const needsCold = items.some((i) => i.requiresColdEngine);

  const groups = items.reduce<Record<string, InspectionItem[]>>((acc, item) => {
    (acc[item.groupName] ??= []).push(item);
    return acc;
  }, {});

  function finish() {
    const failures = items.filter((i) => answers[i.id] === 'falla');
    const missingNote = failures.find((i) => !(notes[i.id] ?? '').trim());
    if (missingNote) return setError(es.check.failNoteRequired);
    setError(null);

    const payload: Answer[] = items.map((item) => ({
      item,
      result: answers[item.id] ?? 'na',
      note: notes[item.id] ?? '',
      mediaId: photos[item.id]?.[0] ?? null,
      mediaIds: photos[item.id] ?? [],
      action: actions[item.id] ?? defaultActionFor(answers[item.id], item.onFail),
    }));

    setSaving(true);
    void (async () => {
      const result = await saveInspection({
        id: inspectionId,
        vehicleId: activeVehicle!.id,
        templateId: template!.id,
        occurredAt: todayIso(),
        odometerKm: odometer.trim() ? parseDecimal(odometer) : null,
        durationSec: Math.round((Date.now() - startedAt) / 1000),
        answers: payload,
      });
      await refresh();
      router.replace({
        pathname: '/inspeccion/[id]',
        // The reminders a failure created have no link back to the run, so the
        // result screen can only name them if it is told on the way in.
        params: { id: result.id, fresh: '1', reminders: JSON.stringify(result.createdReminders) },
      });
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
              {es.check.cadences[template.cadence]}
            </T>
            <T face="display" style={[styles.title, { color: theme.text.primary }]}>
              {template.name}
            </T>
            <T face="mono" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4 }}>
              {answered}/{items.length} · {es.check.elapsed(Math.floor(elapsed / 60), elapsed % 60)}
            </T>
          </View>
          {/* The boost gauge fills as the list does: amber only, completion is not danger. */}
          <BoostRing
            progress={items.length ? answered / items.length : 0}
            size={104}
            value={`${items.length ? Math.round((answered / items.length) * 100) : 0}%`}
            label={es.check.title}
          />
        </View>

        {needsCold ? (
          <View style={[styles.cold, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 14, lineHeight: 19 }}>
              {es.check.coldEngine}
            </T>
          </View>
        ) : null}

        {Object.entries(groups).map(([group, groupItems]) => (
          <View key={group}>
            <T face="eyebrow" accessibilityRole="header" style={[styles.group, { color: theme.text.muted }]}>
              {group}
            </T>
            {groupItems.map((item) => {
              const verdict = answers[item.id];
              return (
                <Surface key={item.id} style={{ marginBottom: space.sm }}>
                  <View style={styles.itemHeader}>
                    <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                      {item.label}
                    </T>
                    {item.requiresColdEngine ? (
                      <T face="eyebrow" style={{ color: theme.statusText.proximo, fontSize: 10 }}>
                        {es.check.coldBadge}
                      </T>
                    ) : null}
                  </View>

                  {item.how ? (
                    <Pressable
                      onPress={() => setExpanded((p) => ({ ...p, [item.id]: !p[item.id] }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: Boolean(expanded[item.id]) }}
                      aria-expanded={Boolean(expanded[item.id])}>
                      <T face="semibold" style={{ color: theme.accent, fontSize: 13, marginTop: 4 }}>
                        {es.check.how}
                      </T>
                    </Pressable>
                  ) : null}
                  {expanded[item.id] ? (
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                      {item.how}
                      {item.warning ? `\n\n${item.warning}` : ''}
                    </T>
                  ) : null}
                  {FEATURE_DIY && isTirePressureItem(item.label) && (psi.f != null || psi.r != null) ? (
                    <T face="mono" style={{ color: theme.accent, fontSize: 12, marginTop: 6 }}>
                      {es.fluids.oem(psi.f != null ? String(psi.f) : '—', psi.r != null ? String(psi.r) : '—')}
                    </T>
                  ) : null}
                  {(() => {
                    const kind = FEATURE_DIY ? fluidForItem(item.label) : null;
                    const card = kind ? fluidCards[kind] : null;
                    if (!card) return null;
                    return (
                      <View style={[styles.fluid, { borderColor: theme.accentFill, backgroundColor: theme.bg.raised }]}>
                        <T face="eyebrow" style={{ color: theme.accent, fontSize: 10 }}>
                          {es.fluids.inCheck(fluidInfo(card.kind)?.label ?? item.label, activeVehicle?.name ?? '')}
                        </T>
                        {card.mediaId ? <PhotoThumb mediaId={card.mediaId} height={150} /> : null}
                        {card.notes ? (
                          <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                            {card.notes}
                          </T>
                        ) : null}
                      </View>
                    );
                  })()}

                  <View style={styles.verdicts}>
                    {VERDICTS.map((v) => {
                      const on = verdict === v;
                      const color =
                        v === 'ok'
                          ? theme.statusText.ok
                          : v === 'falla'
                            ? theme.statusText.vencido
                            : v === 'atencion'
                              ? theme.statusText.proximo
                              : theme.text.muted;
                      return (
                        <Pressable
                          key={v}
                          onPress={() => {
                            // The "AL TERMINAR, CREAR" default differs per verdict
                            // (a falla uses the item's, an atención none), so a
                            // choice made under the other verdict does not carry over.
                            if (v !== verdict) {
                              setActions((p) => {
                                const next = { ...p };
                                delete next[item.id];
                                return next;
                              });
                            }
                            setAnswers((p) => ({ ...p, [item.id]: v }));
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: answers[item.id] === v }}
                          aria-selected={answers[item.id] === v}
                          style={[
                            styles.verdict,
                            { borderColor: on ? color : theme.line, backgroundColor: on ? `${color}28` : 'transparent' },
                          ]}>
                          <T
                            face="title"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={[styles.verdictLabel, { color: on ? color : theme.text.secondary }]}>
                            {v === 'ok'
                              ? es.check.ok
                              : v === 'falla'
                                ? es.check.fail
                                : v === 'atencion'
                                  ? es.check.attention
                                  : es.check.na}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>

                  {needsDetail(verdict) ? (
                    <View style={{ marginTop: space.md }}>
                      <Field
                        label={verdict === 'atencion' ? es.check.attentionNote : es.check.failNote}
                        value={notes[item.id] ?? ''}
                        onChangeText={(v) => setNotes((p) => ({ ...p, [item.id]: v }))}
                      />
                      <CheckPhotoStrip
                        mediaIds={photos[item.id] ?? []}
                        ownerId={resultIdFor(inspectionId, item.id)}
                        vehicleId={activeVehicle.id}
                        label={item.label}
                        onChange={(ids) => setPhotos((p) => ({ ...p, [item.id]: ids }))}
                      />
                      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 6 }}>
                        {es.check.onFailTitle}
                      </T>
                      <Segmented
                        options={[
                          { key: 'task', label: es.check.onFailShort.task },
                          { key: 'reminder', label: es.check.onFailShort.reminder },
                          { key: 'none', label: es.check.onFailShort.none },
                        ]}
                        value={actions[item.id] ?? defaultActionFor(verdict, item.onFail)}
                        onChange={(v) => setActions((p) => ({ ...p, [item.id]: v }))}
                      />
                    </View>
                  ) : null}
                </Surface>
              );
            })}
          </View>
        ))}

        <Field
          label={es.check.odometerPrompt}
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
        />

        {error ? (
          <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.md }}>
            {error}
          </T>
        ) : null}

        <PrimaryButton
          label={remaining > 0 ? `${es.check.finish} · ${es.check.remaining(remaining)}` : es.check.finish}
          disabled={remaining > 0 || saving}
          onPress={finish}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fluid: { borderWidth: 1, borderRadius: radius.input, padding: space.sm, gap: 6, marginTop: space.sm },
  pad: { padding: space.gutter, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  cold: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.lg },
  title: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.3 },
  group: { fontSize: 11, marginTop: space.lg, marginBottom: space.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Four across on a 360 px phone: tighter gaps and type than the three-button row had.
  verdicts: { flexDirection: 'row', gap: 6, marginTop: space.md },
  verdict: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  verdictLabel: { fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
});
