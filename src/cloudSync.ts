import { HealthStore } from './types';
import { UserProfile } from './onboarding';
import { AppPreferences } from './preferences';

export const NOURA_ICLOUD_CONTAINER = 'iCloud.de.noura.healthtracker';
export type CloudSnapshot = { schemaVersion: 2; updatedAt: string; healthStore: HealthStore; profile: UserProfile; preferences: Partial<AppPreferences> };

function cloud(): any { try { return require('expo-cloudkit'); } catch { return null; } }
export function isCloudKitModulePresent() { return !!cloud(); }

async function ready() {
  const ck = cloud();
  if (!ck) throw new Error('iCloud-Live-Sync ist in diesem Build nicht enthalten. Backup/Restore funktioniert weiterhin.');
  ck.configure?.(NOURA_ICLOUD_CONTAINER);
  const status = await ck.getAccountStatus?.();
  if (status && status !== 'available') throw new Error('iCloud ist für Noura auf diesem Gerät nicht verfügbar oder nicht angemeldet.');
  return ck;
}

export async function pushCloudSnapshot(store: HealthStore, profile: UserProfile, preferences: AppPreferences) {
  const ck = await ready();
  const payload: CloudSnapshot = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    healthStore: store,
    profile,
    preferences: { ...preferences, lastAIDataSignature: undefined },
  };
  const text = JSON.stringify(payload);
  const chunkSize = 350000;
  const chunks = Array.from({ length: Math.ceil(text.length / chunkSize) }, (_, i) => text.slice(i * chunkSize, (i + 1) * chunkSize));
  const records = [
    { recordType: 'NouraSyncMeta', recordName: 'main', zoneName: '_defaultZone', fields: { updatedAt: { type: 'string', value: payload.updatedAt }, chunkCount: { type: 'number', value: chunks.length } } },
    ...chunks.map((value, i) => ({ recordType: 'NouraSyncChunk', recordName: `main-${i}`, zoneName: '_defaultZone', fields: { index: { type: 'number', value: i }, payload: { type: 'string', value } } })),
  ];
  await ck.saveRecords(records, 'private', { queueOnFailure: true });
  return { updatedAt: payload.updatedAt, chunks: chunks.length };
}

export async function pullCloudSnapshot(): Promise<CloudSnapshot | null> {
  const ck = await ready();
  let meta: any;
  try { meta = await ck.fetchRecord('NouraSyncMeta', 'main', '_defaultZone', 'private'); }
  catch (e: any) { if (e?.code === 'RECORD_NOT_FOUND') return null; throw e; }
  const count = Number(meta?.fields?.chunkCount?.value || 0);
  if (!count) return null;
  const chunks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = await ck.fetchRecord('NouraSyncChunk', `main-${i}`, '_defaultZone', 'private');
    chunks.push(String(row?.fields?.payload?.value || ''));
  }
  const parsed = JSON.parse(chunks.join(''));
  if (!parsed?.healthStore || !parsed?.profile) return null;
  return parsed as CloudSnapshot;
}
