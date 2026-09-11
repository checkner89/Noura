import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppPreferences = {
  schemaVersion: 1;
  iCloudBackupEnabled: boolean;
  dailyAIEnabled: boolean;
  lastBackupAt?: string;
  lastBackgroundAIAt?: string;
};

const KEY = 'noura.app-preferences.v1';

export const defaultAppPreferences = (): AppPreferences => ({
  schemaVersion: 1,
  iCloudBackupEnabled: true,
  dailyAIEnabled: false,
});

export async function loadAppPreferences(): Promise<AppPreferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaultAppPreferences();
  try {
    const value = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      ...defaultAppPreferences(),
      ...value,
      schemaVersion: 1,
      iCloudBackupEnabled: value.iCloudBackupEnabled !== false,
      dailyAIEnabled: value.dailyAIEnabled === true,
    };
  } catch {
    return defaultAppPreferences();
  }
}

export async function saveAppPreferences(value: AppPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}
