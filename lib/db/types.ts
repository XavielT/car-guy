import type { EconomyUnit, VolumeUnit } from '../domain/units';
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
import { t } from '../i18n';

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
  // v2 (IMP 28092026)
  nickname: string | null;
  status: VehicleStatus;
  chassisCode: string | null;
  chassisNumber: string | null;
  engineCode: string | null;
  transmission: Transmission | null;
  drivetrain: Drivetrain | null;
  origin: VehicleOrigin | null;
  importedYear: number | null;
  story: string;
  heroMediaId: string | null;
  /** My role when the vehicle is shared with me; null = it is mine. */
  garageRole: GarageRole | null;
  // v6 (IMP 29092026). `tankVolume` is liters from here on (lib/domain/units.ts).
  volumeUnit: VolumeUnit;
  economyUnit: EconomyUnit;
  /** null → 10 % of the tank. */
  reserveVolumeL: number | null;
  /** The tank as typed, in `volumeUnit`. */
  tankVolumeEntered: number | null;
  /** "esperando piezas" — shown after the status. */
  statusNote: string;
  statusSince: string | null;
  /** lib/domain/refdata ids; `color`, `make`, `model` keep the free text / label. */
  bodyType: string | null;
  colorId: string | null;
  interiorColorId: string | null;
  /** refdata material id without its prefix: tela, cuero, piel-sintetica, vinil, alcantara, otro. */
  interiorMaterial: string | null;
  makeId: string | null;
  modelId: string | null;
  /** Redline on the speed dial. */
  limitKmh: number;
  tripMode: TripMode;
};

export type VehicleStatus =
  | 'activo'
  | 'proyecto'
  | 'en_taller'
  | 'accidentado'
  | 'guardado'
  | 'restauracion'
  | 'prestado'
  | 'vendido'
  | 'perdido';
export type InteriorMaterial = 'tela' | 'cuero' | 'vinil' | 'alcantara' | 'otro';
export type TripMode = 'auto' | 'manual' | 'off';
export type Transmission = 'manual' | 'automatica' | 'cvt' | 'otro';
export type Drivetrain = 'fwd' | 'rwd' | 'awd';
export type VehicleOrigin = 'jdm' | 'usdm' | 'eudm' | 'local' | 'otro';
export type GarageRole = 'owner' | 'editor' | 'viewer';

export type VehicleSpec = Syncable & {
  vehicleId: string;
  name: string;
  value: string;
  sortOrder: number;
};

/** 'trip_estimate' (v6, ADR-30): GPS distance since the last typed reading — a suggestion, never the truth. */
export type OdometerSource = 'fuel' | 'service' | 'inspection' | 'manual' | 'import' | 'mod' | 'track' | 'trip_estimate';

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
  // v6: `volume` is liters and `pricePerUnit` RD$ per liter (m³ for GNV).
  gaugeBeforeEighths: number | null;
  gaugeAfterEighths: number | null;
  /** The before reading was on reserve. */
  inReserve: boolean;
  /** The volume as typed, in `volumeEnteredUnit`. */
  volumeEntered: number | null;
  volumeEnteredUnit: 'gal' | 'l' | 'm3' | null;
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
  /** v2: the taller/contact that did the job. */
  contactId: string | null;
};

export type ServiceRecordItem = Syncable & {
  serviceRecordId: string;
  serviceTypeId: string;
  notes: string;
  // v6: the oil that went in, when the item is an oil change.
  oilViscosity: string | null;
  oilType: OilType | null;
  oilSpec: string | null;
  oilBrand: string | null;
};

export type OilType = 'mineral' | 'semisintetico' | 'sintetico';

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

/** Read at the moment of use, so it follows the language (ADR-39). */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = new Proxy({} as Record<ExpenseCategory, string>, {
  get: (_target, key) => (t.expenseCategories as Record<string, string>)[key as string],
  ownKeys: () => Reflect.ownKeys(t.expenseCategories),
  getOwnPropertyDescriptor: (_target, key) => ({ value: (t.expenseCategories as Record<string, string>)[key as string], enumerable: true, configurable: true }),
});

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
  /** 'con_avisos': no failure, but at least one ATENCIÓN (IMP 29092026 note 3). */
  status: 'ok' | 'con_avisos' | 'con_fallas';
  durationSec: number | null;
  notes: string;
};

