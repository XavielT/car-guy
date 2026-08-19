export const FUEL_TYPES = [
  'premium',
  'regular',
  'gasoil_regular',
  'gasoil_optimo',
  'glp',
  'gnv',
] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export type FuelGroup = 'gasolina' | 'gasoil' | 'glp' | 'gnv';

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
  defaultFuelType: FuelType;
  tankVolume: number | null;
  createdAt: string;
};

export type FillUp = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  odometerKm: number;
  volume: number;
  pricePerUnit: number;
  totalDop: number;
  fuelType: FuelType;
  isFullTank: boolean;
  station: string;
  notes: string;
  createdAt: string;
};

export type ReferencePrices = Record<FuelType, number>;

export type Settings = {
  activeVehicleId: string | null;
  referencePrices: ReferencePrices;
  priceWeekLabel: string;
};

export type AppData = {
  vehicles: Vehicle[];
  fillups: FillUp[];
  settings: Settings;
};

export type EconomyPoint = {
  fillUpId: string;
  occurredAt: string;
  distanceKm: number;
  volume: number;
  kmPerUnit: number;
  costPerKm: number | null;
};
