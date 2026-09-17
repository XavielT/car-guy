# Car Guy

**Tu carro, al día.** App móvil (Expo / React Native) para cuidar uno o varios vehículos en
República Dominicana: mantenimientos, chequeos diarios y semanales, reparaciones, mejoras,
combustible y documentos — todo en un solo historial, con estadísticas.

El combustible es una parte, no el centro: sigue registrando cargas y calculando el consumo real
km/gal como siempre, pero ahora al lado del aceite que toca a los 5,000 km y del marbete que vence
en enero.

Plan de la transformación, decisiones y fases: [docs/imp-17092026/](docs/imp-17092026/).
Reglas de dominio y precios MICM semilla del app original: [docs/PLAN.md](docs/PLAN.md).

## Origen

Car Guy nació de **Tu Combustible RD** (v1.x). Nació de un descuido: un radiador sin refrigerante
porque no había la costumbre de revisarlo. De ahí que los chequeos sean el corazón de la app y no
un extra.

## Qué hace

- **Garaje**: uno o varios vehículos, cada uno con su perfil, odómetro y foto
- **Mantenimiento**: servicios, reparaciones y mejoras con fecha, odómetro, costo, taller y piezas
- **Chequeos**: listas diarias, semanales y mensuales; una falla se convierte en tarea
- **Recordatorios**: por fecha, por kilometraje o lo que llegue primero, con fecha estimada según
  tus km/día. Incluye marbete, seguro y licencia
- **Combustible**: cargas con fecha, odómetro, estación, tanque lleno o parcial; cuenta automática
  (llena dos de tres: volumen, precio/unidad, total); consumo brim-to-brim entre tanques llenos;
  precios oficiales de referencia editables
- **Historial y estadísticas**: una sola línea de tiempo por vehículo, costo por km, gasto por
  categoría y mes a mes

Todo vive en el teléfono. La cuenta en la nube es opcional y nunca hace falta para usar la app.

## Correrla

```bash
npm start
```

Luego abre Expo Go en el teléfono, o `w` para web.

```bash
npm test              # lógica de dominio (jest-expo)
npx tsc --noEmit      # tipos
npx expo lint         # estilo
npm run build         # export web estático a dist/
```

## Instalar en Android

El identificador Android es `com.xaviel.carguy`. No lo cambies después de publicar: Android lo usa
para reconocer que una nueva versión pertenece a la misma app.

**Car Guy es una app distinta de Tu Combustible RD**, no una actualización. Al usar un paquete
nuevo, Android la instala aparte: la app vieja sigue funcionando con sus datos hasta que la
desinstales. Tus datos entran a Car Guy importando un respaldo JSON de Tu Combustible RD
(*Más → Restaurar desde archivo*); Car Guy lee ese formato y seguirá leyéndolo siempre.

Para generar un APK instalable de prueba o un AAB para Google Play:

```bash
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

El perfil `preview` genera un APK instalable. El perfil `production` genera el paquete de
publicación y aumenta automáticamente el `versionCode`. EAS guarda la keystore de Android de forma
remota; conserva esa misma keystore para que las actualizaciones sean aceptadas como la misma
aplicación.

Para compilar localmente sin EAS, ver [docs/NEXT.md](docs/NEXT.md).

## Dónde viven los datos

Todo se guarda en **SQLite** (`carguy.db`) dentro del teléfono — en la web, en OPFS del navegador.
El esquema se versiona con `PRAGMA user_version` y las migraciones están en `lib/db/migrations.ts`;
nunca se edita una versión ya publicada, se agrega la siguiente.

Ninguna pantalla escribe SQL: todo pasa por los repositorios de `lib/db/repos/`. Borrar algo deja
una marca (`deleted_at`) en vez de eliminar la fila, para que más adelante la sincronización pueda
propagar el borrado. La única excepción es **Borrar todos los datos**, que sí elimina de verdad.

### Respaldos

*Más → Crear respaldo JSON* exporta un respaldo **v2**: todas las tablas, incluidas las marcas de
borrado. Funciona en Android (hoja de compartir) y en la web (descarga directa). Las fotos no van
dentro del archivo, solo sus referencias.

*Más → Restaurar o importar respaldo* acepta dos formatos y elige solo:

- **v2 (Car Guy)** — combina por id y gana el `updated_at` más reciente. Nunca borra: restaurar un
  respaldo viejo no deshace lo que hiciste después.
- **v1 (Tu Combustible RD)** — importa tu historial completo. Es idempotente: importar el mismo
  archivo dos veces no duplica nada. Este formato se seguirá leyendo siempre.

### Al actualizar la app

Instalar una versión nueva encima conserva los datos, siempre que se mantengan el mismo
`android.package`, la misma firma/keystore y no se borren los datos de la aplicación. No uses
`adb install -r` con un paquete firmado con otra keystore. Desinstalar la app o usar "Borrar todos
los datos" sí elimina la información local — exporta un respaldo antes.

## Unidades

Kilómetros en el tablero, galones en la bomba, pesos dominicanos. GNV se registra en m³.
