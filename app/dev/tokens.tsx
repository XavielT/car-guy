import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import {
  Badge,
  BoostRing,
  CarbonFrame,
  Card,
  Chip,
  ClusterHero,
  CornerGrid,
  EmptyState,
  GaugeRing,
  Hanko,
  HazardDivider,
  LcdDigits,
  TelltaleRow,
  Timeline,
  type CornerValues,
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
import { replayGaugeSweep } from '@/lib/motion/gaugeSweep';
import { contrast, textPairs } from '@/lib/theme/contrast';
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
          Cluster JDM 90s
        </T>
        <T face="body" style={styles.sub}>
          Tokens de Car Guy 2.1. Izquierda oscuro (predeterminado), derecha claro.
        </T>
        <View style={{ paddingHorizontal: space.gutter, marginBottom: space.lg }}>
          <PrimaryButton label="Repetir el barrido" onPress={replayGaugeSweep} />
        </View>
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
          <Swatch label="bg.well" color={theme.bg.well} theme={theme} />
          <Swatch label="lineStrong" color={theme.lineStrong} theme={theme} />
          <Swatch label="accent" color={theme.accent} theme={theme} />
          <Swatch label="accentFill" color={theme.accentFill} theme={theme} />
          <Swatch label="accent.pressed" color={theme.accentPressed} theme={theme} />
          <Swatch label="needle" color={theme.needle} theme={theme} />
          <Swatch label="redline" color={theme.redline} theme={theme} />
          <Swatch label="redlineText" color={theme.redlineText} theme={theme} />
          <Swatch label="danger" color={theme.danger} theme={theme} />
          <Swatch label="telltaleOff" color={theme.telltaleOff.lamp} theme={theme} />
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
        <T face="display" style={{ color: theme.text.primary, fontSize: 32, textTransform: 'uppercase' }}>
          Tablero
        </T>
        <T face="title" style={{ color: theme.text.primary, fontSize: 21 }}>
          Próximos mantenimientos
        </T>
        <T face="eyebrow" style={{ color: theme.text.muted }}>
          Sección · eyebrow
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 15 }}>
          Texto de cuerpo en Rajdhani. Explica lo que significa el número.
        </T>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
          Título de tarjeta en Rajdhani 700
        </T>
        <T face="badge" style={{ color: theme.text.primary, fontSize: 13 }}>
          Car Guy
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            Registro
          </T>
          <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
            記録
          </T>
          <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
            ハチゴー
          </T>
        </View>
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
          <BoostRing progress={0.72} size={120} value="72%" label="chequeo" peak={0.86} animate />
          <GaugeRing progress={1} size={88} value="3" label="semanas" color={theme.status.ok} />
        </View>
      </Section>

      <Section title="Cluster (ClusterHero)" theme={theme}>
        <ClusterHero
          odometerKm={52400}
          size={300}
          reading={{ progress: 0.82, title: 'Aceite', remaining: { km: 1250 }, predictedDueDate: '2026-10-12' }}
          caption="Actualizado hace 3 días"
          header={
            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
              <Badge label="4AGE 20V" />
              <Badge label="Drift" tone="amber" />
            </View>
          }>
          <View style={{ marginTop: space.md }}>
            <TelltaleRow
              lamps={[
                { icon: 'oil', status: 'proximo', label: 'Aceite' },
                { icon: 'coolant', status: 'vencido', label: 'Refrigerante' },
                { icon: 'tire', status: 'off', label: 'Gomas' },
                { icon: 'battery', status: 'off', label: 'Batería' },
                { icon: 'brake', status: 'urgente', label: 'Frenos' },
                { icon: 'document', status: 'off', label: 'Documentos' },
                { icon: 'fuel', status: 'off', label: 'Combustible' },
                { icon: 'checklist', status: 'ok', label: 'Chequeo' },
              ]}
            />
          </View>
        </ClusterHero>
        <OdometerHero
          vehicleName="Trueno AE85"
          odometerKm={null}
          daysSinceReading={null}
          telltales={[{ status: 'proximo', label: 'Aceite · faltan 320 km' }]}
          onPressOdometer={() => {}}
        />
      </Section>

      <Section title="LCD, badges, hanko" theme={theme}>
        <View style={{ gap: space.md }}>
          <View style={{ backgroundColor: theme.bg.well, padding: space.md, borderRadius: radius.input, alignSelf: 'flex-start' }}>
            <LcdDigits value={52400} height={32} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Badge label="4AGE 20V" />
            <Badge label="Swap" />
            <Badge label="Daily" tone="amber" />
            <Badge label="Stock" tone="green" />
            <Badge label="Proyecto" tone="outline" />
            <Badge label="Ex" tone="outline" />
          </View>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
            <Hanko char="X" />
            <Hanko char="車" />
            <Hanko char="改" shape="square" size={40} />
          </View>
        </View>
      </Section>

      <Section title="Divisores y carbono" theme={theme}>
        <HazardDivider />
        <HazardDivider tone="vencido" style={{ marginTop: space.md }} />
        <CarbonFrame style={{ marginTop: space.md, borderRadius: radius.card, padding: space.md }}>
          <View style={{ backgroundColor: theme.bg.surface, padding: space.md, borderRadius: radius.input }}>
            <T face="body" style={{ color: theme.text.secondary }}>
              El carbono es marco: el texto va en su propio panel.
            </T>
          </View>
        </CarbonFrame>
      </Section>

      <Section title="Presiones (CornerGrid)" theme={theme}>
        <CornerDemo />
      </Section>

      <Section title="Línea de tiempo" theme={theme}>
        <Timeline
          items={TIMELINE}
          getDate={(i) => i.at}
          keyExtractor={(i) => i.id}
          dotColor={(i) => i.color}
          monthAside={(key) => (key === '2025-08' ? '48 900 km' : null)}
          renderItem={(i) => (
            <Card style={{ padding: space.md }}>
              <T face="semibold" style={{ color: theme.text.primary }}>
                {i.title}
              </T>
            </Card>
          )}
          scrollEnabled={false}
        />
      </Section>

      <Section title="Contraste (texto ≥ 4.5:1)" theme={theme}>
        {textPairs(theme).map((pair) => {
          const ratio = contrast(pair.fg, pair.bg, pair.under);
          return (
            <T key={pair.name} face="mono" style={{ color: ratio >= 4.5 ? theme.text.secondary : theme.dangerText, fontSize: 10 }}>
              {ratio.toFixed(2)} · {pair.name}
            </T>
          );
        })}
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

const TIMELINE = [
  { id: '1', at: '2025-08-15T12:00:00.000Z', title: 'Swap 4A-GE 20V', color: categoryColors.album },
  { id: '2', at: '2025-08-02T12:00:00.000Z', title: 'Aros 15x8 ET0', color: categoryColors.mejora },
  { id: '3', at: '2025-06-20T12:00:00.000Z', title: 'Aceite y filtro', color: categoryColors.mantenimiento },
];

function CornerDemo() {
  const [cold, setCold] = useState<CornerValues>({ fl: 30, fr: 30, rl: 28, rr: 28 });
  const hot: CornerValues = { fl: 34, fr: 34, rl: 37, rr: 38 };
  return (
    <View style={{ gap: space.md }}>
      <CornerGrid values={cold} onChange={(c, v) => setCold((p) => ({ ...p, [c]: v }))} />
      <CornerGrid values={hot} compare={cold} flagDelta={8} editable={false} />
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
      <T face="eyebrow" style={[styles.eyebrow, { color: theme.text.muted }]}>
        {title}
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
