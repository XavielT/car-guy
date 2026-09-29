# Changelog

## 2.1.3 (2026-09-29)

- **Fotos en Android**: agregar la foto de un carro nuevo (o de un chequeo, un servicio) ya no falla con
  un error raro. Si una foto no se puede guardar, la app lo dice claro y te deja reintentar con la misma
  foto.
- **Cuenta disponible en el APK**: "Iniciar sesión" funciona desde el APK que se descarga de GitHub (hasta
  la 2.1.2 ese APK salía sin la conexión a la nube).
- **Mensajes claros**: ningún mensaje de error muestra detalles técnicos. La pantalla de Cuenta dice la
  versión de la app.
- Preparación para la 2.2: los cambios que haga una versión más nueva se guardan para cuando actualices,
  en vez de mezclarse mal.
- El APK de cada versión se publica también como `car-guy.apk`, con un enlace que siempre apunta a la
  última.

## 2.1.2 (2026-09-29)

- Pista: el **trazado** del evento (completo, corto…); las mejores vueltas se comparan en el mismo
  trazado, y la ficha pública lo muestra.
- Pista: **gomas por sesión** — marca en cada sesión las gomas que salieron y cada una suma un ciclo
  de calor por salida (la marca del día sigue en el evento).
- Garaje compartido: los miembros ven los tipos de servicio y las listas de chequeo propias del
  dueño que usa ese carro.
- Por dentro: Expo al día (57.0.26), menos avisos de seguridad en dependencias (de 18 a 3) y sin los
  avisos de los gráficos en la web.

## 2.1.1 (2026-09-29)

- La búsqueda ignora acentos y mayúsculas: "optimo" encuentra "Óptimo", en el historial y en los
  códigos OBD.
- En un carro compartido, los miembros ven los nombres de las pistas y categorías de mods del dueño.

## 2.1.0 — Hachi-Gō (2026-09-29)

El garaje deja de ser una lista de carros y se vuelve la historia de cada uno: las fotos de
siempre con su fecha, el build con lo que costó, la ficha para el taller, los días de pista y un
link para enseñarlo. Se actualiza **encima** de la 2.0.0: los datos se quedan y la base de datos
se migra sola al abrir.

### Look JDM

- Tablero con tacómetro, luces testigo, odómetro LCD y badges (motor, DRIFT, SWAP, EX).
- Pestaña **Garaje** con portada, apodo en katakana, estado (activo, proyecto, guardado,
  vendido) y la historia de los que ya se fueron.
- Encabezados en mayúscula, secciones con eyebrow, carbono y señales de peligro donde tocan.

### Álbum y memoria

- Importar fotos viejas con su fecha real (EXIF), sin duplicados, en una línea de tiempo por año.
- Hitos (compra, swap, choque, primer track day), "cómo estaba el carro ese día", favoritas.
- Miniaturas de 400 px y copia de 1600 px; 300 MB de fotos en la nube por cuenta, con medidor.

### Build

- Mods con categoría, marca, costos en RD$ (o en USD con la tasa), instalador y fotos
  antes/después; STOCK → ACTUAL calculado de los mods; wishlist que se convierte en mod;
  inventario de piezas, aros y gomas (DOT, ciclos de calor).
- La ficha técnica se comparte como imagen.

### DIY

- Ficha de servicio con presets por plataforma (AE85, S13, Civic, DS3…), VIN por vPIC, y
  "verificado por mí" en cada dato. Siempre: *verifica con tu manual*.
- Guía de fluidos con tus fotos, que sale en el chequeo; códigos OBD en español; contactos con
  llamada y WhatsApp.

### Pista

- Eventos (track day, drift, drag, autocross, junte) y sesiones con setup completo: presiones
  frío → caliente por goma (traseras en rojo si suben más de 8 psi), alineación, altura,
  suspensión, frenos, ángulo y LSD, tiempos en m:ss.mmm.
