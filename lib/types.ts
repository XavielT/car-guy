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

/**
 * ---------------------------------------------------------------------------
 * Legacy shapes — Tu Combustible RD's AsyncStorage blob and backup v1.
 *
 * From Phase 2 on, the app's real types live in lib/db/types.ts. These stay
 * because the importer must read that format forever (decision D1), and because
 * the screens PROMPT-04/06 replace still speak them through the store.
 * ---------------------------------------------------------------------------
 */

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

export const EXPENSE_CATEGORIES = [
  'maintenance',
  'repair',
  'insurance',
  'tax',
  'toll',
  'parking',
  'wash',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  odometerKm: number | null;
  amountDop: number;
  category: ExpenseCategory;
  description: string;
  createdAt: string;
};

export type MaintenanceReminder = {
  id: string;
  vehicleId: string;
  title: string;
  dueDate: string | null;
  dueOdometerKm: number | null;
  completedAt: string | null;
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
  expenses: Expense[];
  reminders: MaintenanceReminder[];
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

/** Aliases that say plainly which side of the migration a type belongs to. */
export type LegacyVehicle = Vehicle;
export type LegacyFillUp = FillUp;
export type LegacyExpense = Expense;
export type LegacyExpenseCategory = ExpenseCategory;
export type LegacyMaintenanceReminder = MaintenanceReminder;
export type LegacySettings = Settings;
export type LegacyAppData = AppData;
