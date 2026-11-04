import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, SectionHeader, Surface, ToggleRow } from '@/components/ui';
import { space } from '@/constants/theme';
import { DEFAULT_AI_CONFIG, fieldsFromConfig, parseLimits, usd, type AiConfig, type AiUsageSummary, type LimitFields } from '@/lib/ai/limits';
import { AI_FEATURES, withFeature, type AiFeature } from '@/lib/ai/features';
import { loadAiUsage, pruneAiUsage, readAiConfig, saveAiLimits, setAiEnabled, setAiFeaturesOff } from '@/lib/cloud/aiAdmin';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Admin > Uso y costos > IA (IMP 03112026, ADR-66): what the AI costs (today / 7 days / 30 days, by function and by
 * person), the four brakes (per-person hourly count, per-person and global daily USD caps, places per day) and the KILL
 * SWITCH. The company's key pays for Car Guy and for his friends, so the brakes live here, editable without a release.
 * Mounted only inside the admin gate of app/admin/uso.tsx; the server refuses anyone else regardless.
 */
export function AiAdminPanel() {
  const { theme } = useTheme();
  const [usage, setUsage] = useState<AiUsageSummary | null | 'error'>(null);
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_AI_CONFIG.enabled);
  const [fields, setFields] = useState<LimitFields>(fieldsFromConfig(DEFAULT_AI_CONFIG));
  const [note, setNote] = useState<string | null>(null);
  const [featuresOff, setFeaturesOff] = useState<string[]>([]);

  const apply = useCallback((u: AiUsageSummary | null, c: AiConfig | null) => {
    setUsage(u ?? 'error');
    if (c) {
      setEnabled(c.enabled);
      setFeaturesOff(c.featuresOff);
      setFields(fieldsFromConfig(c));
    }
  }, []);
  const load = useCallback(() => Promise.all([loadAiUsage(), readAiConfig()]).then(([u, c]) => apply(u, c)), [apply]);

  // Same shape as app/admin/uso.tsx: the state is set when the promise settles, not synchronously in the effect.
  useEffect(() => {
    let alive = true;
    void Promise.all([loadAiUsage(), readAiConfig()]).then(([u, c]) => {
      if (alive) apply(u, c);
    });
    return () => {
      alive = false;
    };
  }, [apply]);

  const flip = async (next: boolean) => {
    setEnabled(next);
    const ok = await setAiEnabled(next);
    if (!ok) {
      setEnabled(!next);
      setNote(t.ai.admin.saveFailed);
    } else setNote(null);
  };

  const flipFeature = async (id: AiFeature, on: boolean) => {
    const next = withFeature(featuresOff, id, on);
    const before = featuresOff;
    setFeaturesOff(next);
    if (await setAiFeaturesOff(next)) setNote(null);
    else {
      setFeaturesOff(before);
      setNote(t.ai.admin.saveFailed);
    }
  };

  const save = async () => {
    const parsed = parseLimits(fields);
    if (!parsed) return setNote(t.ai.admin.invalid);
    setNote((await saveAiLimits(parsed)) ? t.ai.admin.saved : t.ai.admin.saveFailed);
  };

  const prune = async () => {
    const n = await pruneAiUsage(90);
    setNote(n == null ? t.ai.admin.saveFailed : t.ai.admin.pruned(n));
    void load();
  };

  const row = (label: string, s: { calls: number; errors: number; cost_usd: number }) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {label}
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
          {t.ai.admin.calls(Number(s.calls), Number(s.errors))}
        </T>
      </View>
      <T face="mono" style={{ color: theme.text.primary, fontSize: 14 }}>
        {t.ai.admin.usd(usd(s.cost_usd))}
      </T>
    </View>
  );

  const set = (k: keyof LimitFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <View style={{ marginBottom: space.lg }}>
      <SectionHeader title={t.ai.admin.title} caption={t.ai.admin.caption} />
      <Surface padded style={{ marginBottom: space.md }}>
        <ToggleRow label={t.ai.admin.masterSwitch} hint={t.ai.admin.masterHint} value={enabled} onChange={(v) => void flip(v)} />
      </Surface>

      <Surface padded style={{ marginBottom: space.md }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {t.ai.admin.features.title}
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.xs }}>
          {t.ai.admin.features.hint}
        </T>
        {AI_FEATURES.map((id) => (
          <ToggleRow key={id} label={t.ai.admin.features[id]} value={!featuresOff.includes(id)} onChange={(v) => void flipFeature(id, v)} />
        ))}
      </Surface>

      <Surface padded style={{ marginBottom: space.md }}>
        {usage === 'error' ? (
          <T face="body" style={{ color: theme.dangerText, fontSize: 14 }}>
            {t.ai.admin.loadFailed}
          </T>
        ) : usage ? (
          Number(usage.d30.calls) === 0 ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {t.ai.admin.noUsage}
            </T>
          ) : (
            <>
              {row(t.ai.admin.today, usage.today)}
              {row(t.ai.admin.d7, usage.d7)}
              {row(t.ai.admin.d30, usage.d30)}
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                {t.ai.admin.consented(Number(usage.consented_users))}
              </T>
              <T face="eyebrow" style={{ color: theme.text.secondary, marginTop: space.md, marginBottom: 4 }}>
                {t.ai.admin.byFunction}
              </T>
              {usage.by_function.map((f) => row(f.function, f))}
              <T face="eyebrow" style={{ color: theme.text.secondary, marginTop: space.md, marginBottom: 4 }}>
                {t.ai.admin.byUser}
              </T>
              {usage.by_user.map((u) => row(u.display_name || u.user_id.slice(0, 8), { calls: u.calls, errors: 0, cost_usd: u.cost_usd }))}
            </>
          )
        ) : null}
      </Surface>

      <T face="eyebrow" style={{ color: theme.text.secondary, marginBottom: 4 }}>
        {t.ai.admin.limitsTitle}
      </T>
      <Field label={t.ai.admin.limitUserHour} value={fields.userHour} onChangeText={set('userHour')} keyboardType="number-pad" />
      <Field label={t.ai.admin.capUserDay} value={fields.userDayUsd} onChangeText={set('userDayUsd')} keyboardType="decimal-pad" />
      <Field label={t.ai.admin.capGlobalDay} value={fields.globalDayUsd} onChangeText={set('globalDayUsd')} keyboardType="decimal-pad" />
      <Field label={t.ai.admin.limitPlacesDay} value={fields.placesUserDay} onChangeText={set('placesUserDay')} keyboardType="number-pad" />
      {note ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, marginBottom: space.sm }}>
          {note}
        </T>
      ) : null}
      <PrimaryButton label={t.ai.admin.save} onPress={() => void save()} />
      <View style={{ height: space.sm }} />
      <GhostButton label={t.ai.admin.prune} onPress={() => void prune()} />
    </View>
  );
}
