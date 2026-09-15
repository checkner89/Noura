import Constants from 'expo-constants';
import { HealthMetricEntry, CycleEntry } from './types';

export type LiveHealthResult = { metrics: HealthMetricEntry[]; cycle: CycleEntry[]; sourceRecords: number; note?: string };

function uid(prefix:string, seed:string){ let h=2166136261; for(let i=0;i<seed.length;i+=1)h=Math.imul(h^seed.charCodeAt(i),16777619); return `${prefix}-${(h>>>0).toString(36)}`; }
function dayStart(daysAgo:number){ const d=new Date(); d.setDate(d.getDate()-daysAgo); d.setHours(0,0,0,0); return d; }

export function isHealthKitCapabilityEnabled() {
  return Constants.expoConfig?.extra?.nouraCapabilities?.healthKit === true;
}

function maybeModule(): any {
  if (!isHealthKitCapabilityEnabled()) return null;
  try { return require('@appeeky/expo-healthkit'); } catch { return null; }
}

export function isDirectHealthKitModulePresent(){ return isHealthKitCapabilityEnabled() && !!maybeModule(); }

export async function requestDirectHealthAccess(): Promise<void> {
  if (!isHealthKitCapabilityEnabled()) {
    throw new Error('Dieser Noura-Build ist nicht mit der Apple-Health-Capability signiert. Nutze den Health-Export-Import oder installiere einen entsprechend signierten Build.');
  }
  const hk=maybeModule();
  if(!hk) throw new Error('Das Apple-Health-Modul ist in diesem Build nicht verfügbar. Nutze den Health-Export-Import.');
  const available = typeof hk.isAvailable === 'function' ? await Promise.resolve(hk.isAvailable()) : true;
  if(!available) throw new Error('Apple Health ist auf diesem Gerät nicht verfügbar.');
  const toRead = [
    'HKQuantityTypeIdentifierStepCount','HKQuantityTypeIdentifierBodyMass','HKQuantityTypeIdentifierBodyTemperature',
    'HKQuantityTypeIdentifierRestingHeartRate','HKQuantityTypeIdentifierActiveEnergyBurned','HKQuantityTypeIdentifierDietaryWater',
    'HKCategoryTypeIdentifierSleepAnalysis','HKCategoryTypeIdentifierMenstrualFlow',
  ];
  await hk.requestAuthorization({ toRead, toShare: [] });
}

async function queryQuantity(hk:any,type:string,unit:string,from:Date,to:Date,kind:HealthMetricEntry['kind']){
  if(typeof hk.queryQuantitySamples!=='function') return [] as HealthMetricEntry[];
  const rows = await hk.queryQuantitySamples({ type, unit, from, to, limit:5000, ascending:false });
  return (Array.isArray(rows)?rows:[]).map((r:any)=>({
    id:uid('hk',`${type}|${r.startDate||r.start||r.date}|${r.value}|${r.sourceName||''}`),
    createdAt:new Date(r.startDate||r.start||r.date||Date.now()).toISOString(), endAt:r.endDate?new Date(r.endDate).toISOString():undefined,
    kind, value:Number(r.value), unit, source:'apple-health-direct' as const, sourceName:r.sourceName||r.source?.name||'Apple Health',
  })).filter((x:HealthMetricEntry)=>Number.isFinite(x.value));
}

export async function syncDirectAppleHealth(days=30): Promise<LiveHealthResult> {
  if (!isHealthKitCapabilityEnabled()) {
    throw new Error('Direkter Apple-Health-Sync ist in diesem Sideload-Build deaktiviert, weil die HealthKit-Capability fehlt. Der Health-Export-Import funktioniert weiterhin.');
  }
  const hk=maybeModule(); if(!hk) throw new Error('Direkter Apple-Health-Zugriff ist in diesem Build nicht enthalten.');
  await requestDirectHealthAccess();
  const from=dayStart(days); const to=new Date();
  const specs:[string,string,HealthMetricEntry['kind']][]=[
    ['HKQuantityTypeIdentifierStepCount','count','steps'],['HKQuantityTypeIdentifierBodyMass','kg','weight'],
    ['HKQuantityTypeIdentifierBodyTemperature','degC','bodyTemperature'],['HKQuantityTypeIdentifierRestingHeartRate','count/min','restingHeartRate'],
    ['HKQuantityTypeIdentifierActiveEnergyBurned','kcal','activeEnergy'],['HKQuantityTypeIdentifierDietaryWater','mL','water'],
  ];
  const raw=(await Promise.all(specs.map(([t,u,k])=>queryQuantity(hk,t,u,from,to,k)))).flat();
  const bucket=new Map<string,HealthMetricEntry[]>();
  for(const x of raw){ const d=new Date(x.createdAt); const day=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; const key=`${day}|${x.kind}`; const list=bucket.get(key)||[]; list.push(x); bucket.set(key,list); }
  const metrics:HealthMetricEntry[]=[];
  for(const [key,items] of bucket){
    const latest=items.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    if (!latest) continue;
    const kind=latest.kind;
    let value:number;
    if(['steps','activeEnergy'].includes(kind)){
      const bySource=new Map<string,number>(); for(const row of items){const src=row.sourceName||'Apple Health';bySource.set(src,(bySource.get(src)||0)+row.value);}
      value=Math.max(...bySource.values());
    } else if(kind==='water') value=items.reduce((a,b)=>a+b.value,0);
    else value=items.reduce((a,b)=>a+b.value,0)/items.length;
    metrics.push({...latest,id:uid('hk-day',key),value:Math.round(value*100)/100});
  }
  // Sleep and cycle APIs differ slightly between HealthKit wrappers; keep them optional and non-fatal.
  const cycle:CycleEntry[]=[];
  try {
    if(typeof hk.queryCategorySamples==='function'){
      const sleep=await hk.queryCategorySamples({type:'HKCategoryTypeIdentifierSleepAnalysis',from,to,limit:5000,ascending:false});
      const intervalsByDay=new Map<string,Array<[number,number]>>();
      for(const r of Array.isArray(sleep)?sleep:[]){
        const start=new Date(r.startDate||r.start); const end=new Date(r.endDate||r.end);
        if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)continue;
        if(String(r.value||'').toLowerCase().includes('awake'))continue;
        const day=start.toISOString().slice(0,10); const list=intervalsByDay.get(day)||[]; list.push([start.getTime(),end.getTime()]); intervalsByDay.set(day,list);
      }
      for(const [day,intervals] of intervalsByDay){
        const sorted=intervals.sort((a,b)=>a[0]-b[0]); const merged:Array<[number,number]>=[];
        for(const [a,b] of sorted){const last=merged[merged.length-1];if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}
        const hours=merged.reduce((sum,[a,b])=>sum+(b-a)/3600000,0);
        metrics.push({id:uid('hk-sleep',day),createdAt:`${day}T07:00:00.000Z`,kind:'sleep',value:Math.round(hours*100)/100,unit:'h',source:'apple-health-direct',sourceName:'Apple Health'});
      }
      const flow=await hk.queryCategorySamples({type:'HKCategoryTypeIdentifierMenstrualFlow',from,to,limit:500,ascending:false});
      for(const r of Array.isArray(flow)?flow:[]){ const createdAt=new Date(r.startDate||r.start||Date.now()).toISOString(); cycle.push({id:uid('hk-cycle',`${createdAt}|${r.value}`),createdAt,bleeding:true,note:'Direkt aus Apple Health synchronisiert'}); }
    }
  } catch { /* optional types must never break quantity sync */ }
  return { metrics:metrics.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)), cycle, sourceRecords:raw.length, note:'Direkter HealthKit-Sync' };
}