- **Copiar a la sesión siguiente** y el aviso "Cambiaste desde la sesión 1: TI/TD 40 → 42".
- Gomas usadas (ciclos), goma quemada, medida de pastillas con recordatorio "Pastillas (pista)".
- Resumen del día para compartir como imagen o texto; días de pista y su gasto en Cifras.

### Compartir

- **Ficha pública por link** (`car-guy.vercel.app/c/…`) con vista previa en WhatsApp: tú eliges
  qué se ve (historia, mods, mantenimiento, pista, km, costos, placa, VIN) y hasta 24 fotos.
  Se desactiva cuando quieras.
- **Libro del carro** en PDF: portada, ficha, historia, mods, mantenimiento, documentos, pista y
  hasta 60 fotos.
- **Garaje compartido**: invita a alguien a un carro como editor o solo lectura; el dueño cambia
  roles o lo quita.

### Arreglos

- Documentos en PDF (antes solo fotos).
- Cifras: el eje empieza en 0; en la computadora la app es una columna centrada.
- Borrar un carro ahora borra también lo que anotaste de gomas y pastillas en pista.

### Antes de publicar (2026-09-29)

- Probado en un teléfono real (Redmi Note 10 Pro, Android 13) **instalando encima de la versión
  anterior con datos reales**: el garaje quedó intacto y la base de datos se migró sola.
- En el teléfono: libro PDF, ficha para el taller, pista (presiones, copiar sesión, resumen como
  imagen y texto), menú de un mod, contactos, invitación por link y adjuntar PDF.
- En la web y en la nube: la ficha pública por link (con vista previa en WhatsApp confirmada), el
  garaje compartido entre dos cuentas (invitar, editar, solo lectura, quitar) y la sincronización.
- La web de producción no tenía configurada la nube desde que se mudó de proyecto: ya la tiene,
  así que la cuenta y la sincronización funcionan también en `car-guy.vercel.app`.
- Una falla de seguridad en el garaje compartido (cualquier cuenta podía invitarse a un carro
  ajeno) se encontró y se cerró antes de que existieran cuentas reales.

## 2.0.0 — Car Guy (2026-09-25)

Primera versión de Car Guy para Android. Se probó en un teléfono real (Redmi Note 10 Pro, Android
13), en la web y con la sincronización entre dos dispositivos. Lo que esas pruebas encontraron ya
viene arreglado en esta versión — ver *Antes de publicar* al final.

Tu Combustible RD se convirtió en **Car Guy**. El combustible sigue completo, pero ya no es el
centro: ahora está al lado del aceite que toca a los 5,000 km y del marbete que vence en enero.

**Car Guy se instala aparte de Tu Combustible RD**, no encima. El paquete Android es nuevo
(`com.xaviel.carguy`), así que la app vieja sigue con sus datos hasta que la desinstales. Tus datos
entran por *Más → Restaurar o importar respaldo*, que lee el respaldo JSON de Tu Combustible RD — y
lo seguirá leyendo siempre.

### Nombre e identidad

- Car Guy: nombre, ícono, splash, tema oscuro por defecto y claro para el sol del mediodía.
- Todo el texto de la app vive en un solo archivo (`lib/i18n/es.ts`), en español dominicano.
- En la web, los avisos ya no usan el diálogo del navegador: son parte de la app.

### Garaje

- Uno o varios vehículos, cada uno con perfil, odómetro, foto y datos de compra.
- Carro, jeepeta, camioneta, motor, camión, guagua.
- Vehículos archivados: salen del camino sin perder su historial.

### Mantenimiento e historial

- Servicios, reparaciones y mejoras con fecha, odómetro, costo de piezas y mano de obra, taller,
  garantía y piezas usadas.
