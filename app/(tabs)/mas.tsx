import Ionicons from '@expo/vector-icons/Ionicons';
import { router as appRouter, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { T } from '@/components/T';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SelectField } from '@/components/pickers';
import { Field } from '@/components/Field';
import { SmartSearch } from '@/components/ai/SmartSearch';
import { FeatureCard, featureCopy } from '@/components/features/FeatureCards';
import { FeatureSetSheet } from '@/components/features/FeatureSetSheet';
import { useFeatureBadges, useOpenFeature } from '@/components/features/useFeatures';
import { Collapsible, GhostButton, NavRow, StatusRow, Surface } from '@/components/ui';
import { includesTopic, splitAdvanced, splitBySet, suggestTopics } from '@/lib/features/featureSet';
import { useFeatureSet } from '@/lib/features/featureSetStore';
import { FEATURE_SECTIONS, type FeatureId } from '@/lib/features/ids';
import { activeFeatures, type FeatureDef } from '@/lib/features/registry';
import { searchFeatures } from '@/lib/features/search';
import { readUsedAt } from '@/lib/features/usage';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { appVersion, gitSha } from '@/lib/appVersion';
import { useVersionSeen } from '@/lib/changelog/seen';
import { useIsAdmin } from '@/lib/cloud/admin';
import { useSession } from '@/lib/cloud/auth';
import { userMessage } from '@/lib/diagnostics';
import { setDiagnosticsMode, useDiagnosticsMode } from '@/lib/diagnosticsMode';
import { exportBackup, importBackup } from '@/lib/backup';
import { FEATURE_I18N, FEATURE_SHARE, FEATURE_SYNC } from '@/lib/flags';
import { FEATURE_ONBOARDING_V2 } from '@/lib/flagsV8';
import { resetTips } from '@/lib/onboarding/tips';
import { FEEDBACK_ROUTE } from '@/lib/feedback';
import { t, useLanguage, type LanguagePreference } from '@/lib/i18n';
import { describeCounts } from '@/lib/import/tucombustible';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { useTheme, type ThemePreference } from '@/lib/theme/useTheme';

/**
 * Everything that is not a tab, in the order 03-screens-ia.md lays out: what you
 * own, what you do to it, what you paid, the papers, the account, the data, and
 * then the app's own settings.
 */
