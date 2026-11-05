import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { clearDraft, draftAge, loadDraft, saveDraft, worthKeeping, type Draft } from '@/lib/forms/draft';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Tienes un borrador": saves the text fields of a form about a second after the last keystroke, offers the draft back
 * the next time the form opens (Recuperar / Descartar), and forgets it when the form is saved.
 *
 *   const draft = useFormDraft('fuel:new', { odo, vol }, enabled, (v) => { setOdo(v.odo); … });
 *   …{draft.banner}…            // render once, at the top of the form
 *   draft.clear();              // after a successful save
 */
export function useFormDraft<V extends Record<string, string>>(key: string, values: V, enabled: boolean, onRestore: (values: V) => void) {
  const { theme } = useTheme();
  const [offer, setOffer] = useState<Draft<V> | null>(null);
  const [now] = useState(() => Date.now());
  /** No autosave until the offer was answered, so an old draft is not overwritten by the empty form behind it. */
  const [ready, setReady] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadDraft<V>(key).then((d) => {
      if (cancelled) return;
      if (d && worthKeeping(d.values)) setOffer(d);
      else setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  const json = JSON.stringify(values);
  useEffect(() => {
    if (!enabled || !ready || cleared.current) return;
    const parsed = JSON.parse(json) as V;
    const timer = setTimeout(() => {
      if (worthKeeping(parsed)) void saveDraft(key, parsed);
      else void clearDraft(key);
    }, 900);
    return () => clearTimeout(timer);
  }, [json, key, enabled, ready]);

  const clear = useCallback(() => {
    cleared.current = true;
    void clearDraft(key);
  }, [key]);

  const banner: ReactNode = offer ? (
    <Surface padded style={styles.card}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
        {t.draft.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
        {t.draft.body(draftAge(offer.at, now))}
      </T>
      <View style={styles.row}>
        <PrimaryButton
          label={t.draft.restore}
          onPress={() => {
            onRestore(offer.values);
            setOffer(null);
            setReady(true);
          }}
        />
        <GhostButton
          label={t.draft.discard}
          onPress={() => {
            void clearDraft(key);
            setOffer(null);
            setReady(true);
          }}
        />
      </View>
    </Surface>
  ) : null;

  return { banner, clear };
}

const styles = StyleSheet.create({
  card: { gap: space.xs, marginBottom: space.sm },
  row: { gap: space.sm, marginTop: space.xs },
});
