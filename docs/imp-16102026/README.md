# Car Guy — ciclo IMP 16102026 (v2.6 "Kōbō" 工房: permisos, pickers, herramientas a la mano, reparaciones)

Escrito 2026-10-16. Paquete de prompts para Claude Code CLI sobre el ciclo anterior (IMP 01102026, v2.5 "Nakama"). Tus notas de hoy: mapa, permisos, selectores afuera, aceite sintético, funciones escondidas (OBD) y registrar reparaciones.

## Dónde va
`C:\developer\improvements\car guy improvements\Octubre 2026\imp cg 16102026\` (convención desde el 16-10: `C:\developer\improvements\car guy improvements\<Mes año>\imp cg <ddmmyyyy>\`). Dentro del repo, la fase 0 lo copia a `docs/imp-16102026/`.

## Orden
Un prompt por sesión de Claude Code, en este orden: `03-prompts/PROMPT-00` … `PROMPT-06`. Cada uno termina con commit, `PROGRESS.md` actualizado y reporte.

## Contenido
- `00-context/NOTAS-ORIGINALES.md` — tus notas sin editar + tabla nota → fase → criterio (para revisar contra lo que escribiste)
- `00-context/BRIEF.md` — estado esperado, tus respuestas, ADR-59…64, restricciones, reglas permanentes
- `02-specs/SPEC-A…D` — permisos y mapa · SelectField · funciones a la vista · reparaciones
- `03-prompts/PROMPT-00…06` — kickoff y diagnóstico · fix pack · permisos y mapa · pickers · herramientas · reparaciones · regresión y release v2.6.0
- `04-tracking/ROADMAP.md`, `PROGRESS.md`
- `05-manual-checklist.md` — lo que solo tú puedes probar

## Cosas que debes saber
- La primera versión de este paquete se escribió sin ver el repo y se **corrigió el mismo día contra `github.com/XavielT/car-guy` (commit `2691f64`)**: versión 2.5.1, schema v10, `sql/039`, ADR-58. Hallazgos que cambiaron el plan: la casilla de aceite sintético nunca se guarda (solo se aplica al crear); el registro de reparaciones ya existe pero solo se llega por Historial → "+"; ya hay `PickerField`/`SearchSheet`/`SwatchGrid`; los testigos ya son tocables; los permisos están dispersos en ~12 archivos.
- El "map issue" no está definido más allá del aviso de ubicación; por eso la fase 0 lo diagnostica antes de arreglar.
- El comportamiento de permisos en PWA de iOS (¿pregunta en cada apertura?, texto exacto de Ajustes en español) está marcado **no verificado**: hay que probarlo en tu iPhone.
- Incluí siete cosas que vi en tus capturas y no estaban en las notas (X1–X7): campo de fecha desbordado, "hace 0 s" partido, swatch Negro invisible, pestañas cortadas, "875,000" gris, hueco en la tarjeta de Modo conducir, y los Pendientes como caso real de reparación. Quítalas si no las quieres.
- Con "todo en picker" quedan fuera del cambio solo los booleanos (Aceite sintético, Pasajero), el stepper de cuadros, las fechas, el texto libre y la navegación.
