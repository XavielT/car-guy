import { getDb } from './client';
import {
  inventory as inventoryRepo,
  modCategories,
  modMedia as modMediaRepo,
  mods as modRepo,
  odometer as odometerRepo,
  reminders as reminderRepo,
  settings as settingsRepo,
  specSnapshots,
  specsheets,
  tires as tireRepo,
  wheelSets as wheelSetRepo,
  wishlist as wishlistRepo,
} from './repos';
import type { InventoryItem, Mod, ModCategory, ModMedia, SpecSnapshot, Tire, VehicleSpecsheet, WheelSet, WishlistItem } from './types';
import { jsonObject } from '../domain/album';
import { CATEGORY_SERVICE, cleanSpecs, type Specs } from '../domain/build';
import { resetForServiceItems } from '../domain/reminders';
import { id as newId } from '../format';

/**
 * What the build screens read and write (IMP 28092026 Phase 4). The rules —
 * derived specs, totals, conversion — live in lib/domain/build.ts.
 */

export type BuildData = {
  mods: Mod[];
  categories: ModCategory[];
  /** First photo of each mod (DESPUÉS, else any), for the row thumb. */
  thumbs: Record<string, string>;
  wishlist: WishlistItem[];
  sheet: VehicleSpecsheet | null;
  snapshots: SpecSnapshot[];
  wheelSets: WheelSet[];
  tires: Tire[];
  inventory: InventoryItem[];
};

export async function buildData(vehicleId: string): Promise<BuildData> {
  const db = await getDb();
  const [mods, categories, thumbRows, wishlist, sheet, snapshots, wheelSets, tires, inventory] = await Promise.all([
    modRepo.listWhere({ vehicleId }, { orderBy: 'installed_at', direction: 'DESC' }),
    modCategories.listWhere({}, { orderBy: 'sort_order', direction: 'ASC' }),
    db.getAllAsync<{ mod_id: string; media_id: string; role: string }>(
      `SELECT mm.mod_id, mm.media_id, mm.role FROM mod_media mm JOIN mod ON mod.id = mm.mod_id JOIN media m ON m.id = mm.media_id
        WHERE mod.vehicle_id = ? AND mm.deleted_at IS NULL AND m.deleted_at IS NULL ORDER BY mm.created_at`,
      [vehicleId],
    ),
    wishlistRepo.listWhere({ vehicleId }, { orderBy: 'priority', direction: 'ASC' }),
    specsheets.getForVehicle(vehicleId),
    specSnapshots.listWhere({ vehicleId }, { orderBy: 'as_of', direction: 'DESC' }),
    wheelSetRepo.listWhere({ vehicleId }),
    tireRepo.listWhere({ vehicleId }),
    // This car's items and the garage's loose stock (no owner).
    inventoryRepo.listWhere({}, { orderBy: 'name', direction: 'ASC' }),
  ]);
  const thumbs: Record<string, string> = {};
  for (const r of thumbRows) if (!thumbs[r.mod_id] || r.role === 'despues') thumbs[r.mod_id] = r.media_id;
  const inv = inventory.filter((i) => i.ownerVehicleId == null || i.ownerVehicleId === vehicleId);
  return { mods, categories, thumbs, wishlist, sheet: sheet && !sheet.deletedAt ? sheet : null, snapshots, wheelSets, tires, inventory: inv };
}

// ----------------------------------------------------------------- mods ---

export type ModSave = Partial<Mod> & Pick<Mod, 'vehicleId' | 'categoryId' | 'name'> & { fromWishlistId?: string | null };

/**
 * Saves a mod. An installed mod with a km writes an odometer reading (source
 * `mod`, one per mod — the id is derived so an edit moves it rather than adding
 * another); a mod converted from the wishlist closes that item.
 */
