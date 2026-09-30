import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { space } from '@/constants/theme';
import type { Drivetrain, Transmission, VehicleOrigin } from '@/lib/db/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

export type IdentityValue = {
  nickname: string;
  chassisCode: string;
  chassisNumber: string;
  engineCode: string;
  transmission: Transmission | null;
  drivetrain: Drivetrain | null;
  origin: VehicleOrigin | null;
  importedYear: string;
  story: string;
};

const TRANSMISSIONS: Transmission[] = ['manual', 'automatica', 'cvt', 'otro'];
const DRIVETRAINS: Drivetrain[] = ['fwd', 'rwd', 'awd'];
const ORIGINS: VehicleOrigin[] = ['jdm', 'usdm', 'eudm', 'local', 'otro'];

/** "+ Identidad del carro" — unchanged from 2.1 (apodo, chasis, motor, transmisión, tracción, origen, historia). */
export function IdentitySection({ value, onChange }: { value: IdentityValue; onChange: (next: IdentityValue) => void }) {
  const { theme } = useTheme();
  const set = <K extends keyof IdentityValue>(key: K, v: IdentityValue[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      <Field label={t.vehicle.nickname} placeholder={t.vehicle.nicknamePlaceholder} value={value.nickname} onChangeText={(x) => set('nickname', x)} />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={t.vehicle.chassisCode}
            placeholder="AE85"
            autoCapitalize="characters"
            value={value.chassisCode}
            onChangeText={(x) => set('chassisCode', x)}
          />
        </View>
        <View style={styles.half}>
          <Field label={t.vehicle.engineCode} placeholder="4A-GE 20V" value={value.engineCode} onChangeText={(x) => set('engineCode', x)} />
        </View>
      </View>
      <Field
        label={t.vehicle.chassisNumber}
        hint={t.vehicle.chassisNumberHint}
        autoCapitalize="characters"
        value={value.chassisNumber}
        onChangeText={(x) => set('chassisNumber', x)}
      />
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {t.vehicle.transmission}
      </T>
      <View style={styles.row}>
        {TRANSMISSIONS.map((x) => (
          <Chip key={x} label={t.transmissions[x]} selected={value.transmission === x} onPress={() => set('transmission', value.transmission === x ? null : x)} />
        ))}
      </View>
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {t.vehicle.drivetrain}
      </T>
      <View style={styles.row}>
        {DRIVETRAINS.map((d) => (
          <Chip key={d} label={d.toUpperCase()} selected={value.drivetrain === d} onPress={() => set('drivetrain', value.drivetrain === d ? null : d)} />
        ))}
      </View>
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {t.vehicle.origin}
      </T>
      <View style={styles.row}>
        {ORIGINS.map((o) => (
          <Chip key={o} label={t.origins[o]} selected={value.origin === o} onPress={() => set('origin', value.origin === o ? null : o)} />
        ))}
      </View>
      <Field
        label={t.vehicle.importedYear}
        placeholder="2012"
        keyboardType="number-pad"
        value={value.importedYear}
        onChangeText={(x) => set('importedYear', x)}
      />
      <Field label={t.vehicle.story} placeholder={t.vehicle.storyPlaceholder} value={value.story} onChangeText={(x) => set('story', x)} multiline />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
