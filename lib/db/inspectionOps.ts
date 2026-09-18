import { enqueue } from './client';
import {
  inspectionResults as resultRepo,
  inspections as inspectionRepo,
  odometer as odometerRepo,
  tasks as taskRepo,
} from './repos';
import type { InspectionItem } from './types';
import { taskPriorityFor } from '../domain/inspections';
import { id as newId } from '../format';

export type Answer = {
  item: InspectionItem;
  result: 'ok' | 'falla' | 'na';
  note: string;
  mediaId: string | null;
  /** What to do about a failure. Defaults to the item's own `on_fail`. */
  action: 'task' | 'none';
};

export type InspectionDraft = {
  vehicleId: string;
  templateId: string;
  occurredAt: string;
  odometerKm: number | null;
  durationSec: number | null;
  answers: Answer[];
};

export type InspectionResultSummary = {
  id: string;
  failures: number;
  /** Titles of the tasks this run created, for the result screen. */
  createdTasks: string[];
};

/**
 * Saves a completed check: the run, every answer, the odometer reading it
 * produced, and a task for each failure the user wants tracked.
 *
 * The task is the point. Noticing that the coolant is low and then forgetting
 * about it is the same outcome as never looking, so a failure leaves something
 * behind that the home screen will keep showing.
 */
export async function saveInspection(draft: InspectionDraft): Promise<InspectionResultSummary> {
  const inspectionId = newId();
  const failures = draft.answers.filter((a) => a.result === 'falla');

  const createdTasks = await enqueue(async (db) => {
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
    for (const failure of failures) {
      if (failure.action !== 'task') continue;
      const title = `Revisar ${failure.item.label.toLowerCase()}`;
      await taskRepo.upsert(
        {
          vehicleId: draft.vehicleId,
          title,
          kind: 'reparacion',
          priority: taskPriorityFor(failure.item.relatedServiceTypeId),
          status: 'pendiente',
          notes: failure.note,
          sourceInspectionResultId: inspectionId,
        },
        db,
      );
      titles.push(title);
    }
    return titles;
  });

  return { id: inspectionId, failures: failures.length, createdTasks };
}
