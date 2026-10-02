import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ChangelogEntryView } from '@/components/changelog/ChangelogEntryView';
import { T } from '@/components/T';
import { Badge, EmptyState, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { CHANGELOG } from '@/lib/changelog.generated';
import { findEntry } from '@/lib/changelog/parse';
import { markVersionSeen, useVersionSeen } from '@/lib/changelog/seen';
import { buildNumber, gitSha, installedVersion, releaseUrl, UPDATE_URL } from '@/lib/changelog/version';
import { FEATURE_FEEDBACK } from '@/lib/flags';
import { openFeedback } from '@/lib/feedback';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { FEATURE_OTA } from '@/lib/flagsV10';
import { useTheme } from '@/lib/theme/useTheme';
import { checkApk } from '@/lib/updates/apk';
import { checkOta, otaInfo } from '@/lib/updates/ota';
import { useUpdateState } from '@/lib/updates/store';

/**
 * Más → Novedades y versiones (IMP 29092026, note 5): what is installed, where
 * to get the newest APK, and every version's notes from CHANGELOG.md
 * (lib/changelog.generated.ts, built by tools/build-changelog.mjs).
 */
export default function VersionesScreen() {
  const { theme } = useTheme();
  const { loaded, unseen } = useVersionSeen();
  const current = findEntry(CHANGELOG, installedVersion);

  // Opening the list counts as having read what is new.
  useEffect(() => {
    if (loaded && unseen) void markVersionSeen();
  }, [loaded, unseen]);

  const web = Platform.OS === 'web';
  // IMP 01102026 Phase 4: which channel and update this binary runs, and a check that tries both paths.
  const [ota, setOta] = useState<Awaited<ReturnType<typeof otaInfo>>>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const updates = useUpdateState();
  useEffect(() => {
    if (FEATURE_OTA && !web) void otaInfo().then(setOta);
  }, [web]);
  const check = async () => {
    setChecking(true);
    setResult(null);
    const [otaNew, apk] = await Promise.all([checkOta(), checkApk(true)]);
    setChecking(false);
    // A found update shows as the banner on Inicio; here a plain answer.
    setResult(otaNew || apk ? null : t.updates.upToDate);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <Surface>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
          {web ? t.versions.web : t.versions.current}
        </T>
        <T face="display" style={[styles.version, { color: theme.text.primary }]}>
          {t.versions.version(installedVersion ?? '—')}
        </T>
        {buildNumber || gitSha ? (
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
            {[buildNumber ? t.versions.build(buildNumber) : null, gitSha ? t.versions.commit(gitSha) : null]
              .filter(Boolean)
              .join(' · ')}
          </T>
        ) : null}
        {web ? (
          <>
            <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
              {t.versions.checkCaptionWeb}{' '}
              <T
                face="semibold"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(UPDATE_URL)}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}>
                {t.versions.releasesLink}
              </T>
            </T>
          </>
        ) : (
          <>
            {FEATURE_OTA && ota ? (
              <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {[ota.channel ? t.updates.channel(ota.channel) : null, ota.embedded || !ota.updateId ? t.updates.embedded : t.updates.update(ota.updateId.slice(0, 8))]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            ) : null}
            {FEATURE_OTA ? (
              <View style={{ marginTop: space.md, gap: space.xs }}>
                <PrimaryButton label={checking ? t.updates.checking : t.updates.check} disabled={checking} onPress={() => void check()} />
                {updates.otaReady || updates.apk ? (
                  <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
                    {updates.apk ? t.updates.apkAvailable(updates.apk.version, null) : t.updates.otaReady}
                  </T>
                ) : result ? (
                  <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                    {result}
                  </T>
                ) : null}
                <GhostButton label={t.versions.releasesLink} onPress={() => void Linking.openURL(UPDATE_URL)} />
              </View>
            ) : (
              <>
                <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
                  {t.versions.checkCaption}
                </T>
                <View style={{ marginTop: space.md }}>
                  <PrimaryButton label={t.versions.check} onPress={() => void Linking.openURL(UPDATE_URL)} />
                </View>
              </>
            )}
          </>
        )}
      </Surface>
      {FEATURE_FEEDBACK ? <GhostButton label={t.feedback.more} onPress={() => openFeedback('bug')} /> : null}

      <T face="eyebrow" accessibilityRole="header" style={[styles.heading, { color: theme.accent }]}>
        {t.versions.history}
      </T>
      {t.versions.notesLanguage ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.md }}>
          {t.versions.notesLanguage}
        </T>
      ) : null}
      {CHANGELOG.length === 0 ? <EmptyState icon="document-text-outline" message={t.versions.empty} /> : null}
      {CHANGELOG.map((entry) => (
        <Surface key={entry.version} style={styles.card}>
          <View style={styles.cardHead}>
            <T face="title" style={{ color: theme.text.primary, fontSize: 20, textTransform: 'uppercase' }}>
              {entry.name ? `${entry.version} — ${entry.name}` : entry.version}
            </T>
            {entry === current ? <Badge tone="amber" label={t.versions.installed} /> : null}
          </View>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
            {entry.date ? dateLabel(`${entry.date}T12:00:00`) : t.versions.unreleased}
          </T>
          <ChangelogEntryView entry={entry} />
          {entry.date ? (
            <GhostButton label={t.versions.notes} onPress={() => void Linking.openURL(releaseUrl(entry.version))} />
          ) : null}
        </Surface>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  version: { fontSize: 30, textTransform: 'uppercase', marginTop: 2 },
  caption: { fontSize: 14, lineHeight: 21, marginTop: space.md },
  heading: { fontSize: 12, marginTop: space.xxl, marginBottom: space.sm },
  card: { marginBottom: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
