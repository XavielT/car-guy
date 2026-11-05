import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { shareCardImage } from '@/components/track/TrackPieces';
import { RecapCardView } from '@/components/recap/RecapCardView';
import { T } from '@/components/T';
import { PrimaryButton, Sheet, ToggleRow } from '@/components/ui';
import { space } from '@/constants/theme';
import type { Recap } from '@/lib/domain/recap';
import { DEFAULT_SHARE, toShareModel, type ShareOptions } from '@/lib/domain/recapShare';
import { t } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';
import { cardText } from '@/lib/recap/copy';
import { useTheme } from '@/lib/theme/useTheme';

export const EXPORT_SIZES = { story: { w: 1080, h: 1920 }, feed: { w: 1080, h: 1350 } } as const;
const FOOTER = 'CAR GUY · car-guy.vercel.app';

/**
 * Share one card as an image (SPEC-J §J5). The picture is drawn from `toShareModel` — the privacy model — by the SAME card component the
 * viewer uses, at 1080×1920 (story) or 1080×1350 (feed), off-screen; nothing is uploaded. Spend, the car's name and the person's name are
 * OFF unless turned on; plate, VIN, odometer, exact places and other people's names are not in the model at all.
 */
export function RecapShareSheet({ visible, onClose, recap, cardIndex }: { visible: boolean; onClose: () => void; recap: Recap; cardIndex: number }) {
  const { theme } = useTheme();
  const profile = useProfile();
  const [opts, setOpts] = useState<ShareOptions>(DEFAULT_SHARE);
  const [format, setFormat] = useState<'story' | 'feed'>('story');
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const exportRef = useRef<View>(null);

  const model = useMemo(() => toShareModel(recap, { ...opts, userName: profile.displayName ?? null }), [recap, opts, profile.displayName]);
  const kind = recap.cards[cardIndex]?.kind;
  const card = model.cards.find((c) => c.kind === kind) ?? null;
  const text = card ? cardText(card, recap.period) : null;
  const size = EXPORT_SIZES[format];

  const make = async () => {
    if (!card) return;
    setStatus('busy');
    try {
      await shareCardImage(exportRef, `car-guy-${recap.id}-${card.kind}`);
      setStatus('done');
    } catch {
      setStatus('failed');
    }
  };

  const pw = 200;
  return (
    <Sheet visible={visible} onClose={onClose} title={t.recap.share.title}>
      {text && card ? (
        <View style={{ alignItems: 'center', marginBottom: space.md }} accessibilityLabel={text.sentence}>
          <View style={{ borderWidth: 1, borderColor: theme.lineStrong }}>
            <RecapCardView text={text} kind={card.kind} w={pw} h={Math.round((pw * size.h) / size.w)} footer={FOOTER} />
          </View>
        </View>
      ) : (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
          {t.recap.share.thin}
        </T>
      )}

      <View style={styles.row}>
        {(['story', 'feed'] as const).map((f) => (
          <Pressable key={f} onPress={() => setFormat(f)} accessibilityRole="button" accessibilityState={{ selected: format === f }} style={[styles.pill, { borderColor: format === f ? theme.accent : theme.lineStrong, backgroundColor: format === f ? theme.bg.raised : theme.bg.surface }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
              {t.recap.share[f]}
            </T>
          </Pressable>
        ))}
      </View>

      <ToggleRow label={t.recap.share.spend} hint={t.recap.share.spendHint} value={opts.showSpend} onChange={(v) => setOpts((o) => ({ ...o, showSpend: v }))} />
      <ToggleRow label={t.recap.share.car} value={opts.showVehicleName} onChange={(v) => setOpts((o) => ({ ...o, showVehicleName: v }))} />
      <ToggleRow label={t.recap.share.me} value={opts.showUserName} onChange={(v) => setOpts((o) => ({ ...o, showUserName: v }))} />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginVertical: space.sm }}>
        {t.recap.share.never}
      </T>

      <PrimaryButton label={status === 'busy' ? '…' : t.recap.share.make} onPress={() => void make()} disabled={!card || status === 'busy'} />
      {status === 'done' ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.statusText.ok, fontSize: 13, marginTop: space.sm }}>
          {t.recap.share.saved}
        </T>
      ) : null}
      {status === 'failed' ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.dangerText, fontSize: 13, marginTop: space.sm }}>
          {t.recap.share.failed}
        </T>
      ) : null}

      {/* The export itself: the same card at its real size, off-screen, drawn from the share model only. */}
      {visible && text && card ? (
        <View ref={exportRef} collapsable={false} pointerEvents="none" style={{ position: 'absolute', left: -6000, top: 0, width: size.w, height: size.h }}>
          <RecapCardView text={text} kind={card.kind} w={size.w} h={size.h} footer={FOOTER} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  pill: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
