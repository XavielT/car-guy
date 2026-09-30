import { UserError } from './diagnostics';
import { t } from './i18n';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { enqueue, getDb } from './db/client';
import { LATEST_VERSION } from './db/migrations';
import { adoptLegacyPrices } from './db/migrationV8';
import { ALL_TABLES, settings as settingsRepo } from './db/repos';
import { fuelForStorage, tankForStorage } from './domain/units';
import { importTuCombustible, type ImportCounts } from './import/tucombustible';

/**
 * Backup v2 — every table, including tombstones.
 *
 * v1 was Tu Combustible RD's `{app, version:1, data: AppData}`. Car Guy still
 * **reads** it forever (decision D1): that file is how an existing user's
 * history arrives, since Car Guy installs as a separate Android app.
 *
 * Media bytes are deliberately excluded. Photos would multiply the file size by
 * orders of magnitude, and the rows keep their `rel_path` / ids so a restore on
 * the same device still finds them.
 */
const BACKUP_VERSION = 2;

const KNOWN_APPS = ['car-guy', 'tu-combustible-rd'] as const;

export type BackupV2 = {
  app: 'car-guy';
  version: 2;
  exportedAt: string;
  /** Excluded on purpose — see the note above. */
  mediaBytesIncluded: false;
  /**
   * PRAGMA user_version of the database the rows came from (2.2 and later).
   * Missing = before v6, when volumes were gallons: restoreV2 converts them.
   */
  schemaVersion?: number;
  tables: Record<string, Record<string, unknown>[]>;
  setting: { key: string; value: string; updatedAt: string }[];
};

export type RestoreCounts = { merged: number; tables: number };

function filename(): string {
  return `car-guy-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Exported for the dev fixture (__tests__/dev/garage.test.ts); the app only calls exportBackup. */
export async function buildBackup(): Promise<BackupV2> {
  const db = await getDb();
  const tables: BackupV2['tables'] = {};

  for (const table of ALL_TABLES) {
    // Tombstones included: a restore that dropped them would resurrect rows the
    // user deleted, which is the classic sync bug this schema exists to avoid.
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    tables[table] =
      table === 'media' ? rows.map(({ blob: _blob, thumb_blob: _thumb, ...rest }) => rest) : rows;
  }

  return {
    app: 'car-guy',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    mediaBytesIncluded: false,
    schemaVersion: LATEST_VERSION,
    tables,
    setting: await settingsRepo.all(),
  };
}

/**
 * Writes the backup and hands it to the user.
 *
 * Two completely different mechanisms, because there is no shared one:
 * `expo-file-system` has no web implementation at all in SDK 57 — its web module
 * is a stub whose File constructor only warns — so the web path builds a Blob
 * and clicks an `<a download>` instead. Before this, exporting on web threw and
 * the alert blamed the file write.
 */
export async function exportBackup(): Promise<boolean> {
  const json = JSON.stringify(await buildBackup(), null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }

  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, filename());
  file.create({ overwrite: true });
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) return false;
  // expo-sharing only accepts a file:// URL — it builds its own content:// URI
  // through SharingFileProvider. Passing file.contentUri makes it throw.
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Guardar respaldo de Car Guy',
    mimeType: 'application/json',
  });
  return true;
}

export type ImportResult =
  | { kind: 'legacy'; counts: ImportCounts }
  | { kind: 'v2'; counts: RestoreCounts };

/** Reads the picked file as text on either platform. */
async function readPickedFile(uri: string, file?: File): Promise<string> {
  if (Platform.OS === 'web') {
    // DocumentPicker on web hands back a real File object alongside the blob URI.
    if (file) return file.text();
    const response = await fetch(uri);
    return response.text();
  }
  const { File: FsFile } = await import('expo-file-system');
  return new FsFile(uri).text();
}

/**
 * Merges a v2 backup: upsert by id, last write wins on `updated_at`, nothing is
 * ever wiped. A row that is older in the file than in the database is skipped,
 * so restoring an old backup onto a newer device cannot undo recent work.
 *
 * "Reemplazar todo" is a separate, explicitly destructive action — see
 * lib/db/reset.ts.
 */
export async function restoreV2(backup: BackupV2): Promise<RestoreCounts> {
  let merged = 0;
  let touchedTables = 0;
  // A 2.1.x backup holds gallons; this database holds liters (v6).
  const tables = (backup.schemaVersion ?? 0) >= 6 ? backup.tables : backupInLiters(backup.tables);

  await enqueue(async (db) => {
    for (const table of ALL_TABLES) {
      const rows = tables?.[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      touchedTables += 1;

      for (const row of rows) {
        const id = row.id as string | undefined;
        if (!id) continue;

        const existing = await db.getFirstAsync<{ updated_at: string }>(
          `SELECT updated_at FROM ${table} WHERE id = ?`,
          [id],
        );
        if (existing && String(existing.updated_at) >= String(row.updated_at ?? '')) continue;

        const columns = Object.keys(row);
        const updates = columns
          .filter((c) => c !== 'id')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ');
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
          columns.map((c) => row[c]) as never,
        );
        merged += 1;
      }
    }

    for (const s of backup.setting ?? []) {
      await db.runAsync(
        `INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [s.key, s.value, s.updatedAt],
      );
    }

    // A backup from before v8 (2.3.x) carries its prices as two settings and its
    // accidents as a milestone kind: move them the way migration v8 does — prices
    // only when this database has none of its own yet.
    if ((backup.schemaVersion ?? 0) < 8) {
      await db.runAsync(
        `UPDATE milestone SET event_type = 'accidente', severity = 'moderado' WHERE kind = 'accidente' AND event_type = 'hito'`,
      );
      await adoptLegacyPrices(db);
    }
  });

  return { merged, tables: touchedTables };
}

