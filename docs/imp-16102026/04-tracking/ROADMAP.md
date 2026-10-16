# ROADMAP — ciclo IMP 16102026 (v2.6 "Kōbō")

| Fase | Prompt | Qué | Notas | Salida |
|------|--------|-----|-------|--------|
| 0 | PROMPT-00 | Kickoff, línea base, diagnóstico (mapa, aceite, selectores, permisos, funciones, reparaciones) | todas (solo lectura) | Docs de hallazgos, sin cambios de producto |
| 1 | PROMPT-01 | Fix pack 2.5.2: aceite sintético (columna `oil_synthetic`, schema v11, `sql/040`) + test de ida y vuelta, Fecha de compra, "hace 0 s", swatch Negro, "875,000", defectos de mapa independientes, chip de ubicación accionable | N5, N1 parcial, X1, X2, X3, X5 | Patch (OTA esperado) |
| 2 | PROMPT-02 | Registro de permisos, primer, gates, pantalla Permisos, mapa con respaldo y CTAs, tarjeta compacta | N1, N2, N3, X6 | Minor parcial (APK si cambia lo nativo) |
| 3 | PROMPT-03 | `SelectField` (envuelve `PickerField`) y migración de los `Chip`/`Segmented` que eligen un valor, incluidos los filtros de listas + guardia | N4, X3 | OTA |
| 4 | PROMPT-04 | Registro de funciones, hub Herramientas, atajos, pestañas sin cortes, testigos tocables, buscador, OBD, Descubre | N6, N6a, X4 | OTA |
| 5 | PROMPT-05 | Reparaciones: completar el `ServiceRecord` existente (`done_by`, fotos con rol, cerrar Pendientes, entradas, pantalla Reparaciones); schema v12 + `sql/041` | N7, X7 | OTA + SQL en `x-core` |
| 6 | PROMPT-06 | Verificación nota por nota, regresión, docs, **v2.6.0** | N1–N9, X1–X7 | Release nativo (APK) |

Orden estricto: 0 → 1 → 2 → 3 → 4 → 5 → 6. Razón: el fix pack primero (el usuario lo sufre hoy); permisos antes de reparaciones (fotos y garantías los usan); pickers antes de hub y reparaciones (formularios nuevos nacen con el componente); hub antes de reparaciones para que el atajo ya exista.

ADR propuestos (el último real es 58): 59 Permisos · 60 SelectField · 61 Reparación = ServiceRecord completado · 62 Registro de funciones · 63 Ida y vuelta de campos · 64 Mapa sin permiso.
