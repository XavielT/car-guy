import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { lastFxRate, saveWishlistItem } from '@/lib/db/buildQueries';
import { modCategories, wishlist as wishlistRepo } from '@/lib/db/repos';
import type { ModCategory, WishlistItem } from '@/lib/db/types';
import { wishlistTotalDop } from '@/lib/domain/build';
import { parseDecimal } from '@/lib/domain/economy';
import { dateInputFromIso, isoFromDateInput, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { useTheme } from '@/lib/theme/useTheme';

const STATUSES: WishlistItem['status'][] = ['idea', 'ahorrando', 'pedido', 'descartado'];
const CURRENCIES = ['USD', 'EUR', 'JPY', 'DOP'];
const numOrNull = (s: string) => (s.trim() ? parseDecimal(s) : null);

/**
 * A wishlist item: what, how badly (PRÓXIMO · PRONTO · ALGÚN DÍA), and what it
 * really costs to bring it — the foreign price at the last rate + envío +
 * aduana. "Convertir a mod" opens the mod form prefilled and links the two.
 */
export function WishlistForm({ vehicleId, itemId, onDone }: { vehicleId: string; itemId?: string; onDone: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [categories, setCategories] = useState<ModCategory[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [shipping, setShipping] = useState('');
  const [customs, setCustoms] = useState('');
  const [url, setUrl] = useState('');
  const [vendor, setVendor] = useState('');
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<WishlistItem['status']>('idea');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [cats, r] = await Promise.all([modCategories.listWhere({}, { orderBy: 'sort_order', direction: 'ASC' }), lastFxRate()]);
      setCategories(cats);
      setRate(r);
      if (!itemId) return;
      const w = await wishlistRepo.getById(itemId);
      if (!w) return;
      setCategoryId(w.categoryId);
      setName(w.name);
      setBrand(w.brand ?? '');
      setPartNumber(w.partNumber ?? '');
      setPriority(w.priority);
      setPrice(w.estPriceForeign != null ? String(w.estPriceForeign) : '');
      setCurrency(w.currency ?? 'USD');
      setShipping(w.estShippingDop != null ? String(w.estShippingDop) : '');
      setCustoms(w.estCustomsDop != null ? String(w.estCustomsDop) : '');
      setUrl(w.url ?? '');
      setVendor(w.vendor ?? '');
      setTarget(w.targetDate ? dateInputFromIso(w.targetDate) : '');
      setStatus(w.status);
      setNotes(w.notes);
    })();
  }, [itemId]);

  const estimate = wishlistTotalDop({ estPriceForeign: numOrNull(price), currency, estShippingDop: numOrNull(shipping), estCustomsDop: numOrNull(customs), estTotalDop: null }, rate);

  async function save(): Promise<WishlistItem | null> {
    if (!name.trim()) {
      setError(t.modForm.nameRequired);
      return null;
    }
    return saveWishlistItem({
      id: itemId,
      vehicleId,
      categoryId,
      name: name.trim(),
      brand: brand.trim() || null,
      partNumber: partNumber.trim() || null,
      priority,
      estPriceForeign: numOrNull(price),
      currency,
      estShippingDop: numOrNull(shipping),
      estCustomsDop: numOrNull(customs),
      estTotalDop: estimate,
      url: url.trim() || null,
      vendor: vendor.trim() || null,
      targetDate: target ? isoFromDateInput(target) : null,
      status,
      notes: notes.trim(),
    });
  }

  const label = (t: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
      {t}
    </T>
  );

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
        {itemId ? t.wishlist.editTitle : t.wishlist.newTitle}
      </T>
      <Field label={t.wishlist.name} placeholder={t.wishlist.namePlaceholder} value={name} onChangeText={(t) => (setName(t), setError(null))} />
      {label(t.modForm.category)}
      <View style={styles.chips}>
        {categories.map((c) => (
          <Chip key={c.id} label={catalogLabel('modCategory', c)} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
        ))}
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.brand} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.partNumber} value={partNumber} onChangeText={setPartNumber} />
        </View>
      </View>
      {label(t.wishlist.priority)}
      <View style={styles.chips}>
        {([1, 2, 3] as const).map((p) => (
          <Chip key={p} label={t.wishlist.priorities[p]} selected={priority === p} onPress={() => setPriority(p)} />
        ))}
      </View>
      <Field label={t.wishlist.price} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <View style={styles.chips}>
        {CURRENCIES.map((c) => (
          <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
        ))}
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.wishlist.shipping} keyboardType="decimal-pad" value={shipping} onChangeText={setShipping} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.wishlist.customs} keyboardType="decimal-pad" value={customs} onChangeText={setCustoms} />
        </View>
      </View>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15, marginBottom: space.md }}>
        {`${t.wishlist.total}: ${estimate != null ? money(estimate) : '—'}${currency !== 'DOP' && rate ? ` (${currency} a ${rate})` : ''}`}
      </T>
      <Field label={t.wishlist.vendor} value={vendor} onChangeText={setVendor} />
      <Field label={t.wishlist.url} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <DateField label={t.wishlist.targetDate} value={target || new Date().toISOString().slice(0, 10)} onChange={setTarget} />
      {label(t.wishlist.status)}
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Chip key={s} label={t.build.wishStatuses[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>
      <Field label={t.wishlist.notes} value={notes} onChangeText={setNotes} multiline />
      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.wishlist.save} onPress={() => void save().then((w) => w && onDone())} />
      {itemId ? (
        <GhostButton
          label={t.wishlist.convert}
          onPress={() =>
            void save().then((w) => {
              if (w) router.replace({ pathname: '/mod/nuevo', params: { vehicleId, fromWishlist: w.id } });
            })
          }
        />
      ) : null}
      {itemId ? <GhostButton danger label={t.wishlist.delete} onPress={() => void wishlistRepo.softDelete(itemId).then(onDone)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
});
