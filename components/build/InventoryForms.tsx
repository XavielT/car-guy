import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { mountWheelSet, saveInventoryItem, saveTire, saveWheelSet } from '@/lib/db/buildQueries';
import { inventory as inventoryRepo, tires as tireRepo, vehicles as vehicleRepo, wheelSets as wheelSetRepo } from '@/lib/db/repos';
import type { InventoryItem, Tire, WheelSet } from '@/lib/db/types';
import { parseDecimal } from '@/lib/domain/economy';
import { dotAge, parseTireSize, parseWheelSpec } from '@/lib/domain/tires';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

const numOrNull = (s: string) => (s.trim() ? parseDecimal(s) : null);
const intOrNull = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Math.round(Number(s)) : null);
const s = (v: unknown) => (v == null ? '' : String(v));

function Eyebrow({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
      {children}
    </T>
  );
}

function Title({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
      {children}
    </T>
  );
}

// ----------------------------------------------------------------- item ---

const ITEM_KINDS: InventoryItem['kind'][] = ['pieza', 'fluido', 'herramienta', 'consumible', 'aro', 'goma'];
const CONDITIONS: InventoryItem['condition'][] = ['nuevo', 'usado', 'core'];

/** A part, fluid, tool or consumable on the shelf; "Usar en un mod" turns it into one. */
export function InventoryItemForm({ vehicleId, itemId, onDone }: { vehicleId: string; itemId?: string; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<InventoryItem['kind']>('pieza');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [condition, setCondition] = useState<InventoryItem['condition']>('usado');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [garage, setGarage] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!itemId) return;
    void inventoryRepo.getById(itemId).then((i) => {
      if (!i) return;
      setKind(i.kind);
      setName(i.name);
      setBrand(i.brand ?? '');
      setPartNumber(i.partNumber ?? '');
      setQty(s(i.qty));
      setUnit(i.unit ?? '');
      setCondition(i.condition);
      setLocation(i.location ?? '');
      setCost(s(i.costDop));
      setGarage(i.ownerVehicleId == null);
      setNotes(i.notes);
    });
  }, [itemId]);

  async function save() {
    if (!name.trim()) return null;
    return saveInventoryItem({
      id: itemId,
      ownerVehicleId: garage ? null : vehicleId,
      kind,
      name: name.trim(),
      brand: brand.trim() || null,
      partNumber: partNumber.trim() || null,
      qty: numOrNull(qty) ?? 1,
      unit: unit.trim() || null,
      condition,
      location: location.trim() || null,
      costDop: numOrNull(cost),
      notes: notes.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Title>{itemId ? t.inventory.item.editTitle : t.inventory.item.newTitle}</Title>
      <Eyebrow>{t.inventory.item.kind}</Eyebrow>
      <View style={styles.chips}>
        {ITEM_KINDS.map((k) => (
          <Chip key={k} label={t.inventory.item.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Field label={t.inventory.item.name} value={name} onChangeText={setName} />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.item.brand} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.item.partNumber} value={partNumber} onChangeText={setPartNumber} />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.item.qty} keyboardType="decimal-pad" value={qty} onChangeText={setQty} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.item.unit} value={unit} onChangeText={setUnit} />
        </View>
      </View>
      <Eyebrow>{t.inventory.item.condition}</Eyebrow>
      <View style={styles.chips}>
        {CONDITIONS.map((c) => (
          <Chip key={c} label={t.inventory.item.conditions[c]} selected={condition === c} onPress={() => setCondition(c)} />
        ))}
      </View>
      <Field label={t.inventory.item.location} value={location} onChangeText={setLocation} />
      <Field label={t.inventory.item.cost} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
      <SwitchRow label={t.inventory.item.garage} value={garage} onChange={setGarage} />
      <Field label={t.inventory.item.notes} value={notes} onChangeText={setNotes} multiline />
      <PrimaryButton label={t.inventory.item.save} onPress={() => void save().then((i) => i && onDone())} />
      {itemId ? (
        <GhostButton
          label={t.inventory.useInMod}
          onPress={() => void save().then((i) => i && router.replace({ pathname: '/mod/nuevo', params: { vehicleId, fromInventory: i.id } }))}
        />
      ) : null}
      {itemId ? <GhostButton danger label={t.inventory.item.delete} onPress={() => void inventoryRepo.softDelete(itemId).then(onDone)} /> : null}
    </ScrollView>
  );
}

// ------------------------------------------------------------ wheel set ---

const SET_STATUSES: WheelSet['status'][] = ['montado', 'guardado', 'vendido'];

/** A set of wheels ("15x8 ET0 · 4x100 · CB 54.1"), its tires, and "Montar en <vehículo>". */
export function WheelSetForm({ vehicleId, setId, onDone }: { vehicleId: string; setId?: string; onDone: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [bolt, setBolt] = useState('');
  const [bore, setBore] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [qty, setQty] = useState('4');
  const [status, setStatus] = useState<WheelSet['status']>('guardado');
  const [notes, setNotes] = useState('');
  const [tires, setTires] = useState<Tire[]>([]);
  const [vehicleName, setVehicleName] = useState('');

  useEffect(() => {
    void vehicleRepo.getById(vehicleId).then((v) => setVehicleName(v?.name ?? ''));
    if (!setId) return;
    void (async () => {
      const [w, ts] = await Promise.all([wheelSetRepo.getById(setId), tireRepo.listWhere({ wheelSetId: setId })]);
      if (!w) return;
      setName(w.name);
      setSpec(w.widthIn && w.diamIn ? `${w.diamIn}x${w.widthIn}${w.offsetMm != null ? ` ET${w.offsetMm}` : ''}` : '');
      setBolt(w.boltPattern ?? '');
      setBore(s(w.centerBoreMm));
      setBrand(w.brand ?? '');
      setModel(w.model ?? '');
      setQty(s(w.qty));
      setStatus(w.status);
      setNotes(w.notes);
      setTires(ts);
    })();
  }, [vehicleId, setId]);

  const parsed = parseWheelSpec(spec);

  async function save() {
    if (!name.trim()) return null;
    return saveWheelSet({
      id: setId,
      vehicleId,
      name: name.trim(),
      widthIn: parsed.widthIn,
      diamIn: parsed.diamIn,
      offsetMm: parsed.offsetMm,
      boltPattern: bolt.trim() || null,
      centerBoreMm: numOrNull(bore),
      brand: brand.trim() || null,
      model: model.trim() || null,
      qty: intOrNull(qty) ?? 4,
      status,
      notes: notes.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Title>{setId ? t.inventory.wheel.editTitle : t.inventory.wheel.newTitle}</Title>
      <Field label={t.inventory.wheel.name} placeholder={t.inventory.wheel.namePlaceholder} value={name} onChangeText={setName} />
      <Field
        label={t.inventory.wheel.spec}
        value={spec}
        onChangeText={setSpec}
        hint={parsed.widthIn || parsed.diamIn ? [parsed.diamIn && `${parsed.diamIn}"`, parsed.widthIn && `${parsed.widthIn}J`, parsed.offsetMm != null && `ET${parsed.offsetMm}`].filter(Boolean).join(' · ') : undefined}
      />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.wheel.boltPattern} value={bolt} onChangeText={setBolt} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.wheel.centerBore} keyboardType="decimal-pad" value={bore} onChangeText={setBore} />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.wheel.brand} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.wheel.model} value={model} onChangeText={setModel} />
        </View>
      </View>
      <Field label={t.inventory.wheel.qty} keyboardType="number-pad" value={qty} onChangeText={setQty} />
      <Eyebrow>{t.inventory.wheel.status}</Eyebrow>
      <View style={styles.chips}>
        {SET_STATUSES.map((st) => (
          <Chip key={st} label={t.inventory.setStatus[st]} selected={status === st} onPress={() => setStatus(st)} />
        ))}
      </View>
      <Field label={t.inventory.wheel.notes} value={notes} onChangeText={setNotes} multiline />
      {tires.length ? (
        <>
          <Eyebrow>{t.inventory.wheel.tiresOn}</Eyebrow>
          {tires.map((tire) => (
            <T key={tire.id} face="mono" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: 4 }}>
              {[t.inventory.positions[tire.position], tire.size, tire.dotCode ? `DOT ${tire.dotCode}` : null].filter(Boolean).join(' · ')}
            </T>
          ))}
        </>
      ) : null}
      <PrimaryButton label={t.inventory.wheel.save} onPress={() => void save().then((w) => w && onDone())} />
      {setId && status !== 'montado' && status !== 'vendido' ? (
        <GhostButton label={t.inventory.mountOn(vehicleName)} onPress={() => void save().then((w) => w && mountWheelSet(w.id).then(onDone))} />
      ) : null}
      {setId ? <GhostButton label={t.inventory.addTire} onPress={() => router.push({ pathname: '/goma/[id]', params: { id: 'nuevo', vehicleId, setId } })} /> : null}
      {setId ? <GhostButton danger label={t.inventory.wheel.delete} onPress={() => void wheelSetRepo.softDelete(setId).then(onDone)} /> : null}
    </ScrollView>
  );
}

