import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, SectionHeader } from '@/components/ui';
import { space } from '@/constants/theme';
import { AVATAR_IDS, avatarLabel, type AvatarId } from '@/lib/avatars';
import { useSession } from '@/lib/cloud/auth';
import { recordError } from '@/lib/diagnostics';
import { t } from '@/lib/i18n';
import {
  chooseAvatar,
  cleanDisplayName,
  pickProfilePhoto,
  pushFailed,
  removePhoto,
  saveDisplayName,
  useProfile,
  type PushResult,
} from '@/lib/profile';
import { useTheme } from '@/lib/theme/useTheme';

const COLUMNS = 4;
const GAP = space.md;

/**
 * Perfil (03-screens.md "Phase 6", note 10): display name, the 16 house
 * avatars in a grid, or a photo — taken or chosen, squared, 512 px. Reachable
 * from the Más header and from Cuenta. Local settings only, so it renders at
 * once (no skeleton); signed in, each change also goes up (lib/profile.ts).
 */
export default function PerfilScreen() {
  const { theme } = useTheme();
  const profile = useProfile();
  const { session } = useSession();
  const { width } = useWindowDimensions();

  // Null until the person types: the field shows the saved name till then.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? profile.displayName ?? '';
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  const displayName = profile.displayName ?? session?.user.email ?? null;
  const cell = Math.min(88, Math.floor((Math.min(width, 640) - space.gutter * 2 - GAP * (COLUMNS - 1)) / COLUMNS));
  const nameChanged = cleanDisplayName(name) !== profile.displayName;

  function report(result: PushResult, okText?: string) {
    if (pushFailed(result)) setNotice({ text: t.profileUi.cloudFailed, tone: 'warn' });
    else if (okText) setNotice({ text: okText, tone: 'ok' });
  }

  async function photo(camera: boolean) {
    setNotice(null);
    setWorking(true);
    try {
      // First await in the handler: the web picker needs the user gesture.
      const result = await pickProfilePhoto(camera);
      if (result.saved) report(result.push);
    } catch (error) {
      recordError('profile-photo', error);
      setNotice({ text: t.profileUi.photoFailed, tone: 'warn' });
    } finally {
      setWorking(false);
    }
  }

  async function pick(id: AvatarId) {
    setNotice(null);
    report(await chooseAvatar(id));
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: t.profileUi.title }} />

      <View style={styles.hero}>
        <Avatar size={96} photoUri={profile.photoUri} avatarId={profile.avatarId} name={displayName} />
        <View style={{ flex: 1 }}>
          <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
            {t.profileUi.eyebrow}
          </T>
          <T face="display" numberOfLines={2} style={{ color: theme.text.primary, fontSize: 24, textTransform: 'uppercase' }}>
            {displayName ?? t.profileUi.title}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            {t.profileUi.intro}
          </T>
        </View>
      </View>

      <Field
        label={t.profileUi.nameLabel}
        placeholder={t.profileUi.namePlaceholder}
        hint={t.profileUi.nameHint}
        value={name}
        maxLength={40}
        autoCapitalize="words"
        onChangeText={setDraft}
      />
      <PrimaryButton
        label={t.profileUi.saveName}
        disabled={!nameChanged}
        onPress={() =>
          void saveDisplayName(name).then((result) => {
            setDraft(null);
            report(result, t.profileUi.nameSaved);
          })
        }
      />

      <SectionHeader title={t.profileUi.photoSection} />
      <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
        {t.profileUi.photoHint}
      </T>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <GhostButton label={t.profileUi.takePhoto} disabled={working} onPress={() => void photo(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label={t.profileUi.choosePhoto} disabled={working} onPress={() => void photo(false)} />
        </View>
      </View>
      {working ? (
        <View style={styles.row}>
          <ActivityIndicator color={theme.accent} />
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
            {t.profileUi.photoWorking}
          </T>
        </View>
      ) : null}
      {profile.photoRelPath ? <GhostButton danger label={t.profileUi.removePhoto} onPress={() => void removePhoto().then((r) => report(r))} /> : null}

      <SectionHeader title={t.profileUi.avatarsSection} />
      <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
        {t.profileUi.avatarsCaption}
      </T>
      <View style={[styles.grid, { gap: GAP }]} accessibilityRole="radiogroup">
        {AVATAR_IDS.map((id) => {
          const selected = !profile.photoRelPath && profile.avatarId === id;
          return (
            <Pressable
              key={id}
              onPress={() => void pick(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={selected ? `${avatarLabel(id)}, ${t.profileUi.selected}` : avatarLabel(id)}
              style={({ pressed }) => [
                styles.cell,
                { width: cell, height: cell, borderRadius: cell / 2, borderColor: selected ? theme.accent : 'transparent' },
                pressed && { opacity: 0.8 },
              ]}>
              <Avatar size={cell - 8} avatarId={id} decorative />
            </Pressable>
          );
        })}
      </View>

      {notice ? (
        <T
          face="body"
          accessibilityLiveRegion="polite"
          style={{ color: notice.tone === 'ok' ? theme.statusText.ok : theme.statusText.proximo, fontSize: 13, marginTop: space.md }}>
          {notice.text}
        </T>
      ) : null}
      <T face="body" style={[styles.caption, { color: theme.text.muted, marginTop: space.lg }]}>
        {session ? t.profileUi.cloud : t.profileUi.localOnly}
      </T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  caption: { fontSize: 13, lineHeight: 19, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
