import { computeFoodSignalsWindow, computeFoodGroupSignals, getOverallDataQuality, estimateCycleDayForDate, phaseForCycleDay } from '../src/analysis';
import { HealthStore } from '../src/types';

function iso(day:number,hour:number){return new Date(Date.UTC(2026,8,day,hour,0,0)).toISOString();}
const store:HealthStore={schemaVersion:6,meals:[],symptoms:[],bowel:[],cycle:[],observations:[],medications:[],healthMetrics:[],savedDishes:[],deleted:[]};
for(let i=1;i<=6;i++){
  store.meals.push({id:`m${i}`,createdAt:iso(i,12),mealType:'Mittagessen',foods:[{id:`f${i}`,name:'Naturjoghurt',source:'manual'}]});
  if(i<=5) store.symptoms.push({id:`s${i}`,createdAt:iso(i,15),bloating:7,pain:4});
}
for(let i=7;i<=11;i++) store.symptoms.push({id:`c${i}`,createdAt:iso(i,15),bloating:1,pain:0});
const signals=computeFoodSignalsWindow(store,0,5,{averageCycleLength:28,periodLength:5,lastPeriodStart:iso(1,12)});
const top=signals[0];
if(!top) throw new Error('Expected food signal');
if(top.symptomMatches<5) throw new Error('Expected symptom matches');
if(top.controlSamples<4) throw new Error('Expected controls');
const groups=computeFoodGroupSignals(store,5,{averageCycleLength:28,periodLength:5,lastPeriodStart:iso(1,12)});
if(!groups.some(x=>x.group==='dairy')) throw new Error('Expected dairy group');
const quality=getOverallDataQuality(store); if(quality.symptomCheckins!==10) throw new Error('Quality check-in count wrong');
const day=estimateCycleDayForDate(store,iso(10,12),{averageCycleLength:28,periodLength:5,lastPeriodStart:iso(1,12)}); if(day!==10) throw new Error(`Cycle day wrong ${day}`);
if(phaseForCycleDay(2,{averageCycleLength:28,periodLength:5})!=='Menstruation') throw new Error('Phase wrong');
console.log('Noura analysis self-test OK', {top:top.food, quality:top.dataQuality, controls:top.controlSamples});
