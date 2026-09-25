import { addDatabaseChangeListener } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getDb } from './db/client';
import {
  expenses as expenseRepo,
  fuel as fuelRepo,
  reminders as reminderRepo,
  serviceRecords as serviceRecordRepo,
  settings as settingsRepo,
  vehicles as vehicleRepo,
} from './db/repos';
import { resetDatabase } from './db/reset';
import { seedCatalog } from './db/seed';
import { deleteVehicleCascade } from './db/vehicleOps';
import type { Expense as ExpenseRow, ExpenseCategory as NewExpenseCategory, ServiceRecord } from './db/types';
import { id } from './format';
import { lastOdometer } from './math';
import { EMPTY_DATA } from './storage';
import type {
  AppData,
  Expense,
  ExpenseCategory,
  FillUp,
  FuelType,
  MaintenanceReminder,
  Settings,
  Vehicle,
} from './types';

/**
 * The store's surface is unchanged from Tu Combustible RD — same hooks, same
 * selectors, same call signatures — but SQLite is now underneath (ADR-02).
 *
 * That is deliberate: it let the whole persistence layer change in one phase
 * without touching a single screen. PROMPT-04 and PROMPT-06 replace those
 * screens and this legacy shape goes with them.
 *
 * The mutations still return synchronously, generating the id up front and
 * letting the write land in the background. Nothing reads the returned id, and
 * the state refresh comes back through the database change listener.
 */