// ----------------------------------------------------------------- tire ---

const POSITIONS: Tire['position'][] = ['fl', 'fr', 'rl', 'rr', 'spare', 'unmounted'];
const TIRE_STATUSES: Tire['status'][] = ['nueva', 'en_uso', 'guardada', 'quemada', 'vendida'];

/** One tire: size parsed as you type, the DOT decoded ("sem 23/2023 · 3.3 años"), set and corner. */
export function TireForm({ vehicleId, tireId, initialSetId, onDone }: { vehicleId: string; tireId?: string; initialSetId?: string | null; onDone: () => void }) {
  const { theme } = useTheme();
  const [sets, setSets] = useState<WheelSet[]>([]);
  const [size, setSize] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [dot, setDot] = useState('');
  const [compound, setCompound] = useState('');
  const [treadwear, setTreadwear] = useState('');
  const [treadNew, setTreadNew] = useState('');
  const [treadNow, setTreadNow] = useState('');
  const [heat, setHeat] = useState('0');
  const [setId, setSetId] = useState<string | null>(initialSetId ?? null);
  const [position, setPosition] = useState<Tire['position']>('unmounted');
  const [status, setStatus] = useState<Tire['status']>('nueva');
  const [cost, setCost] = useState('');

  useEffect(() => {
    void wheelSetRepo.listWhere({ vehicleId }).then(setSets);
    if (!tireId) return;
    void tireRepo.getById(tireId).then((t) => {
      if (!t) return;
      setSize(t.size ?? '');
      setBrand(t.brand ?? '');
      setModel(t.model ?? '');
      setDot(t.dotCode ?? '');
      setCompound(t.compound ?? '');
      setTreadwear(s(t.treadwear));
      setTreadNew(s(t.treadMmNew));
      setTreadNow(s(t.treadMmCurrent));
      setHeat(s(t.heatCycles));
      setSetId(t.wheelSetId);
      setPosition(t.position);
      setStatus(t.status);
      setCost(s(t.costDop));
    });
  }, [vehicleId, tireId]);

  const parsed = parseTireSize(size);
  const age = dotAge(dot);
  const ageText = !age ? null : 'legacy' in age ? t.inventory.dotOld : t.inventory.dot(age.week, age.year, age.ageYears.toFixed(1));

  async function save() {
    const d = age && !('legacy' in age) ? age : null;
    await saveTire({
      id: tireId,
      vehicleId,
      wheelSetId: setId,
      size: size.trim() || null,
      widthMm: parsed.width,
      aspect: parsed.aspect,
      rimIn: parsed.rim,
      loadIndex: parsed.load,
      speedRating: parsed.speed,
      brand: brand.trim() || null,
      model: model.trim() || null,
      dotCode: dot.trim() || null,
      dotWeek: d?.week ?? null,
      dotYear: d?.year ?? null,
      compound: compound.trim() || null,
      treadwear: intOrNull(treadwear),
      treadMmNew: numOrNull(treadNew),
      treadMmCurrent: numOrNull(treadNow),
      heatCycles: intOrNull(heat) ?? 0,
      position,
      status,
      costDop: numOrNull(cost),
    });
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Title>{tireId ? t.inventory.tire.editTitle : t.inventory.tire.newTitle}</Title>
      <Field
        label={t.inventory.tire.size}
        value={size}
        onChangeText={setSize}
        autoCapitalize="characters"
        hint={parsed.width && parsed.aspect && parsed.rim ? t.inventory.tire.sizeParsed(String(parsed.width), `${parsed.aspect}${parsed.aspectAssumed ? '*' : ''}`, String(parsed.rim)) : undefined}
      />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.brand} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.model} value={model} onChangeText={setModel} />
        </View>
      </View>
      <Field label={t.inventory.tire.dot} keyboardType="number-pad" value={dot} onChangeText={setDot} hint={ageText ?? undefined} error={age?.flag && ageText ? `${ageText} — más de 6 años` : undefined} />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.compound} value={compound} onChangeText={setCompound} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.treadwear} keyboardType="number-pad" value={treadwear} onChangeText={setTreadwear} />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.treadNew} keyboardType="decimal-pad" value={treadNew} onChangeText={setTreadNew} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.inventory.tire.treadNow} keyboardType="decimal-pad" value={treadNow} onChangeText={setTreadNow} />
        </View>
      </View>
      <Field label={t.inventory.tire.heatCycles} keyboardType="number-pad" value={heat} onChangeText={setHeat} />
      <Eyebrow>{t.inventory.tire.set}</Eyebrow>
      <View style={styles.chips}>
        <Chip label={t.inventory.tire.noSet} selected={!setId} onPress={() => setSetId(null)} />
        {sets.map((w) => (
          <Chip key={w.id} label={w.name} selected={setId === w.id} onPress={() => setSetId(w.id)} />
        ))}
      </View>
      <Eyebrow>{t.inventory.tire.position}</Eyebrow>
      <View style={styles.chips}>
        {POSITIONS.map((p) => (
          <Chip key={p} label={t.inventory.positions[p]} selected={position === p} onPress={() => setPosition(p)} />
        ))}
      </View>
      <Eyebrow>{t.inventory.tire.status}</Eyebrow>
      <View style={styles.chips}>
        {TIRE_STATUSES.map((st) => (
          <Chip key={st} label={t.inventory.tireStatus[st]} selected={status === st} onPress={() => setStatus(st)} />
        ))}
      </View>
      <Field label={t.inventory.tire.cost} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
        {parsed.aspectAssumed ? t.inventory.tire.aspectAssumed : ''}
      </T>
      <PrimaryButton label={t.inventory.tire.save} onPress={() => void save()} />
      {tireId ? <GhostButton danger label={t.inventory.tire.delete} onPress={() => void tireRepo.softDelete(tireId).then(onDone)} /> : null}
    </ScrollView>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm }}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
        {label}
      </T>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
});
