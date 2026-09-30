import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ModRow } from '@/components/build/ModRow';
import { SpecsTab } from '@/components/build/SpecsTab';
import { StockActualCard } from '@/components/build/StockActualCard';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, EmptyState, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { buildData, lastFxRate, modAction, mountWheelSet, type BuildData } from '@/lib/db/buildQueries';
import { contacts as contactRepo, vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Contact, InventoryItem, Mod, Tire, Vehicle, WheelSet, WishlistItem } from '@/lib/db/types';
import { jsonObject } from '@/lib/domain/album';
import { cleanSpecs, currentSpecs, investedTotal, modTotalDop, wishlistTotalDop } from '@/lib/domain/build';
import { dotAge, parseTireSize } from '@/lib/domain/tires';
import { parseDecimal } from '@/lib/domain/economy';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The build (IMP 28092026 Phase 4, Build.dc.html): MODS grouped by system with
 * subtotals, the STOCK → ACTUAL card, the wishlist inline at the end; SPECS,
 * WISHLIST and INVENTARIO (wheel sets, tires, parts) as the other tabs.
 */
type Tab = 'mods' | 'specs' | 'wishlist' | 'inventario';
const TABS: Tab[] = ['mods', 'specs', 'wishlist', 'inventario'];

function whole(n: number): string {
  return money(Math.round(n)).replace(/\.00$/, '');
}

