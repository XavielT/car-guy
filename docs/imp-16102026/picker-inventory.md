# Inventario de selectores (N4) — Fase 0, 2026-10-16

Recorrido de `<Chip` y `<Segmented` (`git grep -n "<Chip\b\|<Segmented\b" -- app components`) más los selectores hechos a mano con `Pressable` que no pasan por esos dos componentes. Fuente: `components/ui/index.tsx` (`Chip` :110, `Segmented` :220). El BRIEF decía ≈58 `<Chip` y ≈30 `<Segmented`; el recuento real es:

| Qué | Líneas en el código | Notas |
|-----|---------------------|-------|
| `<Segmented` | **31** | 2 son la galería dev (`app/dev/tokens.tsx`) → 29 reales |
| `<Chip` | **99** líneas | 5 en `app/dev/tokens.tsx` (galería, fuera) y 4 en `app/conducir.tsx` son un `Chip` **local** (`conducir.tsx:420`, no el de ui); quedan **90 líneas** del `Chip` de ui (muchas son un `.map` de una misma lista: una fila de este inventario por campo) |
| A mano (sin Chip/Segmented) | 10 controles | `Pressable` con `accessibilityRole` tab/radio: ver §E |

Clases: **(a)** selector de valor de formulario/ajustes → `SelectField` · **(b)** filtro de lista → `SelectField` (decisión de Xaviel, 16-10) · **(c)** pestaña / navegación → se queda · **(d)** interruptor sí/no → se queda (casilla/`Switch`). "# opc." = número de opciones; "din." = viene de datos (vehículos, contactos, categorías…).

Resumen por clase (**filas** de este documento, sin la galería dev; una fila = un campo/control): **(a) 91 · (b) 13 · (c) 10 · (d) 9 · (e) 4**, más 4 sugerencias/acciones en §F. La fase 3 migra (a)+(b) = **104 filas**; de ellas 5 ya usan `PickerField`/`SwatchGrid` (se unifican en `SelectField`) y 1 se elimina (chip de modo duplicado) → **≈ 98 controles reales** que pasan de "afuera" a picker.

---

## A. Selectores de valor de formulario y ajustes (a) → `SelectField`

