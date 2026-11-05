/**
 * What Hoy remembers between visits, all local (settings): which next steps were snoozed ("Más tarde", 24 h), whether "Primeros pasos"
 * was hidden, and whether the "¿ver solo lo que usas?" offer was waved away. Nothing leaves the device.
 */
import { settings } from '../db/repos';
import { snooze } from './nextStep';

export const SNOOZE_KEY = 'next_step_snoozed';
export const FIRST_STEPS_HIDDEN_KEY = 'first_steps_hidden';
export const FEATURE_OFFER_DISMISSED_KEY = 'feature_set_offer_dismissed';

export async function readSnoozed(): Promise<Record<string, number>> {
  const v = await settings.get<Record<string, number>>(SNOOZE_KEY, {}).catch((): Record<string, number> => ({}));
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export async function snoozeStep(key: string, now = Date.now()): Promise<Record<string, number>> {
  const next = snooze(await readSnoozed(), key, now);
  await settings.set(SNOOZE_KEY, next).catch(() => {});
  return next;
}

export const readFlag = (key: string) => settings.get<boolean>(key, false).catch(() => false);
export const setFlag = (key: string, value = true) => settings.set(key, value).catch(() => {});
