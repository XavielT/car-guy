/**
 * The words people use (SPEC-K §K4): groups of es-DO and English words that mean the same thing to a person looking for something.
 * The search expands each word of the query to its group, so "gomera" finds what is filed under "llantas" and "echar gasolina" finds fuel.
 * Folded (no accents, lowercase). A word may only be in one group; groups are small on purpose: a synonym that is too wide hides the answer.
 */
export const SYNONYM_GROUPS: string[][] = [
  ['gasolina', 'combustible', 'tanque', 'carga', 'cargar', 'echar', 'llenar', 'llenado', 'bomba', 'gasoil', 'fuel', 'gas', 'petrol', 'refuel'],
  ['gomera', 'neumatico', 'neumaticos', 'llanta', 'llantas', 'goma', 'gomas', 'tire', 'tires', 'tyre', 'tyres', 'aros', 'ruedas'],
  ['taller', 'mecanico', 'mecanica', 'reparacion', 'reparar', 'arreglo', 'arreglar', 'averia', 'repair', 'fix', 'garage'],
  ['marbete', 'seguro', 'matricula', 'papeles', 'documentos', 'documento', 'cedula', 'licencia', 'vencimiento', 'vence', 'registration', 'insurance'],
  ['recordatorio', 'recordar', 'recordame', 'avisame', 'alarma', 'aviso', 'avisos', 'reminder', 'remind', 'alert'],
  ['kilometraje', 'kilometros', 'odometro', 'millas', 'millaje', 'odometer', 'mileage', 'km'],
  ['gasto', 'gastos', 'costo', 'costos', 'spending', 'expense', 'expenses', 'cost'],
  ['estadistica', 'estadisticas', 'cifras', 'numeros', 'resumen', 'stats', 'summary', 'recap', 'balance', 'gaste', 'gastado', 'spend', 'spent'],
  ['modificacion', 'modificaciones', 'mod', 'mods', 'pieza', 'upgrade', 'tuning', 'instale', 'instalar'],
  ['foto', 'fotos', 'imagen', 'imagenes', 'galeria', 'album', 'picture', 'pictures', 'photo', 'photos', 'camara'],
  ['viaje', 'viajes', 'ruta', 'rutas', 'manejar', 'trip', 'trips', 'route', 'drive', 'conducir', 'recorrido'],
  ['compartir', 'invitar', 'invitacion', 'prestar', 'share', 'invite', 'miembro', 'miembros'],
  ['codigo', 'codigos', 'escanear', 'escaner', 'scanner', 'scan', 'obd', 'diagnostico', 'check', 'engine', 'luz', 'tablero', 'falla'],
  ['servicio', 'mantenimiento', 'aceite', 'filtro', 'filtros', 'service', 'maintenance', 'oil', 'cambio'],
];

const INDEX: Map<string, string[]> = new Map();
for (const group of SYNONYM_GROUPS) for (const w of group) INDEX.set(w, group);

/** The words that mean the same as `word` (itself included), folded. */
export const synonymsOf = (word: string): string[] => INDEX.get(word) ?? [word];
