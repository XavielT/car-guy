# Checklist manual de Xaviel — ciclo IMP 16102026

Lo que solo tú puedes probar (iPhone real, Redmi, cuentas). Marca cada uno al terminar.

## Antes de empezar
- [ ] Este paquete ya está en `C:\developer\improvements\car guy improvements\Octubre 2026\imp cg 16102026\`; copiarlo al repo (la fase 0 lo hace en `docs/imp-16102026/`) y ejecutar los prompts en orden (cada uno en una sesión de Claude Code, dentro del repo).
- [ ] Antes de la fase 1 y de la fase 5: tener a mano el método para aplicar `sql/040` (aceite sintético) y `sql/041` (reparaciones) en `x-core` con `tools/apply-sql.mjs` (proyecto compartido con Music Hub; cambios aditivos). Aplicarlos **antes** de publicar la app.

## Fase 1 (patch)
- [ ] iPhone: abrir Editar vehículo del DS3, marcar **Aceite sintético**, guardar, cerrar la app del todo, abrirla: sigue marcado.
- [ ] Redmi: mismo valor aparece tras sincronizar (y al revés).
- [ ] "Fecha de compra" ya no se sale de la pantalla; "Tanque…" ya no dice "0 s".
- [ ] El swatch Negro se ve.
- [ ] Modo conducir: tocar el aviso de ubicación pide permiso.

## Fase 2 (permisos y mapa)
- [ ] iPhone: con ubicación permitida, el mapa se centra en ti; con "No permitir", ves los pasos exactos y "Ya la activé" funciona al volver de Ajustes.
- [ ] iPhone: apagar Servicios de localización del teléfono → la app lo distingue del permiso.
- [ ] Anota si la PWA vuelve a preguntar la ubicación en cada apertura (lo marcamos "no verificado").
- [ ] Redmi (APK nuevo): primer de ubicación, luego Automático pide "Permitir todo el tiempo"; negar uno y verificar el botón "Abrir ajustes".
- [ ] Redmi: ahorro de batería/autoarranque MIUI guiado desde la pantalla Permisos.
- [ ] Más → Permisos y acceso: todo lo que falta aparece con su botón.

## Fase 3 (pickers)
- [ ] Editar vehículo: Tipo, Color, Interior, Estado, luz de reserva, Consumo y modo de indicador abren un modal y se cierran al elegir.
- [ ] Atrás/Esc/tocar fuera cierran sin cambiar.
- [ ] Modo conducir: vehículo y modo son pickers; "Pasajero" sigue siendo interruptor.
- [ ] Revisa que no quede ningún grupo de chips desplegado en otras pantallas.

## Fase 4 (funciones a la vista)
- [ ] Inicio → Herramientas: ves OBD en la fila destacada.
- [ ] Tocar el testigo de check engine abre OBD.
- [ ] Buscar "luz del tablero" y "taller" encuentra la función.
- [ ] En el vehículo, todas las pestañas son alcanzables ("Todas las secciones").

## Fase 5 (reparaciones)
- [ ] Registrar una reparación **propia** (ej. cambiar el agua por coolant) cerrando ese Pendiente; deshacer funciona.
- [ ] Registrar una reparación **de taller** (ej. Desabollar y pintar) con taller, piezas, mano de obra, fotos antes/después/factura y garantía.
- [ ] Aparece en historial, en "Lo que me ha costado" y en la lista por taller.
- [ ] Apagar datos, registrar otra, volver a prender: sincroniza.

## Pendientes de ciclos anteriores que se cruzan
- [ ] Subir la llave FCM a expo.dev (Firebase → car-guy-7052a → Cuentas de servicio) y borrar el JSON descargado.
- [ ] Manejada real con el Redmi (permiso de ubicación, autoarranque MIUI, sin optimización de batería) y un junte en vivo con dos dispositivos.

## Cierre
- [ ] Revisar `VERIFICACION.md` que deja Claude Code (cada nota en verde).
- [ ] Anotar lo que quedó "no verificado" para el siguiente ciclo.
