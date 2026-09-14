import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppTheme = 'system' | 'light' | 'dark';
export type AppLanguage = 'de' | 'en';

export type AppPreferences = {
  schemaVersion: 4;
  iCloudBackupEnabled: boolean;
  iCloudSyncEnabled: boolean;
  dailyAIEnabled: boolean;
  appLockEnabled: boolean;
  eveningReminderEnabled: boolean;
  eveningReminderTime: string;
  mealFollowupEnabled: boolean;
  mealFollowupHours: number;
  cycleReminderEnabled: boolean;
  cycleReminderTime: string;
  weeklyReviewEnabled: boolean;
  theme: AppTheme;
  language: AppLanguage;
  lastBackupAt?: string;
  lastCloudSyncAt?: string;
  lastDirectHealthSyncAt?: string;
  lastBackgroundAIAt?: string;
  lastAIDataSignature?: string;
  appleHealthLastImportAt?: string;
  appleHealthImportedRecords?: number;
};

const KEY = 'noura.app-preferences.v1';

export const defaultAppPreferences = (): AppPreferences => ({
  schemaVersion: 4,
  iCloudBackupEnabled: true,
  iCloudSyncEnabled: false,
  dailyAIEnabled: false,
  appLockEnabled: false,
  eveningReminderEnabled: false,
  eveningReminderTime: '20:30',
  mealFollowupEnabled: false,
  mealFollowupHours: 3,
  cycleReminderEnabled: false,
  cycleReminderTime: '19:00',
  weeklyReviewEnabled: true,
  theme: 'system',
  language: 'de',
});

function timeOr(value: unknown, fallback: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export async function loadAppPreferences(): Promise<AppPreferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaultAppPreferences();
  try {
    const value = JSON.parse(raw) as Partial<AppPreferences>;
    const defaults = defaultAppPreferences();
    return {
      ...defaults,
      ...value,
      schemaVersion: 4,
      iCloudBackupEnabled: value.iCloudBackupEnabled !== false,
      iCloudSyncEnabled: value.iCloudSyncEnabled === true,
      dailyAIEnabled: value.dailyAIEnabled === true,
      appLockEnabled: value.appLockEnabled === true,
      eveningReminderEnabled: value.eveningReminderEnabled === true,
      eveningReminderTime: timeOr(value.eveningReminderTime, defaults.eveningReminderTime),
      mealFollowupEnabled: value.mealFollowupEnabled === true,
      mealFollowupHours: Math.max(1, Math.min(8, Number(value.mealFollowupHours) || defaults.mealFollowupHours)),
      cycleReminderEnabled: value.cycleReminderEnabled === true,
      cycleReminderTime: timeOr(value.cycleReminderTime, defaults.cycleReminderTime),
      weeklyReviewEnabled: value.weeklyReviewEnabled !== false,
      theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
      language: value.language === 'en' ? 'en' : 'de',
    };
  } catch {
    return defaultAppPreferences();
  }
}

export async function saveAppPreferences(value: AppPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...value, schemaVersion: 4 }));
}

export async function clearAppPreferences(): Promise<void> { await AsyncStorage.removeItem(KEY); }
