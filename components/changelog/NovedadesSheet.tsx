import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { CHANGELOG } from '@/lib/changelog.generated';
import { findEntry } from '@/lib/changelog/parse';
import { markVersionSeen, useNovedadesCheck, useVersionSeen } from '@/lib/changelog/seen';
import { installedVersion } from '@/lib/changelog/version';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';

import { ChangelogEntryView } from './ChangelogEntryView';

/**
 * "Novedades": opens once after an update with that version's notes (never on
 * a first install — lib/changelog/novedades.ts). Closing it, or "Ver todas",
 * records the version as seen. Mounted once, in the root shell.
 */
export function NovedadesSheet() {
  const router = useRouter();
  const { ready, data } = useStore();
  useNovedadesCheck(ready, data.vehicles.length > 0);
  const { sheetOpen } = useVersionSeen();
  const { height } = useWindowDimensions();
  const entry = findEntry(CHANGELOG, installedVersion);

  if (!entry) return null;

  return (
    <Sheet visible={sheetOpen} onClose={() => void markVersionSeen()} title={es.versions.sheetTitle(entry.version)}>
      <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={styles.body}>
        <ChangelogEntryView entry={entry} />
      </ScrollView>
      <View style={styles.actions}>
        <PrimaryButton label={es.versions.close} onPress={() => void markVersionSeen()} />
        <GhostButton
          label={es.versions.seeAll}
          onPress={() => {
            void markVersionSeen();
            router.push('/versiones');
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.md },
  actions: { marginTop: space.md, gap: space.xs },
});