export default function BuildScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [tab, setTab] = useState<Tab>(TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'mods');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [data, setData] = useState<BuildData | null>(null);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [rate, setRate] = useState<number | null>(null);
  const [acting, setActing] = useState<Mod | null>(null);
  const [selling, setSelling] = useState<Mod | null>(null);
  const [reclass, setReclass] = useState<Mod | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellTo, setSellTo] = useState('');
  const [invKind, setInvKind] = useState('todo');

  const load = useCallback(async () => {
    if (!id) return;
    const [v, d, cs, r] = await Promise.all([vehicleRepo.getById(id), buildData(id), contactRepo.listWhere({}), lastFxRate()]);
    setVehicle(v);
    setData(d);
    setContacts(Object.fromEntries(cs.map((c) => [c.id, c])));
    setRate(r);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const current = useMemo(
    () => (data ? currentSpecs(jsonObject(data.sheet?.stock), data.mods, jsonObject(data.sheet?.overrides)) : {}),
    [data],
  );

  if (!vehicle || !data) return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  const name = (vehicle.nickname || vehicle.name).toUpperCase();
  const invested = investedTotal(data.mods);
  const installed = data.mods.filter((m) => m.status === 'instalado').length;
  const categoryOf = (cid: string) => data.categories.find((c) => c.id === cid);
  const after = async () => {
    await load();
    refresh();
  };

  async function act(action: Parameters<typeof modAction>[1], mod: Mod) {
    await modAction(mod.id, action);
    setActing(null);
    await after();
  }

  // ----------------------------------------------------------- MODS tab
  const groups = data.categories
    .map((c) => ({ category: c, mods: data.mods.filter((m) => m.categoryId === c.id) }))
    .filter((g) => g.mods.length);
  const orphanMods = data.mods.filter((m) => !categoryOf(m.categoryId));
  if (orphanMods.length) groups.push({ category: { id: 'otro', name: 'Otro', icon: null, sortOrder: 999, isSeeded: true } as never, mods: orphanMods });
  const openWishes = data.wishlist.filter((w) => w.status !== 'convertido' && w.status !== 'descartado');

  const modsTab = (
    <View style={{ gap: space.sm }}>
      <StockActualCard current={current} onPress={() => setTab('specs')} />
      {!data.mods.length ? <EmptyState icon="construct-outline" message={t.build.empty} /> : null}
      {groups.map((g) => {
        const subtotal = g.mods.reduce((t, m) => t + (m.status === 'planeado' || m.status === 'pedido' ? 0 : modTotalDop(m)), 0);
        return (
          <View key={g.category.id} style={{ gap: space.sm, marginTop: space.sm }}>
            <View style={styles.groupHead}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {`${catalogLabel('modCategory', g.category)} · ${g.mods.length}`}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {subtotal ? whole(subtotal) : ''}
              </T>
            </View>
            {g.mods.map((m) => (
              <ModRow
                key={m.id}
                mod={m}
                thumb={data.thumbs[m.id]}
                categoryIcon={g.category.icon}
                installerName={m.contactId ? contacts[m.contactId]?.name : null}
                onPress={() => router.push({ pathname: '/mod/[id]', params: { id: m.id } })}
                onLongPress={() => setActing(m)}
              />
            ))}
          </View>
        );
      })}
      {openWishes.map((w) => (
        <WishRow key={w.id} item={w} rate={rate} onPress={() => router.push({ pathname: '/wishlist/[id]', params: { id: w.id } })} />
      ))}
      <View style={{ marginTop: space.md }}>
        <PrimaryButton label={t.build.add} onPress={() => router.push({ pathname: '/mod/nuevo', params: { vehicleId: vehicle.id } })} />
      </View>
    </View>
  );

  // ------------------------------------------------------- WISHLIST tab
  const wishTab = (
    <View style={{ gap: space.sm }}>
      {!data.wishlist.length ? <EmptyState icon="heart-outline" message={t.wishlist.empty} /> : null}
      {([1, 2, 3] as const).map((p) => {
        const items = data.wishlist.filter((w) => w.priority === p && w.status !== 'convertido' && w.status !== 'descartado');
        if (!items.length) return null;
        const total = items.reduce((t, w) => t + (wishlistTotalDop(w, rate) ?? 0), 0);
        return (
          <View key={p} style={{ gap: space.sm, marginTop: space.sm }}>
            <View style={styles.groupHead}>
              <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
                {`${t.wishlist.priorities[p]} · ${items.length}`}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {total ? whole(total) : ''}
              </T>
            </View>
            {items.map((w) => (
              <WishRow key={w.id} item={w} rate={rate} onPress={() => router.push({ pathname: '/wishlist/[id]', params: { id: w.id } })} />
            ))}
          </View>
        );
      })}
      {data.wishlist.some((w) => w.status === 'convertido') ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
          {`${data.wishlist.filter((w) => w.status === 'convertido').length} convertidos a mod.`}
        </T>
      ) : null}
      <View style={{ marginTop: space.md }}>
        <PrimaryButton label={t.wishlist.add} onPress={() => router.push({ pathname: '/wishlist/nuevo', params: { vehicleId: vehicle.id } })} />
      </View>
    </View>
  );

  // ----------------------------------------------------- INVENTARIO tab
  const kinds = ['todo', 'ruedas', 'gomas', 'pieza', 'fluido', 'herramienta', 'consumible'];
  const showSets = invKind === 'todo' || invKind === 'ruedas';
  const showTires = invKind === 'todo' || invKind === 'gomas';
  const items = data.inventory.filter((i) => (invKind === 'todo' ? true : i.kind === invKind || (invKind === 'ruedas' && i.kind === 'aro') || (invKind === 'gomas' && i.kind === 'goma')));
  const invTab = (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {kinds.map((k) => (
          <Chip key={k} label={t.inventory.kinds[k]} selected={invKind === k} onPress={() => setInvKind(k)} />
        ))}
      </ScrollView>
      {!data.wheelSets.length && !data.tires.length && !data.inventory.length ? <EmptyState icon="cube-outline" message={t.inventory.empty} /> : null}
      {showSets && data.wheelSets.length ? (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.sm }}>
          {t.inventory.wheelSets}
        </T>
      ) : null}
      {showSets
        ? data.wheelSets.map((s) => (
            <WheelSetCard
              key={s.id}
              set={s}
              tires={data.tires.filter((t) => t.wheelSetId === s.id)}
              vehicleName={vehicle.name}
              onOpen={() => router.push({ pathname: '/ruedas/[setId]', params: { setId: s.id, vehicleId: vehicle.id } })}
              onMount={() => void mountWheelSet(s.id).then(after)}
            />
          ))
        : null}
      {showTires && data.tires.length ? (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.sm }}>
          {t.inventory.tires}
        </T>
      ) : null}
      {showTires
        ? data.tires.map((t) => (
            <TireRow key={t.id} tire={t} setName={data.wheelSets.find((s) => s.id === t.wheelSetId)?.name ?? null} onPress={() => router.push({ pathname: '/goma/[id]', params: { id: t.id, vehicleId: vehicle.id } })} />
          ))
        : null}
      {items.length ? (
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.sm }}>
          {t.inventory.items}
        </T>
      ) : null}
      {items.map((i) => (
        <ItemRow key={i.id} item={i} onPress={() => router.push({ pathname: '/inventario/[id]', params: { id: i.id, vehicleId: vehicle.id } })} />
      ))}
      <View style={{ marginTop: space.md, gap: 0 }}>
        <GhostButton label={t.inventory.addWheels} onPress={() => router.push({ pathname: '/ruedas/[setId]', params: { setId: 'nuevo', vehicleId: vehicle.id } })} />
        <GhostButton label={t.inventory.addTire} onPress={() => router.push({ pathname: '/goma/[id]', params: { id: 'nuevo', vehicleId: vehicle.id } })} />
        <GhostButton label={t.inventory.addItem} onPress={() => router.push({ pathname: '/inventario/nuevo', params: { vehicleId: vehicle.id } })} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
              {t.build.eyebrow(name)}
              <T face="kana" style={{ color: theme.text.muted, fontSize: 10, letterSpacing: 0, textTransform: 'none' }}>
                {' 改'}
              </T>
            </T>
            <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 34, lineHeight: 36, textTransform: 'uppercase' }}>
              {t.build.tabs[tab]}
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T face="monoBold" style={{ color: theme.accent, fontSize: 16 }}>
              {whole(invested)}
            </T>
            <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
              {`${t.build.invested} · ${t.build.installedCount(installed)}`}
            </T>
          </View>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((tb) => (
            <Chip key={tb} label={t.build.tabs[tb]} selected={tab === tb} onPress={() => setTab(tb)} />
          ))}
        </View>

        {tab === 'mods' ? modsTab : null}
        {tab === 'specs' ? (
          <SpecsTab vehicleId={vehicle.id} vehicleName={vehicle.nickname || vehicle.name} current={current} stock={cleanSpecs(jsonObject(data.sheet?.stock)).specs} snapshots={data.snapshots} onChanged={() => void after()} />
        ) : null}
        {tab === 'wishlist' ? wishTab : null}
        {tab === 'inventario' ? invTab : null}
      </ScrollView>

      {/* Long-press lifecycle: nothing is deleted, history keeps it. */}
      <Sheet visible={Boolean(acting)} onClose={() => setActing(null)} title={acting ? t.build.actionsTitle(acting.name) : ''}>
        {acting ? (
          <>
            <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.sm }}>
              {t.build.historyKeeps}
            </T>
            {acting.status === 'instalado' ? (
              <>
                <GhostButton label={t.build.remove} onPress={() => void act({ kind: 'quitar', at: new Date().toISOString() }, acting)} />
                <GhostButton
                  label={t.build.sell}
                  onPress={() => {
                    setSelling(acting);
                    setSellPrice('');
                    setSellTo('');
                    setActing(null);
                  }}
                />
                <GhostButton label={t.build.markDamaged} onPress={() => void act({ kind: 'danado', at: new Date().toISOString() }, acting)} />
              </>
            ) : (
              <GhostButton label={t.build.reinstall} onPress={() => void act({ kind: 'reinstalar' }, acting)} />
            )}
            <GhostButton
              label={t.build.reclassify}
              onPress={() => {
                setReclass(acting);
                setActing(null);
              }}
            />
            <GhostButton label={t.build.edit} onPress={() => (setActing(null), router.push({ pathname: '/mod/[id]', params: { id: acting.id } }))} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={Boolean(selling)} onClose={() => setSelling(null)} title={t.build.sellTitle}>
        <Field label={t.build.sellPrice} keyboardType="decimal-pad" value={sellPrice} onChangeText={setSellPrice} />
        <Field label={t.build.sellTo} value={sellTo} onChangeText={setSellTo} />
        <PrimaryButton
          label={t.build.sellSave}
          onPress={() => {
            if (!selling) return;
            const price = sellPrice.trim() ? parseDecimal(sellPrice) : null;
            void modAction(selling.id, { kind: 'vender', at: new Date().toISOString(), priceDop: price, to: sellTo.trim() || null }).then(() => {
              setSelling(null);
              void after();
            });
          }}
        />
      </Sheet>

      <Sheet visible={Boolean(reclass)} onClose={() => setReclass(null)} title={t.build.reclassify}>
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {data.categories.map((c) => (
              <Chip
                key={c.id}
                label={catalogLabel('modCategory', c)}
                selected={reclass?.categoryId === c.id}
                onPress={() => reclass && void modAction(reclass.id, { kind: 'reclasificar', categoryId: c.id }).then(() => (setReclass(null), void after()))}
              />
            ))}
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