/**
 * Picks a file and restores it, choosing the path by what the file says it is:
 * version 2 merges, version 1 (or a raw legacy blob) goes through the Tu
 * Combustible RD importer.
 */
export async function importBackup(): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const text = await readPickedFile(asset.uri, (asset as { file?: File }).file);
  // A broken, empty or non-JSON file would otherwise surface the engine's own
  // English ("Unexpected token 'h'…") straight onto the screen.
  let parsed: Partial<BackupV2> & Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UserError(t.backup.notJson);
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new UserError(t.backup.notBackup);
  }

  if (parsed.app === 'car-guy' && parsed.version === 2) {
    return { kind: 'v2', counts: await restoreV2(parsed as BackupV2) };
  }
  // Ours, but a format this build does not know — never hand it to the legacy
  // importer, which would call it "not a Tu Combustible RD backup".
  if (parsed.app === 'car-guy') throw new UserError(t.backup.unknownVersion(String(parsed.version)));

  const looksLegacy =
    (typeof parsed.app === 'string' && (KNOWN_APPS as readonly string[]).includes(parsed.app)) ||
    parsed.vehicles != null ||
    parsed.fillups != null ||
    parsed.data != null;

  if (looksLegacy) {
    return { kind: 'legacy', counts: await importTuCombustible(parsed, { source: 'file' }) };
  }

  throw new UserError(t.backup.notBackup);
}

/**
 * A pre-v6 backup's rows as v6 stores them: fuel volumes and prices, and the
 * tank, from gallons to liters (GNV stays m³), keeping what was typed —
 * the same conversion migration v6 ran on the device (lib/db/migrationV6.ts).
 * Exported for the round-trip test.
 */
export function backupInLiters(tables: BackupV2['tables']): BackupV2['tables'] {
  if (!tables) return tables;
  const out = { ...tables };
  if (Array.isArray(tables.fuel_log)) {
    out.fuel_log = tables.fuel_log.map((row) => {
      if (row.volume_entered != null) return row;
      const stored = fuelForStorage(
        { volume: Number(row.volume), pricePerUnit: Number(row.price_per_unit), fuelType: String(row.fuel_type) },
        'gal',
      );
      return {
        ...row,
        volume: stored.volume,
        price_per_unit: stored.pricePerUnit,
        volume_entered: stored.volumeEntered,
        volume_entered_unit: stored.volumeEnteredUnit,
      };
    });
  }
  if (Array.isArray(tables.vehicle)) {
    out.vehicle = tables.vehicle.map((row) => {
      if (row.tank_volume == null || row.tank_volume_entered != null) return row;
      const tank = tankForStorage(Number(row.tank_volume), 'gal', String(row.default_fuel_type));
      return { ...row, tank_volume: tank.tankVolume, tank_volume_entered: tank.tankVolumeEntered };
    });
  }
  return out;
}
