import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import {
  BowelEntry,
  CycleEntry,
  EntryKind,
  HealthMetricEntry,
  HealthStore,
  MealEntry,
  MedicationEntry,
  ObservationEntry,
  SavedDish,
  SymptomEntry,
} from './types';

const STORAGE_KEY = 'noura.health-store.v1';
const KEY_NAME = 'noura.health-store.encryption-key.v1';

type EncryptedEnvelope = { encrypted: true; version: 1; nonce: string; ciphertext: string };

function bytesToHex(bytes: Uint8Array) { return Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex: string) {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function getEncryptionKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) return hexToBytes(existing);
  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(KEY_NAME, bytesToHex(key), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  return key;
}

async function encryptStore(store: HealthStore): Promise<string> {
  const key = await getEncryptionKey();
  const nonce = await Crypto.getRandomBytesAsync(12);
  const plain = new TextEncoder().encode(JSON.stringify(store));
  const ciphertext = gcm(key, nonce).encrypt(plain);
  return JSON.stringify({ encrypted: true, version: 1, nonce: bytesToHex(nonce), ciphertext: bytesToHex(ciphertext) } satisfies EncryptedEnvelope);
}

async function decryptStore(raw: string): Promise<unknown> {
  const parsed = JSON.parse(raw) as EncryptedEnvelope | unknown;
  if (!parsed || typeof parsed !== 'object' || (parsed as any).encrypted !== true) return parsed;
  const envelope = parsed as EncryptedEnvelope;
  const key = await getEncryptionKey();
  const plain = gcm(key, hexToBytes(envelope.nonce)).decrypt(hexToBytes(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

export const emptyHealthStore = (): HealthStore => ({
  schemaVersion: 6,
  meals: [],
  symptoms: [],
  bowel: [],
  cycle: [],
  observations: [],
  medications: [],
  healthMetrics: [],
  savedDishes: [],
  deleted: [],
});

function migrateHealthStore(value: unknown): HealthStore {
  if (!value || typeof value !== 'object') return emptyHealthStore();
  const candidate = value as any;
  if (!Array.isArray(candidate.meals) || !Array.isArray(candidate.symptoms) || !Array.isArray(candidate.bowel)) return emptyHealthStore();
  return {
    schemaVersion: 6,
    meals: candidate.meals.map((x: any) => ({ ...x, favorite: !!x.favorite, photoUri: typeof x.photoUri === 'string' ? x.photoUri : undefined })),
    symptoms: candidate.symptoms.map((x: any) => ({
      ...x,
      pain: typeof x.pain === 'number' ? x.pain : undefined,
      bloating: typeof x.bloating === 'number' ? x.bloating : undefined,
      nausea: typeof x.nausea === 'number' ? x.nausea : undefined,
      heartburn: typeof x.heartburn === 'number' ? x.heartburn : undefined,
      energy: typeof x.energy === 'number' ? x.energy : undefined,
      stress: typeof x.stress === 'number' ? x.stress : undefined,
      temperature: typeof x.temperature === 'number' ? x.temperature : undefined,
    })),
    bowel: candidate.bowel,
    cycle: Array.isArray(candidate.cycle) ? candidate.cycle : [],
    observations: Array.isArray(candidate.observations) ? candidate.observations : [],
    medications: Array.isArray(candidate.medications) ? candidate.medications : [],
    healthMetrics: Array.isArray(candidate.healthMetrics) ? candidate.healthMetrics.map((x: any) => ({ ...x, source: x.source || 'manual' })) : [],
    savedDishes: Array.isArray(candidate.savedDishes) ? candidate.savedDishes : [],
    deleted: Array.isArray(candidate.deleted) ? candidate.deleted.filter((x: any) => x && typeof x.id === 'string' && typeof x.kind === 'string' && typeof x.deletedAt === 'string') : [],
  };
}

export async function loadHealthStore(): Promise<HealthStore> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyHealthStore();
  try {
    const value = await decryptStore(raw);
    const migrated = migrateHealthStore(value);
    // Older plaintext stores are transparently migrated to encrypted storage.
    if (!(JSON.parse(raw) as any)?.encrypted || (value as any)?.schemaVersion !== 6) await saveHealthStore(migrated);
    return migrated;
  } catch {
    return emptyHealthStore();
  }
}

export async function saveHealthStore(store: HealthStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, await encryptStore({ ...store, schemaVersion: 6 }));
}

export async function clearHealthStore(): Promise<void> { await AsyncStorage.removeItem(STORAGE_KEY); }
export async function clearHealthEncryptionKey(): Promise<void> { await SecureStore.deleteItemAsync(KEY_NAME); }

function withoutTombstone(store: HealthStore, id: string, kind: EntryKind): HealthStore {
  return { ...store, deleted: store.deleted.filter(x => !(x.id === id && x.kind === kind)) };
}

export function addMeal(store: HealthStore, entry: MealEntry): HealthStore { const base=withoutTombstone(store,entry.id,'meal'); return { ...base, meals: [entry, ...base.meals] }; }
export function addSymptom(store: HealthStore, entry: SymptomEntry): HealthStore { const base=withoutTombstone(store,entry.id,'symptom'); return { ...base, symptoms: [entry, ...base.symptoms] }; }
export function addBowel(store: HealthStore, entry: BowelEntry): HealthStore { const base=withoutTombstone(store,entry.id,'bowel'); return { ...base, bowel: [entry, ...base.bowel] }; }
export function addCycle(store: HealthStore, entry: CycleEntry): HealthStore { const base=withoutTombstone(store,entry.id,'cycle'); return { ...base, cycle: [entry, ...base.cycle] }; }
export function addObservation(store: HealthStore, entry: ObservationEntry): HealthStore { const base=withoutTombstone(store,entry.id,'observation'); return { ...base, observations: [entry, ...base.observations] }; }
export function addMedication(store: HealthStore, entry: MedicationEntry): HealthStore { const base=withoutTombstone(store,entry.id,'medication'); return { ...base, medications: [entry, ...base.medications] }; }
export function addHealthMetrics(store: HealthStore, entries: HealthMetricEntry[]): HealthStore {
  const ids = new Set(store.healthMetrics.map(x => x.id));
  const fresh = entries.filter(x => !ids.has(x.id));
  const deletedIds=new Set(store.deleted.filter(x=>x.kind==='metric').map(x=>x.id));
  const actuallyFresh=fresh.filter(x=>!deletedIds.has(x.id));
  return { ...store, healthMetrics: [...actuallyFresh, ...store.healthMetrics].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}
export function saveDish(store: HealthStore, dish: SavedDish): HealthStore {
  const exists = store.savedDishes.some(x => x.id === dish.id);
  const stamped={...dish,updatedAt:new Date().toISOString()};
  return { ...store, savedDishes: exists ? store.savedDishes.map(x => x.id === dish.id ? stamped : x) : [stamped, ...store.savedDishes] };
}
export function removeDish(store: HealthStore, id: string): HealthStore { return { ...store, savedDishes: store.savedDishes.filter(x => x.id !== id) }; }

export function updateEntry(
  store: HealthStore,
  kind: Exclude<EntryKind, 'metric'>,
  entry: MealEntry | SymptomEntry | BowelEntry | CycleEntry | ObservationEntry | MedicationEntry,
): HealthStore {
  const stamped={...entry,updatedAt:new Date().toISOString()} as typeof entry;
  const base=withoutTombstone(store,entry.id,kind);
  if (kind === 'meal') return { ...base, meals: base.meals.map(x => x.id === entry.id ? stamped as MealEntry : x) };
  if (kind === 'symptom') return { ...base, symptoms: base.symptoms.map(x => x.id === entry.id ? stamped as SymptomEntry : x) };
  if (kind === 'bowel') return { ...base, bowel: base.bowel.map(x => x.id === entry.id ? stamped as BowelEntry : x) };
  if (kind === 'cycle') return { ...base, cycle: base.cycle.map(x => x.id === entry.id ? stamped as CycleEntry : x) };
  if (kind === 'medication') return { ...base, medications: base.medications.map(x => x.id === entry.id ? stamped as MedicationEntry : x) };
  return { ...base, observations: base.observations.map(x => x.id === entry.id ? stamped as ObservationEntry : x) };
}

export function removeEntry(store: HealthStore, kind: EntryKind, id: string): HealthStore {
  const deletedAt=new Date().toISOString();
  const tombstones=[{id,kind,deletedAt},...store.deleted.filter(x=>!(x.id===id&&x.kind===kind))];
  if (kind === 'meal') return { ...store, meals: store.meals.filter(x => x.id !== id), deleted:tombstones };
  if (kind === 'symptom') return { ...store, symptoms: store.symptoms.filter(x => x.id !== id), deleted:tombstones };
  if (kind === 'bowel') return { ...store, bowel: store.bowel.filter(x => x.id !== id), deleted:tombstones };
  if (kind === 'cycle') return { ...store, cycle: store.cycle.filter(x => x.id !== id), deleted:tombstones };
  if (kind === 'metric') return { ...store, healthMetrics: store.healthMetrics.filter(x => x.id !== id), deleted:tombstones };
  if (kind === 'medication') return { ...store, medications: store.medications.filter(x => x.id !== id), deleted:tombstones };
  return { ...store, observations: store.observations.filter(x => x.id !== id), deleted:tombstones };
}


export function clearDiaryWithTombstones(store: HealthStore): HealthStore {
  const deletedAt = new Date().toISOString();
  const additions = [
    ...store.meals.map(x => ({ id:x.id, kind:'meal' as EntryKind, deletedAt })),
    ...store.symptoms.map(x => ({ id:x.id, kind:'symptom' as EntryKind, deletedAt })),
    ...store.bowel.map(x => ({ id:x.id, kind:'bowel' as EntryKind, deletedAt })),
    ...store.cycle.map(x => ({ id:x.id, kind:'cycle' as EntryKind, deletedAt })),
    ...store.observations.map(x => ({ id:x.id, kind:'observation' as EntryKind, deletedAt })),
    ...store.medications.map(x => ({ id:x.id, kind:'medication' as EntryKind, deletedAt })),
    ...store.healthMetrics.map(x => ({ id:x.id, kind:'metric' as EntryKind, deletedAt })),
  ];
  const map = new Map<string, typeof additions[number]>();
  for (const row of [...additions, ...(store.deleted || [])]) {
    const key = `${row.kind}|${row.id}`;
    const old = map.get(key);
    if (!old || new Date(row.deletedAt).getTime() > new Date(old.deletedAt).getTime()) map.set(key, row);
  }
  return { ...emptyHealthStore(), savedDishes:store.savedDishes, deleted:Array.from(map.values()).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)).slice(0,2000) };
}