function WishRow({ item, rate, onPress }: { item: WishlistItem; rate: number | null; onPress: () => void }) {
  const { theme } = useTheme();
  const foreign = item.estPriceForeign != null && item.currency ? `${item.currency} ${Math.round(item.estPriceForeign).toLocaleString('en-US')}` : null;
  const total = wishlistTotalDop(item, rate);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.name, t.build.wishStatuses[item.status], foreign, item.vendor].filter(Boolean).join(', ')}
      style={[styles.wish, { backgroundColor: theme.bg.well, borderColor: theme.lineStrong }]}>
      <View style={[styles.wishIcon, { backgroundColor: theme.bg.raised }]}>
        <Ionicons name="heart-outline" size={20} color={theme.text.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T face="semibold" numberOfLines={2} style={{ color: theme.text.secondary, fontSize: 15 }}>
          {item.name}
        </T>
        <T face="mono" numberOfLines={2} style={{ color: theme.text.muted, fontSize: 11 }}>
          {t.build.wishlistInline(item.priority, foreign ?? (total ? whole(total) : null), item.vendor)}
        </T>
      </View>
      <View style={[styles.saving, { borderColor: theme.accent }]}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 10 }}>
          {t.build.wishStatuses[item.status]}
        </T>
      </View>
    </Pressable>
  );
}

