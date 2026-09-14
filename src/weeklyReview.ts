import { HealthStore } from './types';
import { computeFoodGroupSignals, getOverallDataQuality, getTrackingDays, symptomScoreOrUndefined } from './analysis';
import type { CyclePreferences } from './onboarding';

export type WeeklyReview = {
  title: string;
  summary: string;
  trackingDays: number;
  meals: number;
  symptomCheckins: number;
  topSignal?: string;
  dataQuality: string;
  positives: string[];
  watch: string[];
};

export function buildWeeklyReview(store: HealthStore, prefs?: CyclePreferences, days = 7): WeeklyReview {
  const cutoff = Date.now() - days * 86400000;
  const meals = store.meals.filter(x=>new Date(x.createdAt).getTime()>=cutoff);
  const symptoms = store.symptoms.filter(x=>new Date(x.createdAt).getTime()>=cutoff && symptomScoreOrUndefined(x)!==undefined);
  const scoped: HealthStore = {
    ...store,
    meals,
    symptoms,
    bowel: store.bowel.filter(x=>new Date(x.createdAt).getTime()>=cutoff),
    cycle: store.cycle.filter(x=>new Date(x.createdAt).getTime()>=cutoff),
    observations: store.observations.filter(x=>new Date(x.createdAt).getTime()>=cutoff),
    medications: store.medications.filter(x=>new Date(x.createdAt).getTime()>=cutoff),
    healthMetrics: store.healthMetrics.filter(x=>new Date(x.createdAt).getTime()>=cutoff),
  };
  const quality = getOverallDataQuality(scoped);
  const signal = computeFoodGroupSignals(scoped, 8, prefs)[0];
  const scores = symptoms.map(x=>symptomScoreOrUndefined(x)!).filter(Number.isFinite);
  const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
  const positives:string[]=[]; const watch:string[]=[];
  if (meals.length >= 7) positives.push('Du hast regelmäßig Mahlzeiten dokumentiert.');
  if (symptoms.length >= 4) positives.push('Deine Check-ins liefern genug Kontext für erste Vergleiche.');
  if (avg <= 2 && symptoms.length) positives.push('Die dokumentierte Beschwerdelast war überwiegend niedrig.');
  if (signal?.delta > 0.8) watch.push(signal.friendly || `${signal.food} fiel häufiger vor Beschwerden auf.`);
  if (symptoms.length < 3) watch.push('Ein paar zusätzliche Körper-Check-ins würden die Datenlage deutlich verbessern.');
  return {
    title:'Deine Woche mit Noura',
    summary: signal?.friendly || (scores.length ? `Deine durchschnittliche dokumentierte Beschwerdelast lag bei ${avg.toFixed(1)} von 10.` : 'Noch zu wenig Daten für eine belastbare Wochenzusammenfassung.'),
    trackingDays:getTrackingDays(scoped), meals:meals.length, symptomCheckins:symptoms.length,
    topSignal:signal?.food, dataQuality:quality.label, positives, watch,
  };
}