export type InspectionResult = Syncable & {
  inspectionId: string;
  itemId: string;
  labelSnapshot: string;
  /** 'atencion' (IMP 29092026 note 3): keep an eye on it — not a failure. */
  result: 'ok' | 'atencion' | 'falla' | 'na';
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
  // v2 (IMP 28092026)
  takenAt: string | null;
  datePrecision: 'day' | 'month' | 'year';
  source: 'camera' | 'library' | 'import' | 'web';
  remoteThumbPath: string | null;
  thumbRelPath: string | null;
  /** Web only, never synced. */
  thumbBlob: Uint8Array | null;
  blurhash: string | null;
  caption: string;
  isFavorite: boolean;
};

/** One row of the history_feed view. */
export type HistoryEntry = {
  id: string;
  vehicleId: string;
  kind: 'combustible' | 'mantenimiento' | 'reparacion' | 'mejora' | 'gasto' | 'chequeo' | 'mod' | 'hito' | 'evento' | 'pista' | 'obd' | 'viaje';
  occurredAt: string;
  /** Tie-breaker for same-day entries (v2 view). */
  createdAt?: string | null;
  odometerKm: number | null;
  title: string;
  subtitle: string | null;
  amountDop: number | null;
  /** v5 view: photos on a check's results; null for other kinds. */
  photos?: number | null;
};

// ---------------------------------------------------------------------------
// Schema v2 (IMP 28092026) — docs/imp-28092026/02-specs/01-data-model-v2.md.
// JSON columns are kept as their raw TEXT; lib/domain parses them.
// ---------------------------------------------------------------------------

export type VehicleOwnership = Syncable & {
  vehicleId: string;
  acquiredAt: string | null;
  acquiredKm: number | null;
  acquiredPrice: number | null;
  acquiredFrom: string | null;
  soldAt: string | null;
  soldKm: number | null;
  soldPrice: number | null;
  soldTo: string | null;
  reason: string | null;
  isCurrent: boolean;
};

export type AlbumItem = Syncable & {
  vehicleId: string;
  mediaId: string;
  milestoneId: string | null;
  modId: string | null;
  trackEventId: string | null;
  sortOrder: number;
  /** v6: 'vehicle' = in the vehicle's gallery (and still on the album timeline). */
  role: AlbumRole;
};

/** v8: 'evento' = a proof added from an event's editor (ADR-44); still on the album timeline. */
export type AlbumRole = 'album' | 'vehicle' | 'evento';

export type MilestoneKind =
  | 'compra'
  | 'swap'
  | 'restauracion'
  | 'primer_track'
  | 'accidente'
  | 'venta'
  | 'pintura'
  /** v6: a status change ("Pasó a En el taller") — history and album show it with no table of its own. */
  | 'estado'
  | 'otro';

export type Milestone = Syncable & {
  vehicleId: string;
  kind: MilestoneKind;
  occurredAt: string;
  odometerKm: number | null;
  title: string;
  story: string;
  coverMediaId: string | null;
  // v8 events (ADR-44): 'hito' is a plain milestone; anything else is an event.
  eventType: EventType;
  severity: EventSeverity | null;
  costDop: number | null;
  /** What is still to do ("pintar el guardafango"); '' when nothing. */
  pending: string;
  resolvedAt: string | null;
  linkedServiceId: string | null;
  linkedModId: string | null;
  linkedInspectionId: string | null;
  locationLabel: string;
};

export type EventType =
  | 'hito'
  | 'accidente'
  | 'dano_menor'
  | 'averia'
  | 'sobrecalentamiento'
  | 'robo'
  | 'multa'
  | 'viaje_largo'
  | 'junte'
  | 'otro';

export type EventSeverity = 'leve' | 'moderado' | 'grave';

export type ModCategory = Syncable & {
  name: string;
  icon: string | null;
  sortOrder: number;
  isSeeded: boolean;
};

export type ModStatus = 'planeado' | 'pedido' | 'instalado' | 'quitado' | 'vendido' | 'danado';

export type Mod = Syncable & {
  vehicleId: string;
  categoryId: string;
  name: string;
  brand: string | null;
  partNumber: string | null;
  variant: string | null;
  status: ModStatus;
  installedAt: string | null;
  installedKm: number | null;
  removedAt: string | null;
  removedKm: number | null;
  installerType: 'yo' | 'taller' | 'amigo';
  contactId: string | null;
  costPartDop: number;
  costLaborDop: number;
  costShippingDop: number;
  costCustomsDop: number;
  priceForeign: number | null;
  currency: string | null;
  fxRateToDop: number | null;
  vendor: string | null;
  vendorUrl: string | null;
  replacesModId: string | null;
  affectsSpecs: boolean;
  /** JSON object — see SpecEffects in lib/domain. */
  specEffects: string;
  serviceRecordId: string | null;
  soldPriceDop: number | null;
  soldTo: string | null;
  /** JSON array of strings. */
  tags: string;
  notes: string;
};

