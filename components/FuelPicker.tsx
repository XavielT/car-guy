import { SelectField } from '@/components/pickers';
import { t } from '@/lib/i18n';
import { FUEL_CATALOG, FUEL_ORDER } from '@/lib/fuel';
import type { FuelType } from '@/lib/types';

/** The fuel of a vehicle, a fill-up or a price: one field, the options in a sheet (ADR-60). */
export function FuelPicker({
  value,
  onChange,
  label = t.vehicle.fuel,
}: {
  value: FuelType;
  onChange: (t: FuelType) => void;
  label?: string;
}) {
  return (
    <SelectField<FuelType>
      label={label}
      value={value}
      options={FUEL_ORDER.map((type) => ({ value: type, label: FUEL_CATALOG[type].label }))}
      onChange={onChange}
    />
  );
}
