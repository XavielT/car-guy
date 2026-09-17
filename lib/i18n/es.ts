/**
 * Every user-facing string, in one place (ADR-14).
 *
 * Car Guy is Spanish-only and stays that way this cycle; centralising the copy
 * is about being able to change a word everywhere at once and to keep the voice
 * consistent, not about shipping English.
 *
 * Voice: second person, direct, DR vocabulary — *gomas*, *jeepeta*, *bomba*,
 * *taller*, *marbete*. Say what the number means. No exclamation marks except
 * the one celebratory line after a completed check.
 *
 * New code uses this. The legacy fuel screens keep their inline strings until
 * PROMPT-06 restyles them.
 */
export const es = {
  app: {
    name: 'Car Guy',
    tagline: 'Tu carro, al día.',
  },

  tabs: {
    inicio: 'Inicio',
    chequeo: 'Chequeo',
    historial: 'Historial',
    cifras: 'Cifras',
    mas: 'Más',
  },

  home: {
    eyebrow: 'CAR GUY',
    title: 'Tablero',
    addVehicle: '+ Agregar',
    odometerUnit: 'km',
    odometerEmpty: 'Sin lecturas',
    odometerTapHint: 'Toca para actualizar',
    updatedToday: 'actualizado hoy',
    updatedYesterday: 'actualizado ayer',
    updatedDaysAgo: (days: number) => `actualizado hace ${days} días`,
    allGood: 'Todo al día',
    pending: (n: number) => (n === 1 ? '1 recordatorio pendiente' : `${n} recordatorios pendientes`),
    monthStrip: 'Este mes',
    monthSpend: 'Gasto',
    monthFillups: 'Cargas',
    monthKm: 'Km recorridos',
  },

  quickActions: {
    fuel: 'Combustible',
    check: 'Chequeo',
    service: 'Mantenimiento',
    expense: 'Gasto',
  },

  vehicle: {
    newTitle: 'Nuevo vehículo',
    editTitle: 'Editar vehículo',
    name: 'Nombre',
    namePlaceholder: 'Corolla, la jeepeta, el motor…',
    type: 'Tipo',
    make: 'Marca',
    makePlaceholder: 'Toyota, Honda, Hyundai…',
    model: 'Modelo',
    modelPlaceholder: 'Corolla, CR-V…',
    year: 'Año',
    color: 'Color',
    plate: 'Placa',
    vin: 'Chasis (VIN)',
    fuel: 'Combustible de fábrica',
    tank: 'Tanque (gal)',
    odometer: 'Odómetro actual (km)',
    odometerHint: 'Lo que marca ahora mismo. Se usa para calcular los mantenimientos.',
    synthetic: '¿Aceite sintético?',
    syntheticHint: 'Con sintético el cambio de aceite se espacia a 10,000 km o 12 meses.',
    purchaseSection: 'Compra (opcional)',
    purchaseDate: 'Fecha de compra',
    purchasePrice: 'Precio de compra (RD$)',
    photo: 'Foto',
    notes: 'Notas',
    save: 'Guardar vehículo',
    create: 'Agregar vehículo',
    // Validation
    nameRequired: 'Ponle un nombre para reconocerlo.',
    yearRange: (min: number, max: number) => `El año debe estar entre ${min} y ${max}.`,
    odometerNegative: 'El odómetro no puede ser negativo.',
  },

  vehicleTypes: {
    carro: 'Carro',
    jeepeta: 'Jeepeta',
    camioneta: 'Camioneta',
    motor: 'Motor',
    camion: 'Camión',
    guagua: 'Guagua',
    otro: 'Otro',
  },

  profile: {
    noPhoto: 'Sin foto',
    currentOdometer: 'Odómetro',
    addReading: 'Agregar lectura',
    specs: 'Especificaciones',
    specsEmpty: 'Guarda aquí lo que siempre se te olvida: presión de gomas, tipo de aceite, medida de las gomas.',
    addSpec: 'Agregar especificación',
    specName: 'Qué',
    specValue: 'Valor',
    suggestions: 'Sugerencias',
    totalSpend: 'Gasto total',
    kmLogged: 'Km registrados',
    fillupCount: 'Cargas',
    serviceCount: 'Servicios',
    edit: 'Editar',
    archive: 'Archivar',
    unarchive: 'Desarchivar',
    remove: 'Quitar',
    archived: 'Archivado',
    removeConfirmTitle: 'Quitar vehículo',
    removeConfirmBody: (name: string) => `Se van también las cargas y los gastos de ${name}.`,
    archiveHint: 'Un vehículo archivado desaparece del selector pero conserva su historial.',
  },

  odometerSheet: {
    title: 'Lectura del odómetro',
    value: 'Kilómetros',
    date: 'Fecha',
    save: 'Guardar lectura',
    hint: 'Anota lo que marca el tablero. Sirve para estimar cuándo toca cada mantenimiento.',
  },

  specSuggestions: [
    'Presión de gomas',
    'Tipo de aceite',
    'Medida de gomas',
    'Batería',
    'Bujías',
    'Limpiavidrios',
    'Filtro de aire',
  ],

  check: {
    title: 'Chequeo',
    comingSoon: 'Los chequeos llegan en la próxima fase. Aquí vas a poder hacer la revisión diaria y la semanal en menos de dos minutos.',
  },

  placeholder: {
    comingSoonTitle: 'Próxima fase',
    service: 'El registro de mantenimientos, reparaciones y mejoras llega en la próxima fase.',
    expense: 'El registro de gastos llega en la próxima fase.',
    back: 'Volver',
  },

  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Borrar',
    optional: '(opcional)',
    today: 'Hoy',
    takePhoto: 'Tomar foto',
    choosePhoto: 'Elegir de la galería',
    removePhoto: 'Quitar foto',
    photoError: 'No se pudo usar esa foto.',
  },
} as const;
