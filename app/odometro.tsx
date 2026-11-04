import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiFieldMark, aiOutline } from '@/components/ai/AiFieldMark';
import { useAiDraftOnce } from '@/lib/ai/draft';
import { CaptureButton } from '@/components/ai/CaptureButton';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { LcdDigits, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { currentOdometer as currentOdometerQuery, odometer as odometerRepo } from '@/lib/db/repos';
import { odometerFrom } from '@/lib/ai/formMap';
import { MI_TO_KM } from '@/lib/domain/fuelSanity';
import { odometerWarning } from '@/lib/domain/odometer';
import { isoFromDateInput, km as fmtKm, todayIsoDate } from '@/lib/format';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A manual odometer reading. Its own route rather than a field buried in a form,
 * because "what does it read now" is the one number the app asks for most often
 * and every prediction depends on it being current.
 */
export default function OdometroScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  // A dictated sentence ("el carro marca 84,300") pre-fills this form; the person taps Guardar.
  const draft = useAiDraftOnce('odometer');
  const dp = (draft?.prefill ?? {}) as Record<string, string | undefined>;
  const [value, setValue] = useState(dp.value ?? '');
  const [date, setDate] = useState(dp.date ?? todayIsoDate());
  const [current, setCurrent] = useState<number | null>(null);
  const [readings, setReadings] = useState<{ occurredAt: string; valueKm: number }[]>([]);
  // IMP 03112026 (ADR-67): a dashboard photo fills the number; the person still taps Guardar.
  const [aiMark, setAiMark] = useState<number | undefined>(draft?.marks?.value);
  const [milesRead, setMilesRead] = useState(false);

  useEffect(() => {
    if (!activeVehicle) return;
    void (async () => {
      setCurrent(await currentOdometerQuery(activeVehicle.id));
      setReadings(await odometerRepo.list(activeVehicle.id));
    })();
  }, [activeVehicle]);

  if (!activeVehicle) return null;

  const parsed = value.trim() ? parseDecimal(value) : null;
  const warning = parsed != null ? odometerWarning(parsed, isoFromDateInput(date), readings) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.odometerSheet.title}
        </T>
        <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
          {t.odometerSheet.hint}
        </T>

        {/* The LCD readout: the last reading, then what you type as you type it. */}
        <View style={[styles.well, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
          <LcdDigits value={parsed ?? (current != null ? Math.round(current) : null)} height={40} />
        </View>

        <CaptureButton
          kind="odometer"
          icon="speedometer-outline"
          label={t.ai.capture.dashboardPhoto}
          onRead={(result) => {
            const read = odometerFrom(result);
            if (!read) {
              Alert.alert(t.ai.consent.title, t.ai.capture.nothingRead);
              return;
            }
            setValue(read.value);
            setMilesRead(read.milesRead);
            setAiMark(read.confidence);
          }}
        />
        <AiFieldMark confidence={aiMark} />
        <Field
          style={aiOutline(aiMark, theme.accent)}
          label={t.odometerSheet.value}
          placeholder={current != null ? String(Math.round(current)) : '51676'}
          keyboardType="number-pad"
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setAiMark(undefined);
            setMilesRead(false);
          }}
          hint={current != null ? t.odometerSheet.lastReading(fmtKm(Math.round(current))) : undefined}
        />
        {milesRead && parsed != null ? (
          <>
            <T face="body" style={{ color: theme.statusText.proximo, fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
              {t.ai.capture.unitMiles(parsed, Math.round(parsed * MI_TO_KM))}
            </T>
            <Pressable
              onPress={() => {
                setValue(String(Math.round(parsed * MI_TO_KM)));
                setMilesRead(false);
              }}
              accessibilityRole="button"
              style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', marginBottom: space.sm }}>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                {t.ai.capture.useKm}
              </T>
            </Pressable>
          </>
        ) : null}
        <DateField label={t.odometerSheet.date} value={date} onChange={setDate} noFuture />

        {warning ? (
          <T face="body" style={[styles.warning, { color: theme.statusText.proximo }]}>
            {warning}
          </T>
        ) : null}

        <PrimaryButton
          label={t.odometerSheet.save}
          disabled={parsed == null}
          onPress={() => {
            if (parsed == null) return;
            void (async () => {
              await odometerRepo.upsert({
                vehicleId: activeVehicle.id,
                occurredAt: isoFromDateInput(date),
                valueKm: parsed,
                source: 'manual',
              });
              await refresh();
              router.back();
            })();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.sm },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: space.xl },
  well: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: space.lg,
    marginBottom: space.xl,
  },
  warning: { fontSize: 13, lineHeight: 19, marginBottom: space.md },
});
