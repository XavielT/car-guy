import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { SelectField, selectOptions } from '@/components/pickers';
import { space } from '@/constants/theme';
import type { Drivetrain, Transmission, VehicleOrigin } from '@/lib/db/types';
import { t } from '@/lib/i18n';

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
      <SelectField<Transmission | null>
        label={t.vehicle.transmission}
        value={value.transmission}
        allowNone
        options={selectOptions(TRANSMISSIONS, (x) => t.transmissions[x])}
        onChange={(x) => set('transmission', x)}
      />
      <SelectField<Drivetrain | null>
        label={t.vehicle.drivetrain}
        value={value.drivetrain}
        allowNone
        options={selectOptions(DRIVETRAINS, (d) => d.toUpperCase())}
        onChange={(d) => set('drivetrain', d)}
      />
      <SelectField<VehicleOrigin | null>
        label={t.vehicle.origin}
        value={value.origin}
        allowNone
        options={selectOptions(ORIGINS, (o) => t.origins[o])}
        onChange={(o) => set('origin', o)}
      />
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
  half: { flex: 1, minWidth: 0 },
});
