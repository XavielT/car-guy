import { Chip } from '@/components/ui';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import type { FuelType } from '@/lib/types';
import { View } from 'react-native';

export function FuelPicker({
  value,
  onChange,
}: {
  value: FuelType;
  onChange: (t: FuelType) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {FUEL_ORDER.map((type) => (
        <Chip
          key={type}
          label={FUEL_CATALOG[type].label}
          selected={value === type}
          onPress={() => onChange(type)}
        />
      ))}
    </View>
  );
}