export function toggleMealFavorite(store: HealthStore, id: string): HealthStore {
  const now=new Date().toISOString();
  return { ...store, meals: store.meals.map(x => x.id === id ? { ...x, favorite: !x.favorite, updatedAt:now } : x) };
}

function modifiedAt(x:{createdAt:string;updatedAt?:string}) { return new Date(x.updatedAt || x.createdAt).getTime() || 0; }
function mergeRows<T extends {id:string;createdAt:string;updatedAt?:string}>(a:T[],b:T[],deleted:Map<string,number>,kind:EntryKind):T[]{
  const map=new Map<string,T>();
  for(const row of [...a,...b]){ const old=map.get(row.id); if(!old||modifiedAt(row)>modifiedAt(old))map.set(row.id,row); }
  return Array.from(map.values()).filter(row => (deleted.get(`${kind}|${row.id}`) || 0) < modifiedAt(row)).sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
}

export function mergeHealthStores(local:HealthStore, remote:HealthStore):HealthStore {
  const tomb=new Map<string,number>();
  const deleted=[...(local.deleted||[]),...(remote.deleted||[])];
  for(const d of deleted){const key=`${d.kind}|${d.id}`;const t=new Date(d.deletedAt).getTime()||0;if(t>(tomb.get(key)||0))tomb.set(key,t);}
  const mergedDeleted=Array.from(tomb.entries()).map(([key,time])=>{const [kind,...rest]=key.split('|');return {kind:kind as EntryKind,id:rest.join('|'),deletedAt:new Date(time).toISOString()};}).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)).slice(0,1000);
  const dishes=new Map<string,SavedDish>();
  for(const d of [...local.savedDishes,...remote.savedDishes]){const old=dishes.get(d.id);const t=(x:SavedDish)=>new Date(x.updatedAt||x.createdAt).getTime()||0;if(!old||t(d)>t(old))dishes.set(d.id,d);}
  return {
    schemaVersion:6,
    meals:mergeRows(local.meals,remote.meals,tomb,'meal'), symptoms:mergeRows(local.symptoms,remote.symptoms,tomb,'symptom'),
    bowel:mergeRows(local.bowel,remote.bowel,tomb,'bowel'), cycle:mergeRows(local.cycle,remote.cycle,tomb,'cycle'),
    observations:mergeRows(local.observations,remote.observations,tomb,'observation'), medications:mergeRows(local.medications,remote.medications,tomb,'medication'),
    healthMetrics:mergeRows(local.healthMetrics,remote.healthMetrics,tomb,'metric'), savedDishes:Array.from(dishes.values()).sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt)), deleted:mergedDeleted,
  };
}

