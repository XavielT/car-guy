import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import {
  Card,
  Chip,
  EmptyState,
  GaugeRing,
  GhostButton,
  KeyValueRow,
  NavRow,
  OdometerHero,
  PrimaryButton,
  QuickActions,
  RecordRow,
  SectionHeader,
  Segmented,
  Sheet,
  StatusPill,
  type Tone,
} from '@/components/ui';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { categoryColors, fonts, palette, radius, space, type Scheme } from '@/constants/theme';
import { dayKey, setSimulatedToday, simulatedTodayIso } from '@/lib/domain/dates';
import { dateLabel, isoFromDateInput } from '@/lib/format';
import { useStore } from '@/lib/store';
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
        <SimulatedDate />
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

/**
 * "Fecha simulada": moves `todayIso()` for the whole app, so the marbete window,
 * due states and "Para hoy" cards can be checked on 16 October or 20 January
 * without touching the phone's clock. In memory only — a reload is the real date.
 */
function SimulatedDate() {
  const router = useRouter();
  const { refresh } = useStore();
  const [value, setValue] = useState<string | null>(() => {
    const current = simulatedTodayIso();
    return current ? dayKey(new Date(current)) : null;
  });

  const apply = (next: string | null) => {
    setValue(next);
    setSimulatedToday(next ? isoFromDateInput(next) : null);
    void refresh();
  };

  // The next marbete season: 16 Oct is just after the "abre pronto" nudge,
  // 20 Jan is inside the last-two-weeks run to the deadline.
  const now = new Date();
  const seasonYear = now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1;
  const presets = [
    { label: '16 oct', date: `${seasonYear}-10-16` },
    { label: '20 ene', date: `${seasonYear + 1}-01-20` },
  ];

  return (
    <View style={[styles.simulated, { borderColor: palette.dark.line }]}>
      <T face="semibold" style={{ color: palette.dark.text.primary, fontSize: 15 }}>
        Fecha simulada
      </T>
      <T face="body" style={{ color: palette.dark.text.secondary, fontSize: 12, marginTop: 2, marginBottom: space.md }}>
        {value ? `La app cree que hoy es ${dateLabel(isoFromDateInput(value))}.` : 'Usando la fecha real.'}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Real" selected={value == null} onPress={() => apply(null)} />
        {presets.map((p) => (
          <Chip key={p.date} label={p.label} selected={value === p.date} onPress={() => apply(p.date)} />
        ))}
      </View>
      <ThemeScope scheme="dark">
        <DateField label="Otra fecha" value={value ?? dayKey(now)} onChange={(d) => apply(d)} />
        {/* This screen is reached by typing its route, and a reload would drop
            the date, so the way out has to be in-app. */}
        <GhostButton label="Ir a Inicio" onPress={() => router.replace('/')} />
      </ThemeScope>
    </View>
  );
}

const STATUSES: { status: Tone; label: string }[] = [
  { status: 'ok', label: 'Al día' },
  { status: 'proximo', label: 'Aceite · faltan 320 km' },
  { status: 'urgente', label: 'Chequeo semanal · hoy' },
  { status: 'vencido', label: 'Marbete · venció 31 ene' },
  { status: 'neutral', label: 'En tu promedio' },
];

function SchemePanel({ scheme }: { scheme: Scheme }) {
  const { theme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [segment, setSegment] = useState<'full' | 'partial'>('full');
  const [date, setDate] = useState('2026-09-18');

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
          Texto de cuerpo en Manrope. Explica lo que significa el número.
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

      <Section title="Tablero" theme={theme}>
        <OdometerHero
          vehicleName="Corolla 2016"
          odometerKm={52000}
          daysSinceReading={3}
          telltales={[
            { status: 'vencido', label: 'Revisar refrigerante' },
            { status: 'proximo', label: 'Aceite · faltan 320 km' },
          ]}
          onPressOdometer={() => {}}
        />
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

      <Section title="Controles" theme={theme}>
        <Card>
          <T face="semibold" style={{ color: theme.text.primary, marginBottom: space.sm }}>
            Card, Field, Chip y botones
          </T>
          <Field label="Odómetro" placeholder="51676" hint="En kilómetros" />
          <Field label="Con error" placeholder="51676" error="El odómetro no puede ser negativo." />
          <DateField label="Fecha" value={date} onChange={setDate} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Premium" selected onPress={() => {}} />
            <Chip label="Regular" onPress={() => {}} />
            <Chip label="GLP" onPress={() => {}} />
          </View>
          <PrimaryButton label="Registrar carga" onPress={() => setSheetOpen(true)} />
          <GhostButton label="Cancelar" onPress={() => {}} />
          <GhostButton danger label="Borrar todo" onPress={() => {}} />
        </Card>
      </Section>

      <Section title="Segmentado" theme={theme}>
        <Segmented
          options={[
            { key: 'full', label: 'Tanque lleno' },
            { key: 'partial', label: 'Carga parcial' },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <Segmented
          style={{ marginTop: space.sm }}
          options={[
            { key: 'mantenimiento', label: 'Mantenimiento', color: categoryColors.mantenimiento },
            { key: 'reparacion', label: 'Reparación', color: categoryColors.reparacion },
            { key: 'mejora', label: 'Mejora', color: categoryColors.mejora },
          ]}
          value="mantenimiento"
          onChange={() => {}}
        />
      </Section>

      <Section title="Encabezado y filas" theme={theme}>
        <SectionHeader title="Mantenimiento" caption="Lo que le has hecho al carro." eyebrow="Sección" />
        <Card>
          <KeyValueRow label="Odómetro" value="51 676 km" big />
          <KeyValueRow label="Taller" value="Ramón" />
          <KeyValueRow label="Total" value="RD$ 4,000.00" />
        </Card>
        <View style={{ marginTop: space.md }}>
          <NavRow label="Recordatorios" caption="Qué toca y cuándo." onPress={() => {}} />
          <NavRow label="Borrar todos los datos" danger onPress={() => {}} />
        </View>
      </Section>

      <Section title="Filas del historial" theme={theme}>
        <RecordRow
          kind="combustible"
          title="Gasolina Premium"
          meta="17 sept · 51 676 km · Texaco"
          amount="RD$ 2,583.00"
          tag="37.45 km/gal"
          onPress={() => {}}
        />
        <RecordRow
          kind="mantenimiento"
          title="Aceite de motor y filtro"
          meta="12 sept · 51 200 km · Taller de Ramón"
          amount="RD$ 4,000.00"
          onPress={() => {}}
        />
        <RecordRow
          kind="reparacion"
          title="Bomba de agua"
          meta="2 ago · 49 800 km"
          amount="RD$ 12,500.00"
          onPress={() => {}}
        />
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
  simulated: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginHorizontal: space.gutter,
    marginBottom: space.lg,
  },
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
