# Notas originales de Xaviel (16-10-2026) y trazabilidad

Este archivo es el que se revisa contra tus notas. Cada nota (N) y cada cosa vista en las capturas (X) tiene fase, prompt y criterio de aceptación. Si falta algo, está mal el paquete.

## Texto original (sin editar)

> i got new improvements, u know what to to with them(if u dont remember tell me)(remember too the path where we storage the files of the improvements and all that stuff):
> Lets fix the map issue, and the app must ask to the user to give the app the permitions that it need. And if a permition is missed, for example the user must have a way to give to it.
> Why is all that outiside, they are must be inside a select or inside a picker that open a modal on screen when the user pick on it to show the options and when the user select it, it must be closed.
> I marked the Aceite sintetico option and save it, but it always shows unmarked.
> Some of the features are hidden, because, are hards to find by the users, lets improve that. Lets find a better way to show it. For example the obd feature is practically hidden, is difficult to the users to find it.
> If a user want to register a repair that he did to his car or a repair store do it to his car, he doesnt have a way actually. Lets fix it.

Capturas (iPhone, PWA): 11:19 Modo conducir · 11:16 Editar vehículo (Tipo/Color) · 11:15 Editar vehículo (cuadritos/estado/precio) · 11:12 Vehículo → pestaña Build.

## Notas divididas

| # | Nota | Fase | Prompt | Criterio de aceptación |
|---|------|------|--------|------------------------|
| N1 | Arreglar el problema del mapa | 0 diagnóstico → 1 y 2 | 00, 01, 02 | Hay `findings` con cada defecto del mapa (M-1…); cada uno corregido con test o captura; el mapa se centra en el usuario con permiso, y sin permiso muestra posición de respaldo + botón accionable (no solo texto). |
| N2 | La app debe pedirle al usuario los permisos que necesita | 2 | 02 | Registro central de permisos; cada permiso se pide con una explicación previa y en el momento en que se necesita; Permisos listados en una pantalla. |
| N3 | Si falta un permiso, el usuario debe tener una forma de darlo | 2 | 02 | Para cada permiso negado/bloqueado: botón en el lugar donde falla + pantalla "Permisos" con "Dar permiso" / "Abrir ajustes" (Android) o pasos exactos (iPhone web); al volver a la app el estado se actualiza solo. |
| N4 | Las opciones están "afuera"; deben estar dentro de un select/picker que abre un modal y se cierra al elegir | 3 | 03 | Un `SelectField` (envuelve el `SelectField` existente + hoja); todo `Chip`/`Segmented` que elija un valor en formularios/ajustes lo usa (incluso 2–3 opciones); la hoja se cierra al elegir; prueba/lint contra recaídas. Los filtros de listas también pasan a picker (Xaviel, 16-10: "sí, si lo recomiendas"); pestañas, navegación e interruptores se quedan. Respuesta de Xaviel: **todo en picker**. |
| N5 | Marqué "Aceite sintético", guardé y siempre sale sin marcar | 1 | 01 | Causa raíz encontrada en el repo: la casilla no es una columna del vehículo, solo se aplica al crear y el editor nunca la carga. Fix: columna `oil_synthetic` (v11, `sql/040`) + aplicar en ambos sentidos; test que falla primero; guardar ✔ → reabrir ✔ → matar app ✔ → sync ✔; test genérico de ida y vuelta de todos los campos del vehículo. |
| N6 | Funciones escondidas, difíciles de encontrar; mejor forma de mostrarlas | 4 | 04 | Inventario de funciones con profundidad de toques; ninguna a más de 2 toques desde Inicio; hub Herramientas + atajos en el vehículo + testigos tocables + buscador (respuestas de Xaviel). |
| N6a | Ejemplo: OBD está prácticamente escondido | 4 | 04 | OBD ("Diagnóstico OBD") en el hub (fila destacada), en los atajos del vehículo y en el testigo de check engine; aviso de primera vez. |
| N7 | No hay forma de registrar una reparación (hecha por él o por un taller) | 5 | 05 | El registro de reparaciones ya existe (`ServiceRecord` `kind='reparacion'`) pero solo se llega desde Historial → "+". Se completa (quién la hizo + taller, fotos con rol incl. factura, garantía rápida, cierre de un Pendiente con deshacer) y se expone desde Herramientas, atajos, Inicio, tarjetas de Pendiente, Eventos y OBD. Costos de piezas y mano de obra ya existen. |
| N8 | "Recuerda la ruta donde guardamos los archivos de las mejoras" | — | README | Paquete destino: `C:\developer\improvements\car guy improvements\Octubre 2026\imp cg 16102026\` (nueva convención de Xaviel, 16-10: `C:\developer\improvements\car guy improvements\<Mes año>\imp cg <ddmmyyyy>\`). |
| N9 | "Sabes qué hacer con ellas" (el proceso de los ciclos anteriores) | — | todo | Paquete de prompts + specs + tracking + checklist manual, más el doc del ciclo en el proyecto Car Guy. |

## Cosas vistas en las capturas (no estaban en las notas; las incluyo y las puedes quitar)

| # | Visto | Fase | Prompt |
|---|-------|------|--------|
| X1 | "FECHA DE COMPRA" se sale del borde derecho de la pantalla (captura 11:15) | 1 | 01 |
| X2 | "hace 0 s" se parte en dos líneas en "Tanque: 4/12 ≈ 4.5 gal · ≈ 120 km (70–190) · hace 0 s" (captura 11:12); "0 s" debería decir "ahora" | 1 | 01 |
| X3 | El swatch "Negro" no se ve sobre el fondo oscuro (captura 11:16) | 1 y 3 | 01, 03 |
| X4 | La pestaña FICHA queda cortada y hay más pestañas fuera de pantalla (captura 11:12) | 4 | 04 |
| X5 | "Precio de compra" muestra "875,000" en gris como placeholder; verificar si es valor guardado mostrado con estilo vacío (misma familia que N5) | 1 | 01 |
| X6 | Tarjeta "¿Por qué?" de Modo conducir tiene un hueco vacío grande; se aprovecha para el estado de permisos | 2 | 02 |
| X7 | Los Pendientes del Build (p. ej. "Desabollar y pintar", "Cambiar el agua … por coolant") son el caso real para cerrar con una reparación | 5 | 05 |
