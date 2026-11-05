import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { settings } from '@/lib/db/repos';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { NAV_ITEMS as ITEMS } from '@/lib/nav/model';
import { railActive } from '@/lib/theme/layout';
import { useTheme } from '@/lib/theme/useTheme';
import { useLiveTrip } from '@/lib/trips/liveStore';

const COLLAPSED_KEY = 'rail_collapsed';
export const RAIL_WIDTH = { open: 232, collapsed: 68 } as const;

/**
 * The side rail (SPEC-F §F2, ADR-70), shown from 1024 px on the web instead of the bottom tab bar: the same destinations, the vehicle
 * switcher on top, the account at the bottom, collapsible (remembered on this device). It is a <nav> of real buttons: tab order,
 * focus ring (the browser's), `aria-current` on the current one, and a title tooltip when collapsed.
 */
export function SideRail() {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const live = useLiveTrip();
  const { data, activeVehicle, setActiveVehicle } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    void settings.get<boolean>(COLLAPSED_KEY, false).then(setCollapsed).catch(() => {});
  }, []);
  const toggle = () => {
    setCollapsed((c) => !c);
    void settings.set(COLLAPSED_KEY, !collapsed).catch(() => {});
  };
  const active = railActive(pathname);
  const vehicles = data.vehicles.filter((v) => !v.isArchived);
  const width = collapsed ? RAIL_WIDTH.collapsed : RAIL_WIDTH.open;

  return (
    <View
      {...({ role: "navigation" } as object)}
      accessibilityLabel={t.desktop.railLabel}
      style={[styles.rail, { width, backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
      <View style={styles.top}>
        {collapsed ? null : (
          <T face="display" style={{ color: theme.text.primary, fontSize: 20, letterSpacing: 1 }}>
            CAR GUY
          </T>
        )}
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={collapsed ? t.desktop.expand : t.desktop.collapse} accessibilityState={{ expanded: !collapsed }} style={styles.iconBtn}>
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={18} color={theme.text.muted} />
        </Pressable>
      </View>

      {!collapsed && vehicles.length > 0 ? (
        <View style={{ gap: 4, marginBottom: space.md }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
            {t.desktop.vehicle}
          </T>
          {vehicles.slice(0, 6).map((v) => {
            const on = v.id === activeVehicle?.id;
            return (
              <Pressable key={v.id} onPress={() => setActiveVehicle(v.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.vehicle, { borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.bg.raised : 'transparent' }]}>
                <T face={on ? 'semibold' : 'body'} numberOfLines={1} style={{ color: on ? theme.text.primary : theme.text.secondary, fontSize: 13 }}>
                  {v.name}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 2, flex: 1 }}>
        {ITEMS.map((it) => {
          const on = active === it.id;
          const recording = it.id === 'conducir' && live != null;
          return (
            <Pressable
              key={it.id}
              onPress={() => router.navigate(it.href as never)}
              accessibilityRole="link"
              accessibilityLabel={it.label()}
              accessibilityState={{ selected: on }}
              // react-native-web maps these to the DOM: the current page for assistive tech, a tooltip when only the icon shows.
              {...({ 'aria-current': on ? 'page' : undefined, title: collapsed ? `${it.label()} (${it.key})` : undefined } as object)}
              style={({ hovered }: { hovered?: boolean }) => [styles.item, { backgroundColor: on ? theme.bg.raised : hovered ? theme.bg.well : 'transparent', borderColor: on ? theme.accent : 'transparent' }]}>
              <Ionicons name={it.icon} size={20} color={on ? theme.accent : recording ? theme.danger : theme.text.secondary} />
              {collapsed ? null : (
                <>
                  <T face={on ? 'semibold' : 'body'} style={{ color: on ? theme.text.primary : theme.text.secondary, fontSize: 15, flex: 1 }}>
                    {it.label()}
                  </T>
                  {recording ? (
                    <T face="eyebrow" style={{ color: theme.danger, fontSize: 10 }}>
                      REC
                    </T>
                  ) : (
                    <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                      {it.key.replace(' ', ' ')}
                    </T>
                  )}
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/cuenta' as never)} accessibilityRole="link" accessibilityLabel={t.desktop.account} {...({ title: collapsed ? t.desktop.account : undefined } as object)} style={styles.item}>
        <Ionicons name="person-circle-outline" size={20} color={theme.text.secondary} />
        {collapsed ? null : (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 15 }}>
            {t.desktop.account}
          </T>
        )}
      </Pressable>
      {collapsed ? null : (
        <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.sm }}>
          {t.desktop.shortcutsHint}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { borderRightWidth: 1, paddingHorizontal: space.md, paddingVertical: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg, minHeight: 32 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.chip },
  vehicle: { borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.sm, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.sm, minHeight: 44 },
});
