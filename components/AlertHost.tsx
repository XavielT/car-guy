import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { subscribeToAlerts, type AlertButton, type AlertRequest } from '@/lib/alert';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

/**
 * The web half of `lib/alert.ts`: one themed dialog, mounted once at the root.
 *
 * Nothing renders on native — `Alert.alert` goes to the platform dialog there —
 * so this costs the Android build a subscription that never fires.
 *
 * Requests queue rather than overwrite. Saving a fill-up can raise a "guardado"
 * and a "revisa el odómetro" in the same tick, and dropping one of them would
 * hide the half that mattered.
 */
export function AlertHost() {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => subscribeToAlerts((request) => setQueue((q) => [...q, request])), []);

  const current = queue[0];

  function dismiss(button?: AlertButton) {
    setQueue((q) => q.slice(1));
    // After the state update, so a handler that raises its own alert queues
    // behind this one instead of being swallowed by it.
    button?.onPress?.();
  }

  if (!current) return null;

  const cancel = current.buttons.find((b) => b.style === 'cancel');

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android back and the scrim both mean "cancel" if there is a cancel
      // button, and "dismiss" if the dialog is only a notice.
      onRequestClose={() => dismiss(cancel)}>
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel={cancel?.text ?? current.title}
        onPress={() => dismiss(cancel)}
      />
      <View style={styles.centre} pointerEvents="box-none">
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.dialog,
            { backgroundColor: theme.bg.surface, borderColor: theme.line },
            theme.cardShadow && styles.shadow,
          ]}>
          <T face="title" style={[styles.title, { color: theme.text.primary }]}>
            {current.title}
          </T>
          {current.message ? (
            <T face="body" style={[styles.message, { color: theme.text.secondary }]}>
              {current.message}
            </T>
          ) : null}
          <View style={styles.actions}>
            {current.buttons.map((button, index) => {
              const destructive = button.style === 'destructive';
              const quiet = button.style === 'cancel';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => dismiss(button)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.action,
                    {
                      backgroundColor: quiet ? 'transparent' : destructive ? theme.danger : theme.accent,
                      borderColor: quiet ? theme.line : 'transparent',
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <T
                    face="semibold"
                    style={{
                      fontSize: 15,
                      color: quiet ? theme.text.secondary : destructive ? '#FFFFFF' : theme.accentInk,
                    }}>
                    {button.text}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
  },
  shadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 19 },
  message: { fontSize: 15, lineHeight: 22, marginTop: space.sm },
  actions: { marginTop: space.xl, gap: space.sm },
  action: {
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
});
