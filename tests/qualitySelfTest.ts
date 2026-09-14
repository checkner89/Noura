import { computeFoodSignalsWindow, computeFoodGroupSignals, getOverallDataQuality } from '../src/analysis';
import { getMedicalSafetyAlerts } from '../src/medicalSafety';
import { buildWeeklyReview } from '../src/weeklyReview';
import { HealthStore } from '../src/types';

const base=():HealthStore=>({schemaVersion:6,meals:[],symptoms:[],bowel:[],cycle:[],observations:[],medications:[],healthMetrics:[],savedDishes:[],deleted:[]});
const iso=(day:number,hour:number)=>new Date(Date.UTC(2026,8,day,hour)).toISOString();
const s=base();
for(let d=1;d<=8;d++){
  s.meals.push({id:`m${d}`,createdAt:iso(d,12),mealType:'Mittagessen',foods:[{id:`f${d}`,name:d<=6?'Naturjoghurt':'Reis',source:'manual'}]});
  if(d!==6) s.symptoms.push({id:`s${d}`,createdAt:iso(d,15),bloating:d<=5?7:1,pain:d<=5?4:0});
}
s.symptoms.push({id:'ctrl',createdAt:iso(9,15),bloating:1,pain:0});
const signals=computeFoodSignalsWindow(s,0,5,{averageCycleLength:28,periodLength:5,lastPeriodStart:iso(1,8)});
if(!signals[0] || signals[0].controlSamples<1 || signals[0].counterExamples<1) throw new Error('Signal must include controls/counterexamples');
if(!computeFoodGroupSignals(s,5).some(x=>x.group==='dairy')) throw new Error('Dairy grouping failed');
const quality=getOverallDataQuality(s); if(quality.trackingDays<7) throw new Error('Tracking day quality failed');
const weekly=buildWeeklyReview(s,undefined,7); if(!weekly.summary) throw new Error('Weekly review missing');
const danger=base(); danger.bowel.push({id:'b1',createdAt:new Date().toISOString(),bristolType:4,blood:true});
if(!getMedicalSafetyAlerts(danger).some(x=>x.id==='blood-stool')) throw new Error('Safety guardrail failed');
console.log('Noura quality self-test OK');