export async function saveMod(input: ModSave): Promise<Mod> {
  const { fromWishlistId, ...draft } = input;
  const effects = cleanSpecs(jsonObject(draft.specEffects ?? '{}')).specs;
  const saved = await modRepo.upsert({
    status: 'instalado',
    installerType: 'yo',
    costPartDop: 0,
    costLaborDop: 0,
    costShippingDop: 0,
    costCustomsDop: 0,
    tags: '[]',
    notes: '',
    deletedAt: null,
    ...draft,
    id: draft.id ?? newId(),
    specEffects: JSON.stringify(effects),
    affectsSpecs: Boolean(draft.affectsSpecs) && Object.keys(effects).length > 0,
  });

  if (saved.status === 'instalado' && saved.installedKm != null && saved.installedAt) {
    await odometerRepo.upsert({
      id: `odo_mod_${saved.id}`,
      vehicleId: saved.vehicleId,
      occurredAt: saved.installedAt,
      valueKm: saved.installedKm,
      source: 'mod',
      sourceId: saved.id,
      deletedAt: null,
    });
  }
  if (fromWishlistId) {
    await wishlistRepo.upsert({ id: fromWishlistId, status: 'convertido', convertedModId: saved.id });
  }
  if (saved.fxRateToDop && saved.currency === 'USD') await settingsRepo.set('last_fx_rate_usd', saved.fxRateToDop);
  return saved;
}

export async function lastFxRate(): Promise<number | null> {
  return settingsRepo.get<number | null>('last_fx_rate_usd', null);
}

export type ModAction =
  | { kind: 'quitar'; at: string; km?: number | null }
  | { kind: 'vender'; at: string; priceDop: number | null; to: string | null }
  | { kind: 'reinstalar' }
  | { kind: 'reclasificar'; categoryId: string }
  | { kind: 'danado'; at: string };

/**
 * The lifecycle from the row's long-press. Nothing is deleted: a removed or
 * sold mod keeps its history (and its cost in "invertido"); reinstalling
 * clears the removal.
 */
export async function modAction(modId: string, action: ModAction): Promise<void> {
  switch (action.kind) {
    case 'quitar':
      return void (await modRepo.upsert({ id: modId, status: 'quitado', removedAt: action.at, removedKm: action.km ?? null }));
    case 'vender':
      return void (await modRepo.upsert({ id: modId, status: 'vendido', removedAt: action.at, soldPriceDop: action.priceDop, soldTo: action.to }));
    case 'danado':
      return void (await modRepo.upsert({ id: modId, status: 'danado', removedAt: action.at }));
    case 'reinstalar':
      return void (await modRepo.upsert({ id: modId, status: 'instalado', removedAt: null, removedKm: null }));
    case 'reclasificar':
      return void (await modRepo.upsert({ id: modId, categoryId: action.categoryId }));
  }
}

