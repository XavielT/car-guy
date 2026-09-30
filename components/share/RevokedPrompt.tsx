import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { t } from '@/lib/i18n';
import { purgeRevoked, revokedVehicles } from '@/lib/share/members';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A shared car I lost access to (the owner removed me, or I left on another
 * device): ask before taking it off this phone. Nothing is pushed either way.
 */
export function RevokedPrompt() {
  const { theme } = useTheme();
  const { data, refresh } = useStore();
  const [pending, setPending] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = await revokedVehicles();
      const rows = await Promise.all(ids.map((id) => vehicleRepo.getById(id)));
      if (!cancelled) setPending(rows.filter((v) => v && !v.deletedAt).map((v) => ({ id: v!.id, name: v!.name })));
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!pending.length) return null;
  const v = pending[0];
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.accent }]}>
      <T face="title" style={{ color: theme.text.primary, fontSize: 16, textTransform: 'uppercase' }}>
        {t.members.revokedTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
        {t.members.revokedBody(v.name)}
      </T>
      <View style={styles.pair}>
        <GhostButton danger style={{ flex: 1 }} label={t.members.revokedPurge} onPress={() => void purgeRevoked(v.id).then(refresh)} />
        <GhostButton style={{ flex: 1 }} label={t.members.revokedKeep} onPress={() => void purgeRevoked(v.id, true).then(refresh)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.sm, marginBottom: space.md },
  pair: { flexDirection: 'row', gap: space.sm },
});
