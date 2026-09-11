import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const PROFILE_FILE = 'noura-profile-avatar.jpg';

export async function pickAndPersistProfileImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Bitte erlaube Noura den Zugriff auf deine Fotos.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.78,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  if (!FileSystem.documentDirectory) return result.assets[0].uri;

  const destination = `${FileSystem.documentDirectory}${PROFILE_FILE}`;
  try { await FileSystem.deleteAsync(destination, { idempotent: true }); } catch { /* noop */ }
  await FileSystem.copyAsync({ from: result.assets[0].uri, to: destination });
  return destination;
}

export async function removePersistedProfileImage(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try { await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${PROFILE_FILE}`, { idempotent: true }); } catch { /* noop */ }
}
