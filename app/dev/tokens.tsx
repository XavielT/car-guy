import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import {
  EmptyState,
  GaugeRing,
  QuickActions,
  Sheet,
  StatusPill,
  type Status,
} from '@/components/ui';
import { Card, Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { Field } from '@/components/Field';
import { categoryColors, colors, fonts, palette, radius, space, type Scheme } from '@/constants/theme';
import { ThemeScope, useTheme } from '@/lib/theme/useTheme';

/**
 * Not a product screen: the identity review surface. Shows the palette, the type
 * scale and every base component in dark and light at once, so a change to
 * constants/theme.ts can be judged in one screenshot instead of by hunting
 * through the app.
 *
 * Reachable only by typing the route; it is in no tab bar and no navigation.
 */
export default function TokensScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark.bg.base }}>
        <T face="body" style={{ color: palette.dark.text.secondary, padding: space.xl }}>
          La vista de tokens solo existe en desarrollo.
        </T>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark.bg.base }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <T face="display" style={styles.h1}>
          Tablero nocturno
        </T>
        <T face="body" style={styles.sub}>
          Tokens de Car Guy. Izquierda oscuro (predeterminado), derecha claro.
        </T>
        <View style={styles.columns}>
          {(['dark', 'light'] as Scheme[]).map((scheme) => (
            <ThemeScope key={scheme} scheme={scheme}>
              <SchemePanel scheme={scheme} />
            </ThemeScope>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUSES: { status: Status; label: string }[] = [
  { status: 'ok', label: 'Al día' },
  { status: 'proximo', label: 'Aceite · faltan 320 km' },
  { status: 'urgente', label: 'Chequeo semanal · hoy' },
  { status: 'vencido', label: 'Marbete · venció 31 ene' },
];

function SchemePanel({ scheme }: { scheme: Scheme }) {
  const { theme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View style={[styles.panel, { backgroundColor: theme.bg.base, borderColor: theme.line }]}>
      <T face="title" style={[styles.h2, { color: theme.text.primary }]}>
        {scheme === 'dark' ? 'Oscuro' : 'Claro'}
      </T>

      <Section title="Superficies" theme={theme}>
        <View style={styles.swatches}>
          <Swatch label="bg.base" color={theme.bg.base} theme={theme} />
          <Swatch label="bg.surface" color={theme.bg.surface} theme={theme} />
          <Swatch label="bg.raised" color={theme.bg.raised} theme={theme} />
          <Swatch label="accent" color={theme.accent} theme={theme} />
          <Swatch label="accent.pressed" color={theme.accentPressed} theme={theme} />
          <Swatch label="danger" color={theme.danger} theme={theme} />
        </View>
      </Section>

      <Section title="Estados" theme={theme}>
        <View style={{ gap: space.sm }}>
          {STATUSES.map((s) => (
            <StatusPill key={s.status} status={s.status} label={s.label} />
          ))}
        </View>
      </Section>

      <Section title="Categorías" theme={theme}>
        <View style={styles.swatches}>
          {Object.entries(categoryColors).map(([key, color]) => (
            <Swatch key={key} label={key} color={color} theme={theme} />
          ))}
        </View>
      </Section>

      <Section title="Tipografía" theme={theme}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 30 }}>
          Tablero
        </T>
        <T face="title" style={{ color: theme.text.primary, fontSize: 21 }}>
          Próximos mantenimientos
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 15 }}>
          Texto de cuerpo en Inter. Explica lo que significa el número.
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
          Captión y texto deshabilitado
        </T>
        <T face="monoBold" style={{ color: theme.text.primary, fontSize: 30 }}>
          51 676 km
        </T>
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 15 }}>
          37.45 km/gal · RD$ 4,000.00
        </T>
        <T face="medium" style={{ color: theme.text.muted, fontSize: 11, letterSpacing: 0.9 }}>
          EYEBROW EN MAYÚSCULAS
        </T>
      </Section>

      <Section title="Medidor" theme={theme}>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <GaugeRing progress={0.72} size={104} value="72%" label="chequeo" />
          <GaugeRing progress={1} size={104} value="3" label="semanas" color={theme.status.ok} />
        </View>
      </Section>

      <Section title="Acciones rápidas" theme={theme}>
        <QuickActions
          actions={[
            { label: 'Combustible', icon: 'flash-outline', onPress: () => {} },
            { label: 'Chequeo', icon: 'clipboard-outline', onPress: () => {} },
            { label: 'Mantenimiento', icon: 'construct-outline', onPress: () => {} },
            { label: 'Gasto', icon: 'cash-outline', onPress: () => {} },
          ]}
        />
      </Section>

      <Section title="Controles heredados" theme={theme}>
        <Card>
          {/* Alias ink, not theme ink: this card paints itself from the static
              alias, so themed text would be dark-on-dark in the light column. */}
          <T face="semibold" style={{ color: colors.ink, marginBottom: space.sm }}>
            Card, Field, Chip y botones
          </T>
          <Field label="Odómetro" placeholder="51676" hint="En kilómetros" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Premium" selected onPress={() => {}} />
            <Chip label="Regular" onPress={() => {}} />
            <Chip label="GLP" onPress={() => {}} />
          </View>
          <PrimaryButton label="Registrar carga" onPress={() => setSheetOpen(true)} />
          <GhostButton label="Cancelar" onPress={() => {}} />
          <GhostButton danger label="Borrar todo" onPress={() => {}} />
        </Card>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
          Estos leen el alias estático `colors`, así que se ven oscuros en ambas columnas hasta la
          Fase 6.
        </T>
      </Section>

      <Section title="Vacío" theme={theme}>
        <EmptyState
          icon="time-outline"
          message="Aquí va quedando la vida de tu carro. Empieza con una carga o un chequeo."
          actionLabel="Registrar carga"
          onAction={() => setSheetOpen(true)}
        />
      </Section>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Hoja inferior">
        <T face="body" style={{ color: theme.text.secondary }}>
          Para los flujos de alta rápida. Se cierra tocando fuera o con el botón atrás.
        </T>
      </Sheet>
    </View>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.xxl }}>
      <T face="medium" style={[styles.eyebrow, { color: theme.text.muted }]}>
        {title.toUpperCase()}
      </T>
      {children}
    </View>
  );
}

function Swatch({
  label,
  color,
  theme,
}: {
  label: string;
  color: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.chipColor, { backgroundColor: color, borderColor: theme.line }]} />
      <T face="mono" style={{ color: theme.text.secondary, fontSize: 10 }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: palette.dark.text.primary,
    fontSize: 30,
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
  },
  sub: {
    color: palette.dark.text.secondary,
    fontSize: 14,
    fontFamily: fonts.body,
    paddingHorizontal: space.gutter,
    marginBottom: space.lg,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingHorizontal: space.lg },
  panel: {
    flexBasis: 380,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
  },
  h2: { fontSize: 20, marginBottom: space.lg },
  eyebrow: { fontSize: 11, letterSpacing: 0.9, marginBottom: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { alignItems: 'center', gap: 4, width: 78 },
  chipColor: { width: 64, height: 40, borderRadius: 10, borderWidth: 1 },
});
