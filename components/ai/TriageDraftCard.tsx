import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { AiError } from '@/lib/ai/codes';
import { askTriage, mailtoFor, type TriageDraft, type TriageSource } from '@/lib/ai/triage';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Borrador con IA" on the admin's comment screen. Asking costs one small call; the answer is a DRAFT shown on screen: nothing is
 * stored, nothing is sent. Copy and "use in mail" are the admin's own actions; the mail only opens the admin's mail client.
 */
export function TriageDraftCard({ row, email }: { row: TriageSource; email: string | null }) {
  const { theme } = useTheme();
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [draft, setDraft] = useState<TriageDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  async function ask() {
    setPhase('working');
    setError(null);
    setCopied(false);
    try {
      const d = await askTriage(row);
      if (!alive.current) return;
      setDraft(d);
      setPhase('done');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof AiError ? (e.code === 'offline' ? t.ai.triage.offline : t.ai.errors[e.code]) : t.ai.triage.tryAgain);
      setPhase('error');
    }
  }

  const x = t.ai.triage;
  return (
    <Surface style={{ marginTop: space.md }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11 }}>
        {x.title}
      </T>
      {phase === 'idle' || phase === 'error' ? (
        <>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
            {x.intro}
          </T>
          {error ? (
            <T face="body" accessibilityRole="alert" style={{ color: theme.statusText.vencido, fontSize: 13, marginTop: space.xs }}>
              {error}
            </T>
          ) : null}
          <GhostButton label={x.ask} onPress={() => void ask()} />
        </>
      ) : null}
      {phase === 'working' ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginTop: space.xs }}>
          {x.working}
        </T>
      ) : null}
      {phase === 'done' && draft ? (
        <View style={{ gap: space.xs, marginTop: space.xs }}>
          <T face="semibold" selectable style={{ color: theme.text.primary, fontSize: 15 }}>
            {draft.summary}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {[draft.category, draft.area, draft.severity].join(' · ')}
            {draft.needs_human ? ` · ${x.needsHuman}` : ''}
          </T>
          {draft.redactions > 0 ? (
            <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
              {x.redacted(draft.redactions)}
            </T>
          ) : null}
          {draft.questions.length ? (
            <View>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.xs }}>
                {x.questions}
              </T>
              {draft.questions.map((q) => (
                <T key={q} face="body" selectable style={{ color: theme.text.secondary, fontSize: 14 }}>
                  {`• ${q}`}
                </T>
              ))}
            </View>
          ) : null}
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.xs }}>
            {x.reply}
          </T>
          {draft.suggested_reply ? (
            <>
              <T face="body" selectable style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
                {draft.suggested_reply}
              </T>
              <GhostButton label={copied ? x.copied : x.copy} onPress={() => void Clipboard.setStringAsync(draft.suggested_reply).then(() => setCopied(true))} />
              {email ? <GhostButton label={x.useInMail} onPress={() => void Linking.openURL(mailtoFor(email, t.feedback.admin.replySubject, draft.suggested_reply))} /> : null}
            </>
          ) : (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {draft.reply_blocked ? x.blocked[draft.reply_blocked] : x.noReply}
            </T>
          )}
          <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.draftNote}
          </T>
          <GhostButton label={x.again} onPress={() => void ask()} />
        </View>
      ) : null}
    </Surface>
  );
}
