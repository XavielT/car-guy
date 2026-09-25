# Changelog

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
