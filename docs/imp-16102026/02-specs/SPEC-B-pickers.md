# SPEC-B — SelectField: toda selección en un modal (N4, X3)

## Problema
Las opciones aparecen "afuera", desplegadas en la pantalla: Tipo (13 chips), Color (grilla de 16 + Otro), Interior, ¿Cuándo se prende la luz de reserva? (4 chips), Consumo en (2), Estado (9 chips), indicador (Aguja/Cuadritos/Porcentaje), Modo conducir (Solo manual/Apagado). Ocupan pantalla, se cortan y es difícil ver qué quedó elegido.

## Lo que ya existe (repo, 2026-10-16)
- `components/pickers/PickerField.tsx`: **solo el campo disparador** (etiqueta, valor, chevron; el sheet lo abre quien lo usa). Usado hoy en `FillUpForm`, `MakeModelYear`, `OilBlock`, `precios/nuevo`.
- `components/pickers/SearchSheet.tsx` (hoja con búsqueda, secciones y "Otro…"), `SwatchGrid.tsx` (círculos con check y "Otro…"), `YearWheel.tsx`, y `components/ui/Sheet.tsx` (hoja en móvil, modal en web).
- Los controles "afuera" son `Chip` y `Segmented` de `components/ui/index.tsx`: ≈58 usos de `<Chip` en ~40 archivos y ≈30 de `<Segmented` en ~24. Muchos son **filtros de listas, pestañas o interruptores**, no selectores de valor.
- Decisión de este ciclo: se construye **`SelectField`** = el `PickerField` como disparador + una hoja con las opciones (`Sheet`; `SearchSheet` si hay más de 8; `SwatchGrid` para colores) que **se cierra al elegir**. No se reescribe `PickerField`, se envuelve.

## Regla (respuesta de Xaviel: todo en picker)
- **Alcance por defecto (decidido aquí, ajustable en PROGRESS)**: todo `Chip`/`Segmented` que sirva para **elegir un valor** de un campo de formulario o de ajustes pasa a `SelectField`, incluso con 2–3 opciones. Los **filtros de listas** (Historial, Viajes, Pista, admin) **también pasan a picker** (decisión de Xaviel, 16-10: "sí, si lo recomiendas"). Regla recomendada: cada filtro es un campo compacto en una fila de filtros (p. ej. "Tipo: Todos ▾") que abre el mismo `SelectField` y se cierra al elegir; con varios filtros activos se muestra un contador y un botón "Limpiar". Se quedan como están solo las **pestañas/navegación** (barra inferior, `TABS` del vehículo, conmutadores de vista como Lista/Mapa) y los **interruptores sí/no**: cambian de vista o de estado, no eligen un valor entre opciones nombradas.
- Toda selección entre **opciones nombradas** (2 o más) usa `SelectField`: un campo que muestra el valor actual; al tocarlo abre un modal con las opciones; al elegir una, el modal **se cierra** y el campo muestra el valor.
- **No son selección** y se quedan como están: booleanos (Aceite sintético, Pasajero → interruptor o casilla), números (stepper de cuadros), fechas (`DateField`), texto libre y la navegación (barra inferior, pestañas del vehículo). Los filtros de listas **sí** se convierten (ver alcance).

## Componente
```tsx
<SelectField
  label="Tipo" value={v} onChange={set}
  options={[{ value, label, icon?, swatch?, hint?, group? }]}
  variant="list" | "swatch-grid"
  searchable="auto"        // búsqueda si hay más de 8 opciones
  allowOther="Otro…"       // abre un campo de texto/color dentro del modal
  required error disabled placeholder testID
  renderValue?             // swatch/ícono + etiqueta
/>
```
- Presentación: hoja inferior en móvil (nativo y web angosto); modal centrado desde 768 px.
- Se cierra al elegir (selección única), con toque fuera, botón ✕, tecla Esc y botón Atrás de Android (los tres últimos cierran **sin cambiar** el valor).
- Opción elegida marcada con ✔ y enfocada al abrir (scroll a la selección).
- "Otro…": dentro del modal aparece el campo; confirmar guarda y cierra.
- Estados que piden datos extra (Estado → nota / desde): al cerrar el modal, los campos extra aparecen debajo del campo.
- Accesibilidad: rol combobox/listbox, foco atrapado en web, etiqueta hablada del valor, objetivos ≥ 44 pt, soporte de lector de pantalla.
- Swatches (X3): todo círculo de color lleva borde/anillo con contraste ≥ 3:1 contra el fondo (el Negro hoy no se ve). Vale para el campo, la grilla y cualquier lugar donde se use el swatch.
- i18n es/en, estilo JDM (ámbar `#FFB300`, tipografías del cluster), skeleton gemelo.

## Inventario esperado (PROMPT-00 lo corrige con el real)
| Pantalla | Campo | Opciones | Control actual → destino |
|----------|-------|----------|--------------------------|
| Editar vehículo | Tipo | 13 | chips → SelectField list |
| Editar vehículo | Color | 16 + Otro | grilla → SelectField swatch-grid |
| Editar vehículo | Interior | 16 + Otro | grilla → SelectField swatch-grid |
| Editar vehículo | Estado | 9 (con nota/desde) | chips → SelectField list + campos extra |
| Editar vehículo | Indicador de combustible | 3 (Aguja / Cuadritos / Porcentaje) | segmentado → SelectField |
| Editar vehículo | ¿Cuándo se prende la luz de reserva? | 4 | chips → SelectField |
| Editar vehículo | Consumo en | 2 (km/gal, L/100 km) | segmentado → SelectField |
| Editar vehículo | Año, marca, modelo | muchas | ya son pickers → unificar con `SelectField` |
| Editar vehículo | Tipo de aceite / unidades L-gal | varias | → SelectField |
| Modo conducir | Vehículo | N | menú ▾ → SelectField |
| Modo conducir | Modo (Solo manual / Apagado / Automático en Android) | 2–3 | segmentado → SelectField |
| Combustible | Estación, tipo de combustible | varias | → SelectField |
| Eventos / Mods / Mantenimiento / Chequeo | tipo, severidad, sistema… | varias | → SelectField |
| Más / Perfil | Idioma, avatar | varias | → SelectField |
| Reparaciones (nuevo, fase 5) | sistema, quién, taller, garantía, pendiente | varias | SelectField desde el inicio |

## Guardia contra recaídas
- Prueba (jest, sobre el código) y regla de lint que falle si un archivo de formulario/ajustes usa `Chip` o `Segmented` como selector de valor; lista blanca explícita solo para pestañas/navegación e interruptores (un comentario `// not-a-select: <motivo>` o un archivo de lista).
- Prueba de captura por pantalla migrada (390 px) y por modal abierto.

## Pruebas
Abrir/elegir/cerrar; Atrás y Esc no cambian el valor; búsqueda filtra; "Otro…" guarda; valor persiste tras guardar y recargar (conecta con el test de ida y vuelta de SPEC de PROMPT-01); teclado y lector de pantalla; el estado "Pasajero" y "Aceite sintético" siguen siendo interruptores.
