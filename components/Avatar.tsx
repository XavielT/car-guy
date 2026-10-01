import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AVATAR_ART } from '@/components/avatars';
import { AV } from '@/components/avatars/base';
import { T } from '@/components/T';
import { avatarLabel, resolveAvatar } from '@/lib/avatars';
import { t } from '@/lib/i18n';

/**
 * A person's picture, everywhere one is shown (IMP 30092026 note 10):
 * photo → avatar drawing → initials on an amber disc. A photo that fails to
 * load falls through to the next one on its own, so a broken or expired URL is
 * never on screen (research 02 §4).
 *
 * `decorative` when the person's name is right next to it, so a screen reader
 * does not read them twice.
 */
export function Avatar({
  size = 40,
  photoUri,
  avatarId,
  name,
  decorative = false,
  style,
}: {
  size?: number;
  photoUri?: string | null;
  avatarId?: string | null;
  name?: string | null;
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Keyed on the uri: a new photo gets its own chance to load.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const photoFailed = Boolean(photoUri) && failedUri === photoUri;

  const source = resolveAvatar({ photoUri, avatarId, name, photoFailed });
  const label = source.kind === 'art' ? avatarLabel(source.id) : (name || t.profileUi.title);
  const a11y = decorative
    ? ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const);

  const frame: StyleProp<ViewStyle> = [
    { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    style,
  ];

  if (source.kind === 'photo') {
    return (
      <View {...a11y} style={[frame, { backgroundColor: AV.disc }]}>
        <Image
          source={{ uri: source.uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailedUri(source.uri)}
        />
      </View>
    );
  }
  if (source.kind === 'art') {
    const Art = AVATAR_ART[source.id];
    return (
      <View {...a11y} style={frame}>
        <Art size={size} />
      </View>
    );
  }
  return (
    <View {...a11y} style={[frame, { backgroundColor: AV.amber }]}>
      <T face="badge" allowFontScaling={false} style={{ color: AV.page, fontSize: Math.round(size * (source.text.length > 1 ? 0.34 : 0.42)), letterSpacing: 0 }}>
        {source.text}
      </T>
    </View>
  );
}
