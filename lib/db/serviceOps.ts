import { enqueue } from './client';
import {
  expenses as expenseRepo,
  parts as partRepo,
  reminders as reminderRepo,
  serviceRecordItems as itemRepo,
  serviceRecords as serviceRecordRepo,
} from './repos';
import type { ExpenseCategory, ServiceKind } from './types';
import { completeLegal, describeReset, resetForServiceItems } from '../domain/reminders';
import { id as newId } from '../format';

export type PartDraft = {
  id?: string;
  name: string;
  partNumber?: string | null;
  brand?: string | null;
  quantity: number;
  unitCostDop?: number | null;
};

export type ServiceDraft = {
  id?: string;
  vehicleId: string;
  kind: ServiceKind;
  occurredAt: string;
  odometerKm: number | null;
  title: string;
  description: string;
  costPartsDop: number;
  costLaborDop: number;
  totalDop: number;
  shop: string;
  warrantyUntilDate: string | null;
  warrantyUntilKm: number | null;
  sourceTaskId?: string | null;
  sourceInspectionId?: string | null;
  /** Catalog items done in this visit — these drive the reminder resets. */
  serviceTypeIds: string[];
  parts: PartDraft[];
};

export type SaveResult = {
  id: string;
  /** Human-readable lines for the summary sheet, e.g. "Aceite de motor → 57,000 km". */
  resets: string[];
};

/**
 * Saves a service record and everything it implies, in one transaction.
 *
 * The reminder resets are the point of the whole feature: logging an oil change
 * is only useful if the app stops asking for one. They run here rather than in
 * the screen so that a record saved from anywhere — the form, a task, a failed
 * inspection in PROMPT-05 — re-arms the same reminders the same way.
 */
export async function saveServiceRecord(draft: ServiceDraft): Promise<SaveResult> {
  const recordId = draft.id ?? newId();

  const resets = await enqueue(async (db) => {
    await serviceRecordRepo.upsert(
      {
        id: recordId,
        vehicleId: draft.vehicleId,
        kind: draft.kind,
        occurredAt: draft.occurredAt,
        odometerKm: draft.odometerKm,
        title: draft.title,
        description: draft.description,
        costPartsDop: draft.costPartsDop,
        costLaborDop: draft.costLaborDop,
        totalDop: draft.totalDop,
        shop: draft.shop,
        warrantyUntilDate: draft.warrantyUntilDate,
        warrantyUntilKm: draft.warrantyUntilKm,
        sourceTaskId: draft.sourceTaskId ?? null,
        sourceInspectionId: draft.sourceInspectionId ?? null,
      },
      db,
    );

    // Items and parts are replaced wholesale: an edit that removed one has to
    // remove it here too, and there are only ever a handful.
    for (const existing of await itemRepo.listWhere({ serviceRecordId: recordId })) {
      await itemRepo.softDelete(existing.id, db);
    }
    for (const serviceTypeId of draft.serviceTypeIds) {
      await itemRepo.upsert(
        { id: `${recordId}__${serviceTypeId}`, serviceRecordId: recordId, serviceTypeId, deletedAt: null },
        db,
      );
    }

    for (const existing of await partRepo.listWhere({ serviceRecordId: recordId })) {
      await partRepo.softDelete(existing.id, db);
    }
    for (const part of draft.parts) {
      await partRepo.upsert(
        {
          id: part.id,
          serviceRecordId: recordId,
          name: part.name,
          partNumber: part.partNumber ?? null,
          brand: part.brand ?? null,
          quantity: part.quantity,
          unitCostDop: part.unitCostDop ?? null,
          deletedAt: null,
        },
        db,
      );
    }

    if (draft.serviceTypeIds.length === 0) return [];

    const vehicleReminders = await reminderRepo.listWhere({ vehicleId: draft.vehicleId });
    const patches = resetForServiceItems(vehicleReminders, draft.serviceTypeIds, {
      date: draft.occurredAt,
      km: draft.odometerKm,
      recordId,
    });

    for (const { patch } of patches) {
      await reminderRepo.upsert(patch, db);
    }
    return patches.map(({ reminder, patch }) => describeReset(reminder, patch));
  });

  return { id: recordId, resets };
}

export type ExpenseDraft = {
  id?: string;
  vehicleId: string;
  occurredAt: string;
  odometerKm: number | null;
  category: ExpenseCategory;
  amountDop: number;
  description: string;
  vendor: string;
};

/** Expense categories that *are* the renewal of a legal obligation. */
const LEGAL_BY_CATEGORY: Partial<Record<ExpenseCategory, string>> = {
  marbete: 'marbete',
  seguro: 'seguro',
};

/**
 * Saves an expense, and treats paying for the marbete or the insurance as
 * renewing it — because it is. Someone who records "Marbete · RD$1,500" has
 * already been to the bank; making them also tick the reminder asks twice for
 * the same fact.
 */
export async function saveExpense(draft: ExpenseDraft): Promise<SaveResult> {
  const expenseId = draft.id ?? newId();

  const resets = await enqueue(async (db) => {
    await expenseRepo.upsert(
      {
        id: expenseId,
        vehicleId: draft.vehicleId,
        occurredAt: draft.occurredAt,
        odometerKm: draft.odometerKm,
        category: draft.category,
        amountDop: draft.amountDop,
        description: draft.description,
        vendor: draft.vendor,
      },
      db,
    );

    const legalKind = LEGAL_BY_CATEGORY[draft.category];
    if (!legalKind) return [];

    const vehicleReminders = await reminderRepo.listWhere({ vehicleId: draft.vehicleId });
    const patches = completeLegal(vehicleReminders, legalKind, {
      date: draft.occurredAt,
      km: draft.odometerKm,
    });
    for (const { patch } of patches) {
      await reminderRepo.upsert(patch, db);
    }
    return patches.map(({ reminder, patch }) => describeReset(reminder, patch));
  });

  return { id: expenseId, resets };
}

/** Shops the user has typed before, newest first — cheap autocomplete. */
export async function shopSuggestions(vehicleId: string): Promise<string[]> {
  const records = await serviceRecordRepo.list(vehicleId, {
    orderBy: 'occurred_at',
    direction: 'DESC',
    limit: 50,
  });
  const seen: string[] = [];
  for (const record of records) {
    const shop = record.shop.trim();
    if (shop && !seen.includes(shop)) seen.push(shop);
  }
  return seen.slice(0, 6);
}
