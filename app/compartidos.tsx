import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { EmptyState, GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { activeShares } from '@/lib/db/shareQueries';
import type { VehicleShare } from '@/lib/db/types';
import { shareUrl } from '@/lib/share/publish';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/** Más → Links compartidos: every car with a live public page. */
export default function SharesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [list, setList] = useState<(VehicleShare & { vehicleName: string })[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void activeShares().then((l) => !cancelled && setList(l));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {es.share.listTitle}
      </T>
      {list && !list.length ? <EmptyState icon="link-outline" message={es.share.listEmpty} /> : null}
      {(list ?? []).map((s) => {
        const url = shareUrl(s.slug!);
        return (
          <View key={s.id} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <Pressable onPress={() => router.push({ pathname: '/vehiculo/[id]/compartir', params: { id: s.vehicleId } })} accessibilityRole="button">
              <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase' }}>
                {s.vehicleName}
              </T>
              <T face="mono" style={{ color: theme.accent, fontSize: 12 }}>
                {`${url.replace('https://', '')} · ${es.share.visibility[s.visibility]}`}
              </T>
            </Pressable>
            <View style={styles.pair}>
              <GhostButton style={{ flex: 1 }} label={copied === s.id ? es.share.copied : es.share.copy} onPress={() => void Clipboard.setStringAsync(url).then(() => setCopied(s.id))} />
              <GhostButton style={{ flex: 1 }} label={es.share.preview} onPress={() => void Linking.openURL(url)} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.sm, marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
});
