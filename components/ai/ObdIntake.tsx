import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptureButton } from '@/components/ai/CaptureButton';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import type { ReadResult } from '@/lib/ai/read';
import { logDtc } from '@/lib/db/diyQueries';
import { currentOdometer } from '@/lib/db/repos';
import { DASH_LIGHTS, actionOf, rankLights, type DashLight, type LightColor, type RecognisedLight } from '@/lib/domain/dashLights';
import { normalizeCode } from '@/lib/domain/dtc';
import { extractCodes, extractFreezeFrame, type FreezeFrame } from '@/lib/domain/dtcParse';
import { featureForTelltale, featureHref } from '@/lib/features/registry';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const LIGHTS = new Set<string>(DASH_LIGHTS);
const COLORS = new Set<string>(['red', 'amber', 'green', 'blue', 'other']);

/** The lights a `dash_lights` read recognised, off the wire. Anything outside the closed lists is dropped. */
export function lightsFrom(result: ReadResult): RecognisedLight[] {
  return (result.items ?? [])
    .map((it) => {
      const light = it.light?.value;
      const color = it.color?.value;
      return typeof light === 'string' && LIGHTS.has(light)
        ? { light: light as DashLight, color: (typeof color === 'string' && COLORS.has(color) ? color : null) as LightColor | null, confidence: it.light.confidence }
        : null;
    })
    .filter((l): l is RecognisedLight => l != null);
}

/** The codes and freeze-frame values a `scanner` read carries, off the wire. */
export function scannerFrom(result: ReadResult): { codes: string[]; freeze: FreezeFrame | null } {
  const codes = [...new Set((result.items ?? []).map((it) => normalizeCode(String(it.code?.value ?? ''))).filter((c): c is string => !!c))];
  const n = (k: string) => (typeof result.fields[k]?.value === 'number' ? (result.fields[k].value as number) : null);
  const freeze = { rpm: n('rpm'), coolantC: n('coolant_c'), loadPct: n('load_pct'), speedKmh: n('speed_kmh') };
  return { codes, freeze: Object.values(freeze).some((v) => v != null) ? freeze : null };
}

/**
 * OBD intake (IMP 03112026 SPEC-D §D2/§D3, ADR-67): a photo of a warning light names it and points to the right place; a pasted
 * list or a scanner screenshot becomes codes the person CONFIRMS before they are logged, then explained together. Pasted text is
 * read offline and free (dtcParse); only a screenshot calls the AI. What each light means is a table in the app, not the model.
 */