export type ModMedia = Syncable & {
  modId: string;
  mediaId: string;
  role: 'antes' | 'despues' | 'instalacion' | 'recibo' | 'dyno' | 'foto';
};

export type VehicleSpecsheet = Syncable & {
  vehicleId: string;
  presetId: string | null;
  stock: string;
  overrides: string;
  fieldSources: string;
  verifiedFields: string;
  oilCapacityL: number | null;
  oilCapacityFilterL: number | null;
  oilGrade: string | null;
  oilSpec: string | null;
  oilFilterPn: string | null;
  coolantCapacityL: number | null;
  coolantType: string | null;
  transOilL: number | null;
  transOilSpec: string | null;
  diffOilL: number | null;
  diffOilSpec: string | null;
  brakeFluid: string | null;
  psFluid: string | null;
  sparkPlugPn: string | null;
  plugGapMm: number | null;
  batterySpec: string | null;
  tireSizeOemF: string | null;
  tireSizeOemR: string | null;
  psiOemF: number | null;
  psiOemR: number | null;
  boltPattern: string | null;
  centerBoreMm: number | null;
  lugTorqueNm: number | null;
  lugThread: string | null;
  fuelTankL: number | null;
  fuelOctane: number | null;
  // v8 "what I actually buy" (the car's memory, note 6)
  oilBrand: string | null;
  oilProduct: string | null;
  oilFilterBrand: string | null;
  airFilterPn: string | null;
  cabinFilterPn: string | null;
  fuelFilterPn: string | null;
  wiperSizes: string | null;
  bulbLow: string | null;
  bulbHigh: string | null;
  tireCurrentF: string | null;
  tireCurrentR: string | null;
  batteryBrand: string | null;
  whereBought: string;
};

/** v8: anything else worth remembering about a car, key/value (synced, member-readable). */
export type VehicleFact = Syncable & {
  vehicleId: string;
  label: string;
  value: string;
  groupName: VehicleFactGroup;
  sortOrder: number;
};

export type VehicleFactGroup = 'motor' | 'gomas' | 'electrico' | 'carroceria' | 'interior' | 'papeles' | 'otros';

export type FuelPriceSource = 'micm' | 'estacion' | 'recibo' | 'app' | 'otro' | 'manual';

/** v8: the user's own price history (synced). RD$ per the fuel's posted unit (gal, m³). */
export type FuelPrice = Syncable & {
  fuelType: string;
  price: number;
  /** ISO date 'YYYY-MM-DD'. */
  validFrom: string;
  source: FuelPriceSource;
  station: string;
  note: string;
};

/** v8: local cache of the cloud's MICM rows — pull-only, never pushed; id `${weekStart}:${fuelType}`. */
export type FuelPriceRef = {
  id: string;
  fuelType: string;
  price: number;
  weekStart: string;
  weekEnd: string;
  pdfUrl: string | null;
  importedAt: string;
  stale: boolean;
};

/** v8: which terms version this person accepted, where (synced so a signed-in user carries it). */
export type LegalAcceptance = Syncable & {
  version: string;
  acceptedAt: string;
  locale: string;
  platform: string;
  deviceId: string;
};

export type SpecSnapshot = Syncable & {
  vehicleId: string;
  label: string;
  asOf: string;
  specs: string;
  coverMediaId: string | null;
};

export type TorqueSpec = Syncable & {
  vehicleId: string;
  item: string;
  valueNm: number;
  stage: string | null;
  source: string | null;
  mediaId: string | null;
  notes: string;
};

export type WishlistItem = Syncable & {
  vehicleId: string;
  categoryId: string | null;
  name: string;
  brand: string | null;
  partNumber: string | null;
  /** 1 próximo, 2 pronto, 3 algún día. */
  priority: 1 | 2 | 3;
  estPriceForeign: number | null;
  currency: string | null;
  estShippingDop: number | null;
  estCustomsDop: number | null;
  estTotalDop: number | null;
  url: string | null;
  vendor: string | null;
  targetDate: string | null;
  status: 'idea' | 'ahorrando' | 'pedido' | 'convertido' | 'descartado';
  convertedModId: string | null;
  notes: string;
};

