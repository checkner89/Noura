import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import JSZip from 'jszip';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { HealthStore } from './types';
import { UserProfile } from './onboarding';
import { AppPreferences } from './preferences';

function csv(value: unknown) { const text = value == null ? '' : String(value); return `"${text.replace(/"/g,'""')}"`; }
function table(headers: string[], rows: unknown[][]) { return [headers.map(csv).join(','), ...rows.map(r => r.map(csv).join(','))].join('\n'); }

function exportDir() { const dir = new Directory(Paths.cache, 'NouraExports'); if (!dir.exists) dir.create({ intermediates:true, idempotent:true }); return dir; }

export async function createPortableExport(store: HealthStore, profile: UserProfile, preferences: AppPreferences) {
  const zip = new JSZip();
  zip.file('noura-data.json', JSON.stringify({ schemaVersion:1, exportedAt:new Date().toISOString(), profile, preferences: { ...preferences, lastAIDataSignature: undefined }, healthStore:store }, null, 2));
  zip.file('meals.csv', table(['id','createdAt','mealType','foods','note','favorite'], store.meals.map(x=>[x.id,x.createdAt,x.mealType,x.foods.map(f=>`${f.name}${f.amount?` (${f.amount})`:''}`).join(' | '),x.note||'',!!x.favorite])));
  zip.file('symptoms.csv', table(['id','createdAt','pain','bloating','nausea','heartburn','energy','stress','temperature','note'], store.symptoms.map(x=>[x.id,x.createdAt,x.pain,x.bloating,x.nausea,x.heartburn,x.energy,x.stress,x.temperature,x.note||''])));
  zip.file('bowel.csv', table(['id','createdAt','bristolType','urgency','mucus','blood','pain','note'], store.bowel.map(x=>[x.id,x.createdAt,x.bristolType,x.urgency,!!x.mucus,!!x.blood,x.pain,x.note||''])));
  zip.file('cycle.csv', table(['id','createdAt','bleeding','flow','cramps','cravings','headache','breastTenderness','mood','basalTemperature','note'], store.cycle.map(x=>[x.id,x.createdAt,x.bleeding,x.flow||'',x.cramps,x.cravings,x.headache,x.breastTenderness,x.mood||'',x.basalTemperature,x.note||''])));
  zip.file('medications.csv', table(['id','createdAt','kind','name','dose','note'], store.medications.map(x=>[x.id,x.createdAt,x.kind,x.name,x.dose||'',x.note||''])));
  zip.file('metrics.csv', table(['id','createdAt','kind','value','unit','source','sourceName'], store.healthMetrics.map(x=>[x.id,x.createdAt,x.kind,x.value,x.unit,x.source,x.sourceName||''])));
  zip.file('observations.csv', table(['id','createdAt','category','severity','text','tags'], store.observations.map(x=>[x.id,x.createdAt,x.category||'',x.severity,x.text,(x.tags||[]).join(' | ')])));
  const base64 = await zip.generateAsync({ type:'base64', compression:'DEFLATE' });
  const file = new File(exportDir(), `Noura-Export-${new Date().toISOString().slice(0,10)}.zip`);
  if (!file.exists) file.create({ intermediates:true, overwrite:true });
  await LegacyFileSystem.writeAsStringAsync(file.uri, base64, { encoding: LegacyFileSystem.EncodingType.Base64 });
  return file.uri;
}

export async function sharePortableExport(store: HealthStore, profile: UserProfile, preferences: AppPreferences) {
  const uri = await createPortableExport(store, profile, preferences);
  if (!await Sharing.isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  await Sharing.shareAsync(uri, { mimeType:'application/zip', dialogTitle:'Noura-Daten exportieren' });
  return uri;
}

export async function pickPortableExport(): Promise<{store: HealthStore; profile: UserProfile; preferences?: Partial<AppPreferences>} | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const uri = result.assets[0].uri;
  let payload: any;
  if ((result.assets[0].name || '').toLowerCase().endsWith('.zip')) {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const json = zip.file('noura-data.json');
    if (!json) throw new Error('In dieser ZIP fehlt noura-data.json.');
    payload = JSON.parse(await json.async('string'));
  } else {
    const file = new File(uri);
    payload = JSON.parse(await file.text());
  }
  if (!payload?.healthStore || !payload?.profile) throw new Error('Die Datei ist kein gültiger Noura-Datenexport.');
  return { store: payload.healthStore as HealthStore, profile: payload.profile as UserProfile, preferences: payload.preferences as Partial<AppPreferences> | undefined };
}
