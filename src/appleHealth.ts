import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import JSZip from 'jszip';
import { CycleEntry, HealthMetricEntry } from './types';

export type AppleHealthImport = {
  metrics: HealthMetricEntry[];
  cycle: CycleEntry[];
  sourceRecords: number;
  ignoredRecords: number;
  rangeStart?: string;
  rangeEnd?: string;
};

const typeMap: Record<string, { kind: HealthMetricEntry['kind']; unit?: string; transform?: (n: number, unit: string) => { value: number; unit: string } }> = {
  HKQuantityTypeIdentifierBodyMass: { kind: 'weight', transform: (n, unit) => unit.toLowerCase().includes('lb') ? ({ value: n * 0.45359237, unit: 'kg' }) : ({ value: n, unit: unit || 'kg' }) },
  HKQuantityTypeIdentifierBodyTemperature: { kind: 'bodyTemperature', transform: (n, unit) => unit === 'degF' || unit.includes('°F') ? ({ value: (n - 32) * 5 / 9, unit: '°C' }) : ({ value: n, unit: '°C' }) },
  HKQuantityTypeIdentifierStepCount: { kind: 'steps', unit: 'Schritte' },
  HKQuantityTypeIdentifierRestingHeartRate: { kind: 'restingHeartRate', unit: 'bpm' },
  HKQuantityTypeIdentifierActiveEnergyBurned: { kind: 'activeEnergy', unit: 'kcal' },
  HKQuantityTypeIdentifierDietaryWater: { kind: 'water', transform: (n, unit) => unit.toLowerCase().includes('ml') ? ({ value: n, unit: 'ml' }) : unit.toLowerCase().includes('l') ? ({ value: n * 1000, unit: 'ml' }) : ({ value: n, unit: unit || 'ml' }) },
};

function parseAttrs(tag: string) {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) attrs[match[1]] = match[2];
  return attrs;
}

