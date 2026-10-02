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
  /** Hidden from the selector but kept with its history. Absent on legacy rows. */
  isArchived?: boolean;
  /**
   * The full schema-v2 row (IMP 28092026), for the screens that need identity:
   * nickname, status, engine, story. Absent on legacy/imported shapes.
   */
  detail?: import('./db/types').Vehicle;
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
  /**
   * "Se me olvidó registrar una carga anterior" — the odometer moved on fuel
   * that was never logged, so nothing measured across this point is true.
   * `computeEconomy` restarts the brim-to-brim chain here (PROMPT-06).
   *
   * Optional, not required: every row written before Phase 6 simply does not
   * have it, and `undefined` reads as false everywhere it is used.
   */
  missedPrevious?: boolean;
  station: string;
  notes: string;
  createdAt: string;
  /** v6 (note 4): the fuel gauge before / after pumping, 0 = E … 8 = F. Optional like missedPrevious. */
  gaugeBefore8?: number | null;
  gaugeAfter8?: number | null;
  /**
   * v10 (ADR-51): the readings as a fraction 0..1 and as the owner saw them ("4/9", "3/8", "45%"). The maths
   * reads the fraction; a row from before v10 has only the eighths (the migration backfilled both).
   */
  gaugeBeforeFrac?: number | null;
  gaugeAfterFrac?: number | null;
  gaugeBeforeRaw?: string | null;
  gaugeAfterRaw?: string | null;
  /** The reserve light was on before pumping. */
  inReserve?: boolean;
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
  /** Cifras "Incluir estimados en el promedio" (setting economy_include_estimates, note 4). */
  includeEstimates?: boolean;
  /** Cifras "Por echada (aprox.)" dotted series (setting economy_per_fill, note 9). Default on. */
  perFill?: boolean;
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