function id(prefix: string, day: number, suffix: number) { return `${prefix}-${day}-${suffix}`; }
function dateAt(daysAgo: number, hour: number, minute = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, minute, 0, 0); return d.toISOString();
}

export function createDemoStore(): HealthStore {
  const meals: MealEntry[] = [];
  const symptoms: SymptomEntry[] = [];
  const bowel: BowelEntry[] = [];
  const cycle: CycleEntry[] = [];
  const observations: ObservationEntry[] = [];
  const medications: MedicationEntry[] = [];
  const healthMetrics: HealthMetricEntry[] = [];
  for (let day = 0; day < 28; day += 1) {
    const dairyDay = [1, 3, 5, 8, 10, 12, 15, 18, 22, 25].includes(day);
    const lateLutealLike = day <= 4 || day >= 24;
    const bleeding = day >= 10 && day <= 13;
    meals.push({ id: id('meal', day, 1), createdAt: dateAt(day, 8, 10), mealType: 'Frühstück', favorite: day === 1, foods: [
      { id: id('food', day, 1), name: 'Haferflocken', amount: '70 g', kcal: 265 },
      { id: id('food', day, 2), name: dairyDay ? 'Naturjoghurt' : 'Haferdrink', amount: dairyDay ? '150 g' : '180 ml', kcal: dairyDay ? 95 : 72 },
      { id: id('food', day, 3), name: 'Banane', amount: '1 Stück', kcal: 105 },
    ] });
    meals.push({ id: id('meal', day, 2), createdAt: dateAt(day, 13), mealType: 'Mittagessen', foods: [
      { id: id('food', day, 4), name: day % 2 === 0 ? 'Pasta' : 'Reis', amount: '1 Portion', kcal: 520 },
      { id: id('food', day, 5), name: 'Gemüse', amount: '200 g', kcal: 90 },
    ] });
    const base = dairyDay ? 4 : 1; const cycleBoost = lateLutealLike ? 2 : bleeding ? 1 : 0;
    symptoms.push({ id: id('sym', day, 1), createdAt: dateAt(day, 11, 30), pain: Math.min(10, base + cycleBoost), bloating: Math.min(10, base + 2 + cycleBoost), nausea: dairyDay ? 2 : 0, heartburn: day % 4 === 0 ? 2 : 0, energy: lateLutealLike ? 5 : 7, stress: 3 + (day % 3), temperature: 36.4 + ((day % 4) * 0.1) });
    if (day % 2 === 0 || day === 1) bowel.push({ id: id('bowel', day, 1), createdAt: dateAt(day, 9), bristolType: dairyDay ? 6 : 4, urgency: dairyDay ? 2 : 1 });
    cycle.push({ id: id('cycle', day, 1), createdAt: dateAt(day, 20), bleeding, flow: day === 12 ? 'heavy' : bleeding ? 'medium' : undefined, cramps: bleeding ? 5 : lateLutealLike ? 2 : 0, cravings: lateLutealLike ? 7 : 2, headache: lateLutealLike ? 3 : 0, breastTenderness: lateLutealLike ? 5 : 1, mood: lateLutealLike ? 'low' : 'good', basalTemperature: lateLutealLike ? 36.8 : 36.5 });
    if ([1, 5, 10, 24].includes(day)) observations.push({ id: id('obs', day, 1), createdAt: dateAt(day, 15, 15), text: day === 10 ? 'Während der Periode deutlich empfindlicher Bauch.' : dairyDay ? 'Nach dem Joghurt heute auffällig aufgebläht.' : 'Heute insgesamt ruhiger Bauch.', category: day === 10 ? 'cycle' : dairyDay ? 'food' : 'general', severity: dairyDay ? 6 : 2, tags: dairyDay ? ['Milchprodukt', 'Blähungen'] : [] });
    if (day % 6 === 0) medications.push({ id: id('med', day, 1), createdAt: dateAt(day, 7, 45), kind: 'supplement', name: 'Magnesium', dose: '200 mg' });
    if (day % 3 === 0) healthMetrics.push({ id: id('weight', day, 1), createdAt: dateAt(day, 7), kind: 'weight', value: 78.4 + (day % 4) * 0.1, unit: 'kg', source: 'apple-health-export', sourceName: 'Demo' });
    healthMetrics.push({ id: id('steps', day, 1), createdAt: dateAt(day, 21), kind: 'steps', value: 6000 + (day % 5) * 900, unit: 'Schritte', source: 'apple-health-export', sourceName: 'Demo' });
    healthMetrics.push({ id: id('sleep', day, 1), createdAt: dateAt(day, 7), kind: 'sleep', value: lateLutealLike ? 6.3 : 7.4, unit: 'h', source: 'apple-health-export', sourceName: 'Demo' });
  }
  const savedDishes: SavedDish[] = [{ id: 'dish-demo-1', name: 'Mein Haferfrühstück', mealType: 'Frühstück', createdAt: new Date().toISOString(), foods: [
    { id: 'dish-food-1', name: 'Haferflocken', amount: '70 g', source: 'saved-dish' },
    { id: 'dish-food-2', name: 'Banane', amount: '1 Stück', source: 'saved-dish' },
  ] }];
  return { schemaVersion: 6, meals, symptoms, bowel, cycle, observations, medications, healthMetrics, savedDishes, deleted: [] };
}
