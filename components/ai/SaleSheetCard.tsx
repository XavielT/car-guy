import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { AiError } from '@/lib/ai/codes';
import { askSale } from '@/lib/ai/sale';
import { documents as documentRepo } from '@/lib/db/repos';
import { localRawDossier } from '@/lib/db/shareQueries';
import { recordReportable } from '@/lib/diagnostics';
import { buildSaleFacts, carLabel, mergeSale, saleSheetText, templateSale, type Lang, type SaleFact, type SaleSheet } from '@/lib/domain/saleSheet';
import { FEATURE_AI_SALE_SUMMARY } from '@/lib/flagsAi';
import { todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ShareFlags } from '@/lib/share/dossier';
import { useTheme } from '@/lib/theme/useTheme';
import { useAiGate } from './useAiGate';

export type SaleForBook = { title: string; sections: { heading: string; text: string }[] };

/**
 * "Hoja de venta" in the Libro (SPEC-G §G9). The sheet is built on this device from the same records and the same switches as the
 * book, so it exists with no AI and no connection. The person edits any paragraph; "Mejorar la redacción con IA" only swaps in the
 * paragraphs the server verified (every number checked against the facts). What is shown is what is printed: `onSheet` hands the
 * edited text to the screen, which passes it to the PDF when "Incluir en el Libro" is on.
 */
export function SaleSheetCard({ vehicleId, flags, from, to, onSheet }: { vehicleId: string; flags: ShareFlags; from: string | null; to: string | null; onSheet: (s: SaleForBook | null) => void }) {
  const { theme } = useTheme();
  const { ready, sheet: consentSheet } = useAiGate();
  const [lang, setLang] = useState<Lang>('es');
  const [facts, setFacts] = useState<SaleFact[] | null>(null);
  const [label, setLabel] = useState('');
  const [sheet, setSheet] = useState<SaleSheet | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [include, setInclude] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  // The facts follow the Libro's switches and period: change either and the sheet is rebuilt from the records.
  const flagKey = JSON.stringify(flags);
  useEffect(() => {
    let live = true;
    void (async () => {
      const raw = await localRawDossier(vehicleId, flags, { from, to });
      if (!raw || !live) return;
      const docs = (await documentRepo.listWhere({ vehicleId })).map((d) => ({ title: d.title, kind: d.kind, issuedAt: d.issuedAt, expiresAt: d.expiresAt }));
      if (!live) return;
      setFacts(buildSaleFacts(raw, docs, todayIsoDate()));
      setLabel(carLabel(raw.vehicle));
      setEdited({});
      setNote(null);
    })().catch((e) => recordReportable('sale-facts', e));
    return () => {
      live = false;
    };
    // `flags` is represented by flagKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, flagKey, from, to]);

  // The template follows the language; AI paragraphs stay until the language or the facts change (then they are stale).
  useEffect(() => {
    if (facts) setSheet(templateSale(facts, lang));
    setEdited({});
  }, [facts, lang]);

  const shown = sheet?.sections.map((s) => ({ ...s, text: edited[s.section] ?? s.text })) ?? [];
  useEffect(() => {
    onSheet(include && sheet && shown.length ? { title: sheet.title, sections: shown.map((s) => ({ heading: s.heading, text: s.text })) } : null);
    // `shown` is derived from sheet + edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [include, sheet, edited]);

  async function improve() {
    if (!facts || !sheet || !ready()) return;
    setBusy(true);
    setNote(null);
    try {
      const a = await askSale(label, lang, facts);
      if (!alive.current) return;
      const merged = mergeSale(sheet, a.sections);
      setSheet(merged);
      // A paragraph the person already edited is theirs: the model never overwrites it.
      const n = a.sections.filter((s) => edited[s.section] == null && sheet.sections.some((x) => x.section === s.section)).length;
      setNote(n === 0 ? t.ai.sale.kept : a.dropped.length ? `${t.ai.sale.improved(n)} ${t.ai.sale.someKept(a.dropped.length)}` : t.ai.sale.improved(n));
    } catch (e) {
      if (!alive.current) return;
      if (!(e instanceof AiError)) recordReportable('ai-sale', e);
      setNote(e instanceof AiError ? (e.code === 'offline' ? t.ai.sale.offline : t.ai.errors[e.code]) : t.ai.sale.tryAgain);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  if (!FEATURE_AI_SALE_SUMMARY && !sheet) return null;
  const x = t.ai.sale;
  const textNow = sheet ? saleSheetText({ ...sheet, sections: shown }) : '';

  return (
    <Surface padded style={{ marginTop: space.lg }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11 }}>
        {x.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
        {x.intro}
      </T>

      <View style={styles.chips}>
        {(['es', 'en'] as Lang[]).map((l) => (
          <Pressable key={l} onPress={() => setLang(l)} accessibilityRole="button" accessibilityState={{ selected: lang === l }} style={[styles.chip, { borderColor: lang === l ? theme.accent : theme.line, backgroundColor: lang === l ? theme.bg.raised : 'transparent' }]}>
            <T face="semibold" style={{ color: lang === l ? theme.accent : theme.text.secondary, fontSize: 13 }}>
              {l === 'es' ? x.langEs : x.langEn}
            </T>
          </Pressable>
        ))}
      </View>

      {!sheet || shown.length === 0 ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm }}>
          {x.empty}
        </T>
      ) : (
        <View style={{ marginTop: space.sm, gap: space.sm }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
            {sheet.title}
          </T>
          {shown.map((s) => (
            <View key={s.section}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {[s.heading, edited[s.section] != null ? x.editedTag : s.source === 'ai' ? x.aiTag : null].filter(Boolean).join(' · ')}
              </T>
              <TextInput
                value={s.text}
                onChangeText={(v) => setEdited((e) => ({ ...e, [s.section]: v }))}
                multiline
                accessibilityLabel={s.heading}
                style={[styles.input, { color: theme.text.primary, borderColor: theme.line, backgroundColor: theme.bg.raised }]}
                placeholderTextColor={theme.text.muted}
              />
            </View>
          ))}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
            {x.reviewNote}
          </T>
          {note ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13 }}>
              {note}
            </T>
          ) : null}
          <GhostButton label={busy ? x.improving : x.improve} onPress={() => void improve()} />
          <GhostButton label={copied ? x.copied : x.copy} onPress={() => void Clipboard.setStringAsync(textNow).then(() => setCopied(true))} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {x.include}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                {x.includeHint}
              </T>
            </View>
            <Switch value={include} onValueChange={setInclude} accessibilityLabel={x.include} />
          </View>
        </View>
      )}
      {consentSheet}
    </Surface>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, minHeight: 44, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: radius.button, padding: space.sm, fontSize: 14, lineHeight: 20, minHeight: 64, textAlignVertical: 'top', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
});