export type InventoryItem = Syncable & {
  /** null = garage stock, not on any car. */
  ownerVehicleId: string | null;
  kind: 'pieza' | 'aro' | 'goma' | 'fluido' | 'herramienta' | 'consumible';
  name: string;
  brand: string | null;
  partNumber: string | null;
  qty: number;
  unit: string | null;
  condition: 'nuevo' | 'usado' | 'core';
  location: string | null;
  costDop: number | null;
  acquiredAt: string | null;
  /** JSON array of vehicle ids. */
  fitsVehicleIds: string;
  mediaId: string | null;
  notes: string;
  /** v7 / sql/023: the mod "Usar en un mod" put it into — its cost is then the mod's. */
  usedInModId: string | null;
};

export type WheelSet = Syncable & {
  vehicleId: string;
  name: string;
  brand: string | null;
  model: string | null;
  widthIn: number | null;
  diamIn: number | null;
  offsetMm: number | null;
  boltPattern: string | null;
  centerBoreMm: number | null;
  qty: number;
  positionPref: string;
  status: 'montado' | 'guardado' | 'vendido';
  mediaId: string | null;
  notes: string;
};

export type TirePosition = 'fl' | 'fr' | 'rl' | 'rr' | 'spare' | 'unmounted';

export type Tire = Syncable & {
  vehicleId: string;
  wheelSetId: string | null;
  brand: string | null;
  model: string | null;
  size: string | null;
  widthMm: number | null;
  aspect: number | null;
  rimIn: number | null;
  loadIndex: string | null;
  speedRating: string | null;
  dotCode: string | null;
  dotWeek: number | null;
  dotYear: number | null;
  compound: string | null;
  treadwear: number | null;
  position: TirePosition;
  treadMmNew: number | null;
  treadMmCurrent: number | null;
  heatCycles: number;
  purchasedAt: string | null;
  costDop: number | null;
  status: 'nueva' | 'en_uso' | 'guardada' | 'quemada' | 'vendida';
};

/** Local-only, bundled — not Syncable. */
export type DtcCode = {
  code: string;
  system: string;
  descEn: string;
  descEs: string;
  isGeneric: boolean;
};

export type VehicleDtcEvent = Syncable & {
  vehicleId: string;
  code: string;
  seenAt: string;
  odometerKm: number | null;
  clearedAt: string | null;
  repairRecordId: string | null;
  notes: string;
};

export type ContactKind = 'mecanico' | 'gomera' | 'dealer' | 'pintor' | 'grua' | 'electrico' | 'otro';

export type Contact = Syncable & {
  name: string;
  kind: ContactKind;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  notes: string;
  rating: number | null;
};

export type FluidGuideItem = Syncable & {
  vehicleId: string;
  kind: 'aceite' | 'coolant' | 'frenos' | 'direccion' | 'atf' | 'washer' | 'bateria' | 'filtro_aire' | 'otro';
  mediaId: string | null;
  how: string;
  notes: string;
  sortOrder: number;
};

export type Venue = Syncable & {
  name: string;
  city: string | null;
  type: 'circuito' | 'drift' | 'drag' | 'autocross' | 'calle' | 'otro';
  layout: string | null;
  lengthM: number | null;
  lat: number | null;
  lng: number | null;
  isSeeded: boolean;
  notes: string;
};

export type TrackDiscipline = 'track_day' | 'drift' | 'drag' | 'autocross' | 'junte' | 'prueba';

export type TrackEvent = Syncable & {
  vehicleId: string;
  venueId: string | null;
  /** The circuit's configuration ("completo", "corto"…), free text; best laps are per venue + layout. */
  layout: string | null;
  occurredAt: string;
  title: string;
  organizer: string | null;
  discipline: TrackDiscipline;
  weather: string | null;
  ambientC: number | null;
  trackTempC: number | null;
  trackCondition: string | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
  entryFeeDop: number | null;
  fuelCostDop: number | null;
  otherCostDop: number | null;
  notes: string;
};

export type TrackSession = Syncable & {
  eventId: string;
  seq: number;
  kind: 'practica' | 'clasificacion' | 'batalla' | 'cronometrada' | 'prueba' | 'pasada_drag';
  startedAt: string | null;
  durationMin: number | null;
  laps: number | null;
  runs: number | null;
  bestLapMs: number | null;
  secondBestMs: number | null;
  /** JSON array of ms. */
  sectorsMs: string;
  zero100Ms: number | null;
  quarterMileMs: number | null;
  quarterMileTrapKmh: number | null;
  sixtyFootMs: number | null;
  fuelLoadL: number | null;
  ballastKg: number | null;
  driver: string | null;
  passenger: boolean;
  carFeel: string | null;
  rating: number | null;
  notes: string;
  incident: string | null;
  videoUrl: string | null;
};

