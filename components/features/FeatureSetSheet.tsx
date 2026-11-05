import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { CORE_TOPICS, type FeatureSet, type Topic } from '@/lib/features/featureSet';
import { resetFeatureSet, saveFeatureSet, useFeatureSet } from '@/lib/features/featureSetStore';
import { FEATURE_TOPICS } from '@/lib/features/ids';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

const ICON: Record<Topic, keyof typeof Ionicons.glyphMap> = {
  fuel_expenses: 'flash-outline',
  maintenance: 'construct-outline',
  documents: 'document-text-outline',
  trips: 'navigate-outline',
  project: 'build-outline',
  track: 'speedometer-outline',
  community: 'people-outline',
};

function Card({ on, icon, label, caption, onPress }: { on: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; caption?: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.card, { backgroundColor: on ? theme.bg.raised : theme.bg.surface, borderColor: on ? theme.accent : theme.lineStrong }]}>
      <Ionicons name={icon} size={22} color={on ? theme.accent : theme.text.secondary} />
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {label}
        </T>
        {caption ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {caption}
          </T>
        ) : null}
      </View>
      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? theme.accent : theme.text.muted} />
    </Pressable>
  );
}

/** The choices, mounted fresh each time the sheet opens so its first state IS the saved choice (or the suggestion, or the core four). */
function Chooser({ set, suggested, onClose }: { set: FeatureSet; suggested?: Topic[] | null; onClose: () => void }) {
  const { theme } = useTheme();
  const [all, setAll] = useState(set.answered ? set.topics === 'all' : false);
  const [picked, setPicked] = useState<Topic[]>(set.answered ? (set.topics === 'all' ? CORE_TOPICS : set.topics) : suggested?.length ? suggested : CORE_TOPICS);
  const toggle = (topic: Topic) => {
    setAll(false);
    setPicked((p) => (p.includes(topic) ? p.filter((x) => x !== topic) : [...p, topic]));
  };
  return (
    <>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>
        {t.featureSet.intro}
      </T>
      {!set.answered && suggested?.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
          {t.featureSet.suggested}
        </T>
      ) : null}
      {FEATURE_TOPICS.map((topic) => (
        <Card key={topic} on={!all && picked.includes(topic)} icon={ICON[topic]} label={t.featureSet.topics[topic]} onPress={() => toggle(topic)} />
      ))}
      <Card on={all} icon="apps-outline" label={t.featureSet.all} caption={t.featureSet.allCaption} onPress={() => setAll((a) => !a)} />
      <PrimaryButton
        label={t.featureSet.save}
        disabled={!all && picked.length === 0}
        onPress={() => {
          void saveFeatureSet({ topics: all ? 'all' : picked, answered: true }).then(onClose);
        }}
      />
      {set.answered && set.topics !== 'all' ? (
        <GhostButton
          label={t.featureSet.reset}
          onPress={() => {
            void resetFeatureSet().then(onClose);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * "Qué quiero ver" (ADR-73): multi-select cards with "Todo". `suggested` pre-fills from what the person actually used. Saving never
 * deletes anything: it only changes what is prominent. "Volver a ver todo" reverses it.
 */
export function FeatureSetSheet({ visible, onClose, suggested }: { visible: boolean; onClose: () => void; suggested?: Topic[] | null }) {
  const { set, ready } = useFeatureSet();
  return (
    <Sheet visible={visible} onClose={onClose} title={t.featureSet.title}>
      {visible && ready ? <Chooser set={set} suggested={suggested} onClose={onClose} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
});
