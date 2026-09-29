import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip } from '@/components/ui';
import { space } from '@/constants/theme';
import type { Drivetrain, Transmission, VehicleOrigin } from '@/lib/db/types';
import { es } from '@/lib/i18n/es';
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
      <Field label={es.vehicle.nickname} placeholder={es.vehicle.nicknamePlaceholder} value={value.nickname} onChangeText={(t) => set('nickname', t)} />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={es.vehicle.chassisCode}
            placeholder="AE85"
            autoCapitalize="characters"
            value={value.chassisCode}
            onChangeText={(t) => set('chassisCode', t)}
          />
        </View>
        <View style={styles.half}>
          <Field label={es.vehicle.engineCode} placeholder="4A-GE 20V" value={value.engineCode} onChangeText={(t) => set('engineCode', t)} />
        </View>
      </View>
      <Field
        label={es.vehicle.chassisNumber}
        hint={es.vehicle.chassisNumberHint}
        autoCapitalize="characters"
        value={value.chassisNumber}
        onChangeText={(t) => set('chassisNumber', t)}
      />
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicle.transmission}
      </T>
      <View style={styles.row}>
        {TRANSMISSIONS.map((t) => (
          <Chip key={t} label={es.transmissions[t]} selected={value.transmission === t} onPress={() => set('transmission', value.transmission === t ? null : t)} />
        ))}
      </View>
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicle.drivetrain}
      </T>
      <View style={styles.row}>
        {DRIVETRAINS.map((d) => (
          <Chip key={d} label={d.toUpperCase()} selected={value.drivetrain === d} onPress={() => set('drivetrain', value.drivetrain === d ? null : d)} />
        ))}
      </View>
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicle.origin}
      </T>
      <View style={styles.row}>
        {ORIGINS.map((o) => (
          <Chip key={o} label={es.origins[o]} selected={value.origin === o} onPress={() => set('origin', value.origin === o ? null : o)} />
        ))}
      </View>
      <Field
        label={es.vehicle.importedYear}
        placeholder="2012"
        keyboardType="number-pad"
        value={value.importedYear}
        onChangeText={(t) => set('importedYear', t)}
      />
      <Field label={es.vehicle.story} placeholder={es.vehicle.storyPlaceholder} value={value.story} onChangeText={(t) => set('story', t)} multiline />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
