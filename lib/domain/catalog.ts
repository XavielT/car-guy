/**
 * The seeded catalog: maintenance service types and inspection templates.
 *
 * Pure data, no imports from the database layer — `lib/db/seed.ts` turns it into
 * rows. Intervals follow the DR "severe service" defaults in
 * docs/imp-17092026/02-specs/01-data-model.md §3.4 (heat, dust, stop-and-go
 * traffic and fuel quality all shorten them); the inspection items are copied
 * from 01-research/02-maintenance-checklists-dr.md §A.2, §A.4 and §A.5.
 *
 * Every id is a stable slug. They are foreign keys in user data from the first
 * install, so an id here may never be renamed — add a new one and retire the old.
 */
import type { AppliesTo, Cadence, ServiceCategory, TemplateVehicleType } from '../db/types';

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '../db/types';

/**
 * `seedReminder` says which vehicles get a reminder for this service the moment
 * they are created: `false` = never (the user can still add one by hand).
 */
export type ServiceTypeSeed = {
  id: string;
  name: string;
  category: ServiceCategory;
  km: number | null;
  months: number | null;
  appliesTo: AppliesTo;
  seedReminder: false | AppliesTo;
  /** Diesel runs shorter intervals on fuel-side items. */
  dieselOverride?: { km?: number | null; months?: number | null };
  notes?: string;
};

export const SERVICE_TYPES: ServiceTypeSeed[] = [
  { id: 'aceite_motor', name: 'Aceite de motor y filtro', category: 'motor', km: 5000, months: 6, appliesTo: 'all', seedReminder: 'all', notes: 'Sintético: 10,000 km / 12 meses' },
  { id: 'filtro_aire', name: 'Filtro de aire', category: 'filtros', km: 20000, months: 12, appliesTo: 'all', seedReminder: 'all', dieselOverride: { km: 10000 }, notes: 'Diésel o ruta rural: 10,000 km' },
  { id: 'filtro_cabina', name: 'Filtro de cabina (A/C)', category: 'filtros', km: 15000, months: 12, appliesTo: 'all', seedReminder: 'all', notes: 'El A/C vive encendido en RD' },
  { id: 'filtro_combustible', name: 'Filtro de combustible', category: 'filtros', km: 40000, months: 24, appliesTo: 'all', seedReminder: 'all', dieselOverride: { km: 15000, months: 12 } },
  { id: 'bujias', name: 'Bujías', category: 'motor', km: 40000, months: null, appliesTo: 'gasolina', seedReminder: 'gasolina', notes: 'Iridio: 100,000 km' },
  { id: 'refrigerante', name: 'Refrigerante (cambio)', category: 'fluidos', km: 40000, months: 24, appliesTo: 'all', seedReminder: 'all', notes: 'El nivel se revisa en el chequeo, no aquí' },
  { id: 'liquido_frenos', name: 'Líquido de frenos', category: 'fluidos', km: null, months: 24, appliesTo: 'all', seedReminder: 'all' },
  { id: 'pastillas_frenos', name: 'Pastillas de freno (revisión/cambio)', category: 'frenos', km: 10000, months: 12, appliesTo: 'all', seedReminder: 'all' },
  { id: 'discos_frenos', name: 'Discos de freno', category: 'frenos', km: null, months: null, appliesTo: 'all', seedReminder: false },
  { id: 'aceite_transmision', name: 'Aceite de transmisión (ATF/CVT)', category: 'fluidos', km: 60000, months: 48, appliesTo: 'all', seedReminder: 'all', notes: 'CVT: 40,000 km' },
  { id: 'aceite_diferencial', name: 'Aceite de diferencial / transfer', category: 'fluidos', km: 40000, months: 24, appliesTo: 'all', seedReminder: 'diesel' },
  { id: 'liquido_direccion', name: 'Líquido de dirección', category: 'fluidos', km: 80000, months: 48, appliesTo: 'all', seedReminder: false },
  { id: 'correa_accesorios', name: 'Correa de accesorios', category: 'motor', km: 90000, months: 60, appliesTo: 'all', seedReminder: 'all', notes: 'Revisar en cada cambio de aceite' },
  { id: 'correa_tiempo', name: 'Correa de tiempo', category: 'motor', km: 100000, months: 72, appliesTo: 'all', seedReminder: false, notes: 'Solo si el motor usa correa y no cadena' },
  { id: 'bateria', name: 'Batería', category: 'electrico', km: null, months: 36, appliesTo: 'all', seedReminder: 'all', notes: 'Con este calor, 2–3 años es lo típico' },
  { id: 'rotacion_gomas', name: 'Rotación de gomas', category: 'gomas', km: 10000, months: 6, appliesTo: 'all', seedReminder: 'all', notes: 'Junto con el cambio de aceite' },
  { id: 'alineacion', name: 'Alineación', category: 'gomas', km: 20000, months: 12, appliesTo: 'all', seedReminder: 'all', notes: 'O después de un hoyo fuerte' },
  { id: 'balanceo', name: 'Balanceo', category: 'gomas', km: null, months: null, appliesTo: 'all', seedReminder: false },
  { id: 'cambio_gomas', name: 'Cambio de gomas', category: 'gomas', km: 50000, months: 72, appliesTo: 'all', seedReminder: false, notes: 'Por edad: 6–10 años según el DOT' },
  { id: 'limpiavidrios', name: 'Limpiavidrios (wipers)', category: 'carroceria', km: null, months: 12, appliesTo: 'all', seedReminder: 'all' },
  { id: 'servicio_ac', name: 'Servicio de A/C', category: 'otro', km: 50000, months: 24, appliesTo: 'all', seedReminder: 'all' },
  { id: 'amortiguadores', name: 'Amortiguadores', category: 'suspension', km: 80000, months: null, appliesTo: 'all', seedReminder: false },
  { id: 'suspension_revision', name: 'Revisión de suspensión y dirección', category: 'suspension', km: 20000, months: 12, appliesTo: 'all', seedReminder: false },
  { id: 'mangueras', name: 'Mangueras y correas (revisión)', category: 'motor', km: 10000, months: 12, appliesTo: 'all', seedReminder: false },
  { id: 'separador_agua', name: 'Drenar separador de agua (diésel)', category: 'filtros', km: 5000, months: 6, appliesTo: 'diesel', seedReminder: 'diesel' },
  { id: 'cadena_moto', name: 'Cadena / kit de arrastre', category: 'otro', km: 500, months: 1, appliesTo: 'motor', seedReminder: 'motor', notes: 'Lubricar; cambiar cerca de los 20,000 km' },
  { id: 'lavado', name: 'Lavado y detallado', category: 'carroceria', km: null, months: null, appliesTo: 'all', seedReminder: false },
  { id: 'otro', name: 'Otro', category: 'otro', km: null, months: null, appliesTo: 'all', seedReminder: false },
];

