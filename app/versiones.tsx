import { useEffect } from 'react';
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
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

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

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <Surface>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
          {web ? es.versions.web : es.versions.current}
        </T>
        <T face="display" style={[styles.version, { color: theme.text.primary }]}>
          {es.versions.version(installedVersion ?? '—')}
        </T>
        {buildNumber || gitSha ? (
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
            {[buildNumber ? es.versions.build(buildNumber) : null, gitSha ? es.versions.commit(gitSha) : null]
              .filter(Boolean)
              .join(' · ')}
          </T>
        ) : null}
        {web ? (
          <>
            <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
              {es.versions.checkCaptionWeb}{' '}
              <T
                face="semibold"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(UPDATE_URL)}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}>
                {es.versions.releasesLink}
              </T>
            </T>
          </>
        ) : (
          <>
            <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
              {es.versions.checkCaption}
            </T>
            <View style={{ marginTop: space.md }}>
              <PrimaryButton label={es.versions.check} onPress={() => void Linking.openURL(UPDATE_URL)} />
            </View>
          </>
        )}
      </Surface>
      {FEATURE_FEEDBACK ? <GhostButton label={es.feedback.more} onPress={() => openFeedback('bug')} /> : null}

      <T face="eyebrow" accessibilityRole="header" style={[styles.heading, { color: theme.accent }]}>
        {es.versions.history}
      </T>
      {CHANGELOG.length === 0 ? <EmptyState icon="document-text-outline" message={es.versions.empty} /> : null}
      {CHANGELOG.map((entry) => (
        <Surface key={entry.version} style={styles.card}>
          <View style={styles.cardHead}>
            <T face="title" style={{ color: theme.text.primary, fontSize: 20, textTransform: 'uppercase' }}>
              {entry.name ? `${entry.version} — ${entry.name}` : entry.version}
            </T>
            {entry === current ? <Badge tone="amber" label={es.versions.installed} /> : null}
          </View>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
            {entry.date ? dateLabel(`${entry.date}T12:00:00`) : es.versions.unreleased}
          </T>
          <ChangelogEntryView entry={entry} />
          {entry.date ? (
            <GhostButton label={es.versions.notes} onPress={() => void Linking.openURL(releaseUrl(entry.version))} />
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
