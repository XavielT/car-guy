import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The guide — and specifically the overheating section, which is the reason
 * this application exists.
 *
 * Content from 01-research/02-maintenance-checklists-dr.md §A.2, §A.3, §A.4 and
 * §A.5. Written as instructions, not warnings: nobody reads a disclaimer, and
 * the useful thing to know is that you check the coolant cold and that water is
 * not a substitute for coolant.
 */
export default function GuiaScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          Qué revisar y cómo
        </T>

        <View style={[styles.highlight, { backgroundColor: theme.statusBg.urgente, borderColor: theme.status.urgente }]}>
          <T face="title" style={{ color: theme.status.urgente, fontSize: 19, marginBottom: space.sm }}>
            Sobrecalentamiento
          </T>
          <T face="body" style={[styles.body, { color: theme.text.primary }]}>
            Revisa el refrigerante una vez por semana, con el motor frío, antes de arrancar por
            primera vez en el día. Mira el tanque plástico traslúcido: el nivel va entre Min y Max.
            {'\n\n'}
            <T face="semibold" style={{ color: theme.status.urgente }}>
              Nunca abras el tapón del radiador ni el del tanque con el motor caliente.
            </T>{' '}
            El sistema está presurizado y sale hirviendo.
          </T>
        </View>

        <Section title="Señales de que algo anda mal">
          {[
            'El testigo de temperatura o el termómetro de refrigerante encendido.',
            'La aguja de temperatura subiendo por encima de la mitad.',
            'Olor dulce, o vapor saliendo del capó.',
            'Un charco bajo el carro donde pasaste la noche.',
            'La calefacción sopla frío con el motor caliente.',
            'Tener que rellenar refrigerante más de una vez al mes.',
          ].map((line) => (
            <Bullet key={line} text={line} />
          ))}
        </Section>

        <Section title="Si se calienta">
          <Bullet text="Apaga el aire acondicionado y pon la calefacción al máximo: le roba calor al motor." />
          <Bullet text="Oríllate en cuanto sea seguro y apaga el motor." />
          <Bullet text="Espera a que enfríe del todo antes de abrir nada." />
          <Bullet text="No le eches agua fría a un motor caliente ni a un radiador caliente." />
        </Section>

        <Section title="Por qué refrigerante y no agua">
          <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
            Aquí nunca congela, así que parece que el agua bastaría. No basta, por tres razones:
            {'\n\n'}· El refrigerante 50/50 <T face="semibold" style={{ color: theme.text.primary }}>hierve más tarde</T> (unos
            106–108 °C contra 100 °C del agua, y más aún bajo presión).
            {'\n'}· Lleva <T face="semibold" style={{ color: theme.text.primary }}>inhibidores de corrosión</T> que
            protegen la culata de aluminio, el radiador y la bomba de agua. El agua de la llave
            corroe y deja sarro.
            {'\n'}· <T face="semibold" style={{ color: theme.text.primary }}>Lubrica el sello de la bomba de agua.</T>
            {'\n\n'}
            Si es concentrado, se mezcla con agua destilada, nunca de la llave. Echarle agua para
            llegar a la casa está bien; después corrígelo a 50/50.
          </T>
        </Section>

        <Section title="Por qué aquí se calientan más">
          <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
            30–35 °C de ambiente, tapones, el aire acondicionado encendido todo el tiempo y las
            subidas de la Duarte. Un ventilador flojo, un termostato pegado o un nivel bajo
            perdonan mucho menos aquí que en un país frío.
          </T>
        </Section>

        <Section title="Fluidos, cada semana">
          <Bullet text="Aceite de motor: motor frío, piso plano, la varilla entre Min y Max. Lechoso = refrigerante en el aceite." />
          <Bullet text="Refrigerante: motor frío, entre Min y Max." />
          <Bullet text="Agua del parabrisas: rellena. Aquí no hace falta anticongelante." />
          <Bullet text="Líquido de frenos (mensual): claro o ámbar. Marrón oscuro o bajando = pastillas gastadas o fuga." />
        </Section>

        <Section title="Gomas">
          <Bullet text="Presión en frío, las 4 y la de repuesto, según la placa del marco de la puerta." />
          <Bullet text="Se pierde ~1 psi al mes. Una goma 2–3 psi por debajo del resto es una fuga lenta." />
          <Bullet text="Labrado: prueba de la moneda o las barras de desgaste. El mínimo son 1.6 mm." />
          <Bullet text="Desgaste en los bordes = alineación. En el centro = exceso de aire." />
        </Section>

        <Section title="Luces y frenos">
          <Bullet text="Luces: prueba delanteras, freno, retroceso y direccionales contra una pared." />
          <Bullet text="Frenos: en el primer frenazo del día, pedal firme, sin jalar, sin ruido." />
          <Bullet text="Pedal esponjoso, chillido o vibración: al taller, no la próxima semana." />
        </Section>

        <Section title="Si es diésel">
          <Bullet text="Drena el separador de agua cuando encienda el testigo y en cada cambio de aceite." />
          <Bullet text="Filtro de aire: revísalo más seguido si andas en polvo. El turbo es sensible." />
          <Bullet text="Cara del intercooler y del radiador sin lodo ni hojas." />
          <Bullet text="El testigo de bujías incandescentes debe apagarse antes de arrancar." />
        </Section>

        <Section title="Si es motor">
          <Bullet text="T-CLOCS antes de rodar: gomas, controles, luces, aceite y fluidos, chasis, parales." />
          <Bullet text="El acelerador debe moverse libre y cerrar solo, con el manubrio en cualquier posición." />
          <Bullet text="Lubrica la cadena cada ~500 km o después de lluvia." />
        </Section>

        <Surface style={{ marginTop: space.xl }}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 18 }}>
            Fuente: manual del fabricante de tu vehículo, RAC, NHTSA, Michelin y la MSF (T-CLOCS).
            Cuando el manual diga otra cosa, manda el manual.
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: space.xl }}>
      <T face="title" style={{ color: theme.text.primary, fontSize: 19, marginBottom: space.sm }}>
        {title}
      </T>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <T face="body" style={[styles.body, { color: theme.text.secondary, marginBottom: 6 }]}>
      · {text}
    </T>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, marginBottom: space.lg },
  highlight: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, marginBottom: space.xl },
  body: { fontSize: 14, lineHeight: 21 },
});