export function ObdIntake({ vehicleId }: { vehicleId: string | null }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { activeVehicle } = useStore();
  const target = vehicleId ?? activeVehicle?.id ?? null;

  const [lights, setLights] = useState<(RecognisedLight & { urgency: 'stop' | 'soon' | 'info' })[] | null>(null);
  const [text, setText] = useState('');
  const [found, setFound] = useState<{ codes: string[]; freeze: FreezeFrame | null } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const urgencyColor = (u: 'stop' | 'soon' | 'info') => (u === 'stop' ? theme.statusText.vencido : u === 'soon' ? theme.statusText.proximo : theme.text.muted);

  function parseText() {
    const codes = extractCodes(text);
    setFound({ codes, freeze: extractFreezeFrame(text) });
    setPicked(codes);
  }

  function absorb(result: ReadResult) {
    const s = scannerFrom(result);
    if (!s.codes.length && !s.freeze) {
      Alert.alert(t.ai.consent.title, t.ai.obdIntake.noCodes);
      return;
    }
    setFound((cur) => ({ codes: [...new Set([...(cur?.codes ?? []), ...s.codes])], freeze: s.freeze ?? cur?.freeze ?? null }));
    setPicked((cur) => [...new Set([...cur, ...s.codes])]);
  }

  async function confirm() {
    if (!target || !picked.length) return;
    const km = await currentOdometer(target).catch(() => null);
    const seenAt = new Date().toISOString();
    for (const code of picked) await logDtc({ vehicleId: target, code, seenAt, odometerKm: km });
    router.push({
      pathname: '/obd/[code]',
      params: { code: picked[0], vehicleId: target, ...(picked.length > 1 ? { codes: picked.join(',') } : {}), ...(found?.freeze ? { ff: JSON.stringify(found.freeze) } : {}) },
    });
  }

  const fz = found?.freeze;

  return (
    <View style={{ marginBottom: space.lg }}>
      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.ai.obdIntake.lightTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: space.sm }}>
        {t.ai.obdIntake.lightHint}
      </T>
      <CaptureButton
        kind="dash_lights"
        icon="warning-outline"
        label={t.ai.obdIntake.lightScan}
        onRead={(result) => {
          const found = lightsFrom(result);
          if (!found.length) {
            setLights(null);
            Alert.alert(t.ai.consent.title, t.ai.obdIntake.noLights);
            return;
          }
          setLights(rankLights(found));
        }}
      />
      {lights?.map((l) => {
        const action = actionOf(l.light);
        const def = action.kind === 'telltale' ? featureForTelltale(action.telltale) : undefined;
        return (
          <Surface key={`${l.light}-${l.color}`} style={{ marginBottom: space.sm }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {`${t.ai.obdIntake.lightNames[l.light]}${l.color && t.ai.obdIntake.colors[l.color] ? ` · ${t.ai.obdIntake.colors[l.color]}` : ''}`}
            </T>
            <T face="semibold" style={{ color: urgencyColor(l.urgency), fontSize: 13 }}>
              {t.ai.obdIntake.urgency[l.urgency]}
            </T>
            {action.kind === 'obd' ? (
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                {t.ai.obdIntake.pasteHint}
              </T>
            ) : null}
            {def ? (
              <Pressable onPress={() => router.push(featureHref(def, target) as never)} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
                <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                  {`${t.ai.obdIntake.openFeature}: ${t.features.items[def.id].title}`}
                </T>
              </Pressable>
            ) : null}
          </Surface>
        );
      })}

      <T face="eyebrow" style={[styles.h, { color: theme.text.muted, marginTop: space.lg }]}>
        {t.ai.obdIntake.scannerTitle}
      </T>
      <Field label={t.ai.obdIntake.pasteHint} placeholder={t.ai.obdIntake.pastePlaceholder} value={text} onChangeText={setText} multiline autoCapitalize="characters" />
      <View style={styles.row}>
        <Pressable onPress={parseText} accessibilityRole="button" disabled={!text.trim()} style={[styles.btn, { borderColor: theme.accent, backgroundColor: theme.bg.raised, opacity: text.trim() ? 1 : 0.5 }]}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
            {t.ai.obdIntake.parse}
          </T>
        </Pressable>
      </View>
      <CaptureButton kind="scanner" icon="scan-outline" label={t.ai.obdIntake.scanShot} onRead={(r) => absorb(r)} style={{ marginTop: space.sm }} />

      {found ? (
        <Surface style={{ marginBottom: space.md }}>
          <T face="semibold" accessibilityLiveRegion="polite" style={{ color: theme.text.primary, fontSize: 14 }}>
            {found.codes.length ? t.ai.obdIntake.found(found.codes.length) : t.ai.obdIntake.noCodes}
          </T>
          <View style={[styles.row, { marginTop: space.sm }]}>
            {found.codes.map((c) => {
              const on = picked.includes(c);
              return (
                <Pressable key={c} onPress={() => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? theme.accentFill : theme.line, backgroundColor: on ? theme.accentFill : theme.bg.raised }]}>
                  <T face="monoBold" style={{ color: on ? theme.accentFillInk : theme.text.primary, fontSize: 13 }}>
                    {c}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {fz ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginTop: space.sm }}>
              {[
                `${t.ai.obdIntake.freeze}:`,
                fz.rpm != null ? `${t.ai.obdIntake.freezeRpm} ${fz.rpm}` : '',
                fz.coolantC != null ? `${t.ai.obdIntake.freezeCoolant} ${fz.coolantC} °C` : '',
                fz.loadPct != null ? `${t.ai.obdIntake.freezeLoad} ${fz.loadPct} %` : '',
                fz.speedKmh != null ? `${t.ai.obdIntake.freezeSpeed} ${fz.speedKmh} km/h` : '',
              ].filter(Boolean).join(' · ')}
            </T>
          ) : null}
          {picked.length && target ? (
            <View style={{ marginTop: space.md }}>
              <PrimaryButton label={t.ai.obdIntake.confirm} onPress={() => void confirm()} />
            </View>
          ) : null}
          {picked.length && !target ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm }}>
              {t.ai.obdIntake.noVehicle}
            </T>
          ) : null}
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 11, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  btn: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md },
});
