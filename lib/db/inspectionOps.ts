import { enqueue } from './client';
import {
  inspectionItems as itemRepo,
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
import { baseTemplateId, scopedTemplateId, taskPriorityFor } from '../domain/inspections';

export { baseTemplateId, scopedTemplateId };
import { id as newId } from '../format';

export type Answer = {
  item: InspectionItem;
  result: 'ok' | 'falla' | 'na';
  note: string;
  mediaId: string | null;
  /** What to do about a failure. Defaults to the item's own `on_fail`. */
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

  const created = await enqueue(async (db) => {
    await inspectionRepo.upsert(
      {
        id: inspectionId,
        vehicleId: draft.vehicleId,
        templateId: draft.templateId,
        occurredAt: draft.occurredAt,
        odometerKm: draft.odometerKm,
        status: failures.length ? 'con_fallas' : 'ok',
        durationSec: draft.durationSec,
        notes: '',
      },
      db,
    );

    for (const answer of draft.answers) {
      await resultRepo.upsert(
        {
          id: resultIdFor(inspectionId, answer.item.id),
          inspectionId,
          itemId: answer.item.id,
          // Snapshotted: templates can be edited later, and a past run should
          // keep saying what it actually asked.
          labelSnapshot: answer.item.label,
          result: answer.result,
          note: answer.note,
          mediaId: answer.mediaId,
        },
        db,
      );
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
    for (const failure of failures) {
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
          priority: taskPriorityFor(failure.item.relatedServiceTypeId),
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
    createdTasks: created.titles,
    createdReminders: created.reminderTitles,
  };
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
