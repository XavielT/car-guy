import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { getSupabase } from '@/lib/cloud/supabase';
import { t } from '@/lib/i18n';
import { deleteJunteMessage, sendJunteMessage } from '@/lib/junte/api';
import { reportTarget } from '@/lib/social/api';
import { useTheme } from '@/lib/theme/useTheme';

type Msg = { id: string; body: string; created_at: string; mine: boolean };

/**
 * A junte's chat (IMP 01102026 Phase 6) — built, **off** (FEATURE_JUNTE_CHAT = false) until push notifications
 * exist: nobody reads a chat they are not told about. Members only (RLS); blocked authors hidden by the policy;
 * 30 messages a minute. Polls while open. Before switching it on: a list RPC that names authors by @handle (the
 * table read below only tells "mine" from "someone's" and must not keep their ids).
 */
export function JunteChat({ junteId, isOwner }: { junteId: string; isOwner: boolean }) {
  const { theme } = useTheme();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const uid = (await supabase.auth.getSession()).data.session?.user.id;
    const { data } = await supabase
      .from('junte_message')
      .select('id, body, created_at, user_id')
      .eq('junte_id', junteId)
      .order('created_at', { ascending: true })
      .limit(200);
    setMsgs((data ?? []).map((m) => ({ id: m.id, body: m.body, created_at: m.created_at, mine: m.user_id === uid })));
  }, [junteId]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await sendJunteMessage(junteId, body);
    await load();
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
        {t.juntes.chat}
      </T>
      {msgs.length === 0 ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.juntes.chatEmpty}
        </T>
      ) : (
        msgs.map((m) => (
          <Surface key={m.id} padded style={[styles.msg, m.mine ? { alignSelf: 'flex-end', backgroundColor: theme.bg.raised } : { alignSelf: 'flex-start' }]}>
            <T face="body" style={{ color: theme.text.primary, fontSize: 14 }}>
              {m.body}
            </T>
            <View style={styles.actions}>
              {m.mine || isOwner ? (
                <Pressable onPress={() => void deleteJunteMessage(m.id).then(load)} accessibilityRole="button" hitSlop={6}>
                  <T face="semibold" style={{ color: theme.text.muted, fontSize: 11 }}>
                    {t.juntes.deleteMessage}
                  </T>
                </Pressable>
              ) : (
                <Pressable onPress={() => void reportTarget('junte_message', m.id)} accessibilityRole="button" hitSlop={6}>
                  <T face="semibold" style={{ color: theme.text.muted, fontSize: 11 }}>
                    {t.juntes.reportMessage}
                  </T>
                </Pressable>
              )}
            </View>
          </Surface>
        ))
      )}
      <Field label={t.juntes.chatPlaceholder} value={text} onChangeText={(v) => setText(v.slice(0, 500))} />
      <GhostButton label={t.juntes.send} disabled={!text.trim()} onPress={() => void send()} />
    </View>
  );
}

const styles = StyleSheet.create({
  msg: { maxWidth: '85%', marginBottom: space.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
});