| Archivo:línea | Campo | # opc. | Control actual | Destino |
|---------------|-------|--------|----------------|---------|
| `components/VehicleForm.tsx:279` | Tipo (carrocería) | 13 | Chip (nulo permitido) | SelectField con búsqueda |
| `components/VehicleForm.tsx:284` | Color exterior | 18 + Otro | `SwatchGrid` (ya picker, pero en línea) | SelectField → `SwatchGrid` en hoja |
| `components/VehicleForm.tsx:285` | Interior (color) | 8 + Otro | `SwatchGrid` en línea | SelectField → `SwatchGrid` en hoja |
| `components/VehicleForm.tsx:292` | Material del interior | 5 | Chip (nulo permitido) | SelectField |
| `components/VehicleForm.tsx:325` | Unidad del tanque (gal/L) | 2 | Segmented | SelectField |
| `components/VehicleForm.tsx:363` | Consumo en (km/gal · km/L · L/100 km) | 2 | Segmented | SelectField |
| `components/VehicleForm.tsx:422` | Estado del vehículo | 7 | Chip | SelectField |
| `components/FuelPicker.tsx:16` (usado en `VehicleForm.tsx` y otros) | Combustible | 6 | Chip | SelectField |
| `components/vehicle/IdentitySection.tsx:61` | Transmisión | 4 | Chip (nulo permitido) | SelectField |
| `components/vehicle/IdentitySection.tsx:69` | Tracción | 3 | Chip | SelectField |
| `components/vehicle/IdentitySection.tsx:77` | Origen | 5 | Chip | SelectField |
| `components/vehicle/GaugeTypeSection.tsx:36` (`card`) | Indicador de combustible (aguja/cuadros/%) | 3 | tarjetas con dibujo (`radio`) | SelectField con opciones con dibujo (§E) |
| `components/vehicle/GaugeTypeSection.tsx:107` | Luz de reserva (en qué cuadro) | ~6 | Chip | SelectField |
| `app/conducir.tsx:295` | Modo conducir: modo del viaje | 2 (web) / 3 (nativo) | Segmented | SelectField (con tema oscuro, ver M-9) |
| `app/conducir.tsx:236` | Modo conducir: vehículo | din. | Chip local que cicla con un toque | SelectField (hoy "cicla": no se ve la lista) |
| `app/conducir.tsx:241` | Modo conducir: chip de modo (solo lectura, duplica al Segmented) | — | Chip sin acción | se elimina (queda el SelectField del modo) |
| `app/viajes/ajustes.tsx:96` | Modo de viajes | 2–3 | Segmented | SelectField |
| `app/viaje/[id].tsx:278` | Vehículo del viaje | din. | Chip | SelectField |
| `app/viaje/[id].tsx:285` | Rol (conductor/pasajero) | 2 | Segmented | SelectField (¡"Pasajero" en Modo conducir es un interruptor → (d)!) |
| `app/viaje/compartir/[id].tsx:152` | Quién ve el viaje | 3 | Chip | SelectField |
| `app/vehiculo/[id]/compartir.tsx:176` | Visibilidad del vehículo | 3 | Segmented | SelectField |
| `app/juntes/nuevo.tsx:86` | Duración del junte (2/4/6 h) | 3 | Chip | SelectField |
| `app/juntes/nuevo.tsx:99` | Visibilidad del junte | 3 | Chip | SelectField |
| `app/juntes/[id].tsx:273` | Viaje a vincular | hasta 6 | Chip | SelectField |
| `components/social/PrivacyZonesEditor.tsx:91` | Radio de la zona privada | 4 | Chip | SelectField |
| `components/FillUpForm.tsx` (gasolinera) | Gasolinera | din. | `PickerField` + `SearchSheet` | ya es picker (se pasa a `SelectField` para unificar) |
| `components/ReminderForm.tsx:155/157` | Tipo de servicio del recordatorio | din. + Ninguno | Chip | SelectField con búsqueda |
| `components/ReminderForm.tsx:167` | ¿Por qué se mide? (fecha/km/ambos) | 3 | Segmented | SelectField |
| `components/service/OilBlock.tsx:121` | Viscosidad del aceite | din. (~8) + Otra | Chip | SelectField con "Otra…" |
| `components/service/OilBlock.tsx:155` | Tipo de aceite | 3 | Chip | SelectField |
| `components/service/OilBlock.tsx:188` | Especificaciones (multi) | din. | Chip multi | SelectField múltiple (`multiple`) |
| `components/service/OilBlock.tsx:164` | Marca del aceite | din. | `PickerField` + `SearchSheet` | `SelectField` |
| `components/vehicle/MakeModelYear.tsx:53/59/68` | Marca / Modelo / Año | din. | `PickerField` + `SearchSheet` / `YearWheel` | `SelectField` (conserva la rueda de año) |
| `app/servicio/nuevo.tsx:345` | Tipo de servicio (mant./reparación/mejora) | 3 | `Pressable` a mano (con redirección al elegir "mejora") | SelectField (en modo reparación el tipo queda fijo, SPEC-D) |
| `app/servicio/[id].tsx:221` | Tipo de servicio (edición) | 3 | `Pressable` a mano | SelectField |
| `app/tarea/nueva.tsx:67` | Tipo de tarea | 3 | `Chips` local | SelectField |
| `app/tarea/nueva.tsx:68` | Prioridad | 3 | `Chips` local | SelectField |
| `app/documento/nuevo.tsx:71` | Tipo de documento | 7 | `Pressable` a mano | SelectField |
| `app/notificaciones.tsx:137` | Hora del recordatorio | 8 | `Pressable` a mano | SelectField |
| `components/album/EventForm.tsx:254` | Tipo de hito | 7 | Chip | SelectField |
| `components/album/EventForm.tsx:260` | Severidad del evento | 3 | Segmented (con punto de color) | SelectField con punto de color |
| `components/build/InventoryForms.tsx:109` | Tipo de pieza | 6 | Chip | SelectField |
| `components/build/InventoryForms.tsx:132` | Condición | 3 | Chip | SelectField |
| `components/build/InventoryForms.tsx:247` | Estado del juego de aros | 3 | Chip | SelectField |
| `components/build/InventoryForms.tsx:404/406` | Juego de aros de la goma | din. + Ninguno | Chip | SelectField |
| `components/build/InventoryForms.tsx:412` | Posición de la goma | 6 | Chip | SelectField |
| `components/build/InventoryForms.tsx:418` | Estado de la goma | 5 | Chip | SelectField |
| `components/build/ModForm.tsx:262` | Categoría del mod | din. (~20) | Chip + búsqueda | SelectField con búsqueda |
| `components/build/ModForm.tsx:271` | Nombre sugerido (presets por categoría) | din. | Chip que rellena el texto | sugerencias dentro del campo (§F) |
| `components/build/ModForm.tsx:291` | Estado del mod | 6 | Chip | SelectField |
| `components/build/ModForm.tsx:305` | Quién lo instaló | 3 | Chip | SelectField |
| `components/build/ModForm.tsx:327` | Moneda | 3 | Chip | SelectField |
| `components/build/ModForm.tsx:403/405` | Pieza que reemplaza | din. + Ninguno | Chip | SelectField |
| `components/build/WishlistForm.tsx:126` | Categoría | din. | Chip | SelectField con búsqueda |
| `components/build/WishlistForm.tsx:140` | Prioridad | 3 | Chip | SelectField |
| `components/build/WishlistForm.tsx:146` | Moneda | 4 | Chip | SelectField |
| `components/build/WishlistForm.tsx:166` | Estado | 4 | Chip | SelectField |
| `components/diy/ContactPieces.tsx:101` | Tipo de contacto | 7 | Chip | SelectField |
| `components/diy/ContactPieces.tsx:188-193` | Taller/contacto del servicio | din. + Ninguno + Otro + "+" | Chip | SelectField con "Agregar contacto" (SPEC-D) |
| `components/diy/DtcPieces.tsx:71` | Vehículo al guardar un código OBD | din. | Chip dentro de hoja | SelectField |
| `components/memory/MemoryTab.tsx:201` | Grupo del dato de memoria | 7 | Chip | SelectField |
| `components/track/EventForm.tsx:258` | Vehículo del evento de pista | din. | Chip | SelectField |
| `components/track/EventForm.tsx:267/269` | Circuito | din. + "Agregar" | Chip | SelectField con "Agregar circuito" |
| `components/track/EventForm.tsx:277` | Tipo de circuito | 6 | Chip | SelectField |
| `components/track/EventForm.tsx:292` | Disciplina | 6 | Chip | SelectField |
| `components/track/EventForm.tsx:299` | Clima | 4 | Chip (nulo permitido) | SelectField |
| `components/track/EventForm.tsx:309` | Condición de la pista | 5 | Chip (nulo permitido) | SelectField |
| `components/track/SessionForm.tsx:273` | Tipo de sesión | 6 | Chip | SelectField |
| `components/track/SessionForm.tsx:317/325` | Juego de aros delantero / trasero | din. | Chip | SelectField (×2) |
| `components/track/SessionForm.tsx:344` | Gomas usadas (multi) | din. | Chip multi | SelectField múltiple |
| `components/track/SessionForm.tsx:437` | Sensación del carro | 5 | Chip | SelectField |
| `app/album/importar.tsx:315` | Vehículo destino de las fotos | din. | Chip | SelectField |
| `app/album/importar.tsx:410` | Precisión de la fecha | 3 | Chip | SelectField |
| `app/foto/[id].tsx:239` | Precisión de la fecha | 3 | Chip | SelectField |
| `app/garaje/miembros.tsx:161/162` | Rol de un miembro (editor/lector), por fila | 2 | Chip | SelectField compacto por fila |
| `app/garaje/miembros.tsx:176/177` | Rol de la invitación | 2 | Chip | SelectField |
| `app/vehiculo/[id]/build.tsx:342` | Reclasificar un mod (categoría) | din. | Chip en hoja | SelectField |
| `app/vehiculo/[id]/libro.tsx:125` | Período del libro | 3 | Chip | SelectField |
| `app/comentario.tsx:164` | Tipo de comentario | 3 | Chip (`radiogroup`) | SelectField |
| `app/precios/nuevo.tsx:155` | Fuente del precio | 5 | Chip | SelectField |
| `app/precios/nuevo.tsx:161` | Estación | din. | `PickerField` + `SearchSheet` | `SelectField` |
| `app/chequeo/plantillas/[id].tsx:175` | Frecuencia del chequeo | 4 | Chip | SelectField |
| `app/chequeo/plantillas/[id].tsx:259` | Si falla (por ítem) | 3 | Segmented | SelectField |
| `app/chequeo/[templateId]/run.tsx:361` | Acción si falla (por ítem) | 3 | Segmented | SelectField |
| `app/exportar.tsx:133` | Período de la exportación | 4 | Segmented | SelectField |
| `app/(tabs)/mas.tsx:266` | Tema (sistema/oscuro/claro) | 3 | Segmented | SelectField |
| `app/(tabs)/mas.tsx:279` | Idioma | 3 | Segmented | SelectField |
| `app/bienvenida/index.tsx:228` | Idioma (bienvenida) | 3 | Segmented | SelectField |
| `app/admin/comentarios/[id].tsx:109` | Estado del comentario (admin) | 3 | Segmented | SelectField |
| `app/admin/reportes.tsx:63` | Estado de un reporte (admin, por fila) | 3 | Chip | SelectField compacto |
| `app/admin/usuarios.tsx:156` | Rol de usuario (admin, en hoja) | 3 | Segmented | SelectField |

