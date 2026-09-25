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
 * Every screen reads from here. PROMPT-06 moved the last inline strings — the
 * fuel screens, Más, onboarding, Cifras — in, so a grep for accented text in
 * JSX outside this file should come back empty.
 */
export const es = {
  app: {
    name: 'Car Guy',
    tagline: 'Tu carro, al día.',
  },

  /**
   * Navigation titles. On web expo-router feeds these to the document <title>,
   * so they are the text in the browser tab as well as in the header bar.
   */
  routes: {
    home: 'Car Guy',
    newVehicle: 'Nuevo vehículo',
    vehicle: 'Vehículo',
    editVehicle: 'Editar vehículo',
    odometer: 'Odómetro',
    newFillUp: 'Nueva carga',
    editFillUp: 'Editar carga',
    newService: 'Nuevo registro',
    service: 'Registro',
    expense: 'Gasto',
    check: 'Chequeo',
    guide: 'Qué revisar y cómo',
    templateEditor: 'Editar lista',
    inspection: 'Resultado',
    reminders: 'Recordatorios',
    reminder: 'Recordatorio',
    tasks: 'Tareas',
    newTask: 'Nueva tarea',
    task: 'Tarea',
    documents: 'Documentos',
    newDocument: 'Nuevo documento',
    document: 'Documento',
    notifications: 'Notificaciones',
    prices: 'Precios MICM',
    report: 'Reporte',
    export: 'Exportar',
    account: 'Cuenta',
  },

  web: {
    description:
      'Tu carro, al día. Mantenimiento, chequeos, combustible e historial de tus vehículos.',
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
    pendingLabel: 'Sin subir',
    pending: (n: number) => (n === 1 ? '1 recordatorio pendiente' : `${n} recordatorios pendientes`),
    insightLow: 'Rendimiento bajo',
    insightGreat: 'Rendimiento excelente',
    insightNormal: 'Rendimiento estable',
    insightLowBody: (percent: string) => `Este tanque rindió ${percent}% menos que tu promedio anterior.`,
    insightGreatBody: (percent: string) => `Este tanque rindió ${percent}% más que tu promedio anterior.`,
    insightNormalBody: 'Este tanque está dentro de tu rendimiento habitual.',
    lastTank: 'Último tanque',
    lastTankHint: (distance: string, volume: string) => `${distance} con ${volume}`,
    lastTankEmpty: 'Necesitas dos tanques llenos',
    averageTank: 'Promedio',
    averageHint: (n: number) => (n === 1 ? '1 tanque medido' : `${n} tanques medidos`),
    averageEmpty: (unit: string) => `Se mide en ${unit}`,
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
    removeConfirmBody: (name: string) =>
      `Se va todo lo de ${name}: cargas, gastos, mantenimientos, recordatorios, tareas y chequeos. Si solo quieres sacarlo del selector, archívalo.`,
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

  service: {
    newTitle: 'Nuevo registro',
    editTitle: 'Editar registro',
    kind: 'Tipo',
    kinds: { mantenimiento: 'Mantenimiento', reparacion: 'Reparación', mejora: 'Mejora' },
    date: 'Fecha',
    odometer: 'Odómetro (km)',
    title: 'Título',
    titlePlaceholder: 'Cambio de aceite, bomba de agua, rines 17…',
    items: '¿Qué le hiciste?',
    itemsHint: 'Marca lo del catálogo que hiciste. Con eso se reprograman los recordatorios.',
    searchItems: 'Buscar en el catálogo',
    description: 'Detalle',
    costs: 'Costos',
    costParts: 'Partes (RD$)',
    costLabor: 'Mano de obra (RD$)',
    total: 'Total (RD$)',
    totalAuto: 'Se suma solo. Si lo editas, manda lo que pongas.',
    shop: 'Taller',
    shopPlaceholder: 'Taller de Ramón, concesionario…',
    warranty: 'Garantía (opcional)',
    warrantyDate: 'Vence',
    warrantyKm: 'Hasta los (km)',
    parts: 'Partes usadas (opcional)',
    partName: 'Pieza',
    partNumber: 'Número',
    partBrand: 'Marca',
    partQuantity: 'Cantidad',
    partCost: 'Costo unitario',
    addPart: 'Agregar pieza',
    photos: 'Fotos',
    notes: 'Notas',
    save: 'Guardar registro',
    savedTitle: 'Guardado',
    savedWithResets: 'Se actualizaron los recordatorios:',
    titleRequired: 'Ponle un título para reconocerlo después.',
    deleteConfirm: '¿Borrar este registro?',
    reclassify: 'Reclasificar',
    origin: (what: string) => `Origen: ${what}`,
    originTask: (title: string) => `tarea "${title}"`,
    originInspection: (date: string) => `chequeo del ${date}`,
  },

  expense: {
    newTitle: 'Nuevo gasto',
    editTitle: 'Editar gasto',
    category: 'Categoría',
    amount: 'Monto (RD$)',
    date: 'Fecha',
    odometer: 'Odómetro (km, opcional)',
    description: 'Detalle',
    vendor: 'Dónde',
    photo: 'Foto del recibo',
    save: 'Guardar gasto',
    amountRequired: 'Pon cuánto pagaste.',
    legalDone: 'Además marcamos el recordatorio como hecho:',
    deleteConfirm: '¿Borrar este gasto?',
  },

  history: {
    title: 'Historial',
    all: 'Todo',
    search: 'Buscar',
    empty: 'Aquí va quedando la vida de tu carro. Empieza con una carga o un chequeo.',
    emptyFiltered: 'Nada con ese filtro.',
    loadMore: 'Cargar más',
    monthTotal: (total: string) => total,
    kinds: {
      combustible: 'Combustible',
      mantenimiento: 'Mantenimiento',
      reparacion: 'Reparaciones',
      mejora: 'Mejoras',
      gasto: 'Gastos',
      chequeo: 'Chequeos',
    },
    addTitle: '¿Qué vas a registrar?',
    addFuel: 'Carga de combustible',
    addService: 'Mantenimiento',
    addRepair: 'Reparación',
    addUpgrade: 'Mejora',
    addExpense: 'Gasto',
    addInspection: 'Chequeo',
    addOdometer: 'Lectura de odómetro',
  },

  tasks: {
    title: 'Tareas',
    subtitle: 'Lo que el carro necesita y todavía no has hecho.',
    new: 'Nueva tarea',
    editTitle: 'Tarea',
    name: '¿Qué hay que hacer?',
    namePlaceholder: 'Cambiar la goma de repuesto, revisar el A/C…',
    kind: 'Tipo',
    priority: 'Prioridad',
    priorities: { critica: 'Crítica', normal: 'Normal', baja: 'Baja' },
    statuses: { pendiente: 'Pendiente', en_progreso: 'En progreso', hecha: 'Hecha' },
    estimatedCost: 'Costo estimado (RD$)',
    notes: 'Notas',
    save: 'Guardar tarea',
    markDone: 'Marcar hecha',
    markDoneTitle: '¿Registrarla ahora?',
    markDoneBody: 'Puedes guardarla como mantenimiento, reparación o mejora para que quede en el historial con su costo.',
    registerNow: 'Sí, registrar',
    justClose: 'Solo marcar hecha',
    empty: 'Nada pendiente. Cuando un chequeo falle, la tarea aparece aquí sola.',
    deleteConfirm: '¿Borrar esta tarea?',
    nameRequired: 'Escribe qué hay que hacer.',
    fromInspection: 'Viene de un chequeo',
  },

  documents: {
    title: 'Documentos',
    subtitle: 'Seguro, marbete, matrícula y lo que necesites a mano.',
    new: 'Nuevo documento',
    kind: 'Tipo',
    kinds: {
      seguro: 'Seguro',
      marbete: 'Marbete',
      matricula: 'Matrícula',
      licencia: 'Licencia',
      factura: 'Factura',
      garantia: 'Garantía',
      otro: 'Otro',
    },
    name: 'Título',
    issued: 'Emitido',
    expires: 'Vence',
    expiresHint: 'Si lo pones, el recordatorio de ese documento se ajusta a esta fecha.',
    file: 'Foto o archivo',
    notes: 'Notas',
    save: 'Guardar documento',
    empty: 'Guarda aquí una foto del seguro y del marbete. El día que te pidan papeles los tienes.',
    deleteConfirm: '¿Borrar este documento?',
    nameRequired: 'Ponle un título.',
    expiresOn: (date: string) => `Vence ${date}`,
    noExpiry: 'Sin vencimiento',
    linkedReminder: 'Ajustamos el recordatorio a esa fecha.',
  },

  reminders: {
    title: 'Recordatorios',
    subtitle: 'Lo que toca y cuándo, según tus kilómetros.',
    empty: 'Cuando agregues un vehículo te creamos los recordatorios del mantenimiento y los del marbete.',
    done: 'Hecho',
    snooze: 'Posponer 7 días',
    edit: 'Editar',
    overdueDays: (n: number) => (n === 1 ? 'venció ayer' : `venció hace ${n} días`),
    dueDays: (n: number) => (n === 0 ? 'vence hoy' : n === 1 ? 'vence mañana' : `faltan ${n} días`),
    overdueKm: (n: number) => `${n.toLocaleString('es-DO')} km pasado`,
    dueKm: (n: number) => `faltan ${n.toLocaleString('es-DO')} km`,
    estimated: (date: string) => `~${date} (estimado)`,
    lowConfidence: 'Estimado con poca información. Anota el odómetro para afinarlo.',
    noData: 'Falta el dato para poder avisarte.',
    snoozed: 'Pospuesto',
    completeTitle: 'Marcar como hecho',
    completeDate: 'Fecha',
    completeKm: 'Odómetro (km)',
    completeRegister: '¿Registrarlo como mantenimiento?',
    completeJust: 'Solo marcar hecho',
    completedToast: 'Listo. Próximo:',
    dueOn: (date: string) => `vence ${date}`,
    add: 'Nuevo recordatorio',
    newTitle: 'Nuevo recordatorio',
    editTitle: 'Editar recordatorio',
    groups: {
      vencido: 'Vencidos',
      urgente: 'Urgentes',
      proximo: 'Próximos',
      sin_datos: 'Sin datos',
      ok: 'Al día',
      disabled: 'Desactivados',
    },
    disabledLabel: 'Desactivado',
    enabledLabel: 'Activo',
    enable: 'Activar',
    disable: 'Desactivar',
    remove: 'Eliminar',
    removeConfirm: 'Se borra este recordatorio. Tu historial no cambia.',
    form: {
      title: 'Título',
      titleRequired: 'Ponle un título.',
      catalog: 'Del catálogo (opcional)',
      catalogNone: 'Ninguno',
      metric: 'Cuándo toca',
      metrics: { date: 'Fecha', km: 'Km', both: 'Ambos' },
      bothHint: 'Lo que llegue primero.',
      dueDate: 'Fecha límite',
      dueKm: 'Al llegar a (km)',
      dueRequired: 'Pon la fecha o el kilometraje en que toca.',
      recurring: 'Se repite',
      yes: 'Sí',
      no: 'No',
      intervalMonths: 'Cada (meses)',
      intervalDays: 'o cada (días)',
      intervalKm: 'Cada (km)',
      fixed: 'Intervalo fijo',
      fixedHint:
        'Fijo: el próximo se cuenta desde la fecha en que tocaba, no desde cuando lo hiciste. Así funcionan el marbete y el seguro. Si no, se cuenta desde el día que lo hagas.',
      advanced: 'Avanzado',
      advancedHide: 'Ocultar avanzado',
      thresholdDays: 'Avisar con (días de anticipación)',
      thresholdKm: 'Avisar con (km de anticipación)',
      thresholdHint: 'Vacío usa lo normal: 30 días, o el 10 % del intervalo en km.',
      notes: 'Notas',
      enabled: 'Recordatorio activo',
      save: 'Guardar',
      saved: 'Recordatorio guardado',
    },
    multasNote: 'Las multas pendientes bloquean la renovación. Consúltalas antes de ir.',
    multasLink: 'Consultar multas (PGR)',
    status: 'Estado',
  },

  legal: {
    marbeteBanner: 'Marbete',
    vidaUtilTitle: 'Vida útil (Ley 63-17)',
    vidaUtil: (limit: number, remaining: number | null) =>
      remaining == null
        ? `${limit} años para este tipo de vehículo`
        : remaining < 0
          ? `Pasó los ${limit} años hace ${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? 'año' : 'años'}`
          : `Le ${remaining === 1 ? 'queda 1 año' : `quedan ${remaining} años`} de ${limit}`,
    vidaUtilNoYear: 'Pon el año del vehículo para calcularla.',
    revisionTecnica:
      'Revisión técnica: la ley la exige, pero INTRANT todavía no la ha puesto en marcha. Te avisamos cuando empiece.',
  },

  catalog: {
    title: 'Catálogo de servicios',
    caption: 'Cada cuánto toca cada cosa. Cambiarlo ajusta tus recordatorios.',
    subtitle:
      'Los intervalos de fábrica pensados para uso severo. Si cambias uno, los recordatorios que todavía usan el valor anterior se ajustan solos.',
    every: (km: number | null, months: number | null) =>
      [km != null ? `${km.toLocaleString('es-DO')} km` : null, months != null ? `${months} meses` : null]
        .filter(Boolean)
        .join(' · ') || 'Sin intervalo',
    intervalKm: 'Cada (km)',
    intervalMonths: 'Cada (meses)',
    save: 'Guardar',
    saved: 'Intervalo guardado',
    updated: (n: number) =>
      n === 0
        ? 'Ningún recordatorio usaba el valor anterior.'
        : n === 1
          ? 'Se ajustó 1 recordatorio.'
          : `Se ajustaron ${n} recordatorios.`,
    seeded: 'De fábrica',
    hint: 'Deja vacío lo que no aplique. Los recordatorios que ajustaste a mano no cambian.',
  },

  check: {
    title: 'Chequeo',
    todayTitle: 'Para hoy',
    start: 'Empezar',
    lastRun: (date: string) => `Último: ${date}`,
    never: 'Nunca lo has hecho',
    nothingDue: 'Nada pendiente hoy. Vuelve mañana.',
    streak: 'seguidas',
    streakWeeks: (n: number) => (n === 1 ? '1 semana' : `${n} semanas`),
    templates: 'Tus listas',
    recent: 'Últimos chequeos',
    guide: 'Qué revisar y cómo',
    cadences: {
      diaria: 'Diaria',
      semanal: 'Semanal',
      mensual: 'Mensual',
      antes_de_viaje: 'Antes de rodar',
      manual: 'Cuando quieras',
    },
    coldEngine: 'Hazlo con el motor frío. Nunca abras el tapón del radiador caliente.',
    ok: 'OK',
    fail: 'Falla',
    na: 'N/A',
    how: '¿Cómo?',
    failNote: '¿Qué viste?',
    failNoteRequired: 'Escribe qué viste para acordarte después.',
    onFailTask: 'Crear tarea',
    onFailNothing: 'Solo anotarlo',
    remaining: (n: number) => (n === 1 ? 'falta 1' : `faltan ${n}`),
    finish: 'Terminar chequeo',
    odometerPrompt: 'Odómetro (km)',
    resultAllGood: 'Todo al día',
    resultWithFails: (n: number) => (n === 1 ? '1 falla' : `${n} fallas`),
    resultTasks: 'Te creamos estas tareas:',
    celebrate: '¡Así se cuida un carro!',
    comingSoon: 'Los chequeos llegan en la próxima fase.',
    withFails: 'Con fallas',
    disabled: 'Desactivada',
    turnOn: 'Activar',
    turnOff: 'Apagar',
    edit: 'Editar',
    onFailReminder: 'Crear recordatorio',
    onFailTitle: 'Al terminar, crear',
    onFailShort: { task: 'Tarea', reminder: 'Recordatorio', none: 'Nada' },
    resultReminders: 'Y estos recordatorios:',
    resultChecked: 'Lo que revisaste',
    elapsed: (min: number, sec: number) => `${min}:${String(sec).padStart(2, '0')}`,
    editor: {
      title: 'Editar lista',
      name: 'Nombre',
      cadence: 'Cada cuánto',
      enabled: 'Lista activa',
      items: 'Puntos a revisar',
      copyNote:
        'Los cambios son solo para este vehículo. Tus otros vehículos se quedan con la lista de siempre.',
      up: 'Subir',
      down: 'Bajar',
      removed: 'Quitado',
      add: 'Agregar punto',
      newTitle: 'Punto nuevo',
      label: 'Qué revisar',
      how: '¿Cómo? (opcional)',
      group: 'Grupo',
      onFail: 'Si falla',
      save: 'Guardar lista',
      saved: 'Lista guardada',
      labelRequired: 'Ponle nombre a cada punto.',
      empty: 'La lista necesita al menos un punto activo.',
    },
  },

  notifications: {
    title: 'Notificaciones',
    subtitle: 'Te aviso cuando toque un chequeo o un mantenimiento.',
    enable: 'Avisarme',
    notNow: 'Ahora no',
    hour: 'Hora',
    weekday: 'Día del chequeo semanal',
    weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    test: 'Probar notificación',
    testSent: 'Te llega en 5 segundos.',
    scheduled: (n: number) => (n === 1 ? '1 aviso programado' : `${n} avisos programados`),
    denied: 'Android no nos dio permiso. Actívalo en los ajustes del teléfono.',
    webUnsupported: 'En la web no hay avisos del sistema. Los verás dentro de la app.',
  },

  placeholder: {
    comingSoonTitle: 'Próxima fase',
    service: 'El registro de mantenimientos, reparaciones y mejoras llega en la próxima fase.',
    expense: 'El registro de gastos llega en la próxima fase.',
    back: 'Volver',
  },

  /**
   * The check guide's content (PROMPT-05's screen, moved in by PROMPT-06).
   *
   * Prose with emphasis inside it does not survive being flattened to a string,
   * so a paragraph is a list of segments and `strong` marks the ones the screen
   * paints in its emphasis colour. That is the whole markup language; anything
   * richer belongs in a document, not in a phone app's copy file.
   *
   * Source: 01-research/02-maintenance-checklists-dr.md §A.2–§A.5.
   */
  guide: {
    title: 'Qué revisar y cómo',

    overheating: {
      title: 'Sobrecalentamiento',
      body: [
        {
          text:
            'Revisa el refrigerante una vez por semana, con el motor frío, antes de arrancar por ' +
            'primera vez en el día. Mira el tanque plástico traslúcido: el nivel va entre Min y Max.\n\n',
        },
        { text: 'Nunca abras el tapón del radiador ni el del tanque con el motor caliente.', strong: true },
        { text: ' El sistema está presurizado y sale hirviendo.' },
      ],
    },

    signs: {
      title: 'Señales de que algo anda mal',
      bullets: [
        'El testigo de temperatura o el termómetro de refrigerante encendido.',
        'La aguja de temperatura subiendo por encima de la mitad.',
        'Olor dulce, o vapor saliendo del capó.',
        'Un charco bajo el carro donde pasaste la noche.',
        'La calefacción sopla frío con el motor caliente.',
        'Tener que rellenar refrigerante más de una vez al mes.',
      ],
    },

    ifItOverheats: {
      title: 'Si se calienta',
      bullets: [
        'Apaga el aire acondicionado y pon la calefacción al máximo: le roba calor al motor.',
        'Oríllate en cuanto sea seguro y apaga el motor.',
        'Espera a que enfríe del todo antes de abrir nada.',
        'No le eches agua fría a un motor caliente ni a un radiador caliente.',
      ],
    },

    whyCoolant: {
      title: 'Por qué refrigerante y no agua',
      body: [
        { text: 'Aquí nunca congela, así que parece que el agua bastaría. No basta, por tres razones:\n\n· El refrigerante 50/50 ' },
        { text: 'hierve más tarde', strong: true },
        { text: ' (unos 106–108 °C contra 100 °C del agua, y más aún bajo presión).\n· Lleva ' },
        { text: 'inhibidores de corrosión', strong: true },
        {
          text:
            ' que protegen la culata de aluminio, el radiador y la bomba de agua. El agua de la ' +
            'llave corroe y deja sarro.\n· ',
        },
        { text: 'Lubrica el sello de la bomba de agua.', strong: true },
        {
          text:
            '\n\nSi es concentrado, se mezcla con agua destilada, nunca de la llave. Echarle agua ' +
            'para llegar a la casa está bien; después corrígelo a 50/50.',
        },
      ],
    },

    whyHere: {
      title: 'Por qué aquí se calientan más',
      body: [
        {
          text:
            '30–35 °C de ambiente, tapones, el aire acondicionado encendido todo el tiempo y las ' +
            'subidas de la Duarte. Un ventilador flojo, un termostato pegado o un nivel bajo ' +
            'perdonan mucho menos aquí que en un país frío.',
        },
      ],
    },

    fluids: {
      title: 'Fluidos, cada semana',
      bullets: [
        'Aceite de motor: motor frío, piso plano, la varilla entre Min y Max. Lechoso = refrigerante en el aceite.',
        'Refrigerante: motor frío, entre Min y Max.',
        'Agua del parabrisas: rellena. Aquí no hace falta anticongelante.',
        'Líquido de frenos (mensual): claro o ámbar. Marrón oscuro o bajando = pastillas gastadas o fuga.',
      ],
    },

    tyres: {
      title: 'Gomas',
      bullets: [
        'Presión en frío, las 4 y la de repuesto, según la placa del marco de la puerta.',
        'Se pierde ~1 psi al mes. Una goma 2–3 psi por debajo del resto es una fuga lenta.',
        'Labrado: prueba de la moneda o las barras de desgaste. El mínimo son 1.6 mm.',
        'Desgaste en los bordes = alineación. En el centro = exceso de aire.',
      ],
    },

    lightsBrakes: {
      title: 'Luces y frenos',
      bullets: [
        'Luces: prueba delanteras, freno, retroceso y direccionales contra una pared.',
        'Frenos: en el primer frenazo del día, pedal firme, sin jalar, sin ruido.',
        'Pedal esponjoso, chillido o vibración: al taller, no la próxima semana.',
      ],
    },

    diesel: {
      title: 'Si es diésel',
      bullets: [
        'Drena el separador de agua cuando encienda el testigo y en cada cambio de aceite.',
        'Filtro de aire: revísalo más seguido si andas en polvo. El turbo es sensible.',
        'Cara del intercooler y del radiador sin lodo ni hojas.',
        'El testigo de bujías incandescentes debe apagarse antes de arrancar.',
      ],
    },

    motorcycle: {
      title: 'Si es motor',
      bullets: [
        'T-CLOCS antes de rodar: gomas, controles, luces, aceite y fluidos, chasis, parales.',
        'El acelerador debe moverse libre y cerrar solo, con el manubrio en cualquier posición.',
        'Lubrica la cadena cada ~500 km o después de lluvia.',
      ],
    },

    source:
      'Fuente: manual del fabricante de tu vehículo, RAC, NHTSA, Michelin y la MSF (T-CLOCS). ' +
      'Cuando el manual diga otra cosa, manda el manual.',
  },

  /**
   * The screens that only appear when the app could not start. Short, and they
   * say where the data is first — that is the only question the user has.
   */
  boot: {
    brand: 'CAR GUY',
    lockedTitle: 'Tus datos están ocupados',
    lockedBody:
      'Otra pestaña o la app anterior todavía tiene la base de datos abierta. Cierra las demás pestañas de Car Guy y vuelve a intentar. Nada se perdió.',
    crashTitle: 'Algo se rompió al abrir',
    crashBody:
      'Tus datos siguen guardados en este dispositivo. Intenta de nuevo; si sigue pasando, cierra la app y ábrela otra vez.',
    retry: 'Intentar de nuevo',
  },

  more: {
    title: 'Más',
    subtitle: 'Tu garaje, tus papeles y los datos que viven en este teléfono.',

    garage: 'Garaje',
    garageCaption: 'Toca un vehículo para ver su perfil completo.',
    active: 'activo',
    activate: 'Activar',
    addVehicle: 'Agregar vehículo',

    maintenance: 'Mantenimiento',
    service: 'Registrar mantenimiento',
    serviceCaption: 'Un cambio de aceite, una reparación o una mejora.',
    history: 'Ver el historial',
    historyCaption: 'Todo lo que le has hecho al carro, en orden.',
    reminders: 'Recordatorios',
    remindersCaption: 'Qué toca y cuándo, según tus kilómetros.',
    tasks: 'Tareas pendientes',
    tasksCaption: 'Lo que el carro necesita y todavía no has hecho.',

    fuelSection: 'Combustible',
    newFillUp: 'Registrar una carga',
    newFillUpCaption: 'Galones, precio y odómetro en la bomba.',
    prices: 'Precios MICM de referencia',
    pricesCaption: (week: string) => `${week}. Sirven para comparar; cada carga guarda lo que pagaste.`,

    expense: 'Registrar gasto',
    expenseCaption: 'Seguro, marbete, peaje, lavado y lo demás.',

    documents: 'Documentos',
    documentsCaption: 'Seguro, marbete, matrícula y facturas.',

    account: 'Cuenta',
    accountSoon: 'Próximamente',
    accountBody:
      'Sin cuenta la app funciona igual. Con cuenta, si cambias de teléfono, tus datos te siguen.',

    data: 'Datos',
    dataCaption: 'Todo vive en este dispositivo. No hay cuenta ni nube.',
    // Same section, other truth: with an account the phone is still where the
    // app reads from, but it is no longer the only copy.
    dataCaptionSynced: 'Todo vive en este dispositivo y se respalda en tu cuenta.',
    backup: 'Crear respaldo JSON',
    restore: 'Restaurar o importar respaldo',
    restoreCaption:
      'Acepta respaldos de Car Guy y de Tu Combustible RD. Guarda el archivo en Drive, correo o tu computadora antes de desinstalar la app.',
    wipe: 'Borrar todos los datos',
    wipeTitle: 'Borrar todo',
    wipeBody: 'Se van vehículos, cargas, mantenimientos y chequeos. No hay marcha atrás.',
    backupTitle: 'Respaldo',
    backupUnsupported: 'Este dispositivo no permite compartir archivos.',
    backupFailed: (reason: string) => `No se pudo crear el archivo de respaldo.\n\n${reason}`,
    restoredTitle: 'Datos restaurados',
    restoredLegacy: (counts: string) => `Importamos tus datos de Tu Combustible RD: ${counts}.`,
    restoredMerge: (merged: number, tables: number) =>
      `Combinamos el respaldo: ${merged} registros en ${tables} tablas.`,
    restoreTitle: 'Restaurar datos',

    appearance: 'Apariencia',
    appearanceCaption: 'El oscuro es la identidad de Car Guy; el claro está para el sol del mediodía.',
    themes: { system: 'Sistema', dark: 'Oscuro', light: 'Claro' },

    notifications: 'Notificaciones',
    notificationsCaption: 'Cuándo y a qué hora te avisa el carro.',

    about: 'Acerca de',
    version: (version: string) => `Versión ${version}`,
    // The build, for telling two installs of the same version apart when
    // someone reports something that only happens on theirs.
    build: (sha: string) => `Build ${sha}`,
    aboutBody: 'Car Guy · Tu carro, al día. Hecho en República Dominicana.',
  },

  onboarding: {
    legacyPrompt: '¿Vienes de Tu Combustible RD? Trae tu historial completo desde el respaldo JSON.',
    legacyAction: 'Importar respaldo de Tu Combustible RD',
    importedTitle: 'Datos importados',
    importedLegacy: (counts: string) => `Listo: ${counts}.`,
    importedMerge: (merged: number) => `Listo: ${merged} registros restaurados.`,
    importFailedTitle: 'Importar',
  },

  notFound: {
    title: 'Esa pantalla no existe.',
    body: 'El enlace está roto o la pantalla se movió de sitio.',
    back: 'Volver al tablero',
  },

  stats: {
    title: 'Cifras',
    subtitle: (vehicle: string) => `${vehicle} · gasto y consumo reales, no el de la computadora del carro.`,

    periods: { mes: 'Mes', trimestre: '3 meses', ano: 'Año', todo: 'Todo' },
    periodHint: {
      mes: 'Últimos 30 días',
      trimestre: 'Últimos 90 días',
      ano: 'Últimos 365 días',
      todo: 'Desde la primera carga',
    },

    categories: {
      combustible: 'Combustible',
      mantenimiento: 'Mantenimiento',
      reparacion: 'Reparaciones',
      mejora: 'Mejoras',
      legal: 'Seguro y marbete',
      otros: 'Otros',
    },

    total: 'Total',
    spend: 'Gasto',
    costPerKm: 'RD$ / km',
    distance: 'Km recorridos',
    economy: 'Rendimiento',
    average: 'Promedio',

    vsPrevious: 'vs. período anterior',
    deltaUp: (percent: number) => `↑ ${percent} %`,
    deltaDown: (percent: number) => `↓ ${Math.abs(percent)} %`,
    deltaFlat: 'igual',
    deltaNew: 'sin comparación',
    noDistance: 'Anota el odómetro para saberlo',

    byMonth: 'Gasto mes a mes',
    byMonthCaption: 'Apilado por categoría.',
    byMonthEmpty: 'Cuando registres gastos, aquí se ve en qué se va el dinero mes a mes.',

    byCategory: 'Gasto por categoría',
    byCategoryCaption: 'Dentro del período elegido.',
    byCategoryEmpty: 'Nada gastado en este período.',

    economyTitle: 'Rendimiento por tanque',
    economyCaption: (unit: string) => `${unit} entre tanques llenos. La línea punteada es tu promedio.`,
    economyEmpty: 'Necesitas dos tanques llenos seguidos para medir el rendimiento.',

    kmPerMonth: 'Kilómetros por mes',
    kmPerMonthCaption: 'Según las lecturas del odómetro.',
    kmPerMonthEmpty: 'Anota el odómetro en cada carga y aquí verás cuánto ruedas.',

    ownership: 'Costo de tener el carro',
    ownershipCaption: 'Compra menos venta, más todo lo que le has puesto.',
    ownershipPurchase: 'Compra',
    ownershipSold: 'Venta',
    ownershipSpend: 'Gastos',
    ownershipTotal: 'Total',
    ownershipPerMonth: 'Por mes de propiedad',
    ownershipMonths: (n: number) => (n === 1 ? '1 mes' : `${n} meses`),
    ownershipHint: 'Agrega el precio de compra en el perfil del vehículo para verlo.',

    upcoming: 'Próximos gastos estimados',
    upcomingCaption: 'Con tus propios precios, no con promedios.',
    upcomingEmpty: 'Nada previsto. Cuando una tarea tenga costo estimado, aparece aquí.',
    upcomingBasis: { estimado: 'estimado', ultimo_costo: 'lo que costó la última vez' },

    lastTank: 'Lectura del último tanque',
    lastTankValues: { low: 'Bajo', great: 'Excelente', normal: 'Estable' },
    lastTankHint: (average: string) =>
      `Comparado con el promedio de tus tanques anteriores (${average}).`,

    report: 'Reporte PDF',
    csv: 'Exportar CSV',
    empty: 'Registra una carga o un gasto y aquí aparecen tus cifras.',
  },

  sync: {
    signedOut: 'Inicia sesión para sincronizar.',
    never: 'Nunca',
    syncing: 'Sincronizando…',
    syncNow: 'Sincronizar ahora',
    pendingLabel: 'Sin subir',
    pending: (n: number) => (n === 1 ? '1 cambio sin subir' : `${n} cambios sin subir`),
    upToDate: 'Todo subido',
    lastSync: (when: string) => `Última sincronización: ${when}`,
    wipeCloud: 'Borrar datos en la nube',
    wipeCloudCaption:
      'Borra tus datos del servidor y cierra la sesión. Este teléfono no se toca — lo que está aquí se queda aquí.',
    wipeCloudTitle: 'Borrar datos en la nube',
    wipeCloudBody:
      'Se van del servidor tus vehículos, cargas, mantenimientos, chequeos y fotos, y se cierra la sesión en este teléfono para que no vuelvan a subirse. Lo que está guardado aquí no se toca.',
    wipeCloudConfirm: 'Esto no se puede deshacer. ¿Seguro?',
    wipeCloudDone: (n: number) =>
      `Listo. Borramos ${n} registros del servidor y cerramos la sesión.`,
    wipeCloudFailed: 'No se pudo borrar en el servidor. Intenta de nuevo.',
    doneTitle: 'Listo',
    doneBody: (pushed: number, pulled: number) =>
      `Subimos ${pushed} y bajamos ${pulled}.`,
    firstLoginTitle: 'Sincronizando tu garaje…',
    firstLoginBody: 'Esto pasa una sola vez. Puedes seguir usando la app.',

    errors: {
      network: 'Sin conexión. Lo intentamos de nuevo solo.',
      expired: 'La sesión venció. Inicia sesión de nuevo — tus datos siguen aquí.',
      forbidden: 'El servidor rechazó el cambio. Tus datos siguen guardados en el teléfono.',
      generic: 'No se pudo sincronizar. Lo intentamos de nuevo solo.',
    },
  },

  account: {
    title: 'Cuenta',
    subtitle: 'Opcional. La app funciona igual sin ella.',

    pitch: 'Sin cuenta la app funciona igual. Con cuenta, si cambias de teléfono, tus datos te siguen.',
    pitchMore:
      'Nada se sube hasta que inicies sesión, y cerrar sesión no borra nada de este teléfono.',

    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    signOut: 'Cerrar sesión',
    haveAccount: '¿Ya tienes cuenta? Inicia sesión',
    needAccount: '¿No tienes cuenta? Crea una',

    email: 'Correo',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    password: 'Contraseña',
    passwordHint: 'Mínimo 8 caracteres.',
    showPassword: 'Ver contraseña',
    hidePassword: 'Ocultar contraseña',
    displayName: 'Tu nombre (opcional)',

    forgot: '¿Olvidaste la contraseña?',
    resetSentTitle: 'Revisa tu correo',
    resetSentBody: (email: string) => `Te mandamos un enlace a ${email} para cambiar la contraseña.`,
    resetNeedsEmail: 'Escribe tu correo primero.',

    working: 'Un momento…',
    signedInAs: 'Sesión iniciada',
    lastSync: 'Última sincronización',
    lastSyncNever: '—',
    syncSoon: 'Tus datos se sincronizarán en la próxima actualización.',

    createdTitle: 'Cuenta creada',
    createdBody: 'Ya puedes iniciar sesión en otro teléfono con este correo.',

    dangerZone: 'Zona de peligro',
    wipeLocal: 'Borrar datos locales',
    wipeLocalCaption: 'Borra vehículos, cargas y fotos de este teléfono. La cuenta no se toca.',
    wipeLocalTitle: 'Borrar datos locales',
    wipeLocalBody: 'Se van vehículos, cargas, mantenimientos y chequeos de este teléfono. No hay marcha atrás.',

    notConfigured: 'La cuenta todavía no está configurada en esta instalación.',
    notConfiguredCaption:
      'Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. Mira .env.example.',

    onboardingTitle: 'Con cuenta tus datos te siguen',
    onboardingBody: 'Si cambias de teléfono, tu historial va contigo. Puedes crearla después.',
    onboardingAction: 'Crear cuenta',
    onboardingDismiss: 'Ahora no',

    errors: {
      invalidCredentials: 'Correo o contraseña incorrectos.',
      userExists: 'Ya hay una cuenta con ese correo. Inicia sesión.',
      weakPassword: 'La contraseña necesita al menos 8 caracteres.',
      invalidEmail: 'Ese correo no parece válido.',
      rateLimited: 'Demasiados intentos. Espera un momento.',
      network: 'Sin conexión. Tus datos siguen guardados en el teléfono.',
      inviteOnly: 'El servidor todavía no acepta cuentas de Car Guy. Falta aplicar sql/001.',
      generic: 'No se pudo completar. Intenta de nuevo.',
      emailRequired: 'Escribe tu correo.',
      passwordRequired: 'Escribe tu contraseña.',
    },
  },

  report: {
    title: 'Reporte del vehículo',
    subtitle: 'Un resumen que puedes guardar, imprimir o mandarle al taller.',
    documentTitle: (vehicle: string) => `Car Guy · ${vehicle}`,
    period: 'Período',
    historyTitle: 'Historial del período',
    historyEmpty: 'Sin registros en este período.',
    columns: {
      date: 'Fecha',
      kind: 'Tipo',
      title: 'Detalle',
      odometer: 'Odómetro',
      amount: 'Monto',
    },
    economySummary: (tanks: number, average: string, min: string, max: string) =>
      `${tanks} tanques medidos · promedio ${average} km/gal · entre ${min} y ${max}.`,
    footer: 'Generado con Car Guy',

    generate: 'Generar reporte',
    generating: 'Preparando el reporte…',
    rows: (n: number) => (n === 1 ? '1 registro en el período' : `${n} registros en el período`),
    webHint: 'Guarda como PDF desde el diálogo de impresión.',
    sharedTitle: 'Reporte listo',
    sharedBody: 'Lo compartimos como PDF.',
    unavailableTitle: 'Reporte',
    unavailableBody: 'Este dispositivo no permite compartir archivos.',
    failed: (reason: string) => `No se pudo generar el reporte.\n\n${reason}`,
  },

  export: {
    title: 'Exportar datos',
    subtitle: 'Tus registros en CSV, para abrirlos en Excel o LibreOffice.',
    history: 'Historial completo',
    historyCaption: 'Una fila por registro: cargas, mantenimientos, gastos y chequeos.',
    fuel: 'Combustible',
    fuelCaption: 'Todas las columnas de cada carga, con km recorridos y km/gal.',
    period: 'Período',
    download: 'Descargar CSV',
    share: 'Compartir CSV',
    rows: (n: number) => (n === 1 ? '1 fila' : `${n} filas`),
    wipeCloud: 'Borrar datos en la nube',
    wipeCloudCaption:
      'Borra tus datos del servidor y cierra la sesión. Este teléfono no se toca — lo que está aquí se queda aquí.',
    wipeCloudTitle: 'Borrar datos en la nube',
    wipeCloudBody:
      'Se van del servidor tus vehículos, cargas, mantenimientos, chequeos y fotos, y se cierra la sesión en este teléfono para que no vuelvan a subirse. Lo que está guardado aquí no se toca.',
    wipeCloudConfirm: 'Esto no se puede deshacer. ¿Seguro?',
    wipeCloudDone: (n: number) =>
      `Listo. Borramos ${n} registros del servidor y cerramos la sesión.`,
    wipeCloudFailed: 'No se pudo borrar en el servidor. Intenta de nuevo.',
    doneTitle: 'Listo',
    sharedBody: (file: string) => `Compartimos ${file}.`,
    downloadedBody: (file: string) => `Descargamos ${file}.`,
    unavailableBody: 'Este dispositivo no permite compartir archivos.',
    failed: (reason: string) => `No se pudo exportar.\n\n${reason}`,
    encodingHint:
      'UTF-8 con BOM y separador de coma. Excel en español lo abre con los acentos correctos.',
  },

  fuel: {
    newTitle: 'En la bomba',
    editTitle: 'Editar carga',
    intro:
      'Anota dos de tres (galones, precio, total) y el tercero se calcula solo. El consumo sale cuando marcas tanque lleno.',
    date: 'Fecha',
    odometer: 'Odómetro (km)',
    odometerHint: (last: string) => `Última carga: ${last}`,
    type: 'Combustible',
    volume: (unit: string) => `Volumen (${unit})`,
    total: 'Total pagado (RD$)',
    calcPending: 'Falta un dato más para cerrar la cuenta.',
    loadKind: 'Tipo de carga',
    fullTank: 'Tanque lleno',
    partial: 'Carga parcial',
    partialHint: (unit: string) =>
      `El km/${unit} solo se calcula entre dos tanques llenos. Las parciales entran en el gasto y se suman al próximo lleno.`,
    missedPrevious: 'Se me olvidó registrar una carga anterior',
    missedPreviousHint:
      'Si falta una carga en el medio, los kilómetros no cuadran con los galones. Marcando esto empezamos la cuenta otra vez desde aquí, como con el primer tanque lleno.',
    station: 'Estación',
    stationOther: 'Nombre de la estación',
    notes: 'Nota (opcional)',
    notesPlaceholder: 'Viaje a Santiago, tráfico…',
    save: 'Guardar carga',
    saveChanges: 'Guardar cambios',
    delete: 'Borrar esta carga',
    deleteTitle: 'Borrar carga',
    deleteBody: 'Se quita del historial y se recalcula el consumo.',
    odometerRequired: 'Pon el kilometraje que marca el tablero.',
    odometerTooLow: (last: number) =>
      `La última carga quedó en ${last.toLocaleString('es-DO')} km. El nuevo valor no puede ser menor.`,
    amountsRequired: 'Llena dos de estos tres: volumen, precio por unidad, o total.',
  },

  /** The sheet shown after a fill-up is saved, replacing Phase 5's alert. */
  fuelReview: {
    titles: {
      low: 'Rendimiento bajo',
      great: 'Buen rendimiento',
      normal: 'Rendimiento estable',
      first: 'Primera medición',
    },
    statusLabels: {
      low: 'Por debajo de tu promedio',
      great: 'Por encima de tu promedio',
      normal: 'En tu promedio',
      first: 'Sin comparación todavía',
    },
    price: (unit: string) => `Precio por ${unit}`,
    distance: 'Km recorridos',
    economy: 'Rendimiento',
    costPerKm: 'Costo por km',
    noPrevious: 'falta una carga anterior',
    pending: 'se calcula con más datos',
    lowBody: (average: string) =>
      `Está por debajo de tu promedio de ${average}. Revisa tráfico, presión de gomas o posibles fugas.`,
    greatBody: (average: string) => `Está por encima de tu promedio de ${average}.`,
    firstBody: 'Guarda otra carga para empezar a comparar tu rendimiento real.',
    chainBroken:
      'Marcaste que faltaba una carga anterior, así que la cuenta del consumo empieza de nuevo desde esta.',
    seeHistory: 'Ver historial',
    close: 'Listo',
  },

  prices: {
    title: 'Precios MICM',
    intro:
      'Semilla: semana del 15–21 ago 2026. Actualízalos cuando salga el aviso nuevo. No se descargan solos.',
    boardEyebrow: 'Precios de referencia',
    boardCaption: 'Lo que pagaste en cada carga manda sobre esta tabla.',
    week: 'Semana / fuente',
    save: 'Guardar referencia',
    reset: 'Volver a precios semilla',
  },

  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Borrar',
    ok: 'Entendido',
    optional: '(opcional)',
    today: 'Hoy',
    pickDate: 'Elegir fecha',
    takePhoto: 'Tomar foto',
    choosePhoto: 'Elegir de la galería',
    close: 'Cerrar',
    removeItem: (what: string) => `Quitar ${what}`,
    removePhoto: 'Quitar foto',
    edit: 'Editar',
    photoError: 'No se pudo usar esa foto.',
  },
} as const;
