# PROMPT-03 — SelectField y migración de los selectores

Continúas el ciclo IMP 16102026. Lee `00-context/BRIEF.md` (reglas permanentes y "Lo que ya existe"), `00-context/NOTAS-ORIGINALES.md`, `02-specs/SPEC-B-pickers.md` y `picker-inventory.md` de la fase 0. Antes de escribir código, lee los docs versionados de Expo v57 (regla de `AGENTS.md`). **Nada espera una decisión**: default recomendado, registrarlo en `PROGRESS.md`, seguir.

## Alcance (N4, X3)
Respuesta de Xaviel: **todo en picker**, incluso 2–3 opciones. Las opciones no pueden quedar desplegadas "afuera": van dentro de un campo que abre un modal, y el modal se cierra al elegir.

## Punto de partida (ya en el repo)
`components/pickers/PickerField.tsx` es solo el campo disparador; existen `SearchSheet`, `SwatchGrid`, `YearWheel` y `components/ui/Sheet.tsx`. Los selectores "afuera" son `Chip` y `Segmented` de `components/ui/index.tsx` (≈58 y ≈30 usos). No reescribas `PickerField`: envuélvelo.

## Pasos
1. **`SelectField`** (ADR-60) en `components/pickers/SelectField.tsx`, exportado desde `components/pickers/index.ts`: `PickerField` como disparador + hoja con las opciones. Props: `label`, `value`, `options: { value, label, icon?, swatch?, hint? }[]`, `onChange`, `variant: 'list' | 'swatch'`, `searchable` (automático con más de 8 → `SearchSheet`), `allowOther`, `required`, `error`, `disabled`, `placeholder`, `testID`. La hoja usa `Sheet` (móvil: hoja inferior; web: modal) y **se cierra al elegir**; ✕, toque fuera, Esc (web) y Atrás de Android cierran **sin cambiar** el valor; ✔ en la opción actual y scroll a ella; "Otro…" con campo dentro de la hoja; accesibilidad (rol, etiqueta hablada, objetivos ≥ 44 pt); textos en `es.ts` y `en` tipado; skeleton gemelo donde aplique.
2. **Swatches (X3)**: anillo/borde con contraste ≥ 3:1 contra el fondo en `SwatchGrid` y en el valor del campo (Negro, Gris, oscuros). Si la fase 1 ya lo hizo, reutilízalo.
3. **Migra cada fila de `picker-inventory.md` que sea selector de valor**, sin dejar ninguna: como mínimo, de las capturas: Tipo de carrocería (13), Color e Interior (variante swatch + Otro), Estado (9; los que piden nota/desde muestran esos campos debajo), indicador de combustible (Aguja/Cuadritos/Porcentaje; la vista previa se mantiene debajo), ¿Cuándo se prende la luz de reserva? (4), Consumo en (km/gal | L/100 km), Modo conducir (vehículo y modo Solo manual/Apagado/Automático) y el resto del inventario: `VehicleForm`, `IdentitySection`, `GaugeTypeSection`, `ReminderForm`, `track/EventForm`, `album/EventForm`, `SessionForm`, `ModForm`, `InventoryForms`, `WishlistForm`, `ContactPieces`, `OilBlock`, `FillUpForm`, `FuelPicker`, `PricesBlock`, `app/viajes/ajustes`, `app/cuenta`, idioma, etc.
4. **Lo que NO se convierte por defecto** (regístralo en `PROGRESS.md` con la lista de archivos): interruptores sí/no (Aceite sintético, Pasajero), stepper de cuadros, `DateField`, texto libre, navegación (barra inferior, `TABS` del vehículo) y conmutadores de vista (Lista/Mapa). **Los filtros de listas SÍ se convierten** (decisión de Xaviel, 16-10): ver el paso 4b.
4b. **Filtros de listas (Historial, Viajes, Pista, admin y los de la pantalla Reparaciones de la fase 5)**: Xaviel dijo que sí. Cada filtro pasa a un campo compacto que abre `SelectField` (hoja que se cierra al elegir), en una fila de filtros con contador de filtros activos y botón "Limpiar"; el valor "Todos" siempre es la primera opción. Cuida: el estado del filtro se conserva al volver a la lista; no hay parpadeo ni recarga al cambiar; en web el modal funciona con teclado. Queda fuera solo lo de la lista del paso 4 (pestañas, navegación, conmutador Lista/Mapa, interruptores). Registra en `PROGRESS.md` cada filtro migrado.
5. **Valores intactos**: la migración no cambia lo guardado. Usa el test de ida y vuelta de la fase 1 para confirmar que elegir en el picker persiste tras guardar, recargar y sincronizar.
6. **Guardia (ADR-60)**: prueba jest sobre el código + regla de lint que falle si un archivo de formulario/ajustes usa `Chip`/`Segmented` como selector de valor; lista blanca explícita solo para pestañas/navegación e interruptores.
7. **Pruebas**: abrir/elegir/cerrar; Atrás y Esc no cambian el valor; búsqueda filtra; "Otro…" guarda; lector de pantalla; capturas a 390 px de cada pantalla migrada (cerrada y con la hoja abierta); la prueba de auditoría de skeletons sigue pasando; `npm test`, `npm run lint`, typecheck, `npm run build`, i18n (`tools/i18n-*`).
8. **Docs y release**: ADR-60, `CHANGELOG.md` (es), `PROGRESS.md`; release con el script del repo (solo JS → OTA, que decide `tools/ota-gate.cjs`).

## Criterios de aceptación
Ningún selector de valor queda desplegado en una pantalla de formulario o ajustes; todos abren hoja y se cierran al elegir; Negro visible; valores previos intactos y persistentes; la prueba/lint impide recaídas; capturas de todas las pantallas migradas; filtros de listas también migrados; lista de no-conversiones entregada.

## Reporte final
Cuántos selectores se migraron (lista por archivo), qué se dejó fuera y por qué, los filtros migrados, y la versión publicada.