(Las filas "din." y "múltiple" necesitan la variante con búsqueda o `multiple` del `SelectField`.)

## B. Filtros de lista (b) → `SelectField` (decisión de Xaviel)

| Archivo:línea | Qué filtra | # opc. | Control | Destino |
|---------------|-----------|--------|---------|---------|
| `app/(tabs)/historial.tsx:130-155` | Tipo de registro del Historial | ~10 | `Pressable` a mano con `ScrollView` horizontal | SelectField en la cabecera |
| `app/(tabs)/garaje.tsx:258` | Activos / Proyecto / Ex | 3 | Chip | SelectField |
| `app/viajes/index.tsx:85/87` | Vehículo (Todos + cada uno) | din. | Chip | SelectField |
| `app/viajes/index.tsx:97` | Todos / mes / largos / rápidos | 4 | Segmented | SelectField |
| `app/pista/index.tsx:67/69` | Vehículo (Todos + cada uno) | din. | Chip | SelectField |
| `app/cifras.tsx:145` | Período de Cifras | 4 | Segmented | SelectField |
| `app/reporte.tsx:125` | Período del reporte | 4 | Segmented | SelectField |
| `app/tareas/index.tsx:72` | Estado de las tareas | 3 | Segmented | SelectField |
| `app/precios/index.tsx:106` | Combustible del historial de precios | 6 | Chip | SelectField |
| `components/cifras/PricesBlock.tsx:141` | Combustible del gráfico de precios | 6 | Chip | SelectField |
| `app/vehiculo/[id]/build.tsx:198` | Tipo de inventario | ~6 | Chip | SelectField |
| `app/admin/comentarios.tsx:87/89` | Estado de los comentarios (con conteo) | 4 | Chip | SelectField (con el conteo en la opción) |
| `app/album/importar.tsx:202` | Año a explorar de la galería | din. | Chip en `ScrollView` | SelectField (rueda de años) |

