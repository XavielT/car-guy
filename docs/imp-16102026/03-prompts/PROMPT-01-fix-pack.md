# PROMPT-01 — Fix pack (patch de la versión actual)

Continúas el ciclo IMP 16102026 en `docs/imp-16102026/`. Lee `00-context/BRIEF.md` (reglas permanentes), `00-context/NOTAS-ORIGINALES.md` y `findings.md` de la fase 0. **Nada espera una decisión**: aplica el default recomendado, regístralo en `PROGRESS.md` y sigue. Bug → primero test que falla, luego fix.

## Alcance (notas N5, N1 parcial, X1, X2, X3, X5)

### A. Aceite sintético no se queda marcado (N5)
**Causa raíz ya encontrada en el repo (confírmala en la fase 0):** "¿Aceite sintético?" es solo un campo del borrador del formulario (`components/VehicleForm.tsx`: `useState(initial?.synthetic ?? false)`), no existe como columna del vehículo. `app/vehiculo/[id]/editar.tsx` arma `initial` sin `synthetic`, así que al editar siempre arranca en falso; y `saveVehicleDraft` (`lib/db/vehicleOps.ts:170`) solo lo aplica cuando `isNew` (`applySyntheticOil` mueve el recordatorio `aceite_motor` a 10,000 km / 12 meses). Editar un vehículo existente ignora la casilla por completo.
1. Escribe primero un test que **falla**: guardar un vehículo existente con sintético marcado → reabrir el editor → debe seguir marcado, y el recordatorio de aceite debe tener 10,000 km / 12 meses.
2. **Persistencia (default, sin esperar decisión)**: columna `vehicle.oil_synthetic INTEGER NOT NULL DEFAULT 0`: migración local **v11** (patrón de `migrationV10.ts`) + `sql/040_vehicle_oil_synthetic.sql` aditivo con rollback + `types:gen`; backfill: `1` si el recordatorio `aceite_motor` del vehículo ya tiene `intervalKm = 10000` e `intervalMonths = 12` o la nota `t.oil.syntheticNote`. Sync push/pull incluido (y la guardia del gate de esquema).
3. `editar.tsx` carga el valor; `saveVehicleDraft` lo guarda y **aplica en ambos sentidos** (marcar → intervalos sintéticos; desmarcar → vuelve al intervalo del catálogo para `aceite_motor`), recalculando el próximo vencimiento sin perder la última fecha/km de cambio. Test de cada sentido.
4. **Test genérico de ida y vuelta (ADR-63)** para *todos* los campos de `VehicleDraft`: valor distinto del default → guardar → recargar el editor (`editar.tsx`) → comparar → simular sync push y pull → comparar. Cualquier otro campo que falle (X5: "Precio de compra" gris "875,000"; fecha de compra; estado; indicador; luz de reserva; unidades) se corrige aquí con su propio test.
5. Guardia: el pull de sync **no** pisa un valor local más nuevo con un default.
6. Objetivo táctil de la casilla ≥ 44 pt y que tocar el texto también marque.
7. Orden: SQL `040` aplicado a `x-core` con `tools/apply-sql.mjs` **antes** de publicar la app (si no hay credenciales, déjalo listo e indícalo; no esperes).

### B. "Fecha de compra" se sale de la pantalla (X1)
Arregla el layout de la fila Precio/Fecha (columnas iguales, `minWidth: 0`, sin desbordar) a 320, 360 y 390 px, web y nativo. Audita **toda** fila de dos campos de la app con el mismo patrón y corrige las que desborden. Captura antes/después.

### C. "hace 0 s" partido y texto (X2)
En "Tanque: 4/12 ≈ 4.5 gal · ≈ 120 km (70–190) · hace 0 s": que "hace 0 s" nunca se parta (espacios de no separación) y que el salto de línea ocurra solo en los separadores `·`; formateo relativo es/en: "ahora", "hace 5 min", "hace 2 h", "ayer"; no mostrar "0 s". Test del formateador.

### D. Swatch "Negro" invisible (X3, primera parte)
Todo swatch lleva borde/anillo con contraste ≥ 3:1 contra el fondo (también el Gris seleccionado). Prueba visual o de contraste calculado. (El picker de la fase 3 reutiliza el componente.)

### E. Mapa: defectos independientes del sistema de permisos (N1 parcial)
Corrige los `M-n` de `findings.md` marcados "fase 1". Además, como mejora inmediata mientras llega la fase 2: el aviso "Sin permiso de ubicación…" pasa de texto pasivo a **botón** que, al tocarlo (gesto del usuario), solicita la ubicación (web: `getCurrentPosition`; nativo: `requestForegroundPermissionsAsync`) y, si ya está bloqueada, muestra pasos. La fase 2 lo reemplaza por el sistema completo. Cada defecto corregido lleva test o captura.

### F. Cierre
- Entrada en CHANGELOG/Novedades (es/en) con lo corregido, en lenguaje de usuario.
- Typecheck, lint, tests, build web verdes; captura de cada pantalla tocada a 390 px.
- Release **2.5.2** con el script del repo (`tools/ota-gate.cjs` decide OTA vs APK: la migración v11 es JS, pero recuerda que la huella nativa ya cambió con Firebase y hay un APK pendiente; no pidas confirmación y reporta qué canal usaste).
- Actualiza `PROGRESS.md` (Fase 1 ✔, decisiones tomadas, versión publicada).

## Criterios de aceptación
Test de aceite sintético falla antes y pasa después; test de ida y vuelta de campos del vehículo en verde (nativo y web) con los campos extra corregidos; Fecha de compra no desborda a 320 px; "hace 0 s" no se parte ni aparece "0 s"; Negro visible; defectos de mapa de fase 1 cerrados; chip de ubicación es botón; patch publicado.

## Reporte final
Qué causaba el aceite sintético, qué otros campos fallaban, cuántas filas de dos campos desbordaban, qué defectos de mapa se cerraron y la versión publicada.