function healthDate(value?: string) {
  if (!value) return undefined;
  // Apple Health export: 2026-09-11 08:15:01 +0200
  const normalized = value.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function uid(prefix: string, seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

function parseExportXml(xml: string, days = 180): AppleHealthImport {
  const cutoff = Date.now() - days * 86400000;
  const metrics: HealthMetricEntry[] = [];
  const cycle: CycleEntry[] = [];
  let sourceRecords = 0;
  let ignoredRecords = 0;
  const dates: number[] = [];
  const seen = new Set<string>();

  const recordRe = /<Record\s+[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = recordRe.exec(xml))) {
    sourceRecords += 1;
    const a = parseAttrs(match[0]);
    const createdAt = healthDate(a.startDate || a.creationDate);
    if (!createdAt || new Date(createdAt).getTime() < cutoff) { ignoredRecords += 1; continue; }
    const config = typeMap[a.type];
    if (!config) { ignoredRecords += 1; continue; }
    const numeric = Number(a.value);
    if (!Number.isFinite(numeric)) { ignoredRecords += 1; continue; }
    const transformed = config.transform ? config.transform(numeric, a.unit || '') : { value: numeric, unit: config.unit || a.unit || '' };
    const seed = `${a.type}|${createdAt}|${a.endDate || ''}|${a.value}|${a.sourceName || ''}`;
    const id = uid('apple', seed);
    if (seen.has(id)) continue;
    seen.add(id);
    dates.push(new Date(createdAt).getTime());
    metrics.push({ id, createdAt, kind: config.kind, value: Math.round(transformed.value * 100) / 100, unit: transformed.unit, endAt: healthDate(a.endDate), source: 'apple-health-export', sourceName: a.sourceName });
  }

  // Sleep samples are category records; aggregate every individual interval in hours.
  const sleepRe = /<Record\s+[^>]*type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*\/?\s*>/g;
  while ((match = sleepRe.exec(xml))) {
    const a = parseAttrs(match[0]);
    const start = healthDate(a.startDate); const end = healthDate(a.endDate);
    if (!start || !end || new Date(start).getTime() < cutoff) continue;
    if (/Awake/i.test(a.value || '')) continue;
    const hours = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3600000);
    if (!hours) continue;
    const id = uid('apple-sleep', `${start}|${end}|${a.sourceName || ''}`);
    if (seen.has(id)) continue;
    seen.add(id);
    metrics.push({ id, createdAt: start, endAt: end, kind: 'sleep', value: Math.round(hours * 100) / 100, unit: 'h', source: 'apple-health-export', sourceName: a.sourceName });
  }

  // Menstrual flow can enrich Noura's cycle diary without inventing other cycle symptoms.
  const cycleRe = /<Record\s+[^>]*type="HKCategoryTypeIdentifierMenstrualFlow"[^>]*\/?\s*>/g;
  while ((match = cycleRe.exec(xml))) {
    const a = parseAttrs(match[0]);
    const createdAt = healthDate(a.startDate || a.creationDate);
    if (!createdAt || new Date(createdAt).getTime() < cutoff) continue;
    const text = a.value || '';
    const flow = /Heavy/i.test(text) ? 'heavy' : /Medium/i.test(text) ? 'medium' : /Light/i.test(text) ? 'light' : /Spotting/i.test(text) ? 'spotting' : undefined;
    const id = uid('apple-cycle', `${createdAt}|${text}|${a.sourceName || ''}`);
    cycle.push({ id, createdAt, bleeding: true, flow, note: 'Aus Apple Health importiert' });
  }

  // Apple Health can contain hundreds of step/energy samples per day. Noura stores
  // a calm daily summary instead of flooding the diary with raw sensor intervals.
  const bucket = new Map<string, HealthMetricEntry[]>();
  for (const item of metrics) {
    const d = new Date(item.createdAt); const day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key = `${day}|${item.kind}`; const list = bucket.get(key) || []; list.push(item); bucket.set(key, list);
  }
  const aggregated: HealthMetricEntry[] = [];
  for (const [key, items] of bucket.entries()) {
    const [, kind] = key.split('|') as [string, HealthMetricEntry['kind']];
    const latest = items.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    const sumKinds: HealthMetricEntry['kind'][] = ['water'];
    const sourceArbitratedKinds: HealthMetricEntry['kind'][] = ['steps','activeEnergy'];
    const avgKinds: HealthMetricEntry['kind'][] = ['restingHeartRate','bodyTemperature'];
    let value: number;
    if (kind === 'sleep') {
      const intervals = items.map(x => [new Date(x.createdAt).getTime(), x.endAt ? new Date(x.endAt).getTime() : new Date(x.createdAt).getTime() + x.value * 3600000] as [number, number]).filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a,b)=>a[0]-b[0]);
      const merged: Array<[number,number]> = [];
      for (const interval of intervals) { const last=merged[merged.length-1]; if(!last || interval[0] > last[1]) merged.push([...interval] as [number,number]); else last[1]=Math.max(last[1],interval[1]); }
      value = merged.reduce((sum,[a,b])=>sum+(b-a)/3600000,0);
    } else if (sourceArbitratedKinds.includes(kind)) {
      // iPhone + Apple Watch can export overlapping activity samples. Use the largest
      // per-source daily total instead of blindly adding devices together.
      const bySource=new Map<string,number>();
      for(const row of items){const source=row.sourceName||'Apple Health';bySource.set(source,(bySource.get(source)||0)+row.value);}
      value=Math.max(...bySource.values());
    } else value = sumKinds.includes(kind) ? items.reduce((a,b)=>a+b.value,0) : avgKinds.includes(kind) ? items.reduce((a,b)=>a+b.value,0)/items.length : latest.value;
    aggregated.push({ ...latest, id: uid('apple-day', key), value: Math.round(value*100)/100, sourceName: items.length > 1 ? `${latest.sourceName || 'Apple Health'} · Tageswert` : latest.sourceName });
  }
  const cycleByDay = new Map<string, CycleEntry>();
  for (const item of cycle) { const d=new Date(item.createdAt); const key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; if(!cycleByDay.has(key)) cycleByDay.set(key,item); }
  const compactCycle = [...cycleByDay.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  aggregated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    metrics: aggregated,
    cycle: compactCycle,
    sourceRecords,
    ignoredRecords,
    rangeStart: dates.length ? new Date(Math.min(...dates)).toISOString() : undefined,
    rangeEnd: dates.length ? new Date(Math.max(...dates)).toISOString() : undefined,
  };
}

async function extractXml(uri: string, name?: string) {
  const file = new File(uri);
  if ((name || '').toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.base64(), { base64: true });
    const entry = zip.file(/(^|\/)export\.xml$/i)[0] || zip.file(/\.xml$/i)[0];
    if (!entry) throw new Error('In der ZIP-Datei wurde keine Apple-Health export.xml gefunden.');
    return entry.async('text');
  }
  return file.text();
}

export async function pickAndImportAppleHealth(days = 180): Promise<AppleHealthImport | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/xml', 'text/xml', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;
  const xml = await extractXml(picked.assets[0].uri, picked.assets[0].name);
  if (!xml.includes('<HealthData')) throw new Error('Die gewählte Datei sieht nicht wie ein Apple-Health-Export aus.');
  return parseExportXml(xml, days);
}