type Store = {
  ready: boolean;
  data: AppData;
  activeVehicle: Vehicle | null;
  vehicleFillups: FillUp[];
  vehicleExpenses: Expense[];
  vehicleReminders: MaintenanceReminder[];
  setActiveVehicle: (vehicleId: string) => void;
  upsertVehicle: (input: Omit<Vehicle, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteVehicle: (vehicleId: string) => void;
  upsertFillUp: (input: Omit<FillUp, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteFillUp: (fillUpId: string) => void;
  upsertExpense: (input: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteExpense: (expenseId: string) => void;
  upsertReminder: (input: Omit<MaintenanceReminder, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteReminder: (reminderId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  restoreData: (data: Partial<AppData>) => void;
  resetAll: () => void;
  /** Re-read everything from SQLite. The importer calls this when it finishes. */
  refresh: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

/**
 * Runs a background write. Mutations return synchronously to keep the store's
 * original surface, so without this a rejected write would vanish — which is
 * exactly the failure mode that is hardest to diagnose from a screen.
 */
function background(what: string, fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    console.error(`[car-guy] ${what} falló:`, error);
  });
}

/**
 * Legacy `Expense.category` splits across two tables now: maintenance and repair
 * became service records (ADR-09), everything else stayed an expense under a
 * richer category list.
 */
const LEGACY_TO_NEW: Record<Exclude<ExpenseCategory, 'maintenance' | 'repair'>, NewExpenseCategory> = {
  insurance: 'seguro',
  tax: 'impuesto',
  toll: 'peaje',
  parking: 'parqueo',
  wash: 'lavado',
  other: 'otro',
};

const NEW_TO_LEGACY: Record<NewExpenseCategory, ExpenseCategory> = {
  seguro: 'insurance',
  impuesto: 'tax',
  marbete: 'tax',
  multa: 'other',
  peaje: 'toll',
  parqueo: 'parking',
  lavado: 'wash',
  financiamiento: 'other',
  accesorio: 'other',
  grua: 'other',
  otro: 'other',
};

function serviceToLegacyExpense(row: ServiceRecord): Expense {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    occurredAt: row.occurredAt,
    odometerKm: row.odometerKm,
    amountDop: row.totalDop,
    category: row.kind === 'reparacion' ? 'repair' : 'maintenance',
    description: row.title,
    createdAt: row.createdAt,
  };
}

function expenseToLegacy(row: ExpenseRow): Expense {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    occurredAt: row.occurredAt,
    odometerKm: row.odometerKm,
    amountDop: row.amountDop,
    category: NEW_TO_LEGACY[row.category] ?? 'other',
    description: row.description,
    createdAt: row.createdAt,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  // Which table a legacy "expense" id actually lives in, so delete hits the
  // right one without a second round trip.
  const serviceIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [vehicleRows, fuelRows, expenseRows, reminderRows] = await Promise.all([
      vehicleRepo.list(undefined, { orderBy: 'sort_order', direction: 'ASC' }),
      fuelRepo.list(undefined, { orderBy: 'occurred_at', direction: 'DESC' }),
      expenseRepo.list(undefined, { orderBy: 'occurred_at', direction: 'DESC' }),
      reminderRepo.list(undefined, { orderBy: 'created_at', direction: 'DESC' }),
    ]);
    const serviceRows = await serviceRecordRepo.list(undefined, {
      orderBy: 'occurred_at',
      direction: 'DESC',
    });
    const maintenance = serviceRows.filter(
      (r) => r.kind === 'mantenimiento' || r.kind === 'reparacion',
    );
    serviceIds.current = new Set(maintenance.map((r) => r.id));

    const [activeVehicleId, referencePrices, priceWeekLabel] = await Promise.all([
      settingsRepo.get<string | null>('active_vehicle_id', null),
      settingsRepo.get('reference_prices', EMPTY_DATA.settings.referencePrices),
      settingsRepo.get('price_week_label', EMPTY_DATA.settings.priceWeekLabel),
    ]);

    setData({
      vehicles: vehicleRows.map((v) => ({
        id: v.id,
        name: v.name,
        plate: v.plate ?? '',
        defaultFuelType: v.defaultFuelType,
        tankVolume: v.tankVolume,
        createdAt: v.createdAt,
      })),
      fillups: fuelRows.map((f) => ({
        id: f.id,
        vehicleId: f.vehicleId,
        occurredAt: f.occurredAt,
        odometerKm: f.odometerKm,
        volume: f.volume,
        pricePerUnit: f.pricePerUnit,
        totalDop: f.totalDop,
        fuelType: f.fuelType,
        isFullTank: f.isFullTank,
        missedPrevious: f.missedPrevious,
        station: f.station,
        notes: f.notes,
        createdAt: f.createdAt,
      })),
      expenses: [...expenseRows.map(expenseToLegacy), ...maintenance.map(serviceToLegacyExpense)].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
      reminders: reminderRows
        // The catalog and legal reminders seeded in Phase 2 belong to the Phase 5
        // engine, not to the legacy Gastos screen, which can only show a title,
        // a date and a km and would misrepresent them.
        .filter((r) => !r.serviceTypeId && !r.legalKind)
        .map((r) => ({
          id: r.id,
          vehicleId: r.vehicleId,
          title: r.title,
          dueDate: r.dueDate,
          dueOdometerKm: r.dueKm,
          completedAt: r.lastCompletedAt,
          notes: r.notes,
          createdAt: r.createdAt,
        })),
      settings: { activeVehicleId, referencePrices, priceWeekLabel },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getDb();
      await seedCatalog();
      if (cancelled) return;
      await load();
      if (!cancelled) setReady(true);
    })().catch((error: unknown) => {
      // A database that cannot open is not recoverable from here; the app still
      // renders so the user can export or reset rather than facing a blank
      // screen. It must say so, though — swallowing this silently turns a
      // startup failure into "my data disappeared".
      console.error('[car-guy] no se pudo abrir la base de datos:', error);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Any write — from a screen, the importer, or a later sync — re-reads state.
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = addDatabaseChangeListener(() => {
      // A single upsert touches several tables; coalesce the burst.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 60);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [ready, load]);

  const setActiveVehicle = useCallback((vehicleId: string) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, activeVehicleId: vehicleId } }));
    void settingsRepo.set('active_vehicle_id', vehicleId);
  }, []);

  const upsertVehicle = useCallback(
    (input: Omit<Vehicle, 'id' | 'createdAt'> & { id?: string }) => {
      const vehicleId = input.id ?? id();

      // Applied to local state before the write lands, on purpose. Onboarding
      // navigates to (tabs) the instant this returns, and (tabs)/_layout
      // redirects straight back to onboarding while `vehicles` is empty — the
      // two bounce off each other and peg the renderer. The reload below
      // reconciles with whatever SQLite actually stored.
      setData((prev) => {
        const next: Vehicle = {
          id: vehicleId,
          name: input.name,
          plate: input.plate,
          defaultFuelType: input.defaultFuelType,
          tankVolume: input.tankVolume,
          createdAt: new Date().toISOString(),
        };
        const exists = prev.vehicles.some((v) => v.id === vehicleId);
        return {
          ...prev,
          vehicles: exists
            ? prev.vehicles.map((v) => (v.id === vehicleId ? { ...v, ...next } : v))
            : [...prev.vehicles, next],
          settings: {
            ...prev.settings,
            activeVehicleId: prev.settings.activeVehicleId ?? vehicleId,
          },
        };
      });

      background('escritura', async () => {
        await vehicleRepo.upsert({
          id: vehicleId,
          name: input.name,
          plate: input.plate || null,
          defaultFuelType: input.defaultFuelType,
          tankVolume: input.tankVolume,
        });
        const current = await settingsRepo.get<string | null>('active_vehicle_id', null);
        if (!current) await settingsRepo.set('active_vehicle_id', vehicleId);
        await load();
      });
      return vehicleId;
    },
    [load],
  );

  const deleteVehicle = useCallback(
    (vehicleId: string) => {
      background('escritura', async () => {
        // Everything it owns goes with it — records, reminders, tasks, checks,
        // readings, photos — so nothing lingers in totals or in the next sync.
        await deleteVehicleCascade(vehicleId);

        const active = await settingsRepo.get<string | null>('active_vehicle_id', null);
        if (active === vehicleId) {
          const remaining = await vehicleRepo.list();
          await settingsRepo.set('active_vehicle_id', remaining[0]?.id ?? null);
        }
        await load();
      });
    },
    [load],
  );

  const upsertFillUp = useCallback(
    (input: Omit<FillUp, 'id' | 'createdAt'> & { id?: string }) => {
      const fillId = input.id ?? id();

      // Same reasoning as upsertVehicle: the Cargar screen navigates to the
      // history right after saving, and an empty list there reads as data loss.
      setData((prev) => {
        const next = { ...input, id: fillId, createdAt: new Date().toISOString() } as FillUp;
        const exists = prev.fillups.some((f) => f.id === fillId);
        return {
          ...prev,
          fillups: exists
            ? prev.fillups.map((f) => (f.id === fillId ? { ...f, ...next } : f))
            : [next, ...prev.fillups],
        };
      });

      background('escritura', async () => {
        await fuelRepo.upsert({
          id: fillId,
          vehicleId: input.vehicleId,
          occurredAt: input.occurredAt,
          odometerKm: input.odometerKm,
          volume: input.volume,
          pricePerUnit: input.pricePerUnit,
          totalDop: input.totalDop,
          fuelType: input.fuelType,
          isFullTank: input.isFullTank,
          missedPrevious: input.missedPrevious ?? false,
          station: input.station,
          notes: input.notes,
        });
        await load();
      });
      return fillId;
    },
    [load],
  );

  const deleteFillUp = useCallback(
    (fillUpId: string) => {
      background('escritura', async () => {
        await fuelRepo.softDelete(fillUpId);
        await load();
      });
    },
    [load],
  );

  const upsertExpense = useCallback(
    (input: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
      const expenseId = input.id ?? id();
      const asService = input.category === 'maintenance' || input.category === 'repair';
      background('escritura', async () => {
        if (asService) {
          await serviceRecordRepo.upsert({
            id: expenseId,
            vehicleId: input.vehicleId,
            kind: input.category === 'repair' ? 'reparacion' : 'mantenimiento',
            occurredAt: input.occurredAt,
            odometerKm: input.odometerKm,
            title: input.description?.trim() || (input.category === 'repair' ? 'Reparación' : 'Mantenimiento'),
            totalDop: input.amountDop,
          });
        } else {
          await expenseRepo.upsert({
            id: expenseId,
            vehicleId: input.vehicleId,
            occurredAt: input.occurredAt,
            odometerKm: input.odometerKm,
            category: LEGACY_TO_NEW[input.category as keyof typeof LEGACY_TO_NEW] ?? 'otro',
            amountDop: input.amountDop,
            description: input.description,
          });
        }
        await load();
      });
      return expenseId;
    },
    [load],
  );

  const deleteExpense = useCallback(
    (expenseId: string) => {
      background('escritura', async () => {
        if (serviceIds.current.has(expenseId)) await serviceRecordRepo.softDelete(expenseId);
        else await expenseRepo.softDelete(expenseId);
        await load();
      });
    },
    [load],
  );

  const upsertReminder = useCallback(
    (input: Omit<MaintenanceReminder, 'id' | 'createdAt'> & { id?: string }) => {
      const reminderId = input.id ?? id();
      const hasDate = input.dueDate != null;
      const hasKm = input.dueOdometerKm != null;
      background('escritura', async () => {
        await reminderRepo.upsert({
          id: reminderId,
          vehicleId: input.vehicleId,
          title: input.title,
          metric: hasDate && hasKm ? 'both' : hasKm ? 'km' : 'date',
          dueDate: input.dueDate,
          dueKm: input.dueOdometerKm,
          notes: input.notes,
          lastCompletedAt: input.completedAt,
          isEnabled: input.completedAt == null,
        });
        await load();
      });
      return reminderId;
    },
    [load],
  );

  const deleteReminder = useCallback(
    (reminderId: string) => {
      background('escritura', async () => {
        await reminderRepo.softDelete(reminderId);
        await load();
      });
    },
    [load],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      background('escritura', async () => {
        if (patch.activeVehicleId !== undefined) {
          await settingsRepo.set('active_vehicle_id', patch.activeVehicleId);
        }
        if (patch.referencePrices) await settingsRepo.set('reference_prices', patch.referencePrices);
        if (patch.priceWeekLabel !== undefined) {
          await settingsRepo.set('price_week_label', patch.priceWeekLabel);
        }
        await load();
      });
    },
    [load],
  );

  /**
   * Restoring a legacy payload is exactly the legacy import, so it goes through
   * the same code path rather than a second, subtly different one.
   */
  const restoreData = useCallback(
    (incoming: Partial<AppData>) => {
      background('escritura', async () => {
        const { importTuCombustible } = await import('./import/tucombustible');
        await importTuCombustible(incoming, { source: 'file' });
        await load();
      });
    },
    [load],
  );

  const resetAll = useCallback(() => {
    background('escritura', async () => {
      await resetDatabase();
      await seedCatalog();
      await load();
    });
  }, [load]);

  const activeVehicle = useMemo(() => {
    const aid = data.settings.activeVehicleId;
    return data.vehicles.find((v) => v.id === aid) ?? data.vehicles[0] ?? null;
  }, [data.settings.activeVehicleId, data.vehicles]);

  const vehicleFillups = useMemo(() => {
    if (!activeVehicle) return [];
    return data.fillups.filter((f) => f.vehicleId === activeVehicle.id);
  }, [activeVehicle, data.fillups]);

  const vehicleExpenses = useMemo(() => {
    if (!activeVehicle) return [];
    return data.expenses.filter((e) => e.vehicleId === activeVehicle.id);
  }, [activeVehicle, data.expenses]);

  const vehicleReminders = useMemo(() => {
    if (!activeVehicle) return [];
    return data.reminders.filter((r) => r.vehicleId === activeVehicle.id);
  }, [activeVehicle, data.reminders]);

  const value = useMemo<Store>(
    () => ({
      ready,
      data,
      activeVehicle,
      vehicleFillups,
      vehicleExpenses,
      vehicleReminders,
      setActiveVehicle,
      upsertVehicle,
      deleteVehicle,
      upsertFillUp,
      deleteFillUp,
      upsertExpense,
      deleteExpense,
      upsertReminder,
      deleteReminder,
      updateSettings,
      restoreData,
      resetAll,
      refresh: load,
    }),
    [
      ready,
      data,
      activeVehicle,
      vehicleFillups,
      vehicleExpenses,
      vehicleReminders,
      setActiveVehicle,
      upsertVehicle,
      deleteVehicle,
      upsertFillUp,
      deleteFillUp,
      upsertExpense,
      deleteExpense,
      upsertReminder,
      deleteReminder,
      updateSettings,
      restoreData,
      resetAll,
      load,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}

export function useOdometerHint(): number | null {
  const { vehicleFillups } = useStore();
  return lastOdometer(vehicleFillups);
}

export function defaultFuelForNewLoad(vehicle: Vehicle | null): FuelType {
  return vehicle?.defaultFuelType ?? 'regular';
}
