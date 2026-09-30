import { enqueue, getDb } from './client';
import {
  inspectionItems as itemRepo,
  media as mediaRepo,
  inspectionResults as resultRepo,
  inspectionTemplates as templateRepo,
  inspections as inspectionRepo,
  odometer as odometerRepo,
  reminders as reminderRepo,
  tasks as taskRepo,
} from './repos';
import type { Cadence, InspectionItem, InspectionTemplate, OnFail, Vehicle } from './types';
import { templateIdsForVehicle } from '../domain/catalog';
import { addDays } from '../domain/dates';
import {
  baseTemplateId,
  inspectionStatusFor,
  needsDetail,
  scopedTemplateId,
  taskPriorityFor,
  type Verdict,
} from '../domain/inspections';
import { t } from '../i18n';

export { baseTemplateId, scopedTemplateId };
import { id as newId } from '../format';

export type Answer = {
  item: InspectionItem;
  result: Verdict;
  note: string;
  /** Legacy single photo; used when `mediaIds` is absent. */
  mediaId: string | null;
  /**
   * Every photo on the answer, in strip order (IMP 29092026 note 3). The first
   * one is also written to `inspection_result.media_id`, so readers that only
   * know the single column keep working.
   */
  mediaIds?: string[];
  /** What to do about a failure (or an ATENCIÓN). Defaults to the item's own `on_fail`. */
  action: OnFail;
};

export type InspectionDraft = {
  /** Chosen by the runner up front, so a photo taken mid-run can already name its owner. */
  id?: string;
  vehicleId: string;
  templateId: string;
  occurredAt: string;
  odometerKm: number | null;
  durationSec: number | null;
  answers: Answer[];
};

/**
 * A result's id, derivable before the result exists: the runner gives it to the
 * photo picker as the photo's owner while the check is still in progress.
 */
export function resultIdFor(inspectionId: string, itemId: string): string {
  return `${inspectionId}__${itemId}`;
}

export type InspectionResultSummary = {
  id: string;
  failures: number;
  /** ATENCIÓN answers: not failures, but worth a look. */
  warnings: number;
  /** Titles of the tasks this run created, for the result screen. */
  createdTasks: string[];
  createdReminders: string[];
};

/**
 * A failure the user chose to be reminded about rather than tracked as a task
 * gets a week: long enough to get to the shop, short enough that the next
 * weekly check will ask again if it was not.
 */
export const FAILURE_REMINDER_DAYS = 7;

/**
 * Saves a completed check: the run, every answer, the odometer reading it
 * produced, and a task for each failure the user wants tracked.
 *
 * The task is the point. Noticing that the coolant is low and then forgetting
 * about it is the same outcome as never looking, so a failure leaves something
 * behind that the home screen will keep showing.
 */