function WheelSetCard({ set, tires, vehicleName, onOpen, onMount }: { set: WheelSet; tires: Tire[]; vehicleName: string; onOpen: () => void; onMount: () => void }) {
  const { theme } = useTheme();
  const spec = set.widthIn && set.diamIn ? `${set.diamIn}x${set.widthIn}${set.offsetMm != null ? ` ET${set.offsetMm}` : ''}` : null;
  const line = t.inventory.wheelLine([spec ?? '', set.boltPattern ?? '', set.centerBoreMm ? `CB ${set.centerBoreMm}` : '']);
  const sizes = [...new Set(tires.map((t) => t.size).filter(Boolean))].join(' / ');
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: set.status === 'montado' ? theme.accentFill : theme.lineStrong }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${set.name}, ${line}, ${t.inventory.setStatus[set.status]}`} style={{ gap: 4 }}>
      <View style={styles.cardHead}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 16, flex: 1, letterSpacing: 0.5 }}>
          {set.name}
        </T>
        <View style={[styles.pill, { borderColor: set.status === 'montado' ? theme.statusText.ok : theme.lineStrong }]}>
          <T face="eyebrow" style={{ color: set.status === 'montado' ? theme.statusText.ok : theme.text.muted, fontSize: 10 }}>
            {t.inventory.setStatus[set.status]}
          </T>
        </View>
      </View>
      {line ? (
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
          {line}
        </T>
      ) : null}
      {sizes ? (
        <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
          {t.inventory.wheelTires(sizes, tires.length)}
        </T>
      ) : null}
      </Pressable>
      {/* Beside the card's button, not inside it (nested buttons are invalid HTML). */}
      {set.status !== 'montado' && set.status !== 'vendido' ? <GhostButton label={t.inventory.mountOn(vehicleName)} onPress={onMount} /> : null}
    </View>
  );
}

function TireRow({ tire, setName, onPress }: { tire: Tire; setName: string | null; onPress: () => void }) {
  const { theme } = useTheme();
  const age = dotAge(tire.dotCode ?? (tire.dotWeek && tire.dotYear ? `${String(tire.dotWeek).padStart(2, '0')}${String(tire.dotYear).slice(-2)}` : null));
  const dotText = !age ? null : 'legacy' in age ? t.inventory.dotOld : t.inventory.dot(age.week, age.year, age.ageYears.toFixed(1));
  const size = tire.size ?? '';
  const parsed = parseTireSize(size);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[size, dotText, t.inventory.positions[tire.position]].filter(Boolean).join(', ')} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View style={styles.cardHead}>
        <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
          {size || [tire.brand, tire.model].filter(Boolean).join(' ') || '—'}
        </T>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
          {t.inventory.positions[tire.position]}
        </T>
      </View>
      <View style={styles.tireLine}>
        {dotText ? (
          <View style={[styles.pill, { borderColor: age?.flag ? theme.redline : theme.lineStrong }]}>
            <T face="mono" style={{ color: age?.flag ? theme.dangerText : theme.text.secondary, fontSize: 11 }}>
              {dotText}
            </T>
          </View>
        ) : null}
        <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
          {[tire.brand, t.inventory.heatCycles(tire.heatCycles), tire.treadMmCurrent != null ? t.inventory.tread(String(tire.treadMmCurrent)) : null, setName, parsed.load && parsed.speed ? `${parsed.load}${parsed.speed}` : null].filter(Boolean).join(' · ')}
        </T>
      </View>
    </Pressable>
  );
}

function ItemRow({ item, onPress }: { item: InventoryItem; onPress: () => void }) {
  const { theme } = useTheme();
  const qty = `${item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1)}${item.unit ? ` ${item.unit}` : ''}`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, ${qty}${item.location ? `, ${item.location}` : ''}`} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View style={styles.cardHead}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
          {item.name}
        </T>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
          {t.inventory.item.kinds[item.kind] ?? item.kind}
        </T>
      </View>
      <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
        {t.inventory.qtyAt(qty, item.location)}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: space.md },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wish: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space.md },
  wishIcon: { width: 48, height: 48, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  saving: { borderWidth: 1, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 4 },
  card: { borderWidth: 1, borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space.md, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { borderWidth: 1, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  tireLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
