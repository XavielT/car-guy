import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { T } from '@/components/T';
import { Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { CHEATSHEET, IDLE, step, type ChordState } from '@/lib/desktop/shortcuts';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

const isTyping = (el: EventTarget | null): boolean => {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || e.isContentEditable;
};

/**
 * Listens for the desktop shortcuts (SPEC-F §F3, lib/desktop/shortcuts.ts) and hosts the "?" cheat-sheet. Web only, and only mounted
 * by the desktop shell, so a phone never gets a key listener.
 */
export function ShortcutsHost() {
  const router = useRouter();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const chord = useRef<ChordState>(IDLE);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const r = step({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey, typing: isTyping(e.target) }, chord.current, Date.now());
      chord.current = r.state;
      const a = r.action;
      if (!a) return;
      if (a.type === 'close') return setOpen(false);
      e.preventDefault();
      if (a.type === 'search') router.push({ pathname: '/herramientas', params: { focus: 'search' } } as never);
      else if (a.type === 'go') router.navigate(a.href as never);
      else if (a.type === 'new_fillup') router.push('/carga/nueva' as never);
      else if (a.type === 'cheatsheet') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title={t.desktop.shortcuts}>
      <View style={{ gap: space.sm }}>
        {CHEATSHEET.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: 4, minWidth: 96 }}>
              {row.keys.map((k, j) => (
                <View key={j} style={{ borderWidth: 1, borderColor: theme.lineStrong, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: theme.bg.raised }}>
                  <T face="mono" style={{ color: theme.text.primary, fontSize: 12 }}>
                    {k}
                  </T>
                </View>
              ))}
            </View>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
              {t.desktop.shortcutLabels[row.id]}
            </T>
          </View>
        ))}
      </View>
    </Sheet>
  );
}