export async function modPhotos(modId: string): Promise<ModMedia[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT mm.id FROM mod_media mm JOIN media m ON m.id = mm.media_id WHERE mm.mod_id = ? AND mm.deleted_at IS NULL AND m.deleted_at IS NULL ORDER BY mm.created_at`,
    [modId],
  );
  return (await Promise.all(rows.map((r) => modMediaRepo.getById(r.id)))).filter((r): r is ModMedia => Boolean(r));
}

export async function addModPhotos(modId: string, mediaIds: string[], role: ModMedia['role']): Promise<void> {
  for (const mediaId of mediaIds) await modMediaRepo.upsert({ id: newId(), modId, mediaId, role, deletedAt: null });
}

export async function setModPhotoRole(modMediaId: string, role: ModMedia['role']): Promise<void> {
  await modMediaRepo.upsert({ id: modMediaId, role });
}

export async function removeModPhoto(modMediaId: string): Promise<void> {
  await modMediaRepo.softDelete(modMediaId);
}

/**
 * New gomas / pads / coolant from a mod: the reminders of the matching
 * service type, re-armed from this install. Returned as "what would change" so
 * the form can ask first; `apply` writes it.
 */
export async function reminderResetFor(vehicleId: string, categoryId: string): Promise<{ serviceTypeId: string; titles: string[] } | null> {
  const serviceTypeId = CATEGORY_SERVICE[categoryId];
  if (!serviceTypeId) return null;
  const list = await reminderRepo.listWhere({ vehicleId });
  const hits = list.filter((r) => r.isEnabled && r.serviceTypeId === serviceTypeId);
  return hits.length ? { serviceTypeId, titles: hits.map((r) => r.title) } : null;
}

export async function applyReminderReset(vehicleId: string, serviceTypeId: string, context: { date: string; km: number | null }): Promise<number> {
  const list = await reminderRepo.listWhere({ vehicleId });
  const patches = resetForServiceItems(list, [serviceTypeId], context);
  for (const { patch } of patches) await reminderRepo.upsert(patch);
  return patches.length;
}

// ---------------------------------------------------------------- specs ---

export async function saveStock(vehicleId: string, stock: Specs): Promise<void> {
  await specsheets.upsertForVehicle(vehicleId, { stock: JSON.stringify(cleanSpecs(stock).specs) });
}

/** Sets one override (the "TÚ" source) or clears it with null. */
export async function setOverride(vehicleId: string, key: string, value: string | number | null): Promise<void> {
  const sheet = await specsheets.getForVehicle(vehicleId);
  const overrides = jsonObject(sheet?.overrides);
  if (value == null || value === '') delete overrides[key];
  else overrides[key] = value;
  await specsheets.upsertForVehicle(vehicleId, { overrides: JSON.stringify(cleanSpecs(overrides).specs) });
}

export async function deleteSnapshot(id: string): Promise<void> {
  await specSnapshots.softDelete(id);
}

// ------------------------------------------------------------- wishlist ---

export async function saveWishlistItem(input: Partial<WishlistItem> & Pick<WishlistItem, 'vehicleId' | 'name'>): Promise<WishlistItem> {
  return wishlistRepo.upsert({ priority: 2, status: 'idea', notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
}

// ------------------------------------------------------------ inventory ---

export async function saveInventoryItem(input: Partial<InventoryItem> & Pick<InventoryItem, 'kind' | 'name'>): Promise<InventoryItem> {
  return inventoryRepo.upsert({ qty: 1, condition: 'usado', fitsVehicleIds: '[]', notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
}

export async function saveWheelSet(input: Partial<WheelSet> & Pick<WheelSet, 'vehicleId' | 'name'>): Promise<WheelSet> {
  return wheelSetRepo.upsert({ qty: 4, positionPref: 'any', status: 'guardado', notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
}

/**
 * "Montar en <vehículo>": this set goes on, whatever set was on comes off
 * (guardado), and this set's tires take the four corners in the order they
 * were added when they have no position yet. The tires of the set coming off
 * are stored with it.
 */
export async function mountWheelSet(setId: string): Promise<void> {
  const set = await wheelSetRepo.getById(setId);
  if (!set) return;
  const sets = await wheelSetRepo.listWhere({ vehicleId: set.vehicleId });
  const tires = await tireRepo.listWhere({ vehicleId: set.vehicleId });
  for (const other of sets) {
    if (other.id === setId || other.status !== 'montado') continue;
    await wheelSetRepo.upsert({ id: other.id, status: 'guardado' });
    for (const t of tires.filter((x) => x.wheelSetId === other.id && x.position !== 'spare')) {
      await tireRepo.upsert({ id: t.id, position: 'unmounted', status: t.status === 'en_uso' ? 'guardada' : t.status });
    }
  }
  await wheelSetRepo.upsert({ id: setId, status: 'montado' });
  const corners: Tire['position'][] = ['fl', 'fr', 'rl', 'rr'];
  const mine = tires.filter((t) => t.wheelSetId === setId && t.status !== 'quemada' && t.status !== 'vendida');
  const taken = new Set(mine.map((t) => t.position).filter((p) => corners.includes(p)));
  const free = corners.filter((c) => !taken.has(c));
  for (const t of mine) {
    const position = corners.includes(t.position) ? t.position : t.position === 'spare' ? 'spare' : free.shift() ?? 'unmounted';
    await tireRepo.upsert({ id: t.id, position, status: position === 'unmounted' ? t.status : 'en_uso' });
  }
}

export async function saveTire(input: Partial<Tire> & Pick<Tire, 'vehicleId'>): Promise<Tire> {
  return tireRepo.upsert({ position: 'unmounted', heatCycles: 0, status: 'nueva', deletedAt: null, ...input, id: input.id ?? newId() });
}

export async function moveTire(tireId: string, wheelSetId: string | null, position: Tire['position']): Promise<void> {
  await tireRepo.upsert({ id: tireId, wheelSetId, position });
}