## C. Pestañas y navegación (c) — se quedan como están

| Archivo:línea | Qué es |
|---------------|--------|
| `app/vehiculo/[id].tsx:75,314` | 8 pestañas del vehículo (resumen, álbum, eventos, build, ficha, pista, viajes, docs) en `ScrollView` horizontal |
| `app/vehiculo/[id]/build.tsx:274` | Pestañas del Build (mods, specs, wishlist, inventario) |
| `app/vehiculo/[id]/ficha.tsx:223` | Ficha / Memoria |
| `app/vehiculo/[id]/album/index.tsx:154` | Vista línea de tiempo / cuadrícula |
| `app/vehiculo/[id]/compartir.tsx:256` | Elegir fotos / portada |
| `app/comunidad.tsx:124` | Pestañas de Comunidad (5, con conteo) |
| `app/cuenta.tsx:293` | Entrar / Crear cuenta |
| `components/tabbar/CarGuyTabBar.tsx` | Barra inferior (Inicio, Garaje, Conducir al centro, Historial, Más) |
| `app/(tabs)/garaje.tsx:211-218` | Barra de herramientas del garaje (`tablist`) |
| `components/pickers/YearWheel.tsx:58` | Saltos de década dentro de la hoja del año (no es un campo) |

## D. Interruptores sí/no (d) — se quedan como casilla/`Switch`

