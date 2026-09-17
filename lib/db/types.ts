/**
 * TypeScript mirrors of the schema v1 tables.
 *
 * Columns are snake_case in SQLite and camelCase here; the mapping is mechanical
 * and lives in lib/db/repos/base.ts, so these types stay declarative.
 *
 * Every syncable row carries the ADR-03 quartet: created_at, updated_at,
 * deleted_at (tombstone) and synced_at (local only, never sent).
 */
import type { FuelType } from '../types';

export type Syncable = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncedAt: string | null;
};

export type VehicleType = 'carro' | 'jeepeta' | 'camioneta' | 'motor' | 'camion' | 'guagua' | 'otro';

export type Vehicle = Syncable & {
  name: string;
  type: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  color: string | null;
  plate: string | null;
  vin: string | null;
  defaultFuelType: FuelType;
  tankVolume: number | null;
  initialOdometerKm: number | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  soldDate: string | null;
  soldPrice: number | null;
  photoMediaId: string | null;
  notes: string;
  isArchived: boolean;
  sortOrder: number;
};

export type VehicleSpec = Syncable & {
  vehicleId: string;
  name: string;
  value: string;
  sortOrder: number;
};

export type OdometerSource = 'fuel' | 'service' | 'inspection' | 'manual' | 'import';

export type OdometerReading = Syncable & {
  vehicleId: string;
  occurredAt: string;
  valueKm: number;
  source: OdometerSource;
  sourceId: string | null;
};

export type FuelLog = Syncable & {
  vehicleId: string;
  occurredAt: string;
  odometerKm: number;
  volume: number;
  pricePerUnit: number;
  totalDop: number;
  fuelType: FuelType;
  isFullTank: boolean;
  /** "se me olvidó registrar la anterior" — breaks the brim-to-brim chain. */
  missedPrevious: boolean;
  station: string;
  notes: string;
};

export type ServiceCategory =
  | 'motor' | 'frenos' | 'gomas' | 'fluidos' | 'filtros'
  | 'electrico' | 'suspension' | 'carroceria' | 'otro';

export type AppliesTo = 'all' | 'gasolina' | 'diesel' | 'motor';

export type ServiceType = Syncable & {
  name: string;
  category: ServiceCategory;
  defaultIntervalKm: number | null;
  defaultIntervalMonths: number | null;
  appliesTo: AppliesTo;
  isSeeded: boolean;
  sortOrder: number;
};

export type ServiceKind = 'mantenimiento' | 'reparacion' | 'mejora';

export type ServiceRecord = Syncable & {
  vehicleId: string;
  kind: ServiceKind;
  occurredAt: string;
  odometerKm: number | null;
  title: string;
  description: string;
  costPartsDop: number;
  costLaborDop: number;
  totalDop: number;
  shop: string;
  warrantyUntilDate: string | null;
  warrantyUntilKm: number | null;
  sourceInspectionId: string | null;
  sourceTaskId: string | null;
};

export type ServiceRecordItem = Syncable & {
  serviceRecordId: string;
  serviceTypeId: string;
  notes: string;
};

export type Part = Syncable & {
  serviceRecordId: string;
  name: string;
  partNumber: string | null;
  brand: string | null;
  quantity: number;
  unitCostDop: number | null;
};

export const EXPENSE_CATEGORIES = [
  'seguro', 'marbete', 'impuesto', 'multa', 'peaje',
  'parqueo', 'lavado', 'financiamiento', 'accesorio', 'grua', 'otro',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  seguro: 'Seguro',
  marbete: 'Marbete',
  impuesto: 'Impuesto',
  multa: 'Multa',
  peaje: 'Peaje',
  parqueo: 'Parqueo',
  lavado: 'Lavado',
  financiamiento: 'Financiamiento',
  accesorio: 'Accesorio',
  grua: 'Grúa',
  otro: 'Otro',
};

export type Expense = Syncable & {
  vehicleId: string;
  occurredAt: string;
  odometerKm: number | null;
  category: ExpenseCategory;
  amountDop: number;
  description: string;
  vendor: string;
};

export type ReminderMetric = 'date' | 'km' | 'both';
export type LegalKind = 'marbete' | 'seguro' | 'licencia' | 'revision_tecnica';

export type Reminder = Syncable & {
  vehicleId: string;
  title: string;
  serviceTypeId: string | null;
  legalKind: LegalKind | null;
  metric: ReminderMetric;
  dueDate: string | null;
  dueKm: number | null;
  isRecurring: boolean;
  intervalMonths: number | null;
  intervalDays: number | null;
  intervalKm: number | null;
  fixedInterval: boolean;
  thresholdDays: number | null;
  thresholdKm: number | null;
  notes: string;
  lastCompletedAt: string | null;
  lastCompletedKm: number | null;
  lastCompletedRecordId: string | null;
  snoozedUntil: string | null;
  isEnabled: boolean;
};

export type Cadence = 'diaria' | 'semanal' | 'mensual' | 'antes_de_viaje' | 'manual';
export type TemplateVehicleType = 'carro' | 'diesel' | 'motor';

export type InspectionTemplate = Syncable & {
  vehicleId: string | null;
  name: string;
  cadence: Cadence;
  vehicleType: TemplateVehicleType;
  isSeeded: boolean;
  isEnabled: boolean;
};

export type OnFail = 'task' | 'reminder' | 'none';

export type InspectionItem = Syncable & {
  templateId: string;
  groupName: string;
  label: string;
  how: string;
  warning: string;
  requiresColdEngine: boolean;
  onFail: OnFail;
  relatedServiceTypeId: string | null;
  sortOrder: number;
};

export type Inspection = Syncable & {
  vehicleId: string;
  templateId: string;
  occurredAt: string;
  odometerKm: number | null;
  status: 'ok' | 'con_fallas';
  durationSec: number | null;
  notes: string;
};

export type InspectionResult = Syncable & {
  inspectionId: string;
  itemId: string;
  labelSnapshot: string;
  result: 'ok' | 'falla' | 'na';
  note: string;
  mediaId: string | null;
};

export type Task = Syncable & {
  vehicleId: string;
  title: string;
  kind: ServiceKind;
  priority: 'critica' | 'normal' | 'baja';
  status: 'pendiente' | 'en_progreso' | 'hecha';
  estimatedCostDop: number | null;
  notes: string;
  sourceInspectionResultId: string | null;
  doneRecordId: string | null;
};

export type DocumentKind = 'seguro' | 'marbete' | 'matricula' | 'licencia' | 'factura' | 'garantia' | 'otro';

export type VehicleDocument = Syncable & {
  vehicleId: string;
  kind: DocumentKind;
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  reminderId: string | null;
  mediaId: string | null;
  notes: string;
};

export type Media = Syncable & {
  ownerTable: string;
  ownerId: string;
  kind: 'photo' | 'pdf';
  mime: string;
  relPath: string | null;
  blob: Uint8Array | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  remotePath: string | null;
};

/** One row of the history_feed view. */
export type HistoryEntry = {
  id: string;
  vehicleId: string;
  kind: 'combustible' | 'mantenimiento' | 'reparacion' | 'mejora' | 'gasto' | 'chequeo';
  occurredAt: string;
  odometerKm: number | null;
  title: string;
  subtitle: string | null;
  amountDop: number | null;
};