export async function saveInspection(draft: InspectionDraft): Promise<InspectionResultSummary> {
  const inspectionId = draft.id ?? newId();
  const failures = draft.answers.filter((a) => a.result === 'falla');
  const warnings = draft.answers.filter((a) => a.result === 'atencion');

  const created = await enqueue(async (db) => {
    await inspectionRepo.upsert(
      {
        id: inspectionId,
        vehicleId: draft.vehicleId,
        templateId: draft.templateId,
        occurredAt: draft.occurredAt,
        odometerKm: draft.odometerKm,
        status: inspectionStatusFor(draft.answers),
        durationSec: draft.durationSec,
        notes: '',
      },
      db,
    );

    for (const answer of draft.answers) {
      const resultId = resultIdFor(inspectionId, answer.item.id);
      // Only a FALLA or an ATENCIÓN keeps photos: a photo taken before the
      // verdict changed to OK belongs to nothing the user meant to record.
      const keep = needsDetail(answer.result)
        ? (answer.mediaIds ?? (answer.mediaId ? [answer.mediaId] : []))
        : [];
      await resultRepo.upsert(
        {
          id: resultId,
          inspectionId,
          itemId: answer.item.id,
          // Snapshotted: templates can be edited later, and a past run should
          // keep saying what it actually asked.
          labelSnapshot: answer.item.label,
          result: answer.result,
          note: answer.note,
          mediaId: keep[0] ?? null,
        },
        db,
      );
      await reconcileResultPhotos(db, resultId, keep, answer.item.label);
    }

    if (draft.odometerKm != null) {
      await odometerRepo.upsert(
        {
          id: `odo_${inspectionId}`,
          vehicleId: draft.vehicleId,
          occurredAt: draft.occurredAt,
          valueKm: draft.odometerKm,
          source: 'inspection',
          sourceId: inspectionId,
          deletedAt: null,
        },
        db,
      );
    }

    const titles: string[] = [];
    const reminderTitles: string[] = [];
    // An ATENCIÓN creates nothing by default (its action starts at 'none'), but
    // the user may still ask for a task or a reminder.
    for (const failure of [...failures, ...warnings]) {
      if (failure.action === 'none') continue;
      const title = `Revisar ${failure.item.label.toLowerCase()}`;
      if (failure.action === 'reminder') {
        await reminderRepo.upsert(
          {
            vehicleId: draft.vehicleId,
            title,
            serviceTypeId: failure.item.relatedServiceTypeId,
            metric: 'date',
            dueDate: addDays(draft.occurredAt, FAILURE_REMINDER_DAYS),
            isRecurring: false,
            fixedInterval: false,
            isEnabled: true,
            notes: failure.note,
          },
          db,
        );
        reminderTitles.push(title);
        continue;
      }
      await taskRepo.upsert(
        {
          vehicleId: draft.vehicleId,
          title,
          kind: 'reparacion',
          priority: failure.result === 'falla' ? taskPriorityFor(failure.item.relatedServiceTypeId) : 'normal',
          status: 'pendiente',
          notes: failure.note,
          sourceInspectionResultId: resultIdFor(inspectionId, failure.item.id),
        },
        db,
      );
      titles.push(title);
    }
    return { titles, reminderTitles };
  });

  return {
    id: inspectionId,
    failures: failures.length,
    warnings: warnings.length,
    createdTasks: created.titles,
    createdReminders: created.reminderTitles,
  };
}

type Handle = Parameters<Parameters<typeof enqueue>[0]>[0];

/**
 * Photo storage for a result (IMP 29092026 note 3). Every photo is a `media`
 * row owned by the result (owner_table 'inspection_result', owner_id = result
 * id) — the picker already stored them that way while the check was running,
 * so a result's photos are simply "the media it owns". `media_id` keeps the
 * first one for old readers and old runs.
 *
 * Here the owned rows are brought in line with what the user kept: a photo
 * removed from the strip (or left behind by a verdict changed to OK) is
 * soft-deleted, and a kept one without a caption gets "CHEQUEO · <item>" so
 * the album and the viewer say where it came from.
 */
async function reconcileResultPhotos(db: Handle, resultId: string, keep: string[], label: string) {
  const owned = await db.getAllAsync<{ id: string; caption: string | null }>(
    `SELECT id, caption FROM media WHERE owner_table = 'inspection_result' AND owner_id = ? AND deleted_at IS NULL`,
    [resultId],
  );
  const kept = new Set(keep);
  const now = new Date().toISOString();
  for (const row of owned) {
    if (!kept.has(row.id)) await mediaRepo.upsert({ id: row.id, deletedAt: now }, db);
    else if (!row.caption) await mediaRepo.upsert({ id: row.id, caption: t.album.checkCaption(label) }, db);
  }
}

/**
 * Every photo of a run, per result id, in strip order: the result's `media_id`
 * first (the only photo an old run has — found even when it is not owned by
 * the result), then the rest of the media it owns, oldest first.
 */
export async function inspectionPhotos(inspectionId: string): Promise<Record<string, string[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ result_id: string; media_id: string }>(
    `SELECT r.id AS result_id, m.id AS media_id
       FROM inspection_result r
       JOIN media m ON (m.owner_table = 'inspection_result' AND m.owner_id = r.id) OR m.id = r.media_id
      WHERE r.inspection_id = ? AND r.deleted_at IS NULL AND m.deleted_at IS NULL AND m.kind = 'photo'
      ORDER BY r.id, CASE WHEN m.id = r.media_id THEN 0 ELSE 1 END, m.created_at, m.id`,
    [inspectionId],
  );
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.result_id] ??= []).push(r.media_id);
  return out;
}

