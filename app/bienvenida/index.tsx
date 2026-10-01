import Ionicons from '@expo/vector-icons/Ionicons';
import { router as appRouter, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { CarbonFrame, ClusterHero, GaugeRing, GhostButton, Hanko, LcdDigits, PrimaryButton, Segmented, Surface, TelltaleRow } from '@/components/ui';
import { VehicleForm } from '@/components/VehicleForm';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { importBackup } from '@/lib/backup';
import { useSession } from '@/lib/cloud/auth';
import { settings } from '@/lib/db/repos';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { userMessage } from '@/lib/diagnostics';
import { t, useLanguage, type LanguagePreference } from '@/lib/i18n';
import { describeCounts } from '@/lib/import/tucombustible';
import { markOnboarded } from '@/lib/onboarding/welcome';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type SlideId = 'lang' | 'profile' | 'car' | 'features' | 'perms' | 'account';
const SLIDES: SlideId[] = ['lang', 'profile', 'car', 'features', 'perms', 'account'];
/** The setting the profile screen (app/perfil.tsx) reads; written here so the name is not typed twice. */
const NAME_KEY = 'profile_display_name';

/**
 * La bienvenida (IMP 30092026 note 11, 03-screens.md "Phase 6"): six slides in
 * a horizontal FlatList pager — react-native-pager-view has no web — with
 * "Saltar" on every one and the dots under them. Shown by the tabs layout's
 * gate while `onboarded_version` is unset (lib/onboarding/welcome.ts); Más →
 * Ayuda opens it again with ?again=1, and then it returns where it came from.
 *
 * Nothing here is mandatory and nothing asks for a permission: the permissions
 * slide only explains, and its background-location paragraph is the prominent
 * disclosure (research 02 §5.3); the runtime prompts come later, in context.
 */
export default function BienvenidaScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { again } = useLocalSearchParams<{ again?: string }>();
  const { refresh, setActiveVehicle, data } = useStore();
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const list = useRef<FlatList<SlideId>>(null);

  useEffect(() => {
    void settings.get<unknown>(NAME_KEY, '').then((v) => setName(typeof v === 'string' ? v : ''));
  }, []);

  function saveName() {
    const value = name.trim();
    void settings.set(NAME_KEY, value || null);
  }

  async function finish() {
    saveName();
    await markOnboarded();
    if (again === '1' && router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    setIndex(clamped);
    list.current?.scrollToIndex({ index: clamped, animated: true });
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < SLIDES.length) setIndex(next);
  }

  async function handleImport() {
    try {
      const result = await importBackup();
      if (!result) return;
      await refresh();
      Alert.alert(
        t.onboarding.importedTitle,
        result.kind === 'legacy' ? t.onboarding.importedLegacy(describeCounts(result.counts)) : t.onboarding.importedMerge(result.counts.merged),
      );
    } catch (error) {
      Alert.alert(t.onboarding.importFailedTitle, userMessage('welcome-import', error, t.more.restoreFailed));
    }
  }

  if (form) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <GhostButton label={`‹ ${t.welcome.car.backToSlides}`} onPress={() => setForm(false)} />
            <T face="display" style={[styles.formTitle, { color: theme.text.primary }]}>
              {t.welcome.car.formTitle}
            </T>
          </View>
          <VehicleForm
            submitLabel={t.vehicle.create}
            onSubmit={(draft) => {
              void (async () => {
                const id = await saveVehicleDraft(draft);
                await refresh();
                setActiveVehicle(id);
                setIndex(SLIDES.indexOf('features'));
                setForm(false);
              })();
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const firstCar = data.vehicles[0] ?? null;
  const last = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <T face="badge" style={{ color: theme.accent, fontSize: 12 }}>
          {t.home.eyebrow}
        </T>
        <Pressable onPress={() => void finish()} accessibilityRole="button" accessibilityLabel={t.welcome.skipA11y} hitSlop={6} style={styles.skip}>
          <T face="semibold" style={{ color: theme.text.secondary, fontSize: 15 }}>
            {t.welcome.skip}
          </T>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setPageWidth(Math.round(e.nativeEvent.layout.width))}>
        {pageWidth > 0 ? (
          <FlatList
            ref={list}
            data={SLIDES}
            keyExtractor={(id) => id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.slide} keyboardShouldPersistTaps="handled">
                {item === 'lang' ? <LangSlide again={again === '1'} /> : null}
                {item === 'profile' ? (
                  <ProfileSlide name={name} onName={setName} onBlur={saveName} onAvatar={() => router.push('/perfil' as never)} />
                ) : null}
                {item === 'car' ? (
                  <CarSlide carName={firstCar ? firstCar.name : null} onAdd={() => setForm(true)} onImport={handleImport} onLater={() => goTo(SLIDES.indexOf('features'))} />
                ) : null}
                {item === 'features' ? <FeaturesSlide /> : null}
                {item === 'perms' ? <PermsSlide /> : null}
                {item === 'account' ? <AccountSlide onOpen={() => router.push('/cuenta')} /> : null}
              </ScrollView>
            )}
          />
        ) : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityRole="text" accessibilityLabel={t.welcome.step(index + 1, SLIDES.length)}>
          {SLIDES.map((id, i) => (
            <Pressable key={id} onPress={() => goTo(i)} accessibilityElementsHidden importantForAccessibility="no" hitSlop={6}>
              <View style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.lineStrong, width: i === index ? 22 : 8 }]} />
            </Pressable>
          ))}
        </View>
        <PrimaryButton label={last ? t.welcome.start : t.welcome.next} onPress={() => (last ? void finish() : goTo(index + 1))} />
      </View>
    </SafeAreaView>
  );
}

