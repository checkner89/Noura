import { Directory, File, Paths } from 'expo-file-system';
import { HealthStore } from './types';
import { UserProfile } from './onboarding';
import { AppPreferences } from './preferences';

export type NouraBackup = {
  schemaVersion: 1;
  createdAt: string;
  healthStore: HealthStore;
  profile: UserProfile;
  preferences: Pick<AppPreferences, 'iCloudBackupEnabled' | 'dailyAIEnabled'>;
  note: string;
};

const backupDirectory = () => new Directory(Paths.document, 'Noura');
const backupFile = () => new File(backupDirectory(), 'noura-backup.json');

export function getBackupFileUri(): string {
  return backupFile().uri;
}

export async function writeAutomaticBackup(store: HealthStore, profile: UserProfile, preferences: AppPreferences): Promise<string> {
  const directory = backupDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = backupFile();
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  const payload: NouraBackup = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    healthStore: store,
    profile,
    preferences: {
      iCloudBackupEnabled: preferences.iCloudBackupEnabled,
      dailyAIEnabled: preferences.dailyAIEnabled,
    },
    note: 'Enthält keine API-Keys. Diese Backup-Datei liegt im Documents-Bereich der App und ist damit für das iOS-Gerätebackup vorgesehen.',
  };
  file.write(JSON.stringify(payload));
  return file.uri;
}
