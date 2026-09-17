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

## Datos al actualizar

Los datos se guardan localmente en el teléfono. Instalar una nueva versión encima de la anterior los
conserva, siempre que se mantengan el mismo `android.package`, la misma firma/keystore y no se
borren los datos de la aplicación. No uses `adb install -r` con un paquete firmado con otra
keystore.

Antes de cambiar el formato de los datos, agrega una migración y conserva la lectura de las
versiones anteriores — el detalle del almacenamiento y su migración está en
[docs/imp-17092026/](docs/imp-17092026/). Desinstalar la app o usar "Borrar todos los datos" sí
elimina la información local. Exporta un respaldo JSON antes de cualquiera de las dos cosas.

## Unidades

Kilómetros en el tablero, galones en la bomba, pesos dominicanos. GNV se registra en m³.