function Heading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.heading}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
        {eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>
        {title}
      </T>
      {body ? (
        <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

function Art({ children }: { children: ReactNode }) {
  return <View style={styles.art}>{children}</View>;
}

function LangSlide({ again }: { again: boolean }) {
  const language = useLanguage();
  return (
    <>
      <Art>
        <ClusterHero
          size={220}
          odometerKm={24816}
          reading={{ progress: 0.72, title: t.welcome.features.care.title, remaining: { km: 1200 }, predictedDueDate: null }}
        />
      </Art>
      <Heading eyebrow={t.welcome.lang.eyebrow} title={t.welcome.lang.title} body={t.welcome.lang.body} />
      <Segmented<LanguagePreference>
        options={[
          { key: 'system', label: t.language.system },
          { key: 'es', label: t.language.es },
          { key: 'en', label: t.language.en },
        ]}
        value={language.preference}
        onChange={(next) => {
          // The navigator is keyed on the language (app/_layout.tsx): the switch remounts it,
          // so bring the person back here, as Más → Idioma does.
          language.setPreference(next);
          setTimeout(() => appRouter.navigate(again ? '/bienvenida?again=1' : '/bienvenida'), 0);
        }}
      />
    </>
  );
}

function ProfileSlide({ name, onName, onBlur, onAvatar }: { name: string; onName: (v: string) => void; onBlur: () => void; onAvatar: () => void }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '車';
  return (
    <>
      <Art>
        <Hanko char={initial} size={112} />
      </Art>
      <Heading eyebrow={t.welcome.profile.eyebrow} title={t.welcome.profile.title} body={t.welcome.profile.body} />
      <Field
        label={t.welcome.profile.nameLabel}
        placeholder={t.welcome.profile.namePlaceholder}
        value={name}
        onChangeText={onName}
        onBlur={onBlur}
        autoComplete="name"
        maxLength={40}
      />
      <GhostButton label={t.welcome.profile.pickAvatar} onPress={onAvatar} />
    </>
  );
}

function CarSlide({ carName, onAdd, onImport, onLater }: { carName: string | null; onAdd: () => void; onImport: () => void; onLater: () => void }) {
  const { theme } = useTheme();
  return (
    <>
      <Art>
        <CarbonFrame style={styles.lcdFrame}>
          <LcdDigits value={0} minDigits={6} height={44} accessibilityLabel="000000 km" />
        </CarbonFrame>
      </Art>
      <Heading eyebrow={t.welcome.car.eyebrow} title={t.welcome.car.title} body={t.welcome.car.body} />
      {carName ? (
        <Surface>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {t.welcome.car.added(carName)}
          </T>
        </Surface>
      ) : (
        <View style={{ gap: space.sm }}>
          <PrimaryButton label={t.welcome.car.add} onPress={onAdd} />
          <GhostButton label={t.welcome.car.import} onPress={onImport} />
          <GhostButton label={t.welcome.later} onPress={onLater} />
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, textAlign: 'center' }}>
            {t.welcome.car.laterHint}
          </T>
        </View>
      )}
    </>
  );
}

function FeaturesSlide() {
  const { theme } = useTheme();
  const cards = [
    { icon: 'construct-outline', ...t.welcome.features.care },
    { icon: 'map-outline', ...t.welcome.features.trips },
    { icon: 'flag-outline', ...t.welcome.features.build },
    { icon: 'images-outline', ...t.welcome.features.album },
  ] as const;
  return (
    <>
      <Art>
        <TelltaleRow
          lamps={[
            { icon: 'oil', status: 'ok', label: t.welcome.features.care.title },
            { icon: 'tire', status: 'proximo', label: t.welcome.features.build.title },
            { icon: 'fuel', status: 'ok', label: t.welcome.features.trips.title },
            { icon: 'checklist', status: 'ok', label: t.welcome.features.album.title },
          ]}
        />
      </Art>
      <Heading eyebrow={t.welcome.features.eyebrow} title={t.welcome.features.title} />
      <View style={{ gap: space.sm }}>
        {cards.map((c) => (
          <Surface key={c.title} style={styles.featureCard}>
            <Ionicons name={c.icon} size={22} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {c.title}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                {c.body}
              </T>
            </View>
          </Surface>
        ))}
      </View>
    </>
  );
}

function PermsSlide() {
  const { theme } = useTheme();
  const p = t.welcome.perms;
  const row = (icon: 'images-outline' | 'navigate-outline', title: string, body: string) => (
    <Surface style={styles.featureCard}>
      <Ionicons name={icon} size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          {body}
        </T>
      </View>
    </Surface>
  );
  return (
    <>
      <Art>
        <GaugeRing progress={0.5} size={120} value="GPS" label="走" />
      </Art>
      <Heading eyebrow={p.eyebrow} title={p.title} body={p.body} />
      <View style={{ gap: space.sm }}>
        {row('images-outline', p.photosTitle, p.photosBody)}
        {row('navigate-outline', p.locationTitle, p.locationBody)}
        {/* The prominent disclosure for background location (research 02 §5.3): the data, "even
            when the app is closed or not in use", the purpose, not shared, how to turn it off. */}
        <View accessibilityRole="text" style={[styles.disclosure, { borderColor: theme.accent, backgroundColor: theme.bg.surface }]}>
          <T face="title" style={{ color: theme.text.primary, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {p.backgroundTitle}
          </T>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20, marginTop: space.xs }}>
            {p.disclosure}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: space.xs }}>
            {p.askLater}
          </T>
        </View>
      </View>
    </>
  );
}

