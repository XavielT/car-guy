import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { id } from './format';
import { lastOdometer } from './math';
import { EMPTY_DATA, loadData, normalizeData, saveData } from './storage';
import type { AppData, Expense, FillUp, FuelType, MaintenanceReminder, Settings, Vehicle } from './types';

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
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY_DATA);

  useEffect(() => {
    loadData().then((loaded) => {
      setData(loaded);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveData(data).catch(() => {});
  }, [data, ready]);

  const commit = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => updater(prev));
  }, []);

  const setActiveVehicle = useCallback((vehicleId: string) => {
    commit((prev) => ({
      ...prev,
      settings: { ...prev.settings, activeVehicleId: vehicleId },
    }));
  }, [commit]);

  const upsertVehicle = useCallback((input: Omit<Vehicle, 'id' | 'createdAt'> & { id?: string }) => {
    const vehicleId = input.id ?? id();
    commit((prev) => {
      const next: Vehicle = input.id
        ? { ...(prev.vehicles.find((v) => v.id === input.id) as Vehicle), ...input, id: vehicleId }
        : {
            id: vehicleId,
            name: input.name,
            plate: input.plate,
            defaultFuelType: input.defaultFuelType,
            tankVolume: input.tankVolume,
            createdAt: new Date().toISOString(),
          };
      const vehicles = input.id
        ? prev.vehicles.map((v) => (v.id === vehicleId ? next : v))
        : [...prev.vehicles, next];
      return {
        ...prev,
        vehicles,
        settings: {
          ...prev.settings,
          activeVehicleId: prev.settings.activeVehicleId ?? vehicleId,
        },
      };
    });
    return vehicleId;
  }, [commit]);

  const deleteVehicle = useCallback((vehicleId: string) => {
    commit((prev) => {
      const vehicles = prev.vehicles.filter((v) => v.id !== vehicleId);
      const fillups = prev.fillups.filter((f) => f.vehicleId !== vehicleId);
      const expenses = prev.expenses.filter((e) => e.vehicleId !== vehicleId);
      const reminders = prev.reminders.filter((r) => r.vehicleId !== vehicleId);
      const activeVehicleId =
        prev.settings.activeVehicleId === vehicleId
          ? vehicles[0]?.id ?? null
          : prev.settings.activeVehicleId;
      return { ...prev, vehicles, fillups, expenses, reminders, settings: { ...prev.settings, activeVehicleId } };
    });
  }, [commit]);

  const upsertFillUp = useCallback((input: Omit<FillUp, 'id' | 'createdAt'> & { id?: string }) => {
    const fillId = input.id ?? id();
    commit((prev) => {
      const existing = prev.fillups.find((f) => f.id === fillId);
      const next: FillUp = existing
        ? { ...existing, ...input, id: fillId }
        : { ...input, id: fillId, createdAt: new Date().toISOString() };
      const fillups = existing
        ? prev.fillups.map((f) => (f.id === fillId ? next : f))
        : [next, ...prev.fillups];
      return { ...prev, fillups };
    });
    return fillId;
  }, [commit]);

  const deleteFillUp = useCallback((fillUpId: string) => {
    commit((prev) => ({ ...prev, fillups: prev.fillups.filter((f) => f.id !== fillUpId) }));
  }, [commit]);

  const upsertExpense = useCallback((input: Omit<Expense, 'id' | 'createdAt'> & { id?: string }) => {
    const expenseId = input.id ?? id();
    commit((prev) => {
      const existing = prev.expenses.find((e) => e.id === expenseId);
      const next: Expense = existing
        ? { ...existing, ...input, id: expenseId }
        : { ...input, id: expenseId, createdAt: new Date().toISOString() };
      return {
        ...prev,
        expenses: existing ? prev.expenses.map((e) => (e.id === expenseId ? next : e)) : [next, ...prev.expenses],
      };
    });
    return expenseId;
  }, [commit]);

  const deleteExpense = useCallback((expenseId: string) => {
    commit((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== expenseId) }));
  }, [commit]);

  const upsertReminder = useCallback((input: Omit<MaintenanceReminder, 'id' | 'createdAt'> & { id?: string }) => {
    const reminderId = input.id ?? id();
    commit((prev) => {
      const existing = prev.reminders.find((r) => r.id === reminderId);
      const next: MaintenanceReminder = existing
        ? { ...existing, ...input, id: reminderId }
        : { ...input, id: reminderId, createdAt: new Date().toISOString() };
      return {
        ...prev,
        reminders: existing ? prev.reminders.map((r) => (r.id === reminderId ? next : r)) : [next, ...prev.reminders],
      };
    });
    return reminderId;
  }, [commit]);

  const deleteReminder = useCallback((reminderId: string) => {
    commit((prev) => ({ ...prev, reminders: prev.reminders.filter((r) => r.id !== reminderId) }));
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, [commit]);

  const restoreData = useCallback((incoming: Partial<AppData>) => {
    setData(normalizeData(incoming));
  }, []);

  const resetAll = useCallback(() => {
    setData(structuredClone(EMPTY_DATA));
  }, []);

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
