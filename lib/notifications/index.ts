import { Platform } from 'react-native';

import { Alert } from '../alert';
import { baseTemplateId, templatesForVehicle } from '../db/inspectionOps';
import {
  currentOdometer,
  odometer as odometerRepo,
  reminders as reminderRepo,
  settings as settingsRepo,
  vehicles as vehicleRepo,
} from '../db/repos';
import { todayIso } from '../domain/dates';
import { isMarbeteWindowOpen, marbeteNudges } from '../domain/legal-dr';
import { kmPerDay } from '../domain/odometer';
import { displayDueDate, evaluate } from '../domain/reminders';
import { es } from '../i18n/es';
import { firstAttentionDay, planNotifications, type PlanInput, type PlannedNotification } from './plan';

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
/**
 * Whether Android will actually show them — without asking.
 *
 * The switch in settings is only the app's intent. A restored backup or a
 * reinstall brings the switch back "on" on an install that has never been
 * granted the permission, and scheduling succeeds regardless, so the schedule
 * count alone would claim everything works while nothing is ever shown.
 */
export async function hasPermission(): Promise<boolean> {
  if (!supported()) return false;
  const N = await import('expo-notifications');
  return (await N.getPermissionsAsync()).granted;
}

export async function requestPermission(): Promise<boolean> {
  if (!supported()) return false;
  const N = await import('expo-notifications');
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Everything the plan needs, gathered across every vehicle still in the garage —
 * the coolant of the car you are not looking at right now boils just the same.
 */
async function gatherPlanInput(config: NotificationSettings, today: string): Promise<PlanInput> {
  const garage = (await vehicleRepo.list()).filter((v) => !v.isArchived);
  const several = garage.length > 1;

  const reminders: PlanInput['reminders'] = [];
  const templates: PlanInput['templates'] = [];

  for (const vehicle of garage) {
    const [rows, km, readings, mine] = await Promise.all([
      reminderRepo.listWhere({ vehicleId: vehicle.id }),
      currentOdometer(vehicle.id),
      odometerRepo.list(vehicle.id),
      templatesForVehicle(vehicle),
    ]);
    const pace = kmPerDay(readings, today);
    const ctx = { today, currentKm: km, kmPerDay: pace.kmPerDay, confidence: pace.confidence };

    for (const reminder of rows) {
      if (!reminder.isEnabled) continue;
      const status = evaluate(reminder, ctx);
      reminders.push({
        id: reminder.id,
        title: reminder.title,
        dueDate: reminder.dueDate,
        predictedDueDate: displayDueDate(reminder, status),
        proximoDate: firstAttentionDay(reminder, ctx),
        status: status.status,
        vehicleName: several ? vehicle.name : undefined,
      });
    }

    for (const t of mine) {
      templates.push({
        id: t.id,
        baseId: baseTemplateId(t.id),
        name: t.name,
        cadence: t.cadence,
        enabled: t.isEnabled,
      });
    }
  }

  return {
    today,
    hour: config.hour,
    minute: config.minute,
    weeklyWeekday: config.weeklyWeekday,
    reminders,
    templates,
    marbeteNudges: isMarbeteWindowOpen(today) ? marbeteNudges(today) : [],
  };
}

/**
 * Rebuilds the whole schedule from the current data, now.
 *
 * Deterministic ids mean re-scheduling replaces rather than duplicates, and
 * anything no longer in the plan is cancelled — so this can be called after
 * every write without bookkeeping.
 *
 * Serialised: at most one rebuild runs and at most one more waits behind it, so
 * a burst of writes can never interleave two cancel-and-schedule passes. The
 * argument is accepted for older callers and ignored — every vehicle is planned.
 */
export function resync(_vehicleId?: string): Promise<PlannedNotification[]> {
  if (queued) return queued;
  queued = running.catch(() => []).then(() => {
    queued = null;
    return rebuild();
  });
  running = queued;
  return queued;
}

let running: Promise<PlannedNotification[]> = Promise.resolve([]);
let queued: Promise<PlannedNotification[]> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** The debounce every write goes through: one rebuild, 500 ms after the last. */
export const RESYNC_DEBOUNCE_MS = 500;

export function requestResync(): void {
  if (!supported()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void resync().catch(() => {});
  }, RESYNC_DEBOUNCE_MS);
}

async function rebuild(): Promise<PlannedNotification[]> {
  if (!supported()) return [];

  const config = await getSettings();
  if (!config.enabled) {
    await cancelAll();
    return [];
  }

  const today = todayIso();
  const plan = planNotifications(await gatherPlanInput(config, today), new Date().toISOString());

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

const OFFERED_KEY = 'notifications.offered';

/**
 * The one time the app asks: right after the first finished check, when the
 * user has just seen what the reminders are for. Native only; asks once ever,
 * whatever the answer. "Avisarme" creates the channel before asking for the
 * permission (Android 13+ shows no prompt without one), then turns the
 * notifications on and schedules them.
 */
export async function offerAfterFirstInspection(): Promise<void> {
  if (!supported()) return;
  if (await settingsRepo.get<boolean>(OFFERED_KEY, false)) return;
  const current = await getSettings();
  await settingsRepo.set(OFFERED_KEY, true);
  if (current.enabled) return;

  Alert.alert(es.notifications.title, es.notifications.subtitle, [
    { text: es.notifications.notNow, style: 'cancel' },
    {
      text: es.notifications.enable,
      onPress: () => {
        void (async () => {
          await configure();
          if (!(await requestPermission())) {
            Alert.alert(es.notifications.title, es.notifications.denied);
            return;
          }
          await setSettings({ ...(await getSettings()), enabled: true });
          await resync();
        })().catch(() => {});
      },
    },
  ]);
}

/** Follows a notification's `data.route`, from a tap now or one that launched the app. */
export function routeOf(response: { notification: { request: { content: { data?: unknown } } } }) {
  const data = response.notification.request.content.data as { route?: unknown } | undefined;
  return typeof data?.route === 'string' ? data.route : null;
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