function AccountSlide({ onOpen }: { onOpen: () => void }) {
  const { theme } = useTheme();
  const { session } = useSession();
  return (
    <>
      <Art>
        <Hanko char="峠" size={96} shape="square" />
      </Art>
      <Heading eyebrow={t.welcome.account.eyebrow} title={t.welcome.account.title} body={t.welcome.account.body} />
      {session ? (
        <Surface>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {t.welcome.account.signedIn(session.user.email ?? '')}
          </T>
        </Surface>
      ) : (
        <GhostButton label={t.welcome.account.open} onPress={onOpen} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.gutter, paddingRight: space.sm },
  skip: { minWidth: 44, minHeight: 44, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  slide: { flexGrow: 1, paddingHorizontal: space.gutter, paddingBottom: space.lg },
  art: { alignItems: 'center', justifyContent: 'center', minHeight: 150, paddingVertical: space.md },
  heading: { marginBottom: space.lg },
  title: { fontSize: 30, lineHeight: 33, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  body: { fontSize: 15, lineHeight: 22, marginTop: space.sm },
  bottom: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.md, gap: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 20 },
  dot: { height: 8, borderRadius: 4 },
  featureCard: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  disclosure: { borderWidth: 1, borderLeftWidth: 3, borderRadius: radius.button, padding: space.md },
  lcdFrame: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card },
  formHeader: { paddingHorizontal: space.gutter, paddingTop: space.lg },
  formTitle: { fontSize: 28, lineHeight: 30, marginTop: space.sm, textTransform: 'uppercase', letterSpacing: 0.3 },
});