export default function MasScreen() {
  const router = useRouter();
  const { theme, preference, setPreference } = useTheme();
  const language = useLanguage();
  const { data, activeVehicle, resetAll, refresh } = useStore();
  const archived = data.vehicles.filter((v) => v.isArchived);
  const isAdmin = useIsAdmin();
  const { session } = useSession();
  const profile = useProfile();
  const { unseen: versionUnseen } = useVersionSeen();

  // Más (SPEC-K §K2/K4): a search that speaks like people, the registry's groups by the person's own feature set, everything else collapsed.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { set: featureSet } = useFeatureSet();
  const { badgeOf } = useFeatureBadges(activeVehicle?.id);
  const { open: openFeature } = useOpenFeature();
  const [query, setQuery] = useState('');
  const [setOpen, setSetOpen] = useState(false);
  const [usedAt, setUsedAt] = useState<Record<string, number>>({});
  useEffect(() => {
    void readUsedAt().then(setUsedAt);
  }, []);
  const all = useMemo(() => activeFeatures(), []);
  const results = query.trim() ? searchFeatures(query, featureCopy, all) : null;
  const recents = useMemo(
    () =>
      Object.entries(usedAt)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => all.find((d) => d.id === (id as FeatureId)))
        .filter((d): d is FeatureDef => Boolean(d))
        .slice(0, 3),
    [usedAt, all],
  );
  const card = (def: FeatureDef) => {
    // A release the person has not read yet keeps its signal on the Versiones row (it used to be a red dot).
    const b = def.id === 'versions' && versionUnseen ? { text: t.features.badgeNew, warn: false } : badgeOf(def);
    return <FeatureCard key={def.id} def={def} badge={b?.text} warn={b?.warn} onPress={() => openFeature(def)} />;
  };
  const [nowMs] = useState(() => Date.now());
  const suggestion = suggestTopics(all, usedAt, [], nowMs);
  const hiddenCount = all.filter((d) => !includesTopic(featureSet, d.group)).length;

  const version = appVersion;
  const diagnostics = useDiagnosticsMode();
  const taps = useRef({ count: 0, last: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2000);
  }

  // Seven quick taps on the version, like Android's developer options. Only a
  // release build needs it: in development the hints are always on.
  function tapVersion() {
    const now = Date.now();
    const tap = taps.current;
    tap.count = now - tap.last < 800 ? tap.count + 1 : 1;
    tap.last = now;
    if (tap.count >= 3 && tap.count < 7) showToast(t.dev.tapsLeft(7 - tap.count));
    if (tap.count >= 7) {
      tap.count = 0;
      void setDiagnosticsMode(!diagnostics);
      showToast(diagnostics ? t.dev.diagnosticsOff : t.dev.diagnosticsOn);
    }
  }

  async function handleExport() {
    try {
      const shared = await exportBackup();
      if (!shared) Alert.alert(t.more.backupTitle, t.more.backupUnsupported);
    } catch (error) {
      Alert.alert(t.more.backupTitle, userMessage('backup', error, t.more.backupFailed));
    }
  }

  async function handleImport() {
    try {
      const result = await importBackup();
      if (!result) return;
      await refresh();
      // A merge, never a wipe: rows are matched by id and the newer
      // updated_at wins, so restoring an old file cannot undo recent work.
      Alert.alert(
        t.more.restoredTitle,
        result.kind === 'legacy'
          ? t.more.restoredLegacy(describeCounts(result.counts))
          : t.more.restoredMerge(result.counts.merged, result.counts.tables),
      );
    } catch (error) {
      Alert.alert(t.more.restoreTitle, userMessage('restore', error, t.more.restoreFailed));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <ScreenTitle
          title={t.more.title}
          size={34}
          sub={t.more.subtitle}
          trailing={
            // Perfil (IMP 30092026 Phase 6): the person's avatar, photo → drawing → initials.
            <Pressable onPress={() => router.push('/perfil')} accessibilityRole="button" accessibilityLabel={t.profileUi.headerA11y} hitSlop={8}>
              <Avatar size={48} photoUri={profile.photoUri} avatarId={profile.avatarId} name={profile.displayName ?? session?.user.email} decorative />
            </Pressable>
          }
        />

        {/* The account state is the one thing worth seeing without opening anything. */}
        <StatusRow
          icon="person-circle-outline"
          label={session ? t.account.signedInAs : t.account.signIn}
          status={session?.user.email ?? t.more.accountBody}
          tone={session ? 'ok' : 'neutral'}
          onPress={() => router.push('/cuenta')}
        />

        <Field label={t.mas.searchLabel} placeholder={t.mas.searchPlaceholder} value={query} onChangeText={setQuery} autoCorrect={false} autoFocus={focus === 'search'} returnKeyType="search" />
        <SmartSearch query={query} matches={results?.length ?? 0} onQuery={setQuery} />

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
            {recents.length ? (
              <View style={{ marginTop: space.sm, marginBottom: space.sm }}>
                <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
                  {t.mas.recents}
                </T>
                <View style={styles.chips}>
                  {recents.map((d) => (
                    <Pressable key={d.id} onPress={() => openFeature(d)} accessibilityRole="button" style={[styles.chip, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
                      <Ionicons name={d.icon} size={16} color={theme.accent} />
                      <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
                        {featureCopy(d).title}
                      </T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: space.md }}>
              {FEATURE_SECTIONS.map((section) => {
                const items = all.filter((d) => d.section === section);
                const { shown } = splitBySet(items, featureSet);
                const { main, advanced } = splitAdvanced(shown, featureSet);
                if (!main.length && !advanced.length) return null;
                return (
                  <Collapsible key={section} id={`mas-${section}`} title={t.mas.groups[section]} count={main.length + advanced.length}>
                    {main.map(card)}
                    {advanced.length ? (
                      <Collapsible id={`mas-${section}-adv`} title={t.mas.advanced} count={advanced.length}>
                        {advanced.map(card)}
                      </Collapsible>
                    ) : null}
                  </Collapsible>
                );
              })}
            </View>
            {hiddenCount > 0 ? (
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
                {t.featureSet.hiddenCount(hiddenCount)}. {t.featureSet.hiddenNote}
              </T>
            ) : null}

            <IconRow icon="apps-outline" label={t.mas.all} caption={t.mas.allCaption(all.length)} onPress={() => router.push('/herramientas')} style={{ marginTop: space.sm }} />
            <IconRow icon="options-outline" label={t.featureSet.open} caption={t.featureSet.openCaption} onPress={() => setSetOpen(true)} />

            <View style={{ marginTop: space.lg }}>
              <Collapsible id="mas-garage" title={t.mas.garage}>
                <NavRow label={t.more.garageOpen} caption={t.more.garageOpenCaption(data.vehicles.filter((v) => !v.isArchived).length, archived.length)} onPress={() => router.push('/(tabs)/garaje')} />
                {activeVehicle ? <NavRow label={t.more.activeVehicle(activeVehicle.name)} caption={t.more.activeVehicleCaption} onPress={() => router.push({ pathname: '/vehiculo/[id]', params: { id: activeVehicle.id } })} /> : null}
                <NavRow label={t.more.addVehicle} onPress={() => router.push('/vehiculo/nuevo')} />
                <NavRow label={t.catalog.title} caption={t.catalog.caption} onPress={() => router.push('/catalogo')} />
                <NavRow label={t.more.history} caption={t.more.historyCaption} onPress={() => router.push('/(tabs)/historial')} />
                {includesTopic(featureSet, 'maintenance') ? <NavRow label={t.more.checkGuide} caption={t.more.checkGuideCaption} onPress={() => router.push('/chequeo/guia')} /> : null}
                {FEATURE_SHARE ? <NavRow label={t.members.haveCode} caption={t.members.acceptIntro} onPress={() => router.push({ pathname: '/invitacion/[code]', params: { code: '-' } })} /> : null}
              </Collapsible>

              <Collapsible id="mas-data" title={t.mas.data} hint={t.more.dataCaption}>
                <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
                  {FEATURE_SYNC && session ? t.more.dataCaptionSynced : t.more.dataCaption}
                </T>
                <GhostButton label={t.more.backup} onPress={handleExport} />
                <GhostButton label={t.more.restore} onPress={handleImport} />
                <T face="body" style={[styles.meta, { color: theme.text.muted }]}>
                  {t.more.restoreCaption}
                </T>
                <GhostButton
                  danger
                  label={t.more.wipe}
                  onPress={() =>
                    Alert.alert(t.more.wipeTitle, t.more.wipeBody, [
                      { text: t.common.cancel, style: 'cancel' },
                      { text: t.common.delete, style: 'destructive', onPress: resetAll },
                    ])
                  }
                />
              </Collapsible>

              <Collapsible id="mas-look" title={t.mas.look}>
                <SelectField<ThemePreference>
                  label={t.more.appearance}
                  options={[
                    { value: 'system', label: t.more.themes.system },
                    { value: 'dark', label: t.more.themes.dark },
                    { value: 'light', label: t.more.themes.light },
                  ]}
                  value={preference}
                  onChange={setPreference}
                />
                {FEATURE_I18N ? (
                  <SelectField<LanguagePreference>
                    label={t.language.title}
                    options={[
                      { value: 'system', label: t.language.system },
                      { value: 'es', label: t.language.es },
                      { value: 'en', label: t.language.en },
                    ]}
                    value={language.preference}
                    onChange={(next) => {
                      // The navigator is keyed on the language (app/_layout.tsx), so the switch
                      // remounts it on Inicio; bring the person back to where they were.
                      language.setPreference(next);
                      setTimeout(() => appRouter.navigate('/(tabs)/mas'), 0);
                    }}
                  />
                ) : null}
              </Collapsible>

              <Collapsible id="mas-help" title={t.mas.help}>
                {FEATURE_ONBOARDING_V2 ? (
                  <NavRow
                    label={t.welcome.help.tips}
                    caption={t.welcome.help.tipsCaption}
                    onPress={() => {
                      void resetTips();
                      Alert.alert(t.welcome.help.tipsResetTitle, t.welcome.help.tipsReset);
                    }}
                  />
                ) : null}
                {isAdmin ? <NavRow label={t.admin.more} caption={t.admin.moreCaption} onPress={() => router.push('/admin')} /> : null}
              </Collapsible>
            </View>
          </>
        )}
        <SetSheetHost open={setOpen} onClose={() => setSetOpen(false)} suggested={suggestion} />

        <Surface>
          <Pressable onPress={tapVersion} accessibilityRole="text">
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {t.more.version(version)}
            </T>
          </Pressable>
          {notice ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
              {notice}
            </T>
          ) : null}
          {gitSha ? (
            <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
              {t.more.build(gitSha)}
            </T>
          ) : null}
          <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
            {t.more.aboutBody}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
            {t.more.aboutCredits}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  archivedLabel: { fontSize: 11, letterSpacing: 0.9, marginTop: space.md, marginBottom: space.sm },
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 34 },
  sub: { marginTop: 6, lineHeight: 22 },
  firstSection: { marginTop: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: 56, marginBottom: space.sm },
  meta: { marginTop: space.sm, lineHeight: 19, fontSize: 13 },
  cardBody: { fontSize: 14, marginTop: space.sm, lineHeight: 21 },
  vehicle: {
    borderRadius: radius.input,
    padding: space.md,
    paddingLeft: space.lg,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    borderWidth: 1,
  },
});

/**
 * Más's section headers are eyebrows (IMP 28092026, 05-design-jdm.md): Saira
 * 400 tracked, muted, so the rows — not the headers — carry the weight.
 */
/** A NavRow with a leading icon — Más's first row (Cifras). */
function IconRow({
  icon,
  label,
  caption,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconRow,
        { borderColor: theme.line, backgroundColor: theme.bg.surface },
        pressed && { opacity: 0.85 },
        style,
      ]}>
      <Ionicons name={icon} size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {label}
        </T>
        {caption ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
            {caption}
          </T>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </Pressable>
  );
}


function SetSheetHost({ open, onClose, suggested }: { open: boolean; onClose: () => void; suggested: ReturnType<typeof suggestTopics> }) {
  return <FeatureSetSheet visible={open} onClose={onClose} suggested={suggested} />;
}