/**
 * The checklists this vehicle actually uses: its seeded set (§3.5), each one
 * replaced by the vehicle's own copy where it has edited it. Disabled templates
 * are included — the list screen shows them so they can be switched back on.
 */
export async function templatesForVehicle(vehicle: Pick<Vehicle, 'id' | 'type' | 'defaultFuelType'>) {
  const all = await templateRepo.list(undefined, { orderBy: 'id', direction: 'ASC' });
  const byId = new Map(all.map((t) => [t.id, t]));
  return templateIdsForVehicle(vehicle.type, vehicle.defaultFuelType)
    .map((id) => byId.get(scopedTemplateId(id, vehicle.id)) ?? byId.get(id))
    .filter((t): t is InspectionTemplate => t != null);
}

/**
 * Makes sure a template belongs to this vehicle before it is edited, copying a
 * seeded global one — items and all — the first time. Other vehicles keep the
 * defaults, and a re-seed of the catalog never overwrites the user's edits.
 *
 * Returns the id to edit.
 */
export async function ensureVehicleTemplate(templateId: string, vehicleId: string): Promise<string> {
  const template = await templateRepo.getById(templateId);
  if (!template) throw new Error(`No template ${templateId}`);
  if (template.vehicleId === vehicleId) return template.id;

  const copyId = scopedTemplateId(template.id, vehicleId);
  const items = await itemRepo.listWhere({ templateId: template.id }, { orderBy: 'sort_order', direction: 'ASC' });

  await enqueue(async (db) => {
    await templateRepo.upsert(
      {
        id: copyId,
        vehicleId,
        name: template.name,
        cadence: template.cadence,
        vehicleType: template.vehicleType,
        isSeeded: false,
        isEnabled: template.isEnabled,
        deletedAt: null,
      },
      db,
    );
    for (const item of items) {
      await itemRepo.upsert(
        {
          id: `${item.id}@${vehicleId}`,
          templateId: copyId,
          groupName: item.groupName,
          label: item.label,
          how: item.how,
          warning: item.warning,
          requiresColdEngine: item.requiresColdEngine,
          onFail: item.onFail,
          relatedServiceTypeId: item.relatedServiceTypeId,
          sortOrder: item.sortOrder,
          deletedAt: null,
        },
        db,
      );
    }
  });
  return copyId;
}

export type TemplateDraftItem = Pick<
  InspectionItem,
  'groupName' | 'label' | 'how' | 'onFail'
> & {
  /** Missing for an item added in the editor. */
  id?: string;
  /** Unchecked items are removed from the list (soft-deleted). */
  enabled: boolean;
};

/**
 * Writes the editor's result onto a vehicle-scoped template: name, cadence,
 * enabled flag, and the items in their new order. Seeded fields the editor does
 * not show (warning, cold engine, related service) are kept as they were.
 */
export async function saveTemplate(
  templateId: string,
  patch: { name: string; cadence: Cadence; isEnabled: boolean },
  items: TemplateDraftItem[],
): Promise<void> {
  const existing = await itemRepo.listWhere({ templateId });
  const byId = new Map(existing.map((i) => [i.id, i]));

  await enqueue(async (db) => {
    await templateRepo.upsert({ id: templateId, ...patch }, db);

    let order = 0;
    for (const item of items) {
      if (!item.enabled) {
        if (item.id && byId.has(item.id)) await itemRepo.softDelete(item.id, db);
        continue;
      }
      await itemRepo.upsert(
        {
          ...(item.id ? { id: item.id } : {}),
          templateId,
          groupName: item.groupName.trim() || 'Otros',
          label: item.label.trim(),
          how: item.how.trim(),
          onFail: item.onFail,
          sortOrder: order++,
          deletedAt: null,
        },
        db,
      );
    }
  });
}

/** Switches a template on or off for one vehicle, copying it first if seeded. */
export async function setTemplateEnabled(templateId: string, vehicleId: string, isEnabled: boolean) {
  const id = await ensureVehicleTemplate(templateId, vehicleId);
  await templateRepo.upsert({ id, isEnabled });
}
