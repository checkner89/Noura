import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import { HealthStore } from './types';
import { UserProfile } from './onboarding';
import { AppPreferences } from './preferences';

export type NouraBackup = {
  schemaVersion: 4;
  createdAt: string;
  healthStore: HealthStore;
  profile: UserProfile;
  profileImage?: { base64: string; mimeType: string };
  preferences: Pick<AppPreferences, 'iCloudBackupEnabled' | 'iCloudSyncEnabled' | 'dailyAIEnabled' | 'appLockEnabled' | 'eveningReminderEnabled' | 'eveningReminderTime' | 'mealFollowupEnabled' | 'mealFollowupHours' | 'cycleReminderEnabled' | 'cycleReminderTime' | 'weeklyReviewEnabled' | 'theme' | 'language'>;
  note: string;
};

const backupDirectory = () => new Directory(Paths.document, 'Noura');
const backupFile = () => new File(backupDirectory(), 'noura-backup.json');
const restoredAvatarFile = () => new File(backupDirectory(), 'restored-profile-avatar.jpg');

export function getBackupFileUri(): string { return backupFile().uri; }

async function imageAsBase64(uri?: string) {
  if (!uri) return undefined;
  try {
    const file = new File(uri);
    if (!file.exists) return undefined;
    return { base64: await file.base64(), mimeType: file.type || 'image/jpeg' };
  } catch { return undefined; }
}

export async function writeAutomaticBackup(store: HealthStore, profile: UserProfile, preferences: AppPreferences): Promise<string> {
  const directory = backupDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = backupFile();
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  const payload: NouraBackup = {
    schemaVersion: 4,
    createdAt: new Date().toISOString(),
    healthStore: store,
    profile,
    profileImage: await imageAsBase64(profile.profileImageUri),
    preferences: {
      iCloudBackupEnabled: preferences.iCloudBackupEnabled,
      iCloudSyncEnabled: preferences.iCloudSyncEnabled,
      dailyAIEnabled: preferences.dailyAIEnabled,
      appLockEnabled: preferences.appLockEnabled,
      eveningReminderEnabled: preferences.eveningReminderEnabled,
      eveningReminderTime: preferences.eveningReminderTime,
      mealFollowupEnabled: preferences.mealFollowupEnabled,
      mealFollowupHours: preferences.mealFollowupHours,
      cycleReminderEnabled: preferences.cycleReminderEnabled,
      cycleReminderTime: preferences.cycleReminderTime,
      weeklyReviewEnabled: preferences.weeklyReviewEnabled,
      theme: preferences.theme,
      language: preferences.language,
    },
    note: 'Enthält Tagebuch, Profil und Einstellungen, aber keine API-Keys. Die Datei liegt im Documents-Bereich und kann vom iOS-Gerätebackup gesichert werden.',
  };
  file.write(JSON.stringify(payload));
  return file.uri;
}

export async function readAutomaticBackup(): Promise<NouraBackup | null> {
  const file = backupFile();
  if (!file.exists) return null;
  try { return JSON.parse(await file.text()) as NouraBackup; } catch { return null; }
}

export async function shareAutomaticBackup(): Promise<void> {
  const file = backupFile();
  if (!file.exists) throw new Error('Noch kein Backup vorhanden.');
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Noura-Backup sichern' });
}

export async function pickBackupFile(): Promise<NouraBackup | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;
  const file = new File(picked.assets[0].uri);
  const payload = JSON.parse(await file.text()) as NouraBackup;
  if (!payload?.healthStore || !payload?.profile) throw new Error('Die Datei ist kein gültiges Noura-Backup.');
  return payload;
}

export async function restoreProfileImageFromBackup(backup: NouraBackup): Promise<string | undefined> {
  if (!backup.profileImage?.base64) return undefined;
  const dir = backupDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = restoredAvatarFile();
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  await LegacyFileSystem.writeAsStringAsync(file.uri, backup.profileImage.base64, { encoding: LegacyFileSystem.EncodingType.Base64 });
  return file.uri;
}
