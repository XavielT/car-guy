import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { radius, space } from '@/constants/theme';
import { matchesQuery } from '@/lib/domain/text';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { PrimaryButton, Sheet } from '../ui';
import { useKeyboardHeight } from '../ui/Sheet';
import { T } from '../T';

export type SearchItem = {
  key: string;
  label: string;
  /** Smaller line under the label ("2002–2006"). */
  sub?: string;
  /** Extra words the search also matches (aliases: "AE86"). */
  keywords?: string;
  /** Items with the same section are grouped under it, in the order given. */
  section?: string;
  /** Emphasised row (e.g. inside the model's known years). */
  highlight?: boolean;
};

export type SearchPick = { key: string; label: string } | { other: string };

/**
 * A bottom sheet with a search box and a (sectioned) list, plus an "Otro…"
 * row that turns into a text field — for makes, models, oil brands. On web the
 * same Sheet is a modal. The search folds accents ("citroen" → Citroën) and
 * matches every word anywhere in the label, the sub line or the keywords.
 */
export function SearchSheet({
  visible,
  title,
  items,
  selectedKey,
  onPick,
  onClose,
  otherLabel = t.pickers.other,
  allowOther = true,
  searchable = true,
}: {
  visible: boolean;
  title: string;
  items: SearchItem[];
  selectedKey?: string | null;
  onPick: (pick: SearchPick) => void;
  onClose: () => void;
  otherLabel?: string;
  allowOther?: boolean;
  searchable?: boolean;
}) {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  // With the keyboard up the sheet sits on it: the list gets what is left.
  const listMax = keyboard ? Math.max(160, height - keyboard - 260) : height * 0.55;
  const [query, setQuery] = useState('');
  const [typingOther, setTypingOther] = useState(false);
  const [other, setOther] = useState('');

  const sections = useMemo(() => {
    const matching = items.filter((item) => matchesQuery(`${item.label} ${item.sub ?? ''} ${item.keywords ?? ''}`, query));
    const groups = new Map<string, SearchItem[]>();
    for (const item of matching) {
      const key = item.section ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [items, query]);

  function close() {
    setQuery('');
    setTypingOther(false);
    setOther('');
    onClose();
  }

  function pick(p: SearchPick) {
    onPick(p);
    close();
  }

  return (
    <Sheet visible={visible} onClose={close} title={title} avoidKeyboard>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {typingOther ? (
          <View>
            <TextInput
              autoFocus
              value={other}
              onChangeText={setOther}
              placeholder={otherLabel}
              placeholderTextColor={theme.text.muted}
              accessibilityLabel={otherLabel}
              returnKeyType="done"
              onSubmitEditing={() => other.trim() && pick({ other: other.trim() })}
              style={[styles.search, { backgroundColor: theme.bg.raised, borderColor: theme.line, color: theme.text.primary }]}
            />
            <PrimaryButton label={t.pickers.use} onPress={() => pick({ other: other.trim() })} disabled={!other.trim()} />
          </View>
        ) : (
          <>
            {searchable ? (
              <View style={[styles.searchRow, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
                <Ionicons name="search" size={18} color={theme.text.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t.pickers.search}
                  placeholderTextColor={theme.text.muted}
                  accessibilityLabel={t.pickers.search}
                  autoCorrect={false}
                  style={[styles.searchInput, { color: theme.text.primary }]}
                />
              </View>
            ) : null}
            <SectionList
              style={{ maxHeight: listMax }}
              sections={sections}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) =>
                section.title ? (
                  <T face="eyebrow" style={[styles.section, { color: theme.text.muted }]}>
                    {section.title}
                  </T>
                ) : null
              }
              renderItem={({ item }) => {
                const on = item.key === selectedKey;
                return (
                  <Pressable
                    onPress={() => pick({ key: item.key, label: item.label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.row, { borderColor: theme.line }]}>
                    <View style={{ flex: 1 }}>
                      <T
                        face={item.highlight || on ? 'semibold' : 'body'}
                        style={[styles.rowLabel, { color: on ? theme.accent : theme.text.primary }]}>
                        {item.label}
                      </T>
                      {item.sub ? (
                        <T face="mono" style={[styles.rowSub, { color: theme.text.muted }]}>
                          {item.sub}
                        </T>
                      ) : null}
                    </View>
                    {on ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
                  {t.pickers.noMatch}
                </T>
              }
              ListFooterComponent={
                allowOther ? (
                  <Pressable
                    onPress={() => {
                      setOther(query);
                      setTypingOther(true);
                    }}
                    accessibilityRole="button"
                    style={styles.row}>
                    <T face="semibold" style={[styles.rowLabel, { color: theme.text.secondary }]}>
                      {otherLabel}
                    </T>
                  </Pressable>
                ) : null
              }
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    minHeight: 48,
    marginBottom: space.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  search: { borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, minHeight: 48, fontSize: 16, marginBottom: space.md },
  section: { fontSize: 11, marginTop: space.md, marginBottom: space.xs },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 12, marginTop: 2 },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
});