export type InspectionItemSeed = {
  group: string;
  label: string;
  how: string;
  warning: string;
  coldEngine?: boolean;
  onFail?: 'task' | 'reminder' | 'none';
  serviceTypeId?: string;
};

export type InspectionTemplateSeed = {
  id: string;
  name: string;
  cadence: Cadence;
  vehicleType: TemplateVehicleType;
  items: InspectionItemSeed[];
};

// Items reused across cadences — defined once so the wording never drifts.
const GOMAS_VISUAL: InspectionItemSeed = {
  group: 'Gomas',
  label: 'Gomas (visual)',
  how: 'Busca abombamientos, cortes, clavos o una goma obviamente baja; mira el patrón de desgaste.',
  warning: 'Abombamiento en el costado, desgaste en los bordes (alineación) o en el centro (exceso de aire).',
};

const FUGAS: InspectionItemSeed = {
  group: 'Fluidos',
  label: 'Fugas debajo del carro',
  how: 'Mira el piso donde pasaste la noche estacionado.',
  warning: 'Charco verde, naranja o rosado = refrigerante; negro o marrón = aceite; rojo = transmisión o dirección. Transparente casi siempre es agua del A/C, y eso es normal.',
};

const TESTIGOS: InspectionItemSeed = {
  group: 'Tablero',
  label: 'Testigos del tablero',
  how: 'Pon la llave en ON y confirma que todas las luces se apaguen después de arrancar.',
  warning: 'Temperatura subiendo, termómetro de refrigerante, lata de aceite, batería, check engine o freno.',
};

const FRENOS_SENSACION: InspectionItemSeed = {
  group: 'Frenos y dirección',
  label: 'Frenos (sensación)',
  how: 'En el primer frenazo del día, a poca velocidad: el pedal firme, sin jalar, sin ruido.',
  warning: 'Pedal esponjoso, jala hacia un lado, chillido o raspado, vibración.',
  serviceTypeId: 'pastillas_frenos',
};

