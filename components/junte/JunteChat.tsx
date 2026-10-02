import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { deleteJunteMessage, junteMessages, notifyJunteMessage, sendJunteMessage, setJunteMuted, type JunteMessage } from '@/lib/junte/api';
import { registerPush } from '@/lib/notifications/push';
import { reportTarget } from '@/lib/social/api';
import { useTheme } from '@/lib/theme/useTheme';

const authorOf = (m: JunteMessage) => m.author.display_name?.trim() || (m.author.handle ? `@${m.author.handle}` : '—');
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * A junte's chat (sql/039; FEATURE_JUNTE_CHAT gates it). Members only; authors by name / @handle from
 * junte_messages — the screen never holds another member's user id. Blocked authors are dropped by the RPC;
 * 30 messages a minute. Polls every 10 s while open.
 *
 * Push: after a send, api/junte-push.ts tells the other members (Android, once Firebase is in the build). Opening
 * the chat is where the app asks for the notification permission, unless this chat is muted. The iPhone web app
 * gets no push (ADR-48) and says so.
 */
export function JunteChat({ junteId }: { junteId: string; isOwner?: boolean }) {
  const { theme } = useTheme();
  const [msgs, setMsgs] = useState<JunteMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await junteMessages(junteId);
    if (!r.ok || !r.data) return;
    setMsgs(r.data.messages);
    setMuted(r.data.muted);
    return r.data;
  }, [junteId]);

  useEffect(() => {
    let alive = true;
    const first = setTimeout(() => {
      void load().then((page) => {
        if (alive && page && !page.muted) void registerPush({ ask: true });
      });
    }, 0);
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    setNote(null);
    const r = await sendJunteMessage(junteId, body);
    if (!r.ok) {
      setText(body);
      setNote(r.reason === 'rate_limited' ? t.juntes.rateLimited : t.juntes.sendFailed);
      return;
    }
    void notifyJunteMessage(r.data);
    await load();
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    const r = await setJunteMuted(junteId, next);
    if (!r.ok) setMuted(!next);
    else if (!next) void registerPush({ ask: true });
  };

  const report = async (id: string) => {
    const r = await reportTarget('junte_message', id);
    if (r.ok) setReported((s) => new Set(s).add(id));
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <View style={styles.head}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
          {t.juntes.chat}
        </T>
        {Platform.OS !== 'web' ? (
          <Pressable onPress={() => void toggleMute()} accessibilityRole="switch" accessibilityState={{ checked: !muted }} hitSlop={6}>
            <T face="semibold" style={{ color: theme.text.muted, fontSize: 11 }}>
              {muted ? t.juntes.unmute : t.juntes.mute}
            </T>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'web' ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.xs }}>
          {t.juntes.pushOffWeb}
        </T>
      ) : null}
      {msgs.length === 0 ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.juntes.chatEmpty}
        </T>
      ) : (
        msgs.map((m) => (
          <Surface key={m.id} padded style={[styles.msg, m.mine ? { alignSelf: 'flex-end', backgroundColor: theme.bg.raised } : { alignSelf: 'flex-start' }]}>
            {!m.mine ? (
              <T face="semibold" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 2 }}>
                {authorOf(m)}
              </T>
            ) : null}
            <T face="body" style={{ color: theme.text.primary, fontSize: 14 }}>
              {m.body}
            </T>
            <View style={styles.actions}>
              <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginRight: 'auto' }}>
                {timeOf(m.created_at)}
              </T>
              {m.can_delete ? (
                <Pressable onPress={() => void deleteJunteMessage(m.id).then(load)} accessibilityRole="button" hitSlop={6}>
                  <T face="semibold" style={{ color: theme.text.muted, fontSize: 11 }}>
                    {t.juntes.deleteMessage}
                  </T>
                </Pressable>
              ) : null}
              {!m.mine ? (
                reported.has(m.id) ? (
                  <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginLeft: space.sm }}>
                    {t.juntes.reported}
                  </T>
                ) : (
                  <Pressable onPress={() => void report(m.id)} accessibilityRole="button" hitSlop={6} style={{ marginLeft: space.sm }}>
                    <T face="semibold" style={{ color: theme.text.muted, fontSize: 11 }}>
                      {t.juntes.reportMessage}
                    </T>
                  </Pressable>
                )
              ) : null}
            </View>
          </Surface>
        ))
      )}
      {note ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs }}>
          {note}
        </T>
      ) : null}
      <Field label={t.juntes.chatPlaceholder} value={text} onChangeText={(v) => setText(v.slice(0, 500))} />
      <GhostButton label={t.juntes.send} disabled={!text.trim()} onPress={() => void send()} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  msg: { maxWidth: '85%', marginBottom: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
