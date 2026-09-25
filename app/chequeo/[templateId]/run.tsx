import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { GaugeRing, PrimaryButton, Segmented, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  inspectionItems as itemRepo,
  inspectionTemplates as templateRepo,
} from '@/lib/db/repos';
import { resultIdFor, saveInspection, type Answer } from '@/lib/db/inspectionOps';
import type { InspectionItem, InspectionTemplate, OnFail } from '@/lib/db/types';
import { id as newId } from '@/lib/format';
import { todayIso } from '@/lib/domain/dates';
import { es } from '@/lib/i18n/es';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type Verdict = 'ok' | 'falla' | 'na';

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
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actions, setActions] = useState<Record<string, OnFail>>({});
  // Chosen now so a photo taken mid-run can name the result that will own it.
  const [inspectionId] = useState(() => newId());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [error, setError] = useState<string | null>(null);
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
      mediaId: photos[item.id] ?? null,
      action: actions[item.id] ?? item.onFail,
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
      router.replace({ pathname: '/inspeccion/[id]', params: { id: result.id, fresh: '1' } });
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T face="display" style={{ color: theme.text.primary, fontSize: 26 }}>
              {template.name}
            </T>
            <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
              {answered}/{items.length} · {es.check.elapsed(Math.floor(elapsed / 60), elapsed % 60)}
            </T>
          </View>
          <GaugeRing progress={items.length ? answered / items.length : 0} size={72} />
        </View>

        {needsCold ? (
          <View style={[styles.cold, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="semibold" style={{ color: theme.status.proximo, fontSize: 13 }}>
              {es.check.coldEngine}
            </T>
          </View>
        ) : null}

        {Object.entries(groups).map(([group, groupItems]) => (
          <View key={group}>
            <T face="medium" style={[styles.group, { color: theme.text.muted }]}>
              {group.toUpperCase()}
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
                      <T face="body" style={{ color: theme.status.proximo, fontSize: 11 }}>
                        motor frío
                      </T>
                    ) : null}
                  </View>

                  {item.how ? (
                    <Pressable
                      onPress={() => setExpanded((p) => ({ ...p, [item.id]: !p[item.id] }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: Boolean(expanded[item.id]) }}>
                      <T face="body" style={{ color: theme.accent, fontSize: 12, marginTop: 4 }}>
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

                  <View style={styles.verdicts}>
                    {(['ok', 'falla', 'na'] as Verdict[]).map((v) => {
                      const on = verdict === v;
                      const color =
                        v === 'ok' ? theme.status.ok : v === 'falla' ? theme.status.vencido : theme.text.muted;
                      return (
                        <Pressable
                          key={v}
                          onPress={() => setAnswers((p) => ({ ...p, [item.id]: v }))}
                          accessibilityRole="button"
                          accessibilityState={{ selected: answers[item.id] === v }}
                          style={[
                            styles.verdict,
                            { borderColor: on ? color : theme.line, backgroundColor: on ? `${color}28` : 'transparent' },
                          ]}>
                          <T face="semibold" style={{ color: on ? color : theme.text.secondary, fontSize: 13 }}>
                            {v === 'ok' ? es.check.ok : v === 'falla' ? es.check.fail : es.check.na}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>

                  {verdict === 'falla' ? (
                    <View style={{ marginTop: space.md }}>
                      <Field
                        label={es.check.failNote}
                        value={notes[item.id] ?? ''}
                        onChangeText={(v) => setNotes((p) => ({ ...p, [item.id]: v }))}
                      />
                      <PhotoPicker
                        mediaId={photos[item.id] ?? null}
                        ownerTable="inspection_result"
                        ownerId={resultIdFor(inspectionId, item.id)}
                        vehicleId={activeVehicle.id}
                        height={130}
                        onChange={(mediaId) => setPhotos((p) => ({ ...p, [item.id]: mediaId }))}
                      />
                      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: 6 }}>
                        {es.check.onFailTitle}
                      </T>
                      <Segmented
                        options={[
                          { key: 'task', label: es.check.onFailShort.task },
                          { key: 'reminder', label: es.check.onFailShort.reminder },
                          { key: 'none', label: es.check.onFailShort.none },
                        ]}
                        value={actions[item.id] ?? item.onFail}
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
          <T face="body" style={{ color: theme.danger, fontSize: 13, marginBottom: space.md }}>
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
  pad: { padding: space.gutter, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  cold: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.lg },
  group: { fontSize: 11, letterSpacing: 0.9, marginTop: space.lg, marginBottom: space.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  verdicts: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  verdict: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: space.md,
    alignItems: 'center',
  },
});
