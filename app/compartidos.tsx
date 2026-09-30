import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { activeShares } from '@/lib/db/shareQueries';
import type { VehicleShare } from '@/lib/db/types';
import { shareUrl } from '@/lib/share/publish';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** Más → Links compartidos: every car with a live public page. */
export default function SharesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [list, setList] = useState<(VehicleShare & { vehicleName: string })[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Settled once the first read answers (or fails): the skeleton is for that read only (ADR-40).
  const [settled, setSettled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void activeShares()
        .then((l) => !cancelled && setList(l))
        .finally(() => !cancelled && setSettled(true));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const showSkeleton = useDelayedLoading(!settled);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.share.listTitle}
      </T>
      {showSkeleton ? <ListCardsSkeleton n={3} pad={space.md} r={radius.button} buttons={2} titleWidth="50%" /> : null}
      {list && !list.length && !showSkeleton ? <EmptyState icon="link-outline" message={t.share.listEmpty} /> : null}
      {(showSkeleton ? [] : (list ?? [])).map((s) => {
        const url = shareUrl(s.slug!);
        return (
          <View key={s.id} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <Pressable onPress={() => router.push({ pathname: '/vehiculo/[id]/compartir', params: { id: s.vehicleId } })} accessibilityRole="button">
              <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase' }}>
                {s.vehicleName}
              </T>
              <T face="mono" style={{ color: theme.accent, fontSize: 12 }}>
                {`${url.replace('https://', '')} · ${t.share.visibility[s.visibility]}`}
              </T>
            </Pressable>
            <View style={styles.pair}>
              <GhostButton style={{ flex: 1 }} label={copied === s.id ? t.share.copied : t.share.copy} onPress={() => void Clipboard.setStringAsync(url).then(() => setCopied(s.id))} />
              <GhostButton style={{ flex: 1 }} label={t.share.preview} onPress={() => void Linking.openURL(url)} />
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
