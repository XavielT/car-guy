import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { FeatureCard, featureCopy, FeatureTile } from '@/components/features/FeatureCards';
import { useFeatureBadges, useOpenFeature } from '@/components/features/useFeatures';
import { SelectField } from '@/components/pickers';
import { HubSkeleton } from '@/components/skeletons/HubSkeleton';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { FEATURE_SECTIONS } from '@/lib/features/ids';
import { activeFeatures, type FeatureDef } from '@/lib/features/registry';
import { searchFeatures } from '@/lib/features/search';
import { FEEDBACK_ROUTE } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Herramientas (IMP 16102026 ADR-62, SPEC-C §3): every function of the app, a search over them, the four that matter
 * most on top, and the rest by section — one tap from Inicio (the button in its header) or the first row of Más, one
 * more to the function. It is drawn from the registry, so a function added there shows up here and in the search.
 */
export default function ToolsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { ready, data, activeVehicle, setActiveVehicle } = useStore();
  const { open, needsCar, clearNeedsCar } = useOpenFeature();
  const { loading, badgeOf } = useFeatureBadges(activeVehicle?.id);
  const showSkeleton = useDelayedLoading(!ready || loading);
  const [query, setQuery] = useState('');

  const all = useMemo(() => activeFeatures(), []);
  const featured = useMemo(() => all.filter((f) => f.featured).sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0)), [all]);
  const results = query.trim() ? searchFeatures(query, featureCopy, all) : null;
  const vehicles = data.vehicles.filter((v) => !v.isArchived);

  if (!ready || loading) return showSkeleton ? <HubSkeleton /> : <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  const card = (def: FeatureDef) => {
    const b = badgeOf(def);
    return <FeatureCard key={def.id} def={def} badge={b?.text} warn={b?.warn} onPress={() => open(def)} />;
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.features.title}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase' }}>
        {t.features.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {t.features.subtitle}
      </T>

      <Field label={t.features.searchLabel} placeholder={t.features.search} value={query} onChangeText={setQuery} autoCorrect={false} autoFocus={focus === 'search'} returnKeyType="search" />

      {vehicles.length > 1 ? (
        <SelectField
          label={t.features.vehicle}
          value={activeVehicle?.id ?? null}
          options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
          onChange={setActiveVehicle}
        />
      ) : null}

      {results ? (
        results.length ? (
          <View style={{ marginTop: space.md }}>{results.map(card)}</View>
        ) : (
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {t.features.noResults(query.trim())}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {t.features.noResultsHint}
            </T>
            <GhostButton label={t.features.sendFeedback} onPress={() => router.push(FEEDBACK_ROUTE as never)} />
          </View>
        )
      ) : (
        <>
          <T face="eyebrow" style={[styles.section, { color: theme.text.muted }]}>
            {t.features.featured}
          </T>
          <View style={styles.grid}>
            {featured.map((def) => {
              const b = badgeOf(def);
              return <FeatureTile key={def.id} def={def} badge={b?.text} warn={b?.warn} onPress={() => open(def)} />;
            })}
          </View>
          {FEATURE_SECTIONS.map((section) => {
            const items = all.filter((f) => f.section === section);
            if (!items.length) return null;
            return (
              <View key={section}>
                <T face="eyebrow" style={[styles.section, { color: theme.text.muted }]}>
                  {t.features.sections[section]}
                </T>
                {items.map(card)}
              </View>
            );
          })}
        </>
      )}

      <Sheet visible={Boolean(needsCar)} onClose={clearNeedsCar} title={t.features.chooseVehicle}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
          {needsCar ? `${t.features.chooseVehicleBody(featureCopy(needsCar).title)} ${t.features.noVehicle}` : ''}
        </T>
        <PrimaryButton
          label={t.routes.newVehicle}
          onPress={() => {
            clearNeedsCar();
            router.push('/vehiculo/nuevo');
          }}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 64 },
  section: { fontSize: 11, marginTop: space.lg, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
