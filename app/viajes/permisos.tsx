import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { useLocationPermission } from '@/components/trips/TripPieces';
import { Badge, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import { setTripsMode } from '@/lib/trips/settings';

/**
 * Viajes → permisos (03-screens.md "Phase 5"): the three levels explained —
 * Nada / Solo manual / Automático. Part A asks only for the foreground
 * permission; the Automático card is informational until Part B wires the
 * background request (and the MIUI checklist) into it.
 */
export default function TripPermissionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const perm = useLocationPermission();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/viajes/ajustes'));

  const card = (key: 'none' | 'manual' | 'auto', action?: React.ReactNode, badge?: string) => (
    <Surface padded style={styles.card}>
      <View style={styles.cardTop}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase', flex: 1 }}>
          {es.trips.permCards[key].title}
        </T>
        {badge ? <Badge label={badge} tone={key === 'manual' ? 'amber' : 'red'} /> : null}
      </View>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {es.trips.permCards[key].body}
      </T>
      {action}
    </Surface>
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {es.trips.permTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.md }}>
        {es.trips.permIntro}
      </T>

      {card(
        'none',
        <GhostButton
          label={es.trips.permOff}
          onPress={() => {
            void setTripsMode('off');
            back();
          }}
        />,
      )}
      {card(
        'manual',
        perm.state === 'granted' ? (
          <T face="semibold" style={{ color: theme.statusText.ok, fontSize: 14, marginTop: space.sm }}>
            {es.trips.permGranted}
          </T>
        ) : (
          <View style={{ marginTop: space.sm }}>
            <PrimaryButton
              label={perm.state === 'denied' && !perm.canAsk && Platform.OS !== 'web' ? es.trips.openSettings : es.trips.permRequest}
              onPress={() =>
                void (async () => {
                  await setTripsMode('manual');
                  await perm.ask();
                })()
              }
            />
          </View>
        ),
        es.trips.permissionState[perm.state].split(' ·')[0].toUpperCase(),
      )}
      {/* Part B: this card gets its own button (foreground → background → settings). */}
      {card('auto')}

      {Platform.OS === 'web' ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
          {es.trips.permWeb}
        </T>
      ) : null}
      <GhostButton label={es.trips.permLater} onPress={back} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  card: { marginBottom: space.md, gap: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