export type SetupSheet = Syncable & {
  sessionId: string;
  tireSetFId: string | null;
  tireSetRId: string | null;
  psiColdFl: number | null;
  psiColdFr: number | null;
  psiColdRl: number | null;
  psiColdRr: number | null;
  psiHotFl: number | null;
  psiHotFr: number | null;
  psiHotRl: number | null;
  psiHotRr: number | null;
  camberFl: number | null;
  camberFr: number | null;
  camberRl: number | null;
  camberRr: number | null;
  toeFMm: number | null;
  toeRMm: number | null;
  casterL: number | null;
  casterR: number | null;
  rhFlMm: number | null;
  rhFrMm: number | null;
  rhRlMm: number | null;
  rhRrMm: number | null;
  springF: number | null;
  springR: number | null;
  springUnit: string;
  bumpF: number | null;
  reboundF: number | null;
  bumpR: number | null;
  reboundR: number | null;
  clicksTotal: number | null;
  swaybarF: string | null;
  swaybarR: string | null;
  padF: string | null;
  padR: string | null;
  brakeBias: string | null;
  steeringAngleDeg: number | null;
  hydro: boolean;
  lsdType: string | null;
  lsdPreload: string | null;
  tireSizeF: string | null;
  tireSizeR: string | null;
  compoundF: string | null;
  compoundR: string | null;
  twoStepRpm: number | null;
  revLimitRpm: number | null;
  /** JSON array of field names. */
  changedFromPrevious: string;
};

export type ConsumableUsage = Syncable & {
  eventId: string;
  sessionId: string | null;
  tireId: string | null;
  wheelSetId: string | null;
  kind: 'ciclo_goma' | 'goma_quemada' | 'medida_pastilla' | 'fluido' | 'combustible';
  qty: number | null;
  unit: string | null;
  padThicknessMm: number | null;
  treadMm: number | null;
  notes: string;
};

export type VehicleShare = Syncable & {
  vehicleId: string;
  slug: string | null;
  visibility: 'private' | 'link' | 'public';
  showPlate: boolean;
  showVin: boolean;
  showCosts: boolean;
  showLocation: boolean;
  showOdometer: boolean;
  showMaintenance: boolean;
  showMods: boolean;
  showTrack: boolean;
  showDocs: boolean;
  showStory: boolean;
  /** v7 / sql/022: the car's status on the page (off unless chosen). */
  showStatus: boolean;
  /** v8: the public page's tires block (sql/025 public_dossier). */
  showTires: boolean;
  /** v9 / sql/032: "Lo que uso" on the public page (off unless chosen). */
  showMemory: boolean;
  /** v9 / sql/032: the public "Lo que uso" rows as the phone worded them (JSON), published only with showMemory. */
  memorySummary: string | null;
  /** v7 / sql/022: "lo que me ha costado" as the phone computed it (JSON), published only with showCosts. */
  costsSummary: string | null;
  ogMediaId: string | null;
  publishedAt: string | null;
  revokedAt: string | null;
};

export type VehicleMember = Syncable & {
  vehicleId: string;
  userId: string;
  role: GarageRole;
  displayName: string | null;
};

// ---------------------------------------------------------------------------
// Schema v6 (IMP 29092026) — trips. docs/imp-29092026/02-specs/01-data-model-v6.md §1.4.
// ---------------------------------------------------------------------------

export type TripSource = 'auto' | 'manual';
export type TripStatus = 'recording' | 'done' | 'discarded';
export type TripRole = 'conductor' | 'pasajero';

export type Trip = Syncable & {
  vehicleId: string;
  source: TripSource;
  status: TripStatus;
  role: TripRole;
  startedAt: string;
  endedAt: string | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  startLabel: string;
  endLabel: string;
  distanceM: number;
  durationS: number;
  movingS: number;
  avgKmh: number | null;
  avgMovingKmh: number | null;
  maxKmh: number | null;
  /** JSON: seconds in <30, 30–60, 60–90, 90–120, 120+ km/h. */
  speedBuckets: string;
  /** Google polyline, precision 5, simplified. */
  polyline: string | null;
  /** JSON [minLat, minLng, maxLat, maxLng]. */
  bbox: string | null;
  segments: number;
  odometerReadingId: string | null;
  notes: string;
  /** v8: JSON {raw_points, simplified_points, dropped_excursions, mode} from finalize; null before 2.4. */
  diagnostics?: string | null;
};

/** Local only (never synced), purged 30 days after its trip is done. */
export type TripPoint = {
  tripId: string;
  /** epoch ms */
  t: number;
  lat: number;
  lng: number;
  /** m/s as reported; null unknown */
  speed: number | null;
  acc: number | null;
  alt: number | null;
  heading: number | null;
};