const REFRIGERANTE: InspectionItemSeed = {
  group: 'Fluidos',
  label: 'Refrigerante',
  how: 'Solo con el motor frío: el nivel debe quedar entre Min y Max en el tanque plástico. Nunca abras el tapón del radiador caliente.',
  warning: 'Por debajo de Min, que haya que rellenar seguido (fuga), refrigerante oxidado o aceitoso, olor dulce, vapor.',
  coldEngine: true,
  serviceTypeId: 'refrigerante',
};

const ACEITE_MOTOR: InspectionItemSeed = {
  group: 'Fluidos',
  label: 'Aceite de motor',
  how: 'Motor frío y en piso plano: la varilla debe marcar entre Min y Max. Fíjate en el color.',
  warning: 'Por debajo de Min; lechoso (refrigerante en el aceite); negro y arenoso.',
  coldEngine: true,
  serviceTypeId: 'aceite_motor',
};

export const INSPECTION_TEMPLATES: InspectionTemplateSeed[] = [
  {
    id: 'carro_diario',
    name: 'Chequeo diario',
    cadence: 'diaria',
    vehicleType: 'carro',
    items: [FUGAS, TESTIGOS, GOMAS_VISUAL, FRENOS_SENSACION],
  },
  {
    id: 'carro_semanal',
    name: 'Chequeo semanal',
    cadence: 'semanal',
    vehicleType: 'carro',
    items: [
      REFRIGERANTE,
      ACEITE_MOTOR,
      {
        group: 'Fluidos',
        label: 'Agua del parabrisas',
        how: 'Rellena el depósito.',
        warning: 'Vacío. Agua con limpiador basta; aquí no hace falta anticongelante.',
      },
      GOMAS_VISUAL,
      {
        group: 'Luces',
        label: 'Luces',
        how: 'Prueba luces delanteras, freno, retroceso y direccionales contra una pared o con ayuda.',
        warning: 'Alguna bombilla quemada; mica opaca o amarillenta.',
      },
      FRENOS_SENSACION,
      {
        group: 'Exterior',
        label: 'Aire acondicionado',
        how: 'Enciéndelo: el aire debe salir notablemente más frío que la cabina.',
        warning: 'Sale tibio, o huele a humedad.',
        serviceTypeId: 'servicio_ac',
      },
      {
        group: 'Exterior',
        label: 'Bocina, espejos y cinturones',
        how: 'Prueba rápida de que todo funciona.',
        warning: '',
      },
      {
        group: 'Documentos',
        label: 'Documentos al día',
        how: 'Seguro vigente, marbete vigente y licencia contigo en el carro.',
        warning: 'Vencido es multa en la próxima ficha.',
        onFail: 'reminder',
      },
    ],
  },
  {
    id: 'carro_mensual',
    name: 'Chequeo mensual',
    cadence: 'mensual',
    vehicleType: 'carro',
    items: [
      {
        group: 'Gomas',
        label: 'Presión de gomas (incluida la de repuesto)',
        how: 'En frío, con manómetro, las 4 y la de repuesto, según la placa del marco de la puerta.',
        warning: 'Una goma 2–3 psi por debajo del resto es una fuga lenta. Es normal perder ~1 psi al mes.',
      },
      {
        group: 'Gomas',
        label: 'Labrado (dibujo)',
        how: 'Prueba de la moneda o mira las barras de desgaste. El mínimo legal es 1.6 mm.',
        warning: 'Barras de desgaste al ras, desgaste disparejo.',
        serviceTypeId: 'cambio_gomas',
      },
      {
        group: 'Fluidos',
        label: 'Líquido de frenos',
        how: 'El depósito entre Min y Max; el color debe ser claro o ámbar.',
        warning: 'Marrón oscuro, o el nivel bajando (pastillas gastadas o fuga).',
        coldEngine: true,
        serviceTypeId: 'liquido_frenos',
      },
      {
        group: 'Fluidos',
        label: 'Líquido de dirección',
        how: 'Si es hidráulica, revisa la varilla o el depósito en sus marcas Hot/Cold.',
        warning: 'Chillido al girar, nivel bajo.',
        serviceTypeId: 'liquido_direccion',
      },
      {
        group: 'Eléctrico',
        label: 'Batería y bornes',
        how: 'Bornes apretados y sin costra blanca o verde.',
        warning: 'Arranque lento, luces débiles, testigo de batería.',
        serviceTypeId: 'bateria',
      },
      {
        group: 'Motor',
        label: 'Correas y mangueras',
        how: 'Motor frío: aprieta las mangueras (firmes, ni blandas ni duras como piedra); la correa sin grietas ni brillo.',
        warning: 'Chillido al arrancar, grietas, hinchazón cerca de las abrazaderas, costra de refrigerante.',
        coldEngine: true,
        serviceTypeId: 'correa_accesorios',
      },
      {
        group: 'Exterior',
        label: 'Limpiaparabrisas',
        how: 'Actívalos con agua: deben limpiar sin rayar ni saltar.',
        warning: 'Rayas, goma rota.',
        serviceTypeId: 'limpiavidrios',
      },
      {
        group: 'Exterior',
        label: 'Repuesto, gato, llave y triángulo',
        how: 'Confirma que están y que la goma de repuesto tiene aire.',
        warning: 'La de repuesto se desinfla sola y nadie se acuerda de ella.',
      },
    ],
  },
  {
    id: 'diesel_semanal',
    name: 'Chequeo semanal (diésel)',
    cadence: 'semanal',
    vehicleType: 'diesel',
    items: [
      REFRIGERANTE,
      ACEITE_MOTOR,
      {
        group: 'Filtros',
        label: 'Separador de agua del combustible',
        how: 'Drénalo cuando encienda el testigo de agua en el combustible, y en cada cambio de aceite.',
        warning: 'La calidad del gasoil varía aquí, así que revísalo aunque el testigo no encienda.',
        serviceTypeId: 'separador_agua',
      },
      {
        group: 'Filtros',
        label: 'Filtro de aire (visual)',
        how: 'Míralo de cerca si andas en rutas polvorientas o rurales.',
        warning: 'Los turbodiésel son muy sensibles al polvo.',
        serviceTypeId: 'filtro_aire',
      },
      {
        group: 'Motor',
        label: 'Cara del intercooler y el radiador',
        how: 'Revisa que no estén tapados de lodo, hojas o insectos.',
        warning: 'Bloquean el aire y calientan el motor al remolcar o en subidas.',
      },
      {
        group: 'Tablero',
        label: 'Testigo de bujías incandescentes',
        how: 'Debe apagarse antes de que arranques.',
        warning: 'Arranque largo = bujías incandescentes o alimentación de combustible.',
      },
      GOMAS_VISUAL,
      FRENOS_SENSACION,
    ],
  },
  {
    id: 'motor_prerodaje',
    name: 'Antes de rodar (T-CLOCS)',
    cadence: 'antes_de_viaje',
    vehicleType: 'motor',
    items: [
      {
        group: 'Gomas y ruedas',
        label: 'Gomas y ruedas',
        how: 'Labrado y presión en frío; rayos y aros sin grietas; estado de las pastillas.',
        warning: 'Presión baja, aro golpeado, pastilla al mínimo.',
      },
      {
        group: 'Controles',
        label: 'Controles',
        how: 'Manubrio derecho y libre; cables bien ruteados y lubricados; el acelerador se mueve libre y cierra solo.',
        warning: 'Que acelere solo al girar el manubrio.',
      },
      {
        group: 'Luces y eléctrico',
        label: 'Luces y eléctrico',
        how: 'Bornes de batería limpios y apretados; faro alineado; luces traseras y direccionales; switches y espejos.',
        warning: 'Alguna luz que no prende, cable pelado.',
      },
      {
        group: 'Aceite y fluidos',
        label: 'Aceite y fluidos',
        how: 'Aceite de motor, aceite de caja, líquido hidráulico de freno o clutch, refrigerante si es líquida, y combustible.',
        warning: 'Fugas en empaques, sellos o mangueras.',
        coldEngine: true,
        serviceTypeId: 'aceite_motor',
      },
      {
        group: 'Chasis y cadena',
        label: 'Chasis y cadena',
        how: 'Chasis sin grietas, rodamientos de dirección, suspensión, tensión y lubricación de la cadena, tornillería.',
        warning: 'Lubrica la cadena cada ~500 km o después de lluvia.',
        serviceTypeId: 'cadena_moto',
      },
      {
        group: 'Parales',
        label: 'Parales',
        how: 'Pata lateral y central: resortes completos y sin daño.',
        warning: 'Que no suba sola al arrancar.',
      },
    ],
  },
];

/** Which inspection template a vehicle type starts on. */
export function templatesForVehicle(vehicleType: string, fuelType: string): TemplateVehicleType {
  if (vehicleType === 'motor') return 'motor';
  if (fuelType === 'gasoil_regular' || fuelType === 'gasoil_optimo') return 'diesel';
  return 'carro';
}
