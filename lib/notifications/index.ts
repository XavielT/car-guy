import { Platform } from 'react-native';

import { evaluatedReminders } from '../db/reminderQueries';
import { inspectionTemplates as templateRepo, settings as settingsRepo } from '../db/repos';
import { todayIso } from '../domain/dates';
import { isMarbeteWindowOpen, marbeteNudges } from '../domain/legal-dr';
import { displayDueDate } from '../domain/reminders';
import { planNotifications, type PlannedNotification } from './plan';

/**
 * The thin adapter over expo-notifications (ADR-07).
 *
 * Everything decidable lives in `plan.ts` and is tested; this file only talks to
 * the OS. Every call is guarded for web, where expo-notifications does not exist
 * at all — the same due computation feeds the in-app banners there instead.
 */

export const CHANNEL_ID = 'mantenimiento';

export type NotificationSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  /** 1 = Sunday, per expo-notifications. */
  weeklyWeekday: number;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: 9,
  minute: 0,
  weeklyWeekday: 1,
};

const SETTINGS_KEY = 'notifications';

export async function getSettings(): Promise<NotificationSettings> {
  return settingsRepo.get<NotificationSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export async function setSettings(next: NotificationSettings): Promise<void> {
  await settingsRepo.set(SETTINGS_KEY, next);
}

const supported = () => Platform.OS !== 'web';

/**
 * Sets up the handler and the Android channel.
 *
 * The channel has to exist *before* the permission prompt: on Android 13+ the
 * system only shows the prompt once there is a channel to attach it to.
 */
export async function configure(): Promise<void> {
  if (!supported()) return;
  const N = await import('expo-notifications');

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Mantenimiento y chequeos',
      // DEFAULT, not MAX: this is a reminder to check the coolant, not an alarm.
      importance: N.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks for permission. Called the first time the user turns notifications on. */
export async function requestPermission(): Promise<boolean> {
  if (!supported()) return false;
  const N = await import('expo-notifications');
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Rebuilds the whole schedule from the current data.
 *
 * Deterministic ids mean re-scheduling replaces rather than duplicates, and
 * anything no longer in the plan is cancelled — so this can be called after
 * every write without bookkeeping.
 */
export async function resync(vehicleId: string): Promise<PlannedNotification[]> {
  if (!supported()) return [];

  const config = await getSettings();
  if (!config.enabled) {
    await cancelAll();
    return [];
  }

  const today = todayIso();
  const [reminders, templates] = await Promise.all([
    evaluatedReminders(vehicleId, today),
    templateRepo.list(),
  ]);

  const plan = planNotifications({
    today,
    hour: config.hour,
    minute: config.minute,
    weeklyWeekday: config.weeklyWeekday,
    reminders: reminders.map(({ reminder, status }) => ({
      id: reminder.id,
      title: reminder.title,
      dueDate: reminder.dueDate,
      predictedDueDate: displayDueDate(reminder, status),
      status: status.status,
    })),
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      cadence: t.cadence,
      enabled: t.isEnabled,
    })),
    marbeteNudges: isMarbeteWindowOpen(today) ? marbeteNudges(today) : [],
  });

  const N = await import('expo-notifications');
  const wanted = new Set(plan.map((p) => p.id));

  for (const existing of await N.getAllScheduledNotificationsAsync()) {
    if (!wanted.has(existing.identifier)) {
      await N.cancelScheduledNotificationAsync(existing.identifier);
    }
  }

  for (const item of plan) {
    await N.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, data: { route: item.route } },
      trigger: triggerFor(item, N),
    });
  }

  return plan;
}

function triggerFor(
  item: PlannedNotification,
  N: typeof import('expo-notifications'),
): import('expo-notifications').NotificationTriggerInput {
  const types = N.SchedulableTriggerInputTypes;
  if (item.kind === 'date') {
    return { type: types.DATE, date: new Date(item.date), channelId: CHANNEL_ID };
  }
  if (item.kind === 'daily') {
    return { type: types.DAILY, hour: item.hour, minute: item.minute, channelId: CHANNEL_ID };
  }
  if (item.kind === 'weekly') {
    return {
      type: types.WEEKLY,
      weekday: item.weekday ?? 1,
      hour: item.hour,
      minute: item.minute,
      channelId: CHANNEL_ID,
    };
  }
  return {
    type: types.MONTHLY,
    day: item.day ?? 1,
    hour: item.hour,
    minute: item.minute,
    channelId: CHANNEL_ID,
  };
}

export async function cancelAll(): Promise<void> {
  if (!supported()) return;
  const N = await import('expo-notifications');
  await N.cancelAllScheduledNotificationsAsync();
}

/** What is actually pending, for the settings screen. */
export async function scheduledCount(): Promise<number> {
  if (!supported()) return 0;
  const N = await import('expo-notifications');
  return (await N.getAllScheduledNotificationsAsync()).length;
}

/** Fires in five seconds, so the user can confirm it works before trusting it. */
export async function sendTest(): Promise<void> {
  if (!supported()) return;
  const N = await import('expo-notifications');
  await N.scheduleNotificationAsync({
    content: {
      title: 'Car Guy',
      body: 'Así te voy a avisar cuando toque un chequeo o un mantenimiento.',
      data: { route: '/(tabs)/chequeo' },
    },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}