- Gastos: seguro, marbete, peaje, lavado y lo demás.
- Tareas pendientes, documentos (seguro, marbete, matrícula, facturas) con fotos.
- **Un solo historial** por vehículo: cargas, mantenimientos, chequeos y gastos en la misma línea
  de tiempo, con filtros y búsqueda.

### Chequeos y recordatorios

- Listas diarias, semanales y mensuales. Una falla se convierte en tarea, no en un recuerdo.
- Recordatorios por fecha, por kilometraje o lo que llegue primero, con fecha estimada según tus
  km/día reales.
- Marbete, seguro y licencia con las reglas dominicanas (ventana del marbete incluida).
- Notificaciones locales, con hora configurable.

### Combustible

- Cargas con fecha, odómetro, estación, tanque lleno o parcial.
- Llena dos de tres — volumen, precio por unidad, total — y el tercero se calcula.
- Consumo real *brim-to-brim* entre tanques llenos. Si se te olvidó registrar una carga, lo marcas
  y la cuenta empieza de nuevo en vez de mentir.
- Precios MICM de referencia, editables. GNV en m³.

### Cifras

- Costo por km, gasto por categoría y mes a mes, distancia por mes, costo total de propiedad y
  lo que viene.
- Reporte PDF y exportación CSV del historial y de las cargas.

### Cuenta y nube (opcional)

- La app funciona igual sin cuenta. Con cuenta, si cambias de teléfono, tus datos te siguen.
- Sincronización local-first: gana la edición más reciente, los borrados viajan como tal y no
  resucitan, y las fotos van a almacenamiento privado.
- Sincroniza al abrir la app, unos segundos después de escribir, al volver la conexión y cuando lo
  pidas. Si falla, lo dice y lo vuelve a intentar solo — nada se pierde, todo está en el teléfono.
- **Cerrar sesión no borra nada de este teléfono.** "Borrar datos en la nube" borra del servidor y
  cierra la sesión; lo local se queda.

### Datos

- Todo en SQLite (`carguy.db`) en el teléfono; en la web, en OPFS del navegador.
- Respaldo JSON v2 con todas las tablas. Restaurar combina por id y gana el cambio más reciente:
  restaurar un respaldo viejo no deshace lo que hiciste después.
- Importa respaldos v1 de Tu Combustible RD sin duplicar, aunque los importes dos veces.

---

### Antes de publicar (2026-09-25)

Pruebas en el teléfono, dos navegadores haciendo de dispositivos y tres testers recorriendo la app:

- **Sincronización:** en un teléfono nuevo no bajaba nada; ahora sí, con fotos. Ya no se pierden
  filas en tablas grandes ni cambios hechos mientras sincroniza, y un choque entre dos teléfonos lo
  gana el cambio más reciente. «Borrar datos locales» y «Borrar datos en la nube» funcionan de verdad.
- **Consumo:** después de una carga parcial ya no aparece un falso «posibles fugas»; la cuenta es la
  misma que en Inicio.
- **Números:** «1,500» se lee como mil quinientos (antes era 1.5), igual que en un recibo dominicano.
- **Teléfono:** el teclado ya no tapa el campo que escribes; «Atrás» desde una notificación vuelve al
  Inicio en vez de cerrar la app; el PDF se comparte con un nombre claro.
- **Datos:** no se aceptan fechas futuras en cargas y lecturas; el marbete registrado dos veces no
  salta un año; los valores inválidos se rechazan con un mensaje en vez de guardarse como 0.
- **Pantallas:** un registro borrado muestra un aviso en vez de una pantalla en blanco; la búsqueda del
  Historial encuentra «gasolina»; los números de Cifras ya no se cortan.

## 1.1.1 — Tu Combustible RD (2026-09-17)

Arreglo del compartir del respaldo en Android. Ver
[las notas de esa versión](https://github.com/XavielT/car-guy/releases/tag/v1.1.1).

## 1.1.0 — Tu Combustible RD (2026-08-19)

Última versión de Tu Combustible RD antes de Car Guy.
