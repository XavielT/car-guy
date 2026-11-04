import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { setAiDraft } from '@/lib/ai/draft';
import { askObd, buildObdInput, historyHash, obdActions, readCachedObd, saveCachedObd, type ObdAnswer, type ObdRequest } from '@/lib/ai/obd';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { createRescanReminder, listDtcEvents, repairsFor } from '@/lib/db/diyQueries';
import { currentOdometer } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import type { FreezeFrame } from '@/lib/domain/dtcParse';
import { dateLabel, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { AiConsentSheet } from './AiConsentSheet';

const money = (n: number) => n.toLocaleString('es-DO');

/**
 * "Explicar para mi carro" (IMP 03112026 SPEC-D §D1, ADR-67). The bundled lookup above it stays the offline answer; this adds
 * the explanation for THIS car and its history. Cached per (car, codes, relevant history): re-opening costs nothing, Actualizar
 * asks again. Guidance, never a diagnosis. Every action is a draft the person confirms in the normal form: nothing is saved here
 * except the optional re-scan reminder, which the person taps for.
 */
export function ObdExplain({ codes, vehicleId, freezeFrame }: { codes: string[]; vehicleId: string | null; freezeFrame?: FreezeFrame | null }) {
  const { theme } = useTheme();
  const router = useRouter();
  const ai = useAiStatus();
  const { data, activeVehicle } = useStore();
  const [consentSheet, setConsentSheet] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [answer, setAnswer] = useState<ObdAnswer | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rescanned, setRescanned] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const vehicle = data.vehicles.find((v) => v.id === (vehicleId ?? activeVehicle?.id)) ?? null;
  // The question: which car (it may only be known once the store has loaded) and which codes. A new key re-reads the cache.
  const key = `${vehicle?.id ?? ''}|${codes.join(',')}`;

  /** The request, from this device's own data. */
  const buildRequest = useCallback(async (): Promise<ObdRequest | null> => {
    if (!vehicle) return null;
    const [events, repairs, odometerKm] = await Promise.all([listDtcEvents({ vehicleId: vehicle.id }), repairsFor(vehicle.id), currentOdometer(vehicle.id)]);
    return buildObdInput({
      vehicle: { make: vehicle.detail?.make ?? null, model: vehicle.detail?.model ?? null, year: vehicle.detail?.year ?? null, engineCode: vehicle.detail?.engineCode ?? null, defaultFuelType: vehicle.detail?.defaultFuelType ?? null, transmission: vehicle.detail?.transmission ?? null, origin: vehicle.detail?.origin ?? null },
      odometerKm, codes, events, repairs, freezeFrame: freezeFrame ?? null, today: todayIsoDate(),
    });
  }, [vehicle, codes, freezeFrame]);

  // A stored explanation for this exact question shows at once, and costs nothing.
  useEffect(() => {
    let live = true;
    void (async () => {
      setAnswer(null);
      setPhase('idle');
      setErrorText(null);
      const req = await buildRequest().catch(() => null);
      if (!req || !vehicle) return;
      const cached = await readCachedObd(vehicle.id, historyHash(req));
      if (live && cached) {
        setAnswer(cached.answer);
        setSavedAt(cached.createdAt);
        setPhase('done');
      }
    })();
    return () => {
      live = false;
    };
    // `key` stands for the (vehicle, codes) question; buildRequest is rebuilt from the same inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function explain() {
    if (ai.state === 'needs_consent') {
      setConsentSheet(true);
      return;
    }
    if (ai.state !== 'available') {
      Alert.alert(t.ai.consent.title, ai.message);
      return;
    }
    if (!vehicle) return;
    setPhase('loading');
    setErrorText(null);
    try {
      const req = await buildRequest();
      if (!req) return;
      const result = await askObd(req);
      if (!alive.current) return;
      setAnswer(result);
      setSavedAt(new Date().toISOString());
      setPhase('done');
      void saveCachedObd(vehicle.id, historyHash(req), result);
    } catch (e) {
      if (!alive.current) return;
      if (!(e instanceof AiError)) recordReportable('ai-obd', e);
      setErrorText(e instanceof AiError ? (e.code === 'offline' ? t.ai.obd.offline : t.ai.errors[e.code]) : t.ai.obd.tryAgain);
      setPhase(answer ? 'done' : 'error');
    }
  }

  const tint = (c: ObdAnswer['can_drive']) => (c === 'yes' ? theme.statusText.ok : c === 'careful' ? theme.statusText.proximo : theme.statusText.vencido);

  async function act(a: ReturnType<typeof obdActions>[number]) {
    if (!vehicle || !answer) return;
    if (a.kind === 'repair') {
      setAiDraft({ form: 'repair', prefill: { title: a.title, description: a.description }, marks: {}, photos: [], source: 'text', vehicleId: vehicle.id });
      const events = await listDtcEvents({ vehicleId: vehicle.id, code: codes[0] });
      const open = events.find((e) => !e.clearedAt) ?? events[0];
      router.push({ pathname: '/servicio/nuevo', params: { kind: 'reparacion', ...(open ? { dtcEvent: open.id } : {}) } });
    } else if (a.kind === 'task') {
      setAiDraft({ form: 'task', prefill: { title: a.title }, marks: {}, photos: [], source: 'text', vehicleId: vehicle.id });
      router.push('/tarea/nueva');
    } else {
      await createRescanReminder(vehicle.id, codes[0], todayIsoDate(), a.days);
      setRescanned(true);
    }
  }

  const unavailable = ai.state !== 'available' && ai.state !== 'loading';

  return (
    <View style={{ marginTop: space.md }}>
      {phase === 'loading' ? (
        <View style={[styles.btn, { borderColor: theme.line, backgroundColor: theme.bg.raised }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.text.muted} />
          <T face="semibold" style={{ fontSize: 14, color: theme.text.secondary }}>
            {t.ai.obd.explaining}
          </T>
        </View>
      ) : (
        <Pressable
          onPress={() => void explain()}
          accessibilityRole="button"
          accessibilityLabel={answer ? t.ai.obd.refresh : t.ai.obd.explain}
          style={[styles.btn, { borderColor: unavailable ? theme.line : theme.accent, backgroundColor: theme.bg.raised, opacity: unavailable ? 0.65 : 1 }]}>
          <T face="semibold" style={{ fontSize: 14, color: unavailable ? theme.text.muted : theme.text.primary }}>
            {answer ? t.ai.obd.refresh : codes.length > 1 ? `${t.ai.obd.explain} · ${t.ai.obd.together(codes.length)}` : t.ai.obd.explain}
          </T>
        </Pressable>
      )}
      {unavailable ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 17, color: theme.text.muted, marginTop: 4 }}>
          {ai.state === 'offline' ? t.ai.obd.offline : ai.message}
        </T>
      ) : null}
      {errorText ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ fontSize: 13, lineHeight: 18, color: theme.dangerText, marginTop: 6 }}>
          {errorText}
        </T>
      ) : null}

      {answer ? (
        <Surface style={{ marginTop: space.md }}>
          <T face="eyebrow" style={{ color: tint(answer.can_drive), fontSize: 12 }}>
            {t.ai.obd.canDrive[answer.can_drive]}
          </T>
          {answer.can_drive_reason ? (
            <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
              {answer.can_drive_reason}
            </T>
          ) : null}
          {answer.safety_override ? (
            <T face="body" style={{ color: theme.statusText.proximo, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
              {answer.safety_override}
            </T>
          ) : null}

          {answer.history_note ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.ai.obd.historyTitle}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
                {answer.history_note}
              </T>
            </>
          ) : null}

          <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
            {t.ai.obd.causesTitle}
          </T>
          {answer.causes.map((c, i) => (
            <View key={`${c.title}-${i}`} style={{ marginBottom: space.sm, opacity: c.recently_repaired ? 0.75 : 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {`${i + 1}. ${c.title} · ${t.ai.obd.likelihood[c.likelihood]}`}
              </T>
              {c.why ? (
                <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
                  {c.why}
                </T>
              ) : null}
              {c.recently_repaired ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                  {t.ai.obd.recently}
                </T>
              ) : null}
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
                {[t.ai.obd.diy[c.diy_or_shop], c.cost_rd ? t.ai.obd.estimate(money(c.cost_rd.min), money(c.cost_rd.max)) : ''].filter(Boolean).join(' · ')}
              </T>
            </View>
          ))}

          {answer.first_checks.length ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.ai.obd.checksTitle}
              </T>
              {answer.first_checks.map((s) => (
                <T key={s} face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
                  {`• ${s}`}
                </T>
              ))}
            </>
          ) : null}

          {answer.stop_and_tow_when ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.ai.obd.towTitle}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
                {answer.stop_and_tow_when}
              </T>
            </>
          ) : null}

          {answer.related_codes.length ? (
            <>
              <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
                {t.ai.obd.related}
              </T>
              <View style={styles.row}>
                {answer.related_codes.map((c) => (
                  <Pressable key={c} onPress={() => router.push({ pathname: '/obd/[code]', params: { code: c, ...(vehicle ? { vehicleId: vehicle.id } : {}) } })} accessibilityRole="link" style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
                    <T face="monoBold" style={{ color: theme.text.primary, fontSize: 13 }}>
                      {c}
                    </T>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
            {t.ai.obd.actionsTitle}
          </T>
          {obdActions(answer, codes).map((a) => (
            <Pressable key={a.kind} onPress={() => void act(a)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                {a.kind === 'repair' ? t.ai.obd.actions.repair : a.kind === 'task' ? t.ai.obd.actions.task : t.ai.obd.actions.rescan(a.days)}
              </T>
            </Pressable>
          ))}
          {rescanned ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {t.ai.obd.rescanDone}
            </T>
          ) : null}

          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginTop: space.md }}>
            {`${t.ai.obd.guidance} ${t.ai.obd.estimateNote}`}
          </T>
          {savedAt ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
              {t.ai.obd.savedAt(dateLabel(savedAt))}
            </T>
          ) : null}
        </Surface>
      ) : null}

      <AiConsentSheet
        visible={consentSheet}
        onClose={() => setConsentSheet(false)}
        onAccept={() => {
          void ai.setConsent(true).then((ok) => {
            if (ok && alive.current) setConsentSheet(false);
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: radius.button, minHeight: 48, paddingHorizontal: space.md },
  h: { fontSize: 11, marginTop: space.md, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md },
});
