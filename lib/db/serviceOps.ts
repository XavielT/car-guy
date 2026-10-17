import { enqueue } from './client';
import {
  expenses as expenseRepo,
  media as mediaRepo,
  milestones as milestoneRepo,
  parts as partRepo,
  reminders as reminderRepo,
  serviceMedia as serviceMediaRepo,
  serviceRecordItems as itemRepo,
  serviceRecords as serviceRecordRepo,
  tasks as taskRepo,
} from './repos';
import type { DoneBy, ExpenseCategory, ServiceCategory, ServiceKind, ServiceMediaRole, Task } from './types';
import { isPending } from '../domain/events';
import { EMPTY_OIL, normalizeOil, type OilFields } from '../domain/oil';
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
  /** The contact that did it (IMP 28092026 Phase 5); `shop` keeps its name as text. */
  contactId?: string | null;
  warrantyUntilDate: string | null;
  warrantyUntilKm: number | null;
  sourceTaskId?: string | null;
  sourceInspectionId?: string | null;
  /** v12: who did it. Omitted (a record made from a task or an old link), the stored value stays. */
  doneBy?: DoneBy;
  /** v12: the system a repair touched. Omitted, the stored value stays. */
  system?: ServiceCategory | null;
  /**
   * v12: the photos with their role. When given, the links are replaced wholesale (a slot that was emptied loses its
   * link); omitted, they are left as they are.
   */
  media?: { mediaId: string; role: ServiceMediaRole; sort?: number }[];
  /** v12 (X7): the Pendiente this repair resolves — an event with a pending text, or an open task. */
  resolve?: { kind: 'event' | 'task'; id: string } | null;
  /** Catalog items done in this visit — these drive the reminder resets. */
  serviceTypeIds: string[];
  /**
   * The Aceite block per service item id (IMP 29092026 note 16). When given,
   * every item's four oil columns are written — nulls for an item without an
   * entry. Omitted (a record made from a task or a check), they are left as
   * they are.
   */
  oil?: Record<string, Partial<OilFields>>;
  parts: PartDraft[];
};

export type SaveResult = {
  id: string;
  /** Human-readable lines for the summary sheet, e.g. "Aceite de motor → 57,000 km". */
  resets: string[];
  /** What closing a Pendiente changed, to offer "Deshacer" (v12, X7). */
  resolved?: ResolvedPending;
};

/** The state a resolved Pendiente had before, enough to put it back. */
export type ResolvedPending =
  | { kind: 'event'; id: string; title: string; previous: { resolvedAt: string | null; linkedServiceId: string | null } }
  | { kind: 'task'; id: string; title: string; previous: { status: Task['status']; doneRecordId: string | null } };

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

  let resolved: ResolvedPending | undefined;
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
        ...(draft.contactId !== undefined ? { contactId: draft.contactId } : {}),
        ...(draft.doneBy !== undefined ? { doneBy: draft.doneBy } : {}),
        ...(draft.system !== undefined ? { system: draft.system } : {}),
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
        {
          id: `${recordId}__${serviceTypeId}`,
          serviceRecordId: recordId,
          serviceTypeId,
          deletedAt: null,
          ...(draft.oil ? normalizeOil(draft.oil[serviceTypeId] ?? EMPTY_OIL) : {}),
        },
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

    if (draft.media) {
      // Links are replaced wholesale, like parts: the form shows every slot, so what it sends is the truth.
      for (const existing of await serviceMediaRepo.listWhere({ serviceRecordId: recordId })) {
        await serviceMediaRepo.softDelete(existing.id, db);
      }
      for (const [i, m] of draft.media.entries()) {
        await serviceMediaRepo.upsert(
          { id: `sm_${m.mediaId}`, serviceRecordId: recordId, mediaId: m.mediaId, role: m.role, sort: m.sort ?? i, deletedAt: null },
          db,
        );
      }
    }

    // The Pendiente this repair closes (X7): remember what it was, so "Deshacer" can put it back.
    if (draft.resolve?.kind === 'event') {
      const event = await milestoneRepo.getById(draft.resolve.id);
      if (event) {
        resolved = { kind: 'event', id: event.id, title: event.pending || event.title, previous: { resolvedAt: event.resolvedAt, linkedServiceId: event.linkedServiceId } };
        await milestoneRepo.upsert({ id: event.id, resolvedAt: new Date().toISOString(), linkedServiceId: recordId }, db);
      }
    } else if (draft.resolve?.kind === 'task' && draft.resolve.id !== draft.sourceTaskId) {
      const task = await taskRepo.getById(draft.resolve.id);
      if (task) {
        resolved = { kind: 'task', id: task.id, title: task.title, previous: { status: task.status, doneRecordId: task.doneRecordId } };
        await taskRepo.upsert({ id: task.id, status: 'hecha', doneRecordId: recordId }, db);
      }
    }

    // A task that became a record points back at it, so the task detail can say
    // what closed it and the record is not orphaned from the note that asked
    // for it.
    if (draft.sourceTaskId) {
      await taskRepo.upsert({ id: draft.sourceTaskId, status: 'hecha', doneRecordId: recordId }, db);
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

  return { id: recordId, resets, ...(resolved ? { resolved } : {}) };
}

/** "Pendiente resuelto · Deshacer": puts the event or task back as it was (the record itself stays). */
export async function undoResolvedPending(resolved: ResolvedPending): Promise<void> {
  await enqueue(async (db) => {
    if (resolved.kind === 'event') {
      await milestoneRepo.upsert({ id: resolved.id, resolvedAt: resolved.previous.resolvedAt, linkedServiceId: resolved.previous.linkedServiceId }, db);
    } else {
      await taskRepo.upsert({ id: resolved.id, status: resolved.previous.status, doneRecordId: resolved.previous.doneRecordId }, db);
    }
  });
}

export type PendingChoice = { key: string; kind: 'event' | 'task'; id: string; title: string };

/** What a repair of this vehicle can close: events with a pending text, then open tasks. */
export async function listOpenPendings(vehicleId: string): Promise<PendingChoice[]> {
  const [events, tasks] = await Promise.all([milestoneRepo.listWhere({ vehicleId }), taskRepo.listWhere({ vehicleId })]);
  return [
    ...events.filter(isPending).map((e): PendingChoice => ({ key: `event:${e.id}`, kind: 'event', id: e.id, title: e.pending.trim() })),
    ...tasks.filter((t) => t.status !== 'hecha').map((t): PendingChoice => ({ key: `task:${t.id}`, kind: 'task', id: t.id, title: t.title })),
  ];
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

/**
 * A service's photos with their role: the v12 links in order, then any photo that only has the owner link (an older
 * phone that synced, a maintenance form's single photo) as "other". Deleted media never appear.
 */
export async function loadServiceMedia(recordId: string): Promise<{ mediaId: string; role: ServiceMediaRole }[]> {
  const [links, owned] = await Promise.all([
    serviceMediaRepo.listWhere({ serviceRecordId: recordId }),
    mediaRepo.listWhere({ ownerTable: 'service_record', ownerId: recordId }),
  ]);
  const liveOwned = new Set(owned.filter((m) => m.kind === 'photo').map((m) => m.id));
  const linked = links.filter((l) => liveOwned.has(l.mediaId)).sort((a, b) => a.sort - b.sort).map((l) => ({ mediaId: l.mediaId, role: l.role }));
  const seen = new Set(linked.map((l) => l.mediaId));
  return [...linked, ...[...liveOwned].filter((id) => !seen.has(id)).map((mediaId) => ({ mediaId, role: 'other' as const }))];
}
