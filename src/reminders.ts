import * as Notifications from 'expo-notifications';
import { AppPreferences } from './preferences';

const EVENING_ID_KEY = 'noura-evening';
const CYCLE_ID_KEY = 'noura-cycle';

let handlerConfigured = false;
export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

function parseTime(value: string, fallbackHour: number, fallbackMinute: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return { hour: fallbackHour, minute: fallbackMinute };
  return { hour: Math.max(0, Math.min(23, Number(match[1]))), minute: Math.max(0, Math.min(59, Number(match[2]))) };
}

async function cancelByTag(tag: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter(x => x.content.data?.nouraTag === tag).map(x => Notifications.cancelScheduledNotificationAsync(x.identifier)));
}

export async function syncRecurringReminders(prefs: AppPreferences, cycleTrackingEnabled: boolean) {
  configureNotificationHandler();
  await cancelByTag(EVENING_ID_KEY);
  await cancelByTag(CYCLE_ID_KEY);
  if (!(prefs.eveningReminderEnabled || (prefs.cycleReminderEnabled && cycleTrackingEnabled))) return;
  const allowed = await ensureNotificationPermission();
  if (!allowed) throw new Error('Mitteilungen sind nicht erlaubt. Aktiviere sie in den iPhone-Einstellungen für Noura.');

  if (prefs.eveningReminderEnabled) {
    const { hour, minute } = parseTime(prefs.eveningReminderTime, 20, 30);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Kurzer Noura-Check-in', body: 'Wie war dein Tag? Ein paar Sekunden reichen.', data: { nouraTag: EVENING_ID_KEY, route: 'symptoms' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
  if (prefs.cycleReminderEnabled && cycleTrackingEnabled) {
    const { hour, minute } = parseTime(prefs.cycleReminderTime, 19, 0);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Zyklus kurz festhalten', body: 'Nur wenn heute etwas relevant war.', data: { nouraTag: CYCLE_ID_KEY, route: 'cycle' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}

export async function scheduleMealFollowup(prefs: AppPreferences, mealLabel?: string) {
  if (!prefs.mealFollowupEnabled) return;
  configureNotificationHandler();
  const allowed = await ensureNotificationPermission();
  if (!allowed) return;
  const seconds = Math.max(1, Math.min(8, prefs.mealFollowupHours)) * 60 * 60;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wie geht es dir nach dem Essen?',
      body: mealLabel ? `Kurzer Check-in nach „${mealLabel}“.` : 'Ein kurzer Körper-Check-in hilft Noura bei zeitlichen Mustern.',
      data: { nouraTag: 'meal-followup', route: 'symptoms' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function getReminderStatus() {
  const permission = await Notifications.getPermissionsAsync();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return { permission: permission.status, scheduledCount: scheduled.length };
}

export type ReminderRoute = 'symptoms' | 'cycle';

export function addReminderResponseListener(onRoute: (route: ReminderRoute) => void) {
  configureNotificationHandler();
  return Notifications.addNotificationResponseReceivedListener(response => {
    const route = response.notification.request.content.data?.route;
    if (route === 'symptoms' || route === 'cycle') onRoute(route);
  });
}

export async function getLastReminderRoute(): Promise<ReminderRoute | null> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const route = response?.notification.request.content.data?.route;
    if (response && typeof (Notifications as any).clearLastNotificationResponseAsync === 'function') {
      await (Notifications as any).clearLastNotificationResponseAsync().catch(() => undefined);
    }
    return route === 'symptoms' || route === 'cycle' ? route : null;
  } catch {
    return null;
  }
}