| Archivo:línea | Qué es | Nota |
|---------------|--------|------|
| `components/VehicleForm.tsx:373` | Aceite sintético | casilla; N5 |
| `app/conducir.tsx:242` | Pasajero | `Chip` local con `selected` → pasa a interruptor visible |
| `components/FillUpForm.tsx:271` | Tanque lleno / parcial | hoy Segmented de 2 opciones; es un booleano (`full`) → casilla "Llené el tanque" (default aplicado, ver PROGRESS) |
| `components/ReminderForm.tsx:184` | ¿Recurrente? Sí/No | booleano en Segmented → `Switch` |
| `components/ReminderForm.tsx:228` | ¿Fijo? Sí/No | booleano en Segmented → `Switch` |
| `components/ReminderForm.tsx:271` | Activado / Desactivado | booleano en Segmented → `Switch` |
| `app/viajes/ajustes.tsx:159` | Mapa en línea / apagado | booleano en Segmented → `Switch` |
| `components/fuel/GaugePicker.tsx:82,320` | "Solo reserva" | `Chip` con `selected` → casilla |
| `app/viajes/ajustes.tsx:137-149` | Mantener pantalla encendida | `Switch` (ya lo es) |

## E. Selectores a mano / con dibujo (e)

- `components/vehicle/GaugeTypeSection.tsx:36` — tarjetas con dibujo de aguja/cuadros/%: se migran a `SelectField` con opciones que traen su dibujo (`renderOption`), no a texto plano.
- `app/perfil.tsx:143-150` — cuadrícula de avatares (`radiogroup`/`radio`): visual, ya es un selector con imágenes; queda como está (equivale al `SwatchGrid`).
- `components/pickers/SwatchGrid.tsx` — pasa a vivir dentro de la hoja del `SelectField`.
- `app/(tabs)/historial.tsx:212-245` — hoja del "+" (acciones, no valores): se queda.

## F. Sugerencias que rellenan texto (no son selectores de valor)
- `app/viaje/[id].tsx:184` — sugerencias de etiqueta del viaje (`t.trips.labelSuggestions`): el texto es libre; se quedan como sugerencias bajo el campo.
- `components/build/ModForm.tsx:271` — nombres sugeridos por categoría: igual.
- `components/track/EventForm.tsx:488-489` — "Usado" / 🔥 en consumibles: acciones, no selección.
- `components/diy/ContactPieces.tsx:193` — "+" abre el alta de contacto: acción.

---

## Lo que ya existe y la fase 3 reutiliza (`components/pickers/`)
`PickerField` (solo el disparador: etiqueta + valor + chevron, `PickerField.tsx:13`), `SearchSheet` (lista con búsqueda), `SwatchGrid`, `YearWheel`, y `components/ui/Sheet.tsx`. Hoy los usan: `FillUpForm.tsx:355` (gasolinera), `OilBlock.tsx:164` (marca), `MakeModelYear.tsx:53-107` (marca/modelo/año), `precios/nuevo.tsx:161` (estación), `VehicleForm.tsx:284-285` (colores en línea). Lo demás está "afuera".

## Notas para la fase 3
- Un `SelectField` con `options`, `value`, `onChange`, `multiple?`, `searchable?`, `allowNone?`, `renderOption?`, `dark?` (M-9: la hoja de Modo conducir es oscura aunque la app esté en claro) y que **cierra al elegir** (no en `multiple`).
- 2–3 opciones también van en picker ("todo en picker"); los booleanos de §D no.
- Falta decidir (default aplicado: `Pasajero` y `Tanque lleno` son booleanos → interruptor; `Rol` del viaje sí es selección).
- Lint contra recaídas: prohibir `<Chip` y `<Segmented` en `app/**` y `components/**` salvo lista de excepciones (§C, §D, §F) y la galería `app/dev/`.
