import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { AiError } from '@/lib/ai/codes';
import { askPlaces, contactPrefill, distanceLabel, PLACE_KINDS, PRIVACY_GRID_M, type Place, type PlaceKind, type PlacesAnswer } from '@/lib/ai/places';
import { recordReportable } from '@/lib/diagnostics';
import { FEATURE_GOOGLE_PLACES, FEATURE_PLACES_OSM } from '@/lib/flagsAi';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { useAiGate } from './useAiGate';

/**
 * "Buscar cerca de mí" (SPEC-G §G4, verdict D-04). A LIST of gomeras / talleres / gasolineras / lavados near the person:
 *  - the default source is OpenStreetMap (name, address and phone may be kept: "Agregar como contacto" pre-fills the contact form);
 *  - Google Places is an optional, separate source behind FEATURE_GOOGLE_PLACES (default off): list only, Google attribution, "Open in
 *    Google Maps", nothing from it is saved or drawn, and "Agregar como contacto" carries only the kind.
 * The position is rounded to ~500 m before it leaves the phone. This component draws no map and must not sit on a screen that has one.
 * With `onPick` (the repair form's shop field) a result is USED instead of added as a contact.
 */
export function NearbyPlaces({ initialKind = 'taller', onPick }: { initialKind?: PlaceKind; onPick?: (place: Place) => void }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { ready, sheet, featureOff } = useAiGate();
  const location = usePermissionRequest('location_foreground');
  const [kind, setKind] = useState<PlaceKind>(initialKind);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<PlacesAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  if ((!FEATURE_PLACES_OSM && !FEATURE_GOOGLE_PLACES) || featureOff('places')) return null;
  const x = t.ai.places;
  const source: 'osm' | 'google' = FEATURE_GOOGLE_PLACES ? 'google' : 'osm';

  async function search() {
    if (busy || !ready()) return;
    setError(null);
    setBusy(true);
    try {
      // The primer first (ADR-59), then the system dialog. "Ahora no" is not an error.
      if (!(await location.ensure())) return;
      const Location = await import('expo-location');
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setAnswer(await askPlaces(kind, { lat: fix.coords.latitude, lng: fix.coords.longitude }, source));
    } catch (e) {
      if (e instanceof AiError) setError(e.code === 'offline' ? x.offline : e.code === 'provider_error' ? x.unavailable : t.ai.errors[e.code]);
      else {
        recordReportable('ai-places', e);
        setError(x.noFix);
      }
    } finally {
      setBusy(false);
    }
  }

  const add = (p: Place) => {
    if (!answer) return;
    router.push({ pathname: '/contactos/nuevo', params: contactPrefill(p, answer.kind, answer.source) });
  };

  return (
    <Surface padded>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11 }}>
        {x.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
        {x.privacy(PRIVACY_GRID_M)}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
        {PLACE_KINDS.map((k) => (
          <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }} style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, borderColor: kind === k ? theme.accent : theme.line, backgroundColor: kind === k ? theme.bg.raised : 'transparent' }}>
            <T face="semibold" style={{ color: kind === k ? theme.accent : theme.text.secondary, fontSize: 13 }}>
              {x.kinds[k]}
            </T>
          </Pressable>
        ))}
      </View>
      <PrimaryButton label={busy ? x.searching : x.search(x.kinds[kind].toLowerCase())} onPress={() => void search()} disabled={busy} />
      {error ? (
        <T face="body" accessibilityRole="alert" style={{ color: theme.statusText.vencido, fontSize: 13, marginTop: space.xs }}>
          {error}
        </T>
      ) : null}
      {location.sheet}
      {sheet}

      {answer ? (
        <View style={{ marginTop: space.sm, gap: space.sm }}>
          {answer.places.length === 0 ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {x.none}
            </T>
          ) : null}
          {answer.places.map((p) => (
            <View key={p.id} style={{ borderTopWidth: 1, borderColor: theme.line, paddingTop: space.sm, gap: 2 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {p.name}
                {p.rating != null ? `  ★ ${p.rating.toFixed(1)}` : ''}
              </T>
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                {[distanceLabel(p.distance_m), p.address, p.open_now == null ? null : p.open_now ? x.openNow : x.closedNow].filter(Boolean).join(' · ')}
              </T>
              {p.phone ? (
                <T face="mono" style={{ color: theme.text.muted, fontSize: 12 }}>
                  {p.phone}
                </T>
              ) : null}
              <GhostButton label={x.openInMaps} onPress={() => void Linking.openURL(p.maps_url)} />
              {onPick ? <GhostButton label={x.use} onPress={() => onPick(p)} /> : <GhostButton label={x.addContact} onPress={() => add(p)} />}
            </View>
          ))}
          {/* Attribution is part of the result and is never hidden (OSM licence; Google terms §2). */}
          <T face="body" accessibilityLabel={x.attributionLabel} style={{ color: theme.text.muted, fontSize: 11 }}>
            {answer.attribution}
          </T>
          {answer.source === 'google' ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
              {x.googleNote}
            </T>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}
