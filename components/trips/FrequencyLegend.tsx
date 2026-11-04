import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** The ramp of the frequency lines (SPEC-I §I4): the same three colours as the map paint, "pocas veces → muchas veces". */
const RAMP = ['#FFB300', '#FF8A00', '#FF5F00', '#E10600'];

export function FrequencyLegend() {
  const { theme } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${t.trips.frequencyFew} → ${t.trips.frequencyMany}`}>
      <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
        {t.trips.frequencyFew}
      </T>
      <View style={styles.ramp}>
        {RAMP.map((c) => (
          <View key={c} style={{ flex: 1, height: 3, backgroundColor: c, borderRadius: 2 }} />
        ))}
      </View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
        {t.trips.frequencyMany}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  ramp: { flexDirection: 'row', gap: 2, width: 96 },
});
