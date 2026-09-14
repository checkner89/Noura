import type { CyclePreferences } from './onboarding';
import { FOOD_GROUP_LABELS, inferFoodGroups } from './foodGroups';
import { FoodGroupId, HealthStore, TimelineItem } from './types';

export type FoodSignal = {
  food: string;
  occurrences: number;
  symptomMatches: number;
  counterExamples: number;
  exposedScore: number;
  baselineScore: number;
  controlSamples: number;
  delta: number;
  confidence: 'niedrig' | 'mittel' | 'höher';
  dataQuality: 'gering' | 'mittel' | 'gut';
  qualityScore: number;
  confounders: string[];
  windowLabel?: string;
  friendly?: string;
};

export type FoodGroupSignal = FoodSignal & { group: FoodGroupId };

export type DailyTrend = {
  key: string;
  label: string;
  symptomScore: number;
  temperature?: number;
  bowelCount: number;
  mealCount: number;
  cycleSymptomScore: number;
  bleeding: boolean;
};

export type CycleContext = {
  latestEntry?: HealthStore['cycle'][number];
  bleedingToday: boolean;
  cycleEntries: number;
  lastPeriodStart?: string;
  estimatedCycleDay?: number;
  estimatedPhase?: CyclePhase;
  recentAverageCramps: number;
  recentAverageCravings: number;
};

export type CyclePhase = 'Menstruation' | 'Follikelphase' | 'Ovulationsfenster' | 'Lutealphase' | 'Unklar';
export type CycleSymptomSignal = { phase: CyclePhase; symptomScore: number; samples: number; baseline: number; delta: number };
export type FoodCycleSignal = { food: string; phase: CyclePhase; occurrences: number; symptomMatches: number; averageScore: number; baselineScore: number; delta: number };

const DAY_MS = 86400000;
function startOfDay(value: Date) { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; }
function dayKey(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isToday(iso: string) { return dayKey(iso) === dayKey(new Date()); }

function defined(values: Array<number | undefined>) { return values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)); }
export function symptomScoreOrUndefined(entry: HealthStore['symptoms'][number]) {
  const values = defined([entry.pain, entry.bloating, entry.nausea, entry.heartburn]);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}
export function symptomScore(entry: HealthStore['symptoms'][number]) { return symptomScoreOrUndefined(entry) ?? 0; }
export function hasSymptomValues(entry: HealthStore['symptoms'][number]) { return symptomScoreOrUndefined(entry) !== undefined; }
function cycleSymptomScore(entry: HealthStore['cycle'][number]) {
  const values = defined([entry.cramps, entry.cravings, entry.headache, entry.breastTenderness]);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function severityWord(value?: number) {
  if (value == null) return 'nicht erfasst';
  if (value <= 0) return 'keine';
  if (value <= 3) return 'leicht';
  if (value <= 6) return 'mittel';
  if (value <= 8) return 'stark';
  return 'sehr stark';
}

function getBleedingDayKeys(store: HealthStore) { return new Set(store.cycle.filter(x => x.bleeding).map(x => dayKey(x.createdAt))); }
function getPeriodStarts(store: HealthStore): Date[] {
  const bleedingKeys = Array.from(getBleedingDayKeys(store)).sort();
  const starts: Date[] = [];
  let previous: Date | undefined;
  for (const key of bleedingKeys) {
    const date = startOfDay(new Date(`${key}T12:00:00`));
    if (!previous || Math.round((date.getTime() - previous.getTime()) / DAY_MS) > 2) starts.push(date);
    previous = date;
  }
  return starts;
}

function lastPeriodStart(store: HealthStore, prefs?: CyclePreferences, target = new Date()) {
  const configured = prefs?.lastPeriodStart ? startOfDay(new Date(prefs.lastPeriodStart)) : undefined;
  const observed = getPeriodStarts(store).filter(x => x.getTime() <= target.getTime()).sort((a, b) => b.getTime() - a.getTime())[0];
  if (observed && configured) return observed.getTime() >= configured.getTime() ? observed : configured;
  return observed || configured;
}

export function estimateCycleDayForDate(store: HealthStore, dateValue: string | Date, prefs?: CyclePreferences): number | undefined {
  const target = startOfDay(typeof dateValue === 'string' ? new Date(dateValue) : dateValue);
  const last = lastPeriodStart(store, prefs, target);
  if (!last || Number.isNaN(last.getTime())) return undefined;
  const length = Math.max(18, Math.min(60, prefs?.averageCycleLength || 28));
  let day = Math.floor((target.getTime() - last.getTime()) / DAY_MS) + 1;
  if (day <= 0) return undefined;
  if (day > length) day = ((day - 1) % length) + 1;
  return day;
}

export function phaseForCycleDay(day?: number, prefs?: CyclePreferences): CyclePhase {
  if (!day) return 'Unklar';
  const length = Math.max(18, Math.min(60, prefs?.averageCycleLength || 28));
  const periodLength = Math.max(1, Math.min(14, prefs?.periodLength || 5));
  if (day <= periodLength) return 'Menstruation';
  const ovulation = Math.max(periodLength + 3, length - 14);
  if (day < ovulation - 2) return 'Follikelphase';
  if (day <= ovulation + 2) return 'Ovulationsfenster';
  if (day <= length) return 'Lutealphase';
  return 'Unklar';
}

export function cyclePhaseForDate(store: HealthStore, dateValue: string | Date, prefs?: CyclePreferences): CyclePhase {
  const key = dayKey(dateValue);
  if (store.cycle.some(x => dayKey(x.createdAt) === key && x.bleeding)) return 'Menstruation';
  return phaseForCycleDay(estimateCycleDayForDate(store, dateValue, prefs), prefs);
}

export function getCycleContext(store: HealthStore, prefs?: CyclePreferences): CycleContext {
  const sorted = store.cycle.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = sorted.slice(0, 7);
  const avg = (values: Array<number | undefined>) => { const x = defined(values); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0; };
  const last = lastPeriodStart(store, prefs);
  const estimatedCycleDay = estimateCycleDayForDate(store, new Date(), prefs);
  return {
    latestEntry: sorted[0],
    bleedingToday: store.cycle.some(x => isToday(x.createdAt) && x.bleeding),
    cycleEntries: store.cycle.length,
    lastPeriodStart: last?.toISOString(),
    estimatedCycleDay,
    estimatedPhase: phaseForCycleDay(estimatedCycleDay, prefs),
    recentAverageCramps: avg(recent.map(x => x.cramps)),
    recentAverageCravings: avg(recent.map(x => x.cravings)),
  };
}

export function getTodaySummary(store: HealthStore) {
  const meals = store.meals.filter(x => isToday(x.createdAt));
  const symptoms = store.symptoms.filter(x => isToday(x.createdAt));
  const bowel = store.bowel.filter(x => isToday(x.createdAt));
  const cycle = store.cycle.filter(x => isToday(x.createdAt));
  const observations = store.observations.filter(x => isToday(x.createdAt));
  const latestSymptom = symptoms.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestBowel = bowel.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestCycle = cycle.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    mealCount: meals.length,
    latestTemperature: latestSymptom?.temperature,
    latestBristol: latestBowel?.bristolType,
    symptomScore: latestSymptom ? symptomScore(latestSymptom) : undefined,
    latestCycle,
    observationCount: observations.length,
    trackedToday: meals.length + symptoms.length + bowel.length + cycle.length + observations.length,
  };
}

function symptomTimelineSubtitle(entry: HealthStore['symptoms'][number]) {
  const bits: string[] = [];
  if (entry.bloating != null) bits.push(`Blähungen ${severityWord(entry.bloating)}`);
  if (entry.pain != null) bits.push(`Bauchschmerzen ${severityWord(entry.pain)}`);
  if (entry.nausea != null) bits.push(`Übelkeit ${severityWord(entry.nausea)}`);
  if (entry.heartburn != null) bits.push(`Sodbrennen ${severityWord(entry.heartburn)}`);
  if (entry.temperature != null) bits.push(`${entry.temperature.toFixed(1)} °C`);
  if (entry.energy != null) bits.push(`Energie ${entry.energy}/10`);
  return bits.join(' · ') || entry.note || 'Körper-Check-in';
}

export function getTimeline(store: HealthStore, limit = 10): TimelineItem[] {
  const meals: TimelineItem[] = store.meals.map(entry => ({ kind: 'meal', id: entry.id, createdAt: entry.createdAt, title: entry.mealType, subtitle: entry.foods.map(x => x.name).join(', ') || 'Keine Lebensmittel', accent: 'meal' }));
  const symptoms: TimelineItem[] = store.symptoms.map(entry => ({ kind: 'symptom', id: entry.id, createdAt: entry.createdAt, title: 'Körpergefühl', subtitle: symptomTimelineSubtitle(entry), accent: 'symptom' }));
  const bowel: TimelineItem[] = store.bowel.map(entry => ({ kind: 'bowel', id: entry.id, createdAt: entry.createdAt, title: 'Stuhlgang', subtitle: `Bristol Typ ${entry.bristolType}${entry.blood ? ' · Blut angegeben' : ''}${entry.mucus ? ' · Schleim angegeben' : ''}`, accent: 'bowel' }));
  const cycle: TimelineItem[] = store.cycle.map(entry => ({ kind: 'cycle', id: entry.id, createdAt: entry.createdAt, title: 'Zyklus', subtitle: entry.bleeding ? `Periode${entry.flow ? ` · ${entry.flow}` : ''}${entry.cramps != null ? ` · Krämpfe ${severityWord(entry.cramps)}` : ''}` : [entry.cramps != null ? `Krämpfe ${severityWord(entry.cramps)}` : '', entry.cravings != null ? `Cravings ${severityWord(entry.cravings)}` : ''].filter(Boolean).join(' · ') || 'Zyklus-Check-in', accent: 'cycle' }));
  const observations: TimelineItem[] = store.observations.map(entry => ({ kind: 'observation', id: entry.id, createdAt: entry.createdAt, title: 'Beobachtung', subtitle: entry.text, accent: 'observation' }));
  const medications: TimelineItem[] = store.medications.map(entry => ({ kind: 'medication', id: entry.id, createdAt: entry.createdAt, title: entry.kind === 'supplement' ? 'Supplement' : 'Medikament', subtitle: `${entry.name}${entry.dose ? ` · ${entry.dose}` : ''}`, accent: 'medication' }));
  const metricName = (kind: string) => kind === 'weight' ? 'Gewicht' : kind === 'sleep' ? 'Schlaf' : kind === 'steps' ? 'Schritte' : kind === 'bodyTemperature' ? 'Körpertemperatur' : kind === 'restingHeartRate' ? 'Ruhepuls' : kind === 'water' ? 'Wasser' : 'Aktive Energie';
  const metrics: TimelineItem[] = store.healthMetrics.map(entry => ({ kind: 'metric', id: entry.id, createdAt: entry.createdAt, title: metricName(entry.kind), subtitle: `${Math.round(entry.value * 10) / 10} ${entry.unit}${entry.source === 'manual' ? '' : ' · Apple Health'}`, accent: 'metric' }));
  return [...meals, ...symptoms, ...bowel, ...cycle, ...observations, ...medications, ...metrics].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function buildDailyTrends(store: HealthStore, days = 7): DailyTrend[] {
  const result: DailyTrend[] = [];
  const today = startOfDay(new Date());
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today); date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    const symptoms = store.symptoms.filter(x => dayKey(x.createdAt) === key);
    const cycles = store.cycle.filter(x => dayKey(x.createdAt) === key);
    const temps = defined(symptoms.map(x => x.temperature));
    const scores = symptoms.map(symptomScoreOrUndefined).filter((x): x is number => x !== undefined);
    result.push({
      key,
      label: date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
      symptomScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      temperature: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : undefined,
      bowelCount: store.bowel.filter(x => dayKey(x.createdAt) === key).length,
      mealCount: store.meals.filter(x => dayKey(x.createdAt) === key).length,
      cycleSymptomScore: cycles.length ? cycles.map(cycleSymptomScore).reduce((a, b) => a + b, 0) / cycles.length : 0,
      bleeding: cycles.some(x => x.bleeding),
    });
  }
  return result;
}

function normaliseFood(name: string) { return name.trim().toLocaleLowerCase('de-DE'); }
function validSymptoms(store: HealthStore) { return store.symptoms.filter(hasSymptomValues); }
function baselineFor(store: HealthStore) {
  const scores = validSymptoms(store).map(x => symptomScoreOrUndefined(x)!).filter(Number.isFinite);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}
function confidenceFor(occurrences: number, matches: number, controls: number): FoodSignal['confidence'] {
  return occurrences >= 8 && matches >= 5 && controls >= 5 ? 'höher' : occurrences >= 4 && matches >= 3 && controls >= 3 ? 'mittel' : 'niedrig';
}
function sleepHoursNear(store: HealthStore, time: number) {
  const candidates = store.healthMetrics.filter(x => x.kind === 'sleep' && new Date(x.createdAt).getTime() <= time && time - new Date(x.createdAt).getTime() <= 36 * 3600000);
  return candidates.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]?.value;
}
function confoundersFor(store: HealthStore, meals: HealthStore['meals'], matchedSymptoms: HealthStore['symptoms'], prefs?: CyclePreferences) {
  const notes: string[] = [];
  if (!matchedSymptoms.length) return notes;
  const phases = new Map<string, number>();
  matchedSymptoms.forEach(x => { const phase = cyclePhaseForDate(store, x.createdAt, prefs); if (phase !== 'Unklar') phases.set(phase, (phases.get(phase) || 0) + 1); });
  const topPhase = [...phases.entries()].sort((a,b)=>b[1]-a[1])[0];
  if (topPhase && topPhase[1] / matchedSymptoms.length >= 0.55 && matchedSymptoms.length >= 3) notes.push(`Viele Treffer liegen in der ${topPhase[0]}.`);
  const highStress = matchedSymptoms.filter(x => (x.stress ?? 0) >= 7).length;
  if (highStress >= 2 && highStress / matchedSymptoms.length >= 0.4) notes.push('Stress war bei mehreren Treffern ebenfalls hoch.');
  const poorSleep = matchedSymptoms.filter(x => { const h = sleepHoursNear(store, new Date(x.createdAt).getTime()); return h != null && h < 6.5; }).length;
  if (poorSleep >= 2 && poorSleep / matchedSymptoms.length >= 0.4) notes.push('Kurzer Schlaf trat bei mehreren Treffern gleichzeitig auf.');
  const medOverlap = matchedSymptoms.filter(sym => store.medications.some(m => Math.abs(new Date(m.createdAt).getTime() - new Date(sym.createdAt).getTime()) <= 6 * 3600000)).length;
  if (medOverlap >= 2 && medOverlap / matchedSymptoms.length >= 0.4) notes.push('Medikamente/Supplements lagen bei mehreren Treffern zeitlich nah.');
  const eveningMeals = meals.filter(m => new Date(m.createdAt).getHours() >= 18).length;
  if (eveningMeals >= 3 && eveningMeals / meals.length >= 0.7) notes.push('Die Exposition fand überwiegend abends statt.');
  return notes.slice(0, 3);
}
function qualityFor(occurrences: number, matches: number, controls: number, counterExamples: number, distinctDays: number) {
  let score = 0;
  score += Math.min(30, occurrences * 4);
  score += Math.min(25, matches * 5);
  score += Math.min(20, controls * 3);
  score += Math.min(15, distinctDays * 2);
  if (counterExamples > 0) score += Math.min(10, counterExamples * 2);
  score = Math.min(100, score);
  const label: FoodSignal['dataQuality'] = score >= 72 ? 'gut' : score >= 45 ? 'mittel' : 'gering';
  return { score, label };
}
function signalForMeals(store: HealthStore, label: string, meals: HealthStore['meals'], startHour: number, endHour: number, prefs?: CyclePreferences): FoodSignal | undefined {
  const symptoms = validSymptoms(store);
  if (meals.length < 2 || symptoms.length < 3) return undefined;
  const matchedScores: number[] = [];
  const matchedSymptoms: HealthStore['symptoms'] = [];
  let matchedMeals = 0;
  let counterExamples = 0;
  const exposureWindows = meals.map(meal => {
    const t = new Date(meal.createdAt).getTime();
    return [t + startHour * 3600000, t + endHour * 3600000] as const;
  });
  for (const meal of meals) {
    const mealTime = new Date(meal.createdAt).getTime(); const start = mealTime + startHour * 3600000; const end = mealTime + endHour * 3600000;
    const matches = symptoms.filter(sym => { const time = new Date(sym.createdAt).getTime(); return time >= start && time <= end; });
    if (matches.length) {
      matchedMeals += 1;
      const strongest = matches.slice().sort((a,b)=>(symptomScoreOrUndefined(b) ?? 0)-(symptomScoreOrUndefined(a) ?? 0))[0];
      if (strongest) {
        const strongestScore = symptomScoreOrUndefined(strongest);
        if (strongestScore != null) matchedScores.push(strongestScore);
        matchedSymptoms.push(strongest);
      }
    } else counterExamples += 1;
  }
  if (!matchedScores.length) return undefined;
  const controls = symptoms.filter(sym => {
    const t = new Date(sym.createdAt).getTime();
    return !exposureWindows.some(([start,end]) => t >= start && t <= end);
  }).map(x => symptomScoreOrUndefined(x)!).filter(Number.isFinite);
  const globalBaseline = baselineFor(store);
  const baseline = controls.length ? controls.reduce((a,b)=>a+b,0)/controls.length : globalBaseline;
  const exposed = matchedScores.reduce((a,b)=>a+b,0)/matchedScores.length;
  const delta = exposed - baseline;
  if (delta <= 0.35) return undefined;
  const days = new Set(meals.map(x => dayKey(x.createdAt))).size;
  const quality = qualityFor(meals.length, matchedMeals, controls.length, counterExamples, days);
  const confounders = confoundersFor(store, meals, matchedSymptoms, prefs);
  return {
    food: label,
    occurrences: meals.length,
    symptomMatches: matchedMeals,
    counterExamples,
    exposedScore: exposed,
    baselineScore: baseline,
    controlSamples: controls.length,
    delta,
    confidence: confidenceFor(meals.length, matchedMeals, controls.length),
    dataQuality: quality.label,
    qualityScore: quality.score,
    confounders,
    windowLabel: `${startHour}–${endHour} h`,
    friendly: `${label} fiel bei ${matchedMeals} von ${meals.length} dokumentierten Gelegenheiten im Zeitraum ${startHour}–${endHour} Stunden vor stärkeren Beschwerden auf.${counterExamples ? ` ${counterExamples} Gegenbeispiel${counterExamples === 1 ? '' : 'e'} sind ebenfalls vorhanden.` : ''}`,
  };
}

export function computeFoodSignalsWindow(store: HealthStore, startHour = 0, endHour = 8, prefs?: CyclePreferences): FoodSignal[] {
  if (store.meals.length < 3 || validSymptoms(store).length < 3 || endHour <= startHour) return [];
  const occurrences = new Map<string, { display: string; meals: HealthStore['meals'] }>();
  for (const meal of store.meals) {
    const uniqueNames = new Set(meal.foods.map(x => normaliseFood(x.name)).filter(Boolean));
    for (const name of uniqueNames) {
      const existing = occurrences.get(name) || { display: meal.foods.find(x => normaliseFood(x.name) === name)?.name || name, meals: [] };
      existing.meals.push(meal); occurrences.set(name, existing);
    }
  }
  return Array.from(occurrences.values()).map(item => signalForMeals(store, item.display, item.meals, startHour, endHour, prefs)).filter((x): x is FoodSignal => !!x).sort((a, b) => (b.qualityScore + b.delta * 6) - (a.qualityScore + a.delta * 6)).slice(0, 8);
}

export function computeFoodSignals(store: HealthStore, windowHours = 8, prefs?: CyclePreferences) { return computeFoodSignalsWindow(store, 0, windowHours, prefs); }

export function computeFoodGroupSignals(store: HealthStore, windowHours = 8, prefs?: CyclePreferences): FoodGroupSignal[] {
  if (store.meals.length < 3 || validSymptoms(store).length < 3) return [];
  const map = new Map<FoodGroupId, HealthStore['meals']>();
  for (const meal of store.meals) {
    const groups = new Set(meal.foods.flatMap(food => inferFoodGroups(food)));
    for (const group of groups) { const list = map.get(group) || []; list.push(meal); map.set(group, list); }
  }
  return Array.from(map.entries()).map(([group, meals]) => {
    const signal = signalForMeals(store, FOOD_GROUP_LABELS[group], meals, 0, windowHours, prefs);
    return signal ? { ...signal, group } : undefined;
  }).filter((x): x is FoodGroupSignal => !!x).sort((a, b) => (b.qualityScore + b.delta * 6) - (a.qualityScore + a.delta * 6)).slice(0, 8);
}

export function getOverallDataQuality(store: HealthStore) {
  const days = getTrackingDays(store);
  const valid = validSymptoms(store).length;
  const meals = store.meals.length;
  const coverage = Math.min(100, Math.round(days * 2.5 + Math.min(30, meals) + Math.min(30, valid)));
  const label = coverage >= 75 ? 'gut' : coverage >= 45 ? 'mittel' : 'gering';
  return {
    score: coverage,
    label,
    trackingDays: days,
    meals,
    symptomCheckins: valid,
    cycleEntries: store.cycle.length,
    medicationEntries: store.medications.length,
    contextMetrics: store.healthMetrics.length,
  } as const;
}

export function computeCycleSymptomSignals(store: HealthStore, prefs?: CyclePreferences): CycleSymptomSignal[] {
  const valid = validSymptoms(store);
  if (valid.length < 4) return [];
  const baselineValues = valid.map(x => symptomScoreOrUndefined(x)!); const baseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  const buckets = new Map<CyclePhase, number[]>();
  for (const entry of valid) { const phase = cyclePhaseForDate(store, entry.createdAt, prefs); if (phase === 'Unklar') continue; const values = buckets.get(phase) || []; values.push(symptomScore(entry)); buckets.set(phase, values); }
  return Array.from(buckets.entries()).map(([phase, values]) => { const score = values.reduce((a, b) => a + b, 0) / values.length; return { phase, symptomScore: score, samples: values.length, baseline, delta: score - baseline }; }).filter(x => x.samples >= 2).sort((a, b) => b.delta - a.delta);
}

export function computeFoodCycleSignals(store: HealthStore, windowHours = 8, prefs?: CyclePreferences): FoodCycleSignal[] {
  const valid = validSymptoms(store);
  if (store.meals.length < 6 || valid.length < 6) return [];
  const baseline = baselineFor(store); const map = new Map<string, { food: string; phase: CyclePhase; scores: number[]; occurrences: number }>();
  for (const meal of store.meals) {
    const phase = cyclePhaseForDate(store, meal.createdAt, prefs); if (phase === 'Unklar') continue;
    const start = new Date(meal.createdAt).getTime(); const end = start + windowHours * 3600000;
    const matches = valid.filter(x => { const t = new Date(x.createdAt).getTime(); return t >= start && t <= end; });
    const uniqueFoods = Array.from(new Set(meal.foods.map(x => x.name.trim()).filter(Boolean)));
    for (const food of uniqueFoods) { const key = `${normaliseFood(food)}|${phase}`; const current = map.get(key) || { food, phase, scores: [], occurrences: 0 }; current.occurrences += 1; if (matches.length) current.scores.push(Math.max(...matches.map(symptomScore))); map.set(key, current); }
  }
  return Array.from(map.values()).filter(x => x.occurrences >= 2 && x.scores.length >= 2).map(x => { const averageScore = x.scores.reduce((a, b) => a + b, 0) / x.scores.length; return { food: x.food, phase: x.phase, occurrences: x.occurrences, symptomMatches: x.scores.length, averageScore, baselineScore: baseline, delta: averageScore - baseline }; }).filter(x => x.delta > 0.5).sort((a, b) => b.delta - a.delta).slice(0, 8);
}

export function getTrackingDays(store: HealthStore) {
  const keys = new Set<string>();
  for (const group of [store.meals, store.symptoms, store.bowel, store.cycle, store.observations, store.medications, store.healthMetrics]) for (const x of group) keys.add(dayKey(x.createdAt));
  return keys.size;
}

export function computePersonalDayScore(store: HealthStore) {
  const latest = store.symptoms.filter(x => isToday(x.createdAt) && hasSymptomValues(x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return { score: undefined as number | undefined, baselineScore: undefined as number | undefined, delta: undefined as number | undefined };
  const burden = symptomScore(latest);
  const energyBonus = latest.energy == null ? 0 : (latest.energy - 5) * 2.2;
  const stressPenalty = latest.stress == null ? 0 : (latest.stress - 5) * 1.7;
  const score = Math.max(0, Math.min(100, Math.round(82 - burden * 5.6 + energyBonus - stressPenalty)));
  const recent = store.symptoms.filter(x => !isToday(x.createdAt) && hasSymptomValues(x)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 14);
  const recentScores = recent.map(x => Math.max(0, Math.min(100, Math.round(82 - symptomScore(x) * 5.6 + ((x.energy ?? 5) - 5) * 2.2 - ((x.stress ?? 5) - 5) * 1.7))));
  const baselineScore = recentScores.length ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : undefined;
  return { score, baselineScore, delta: baselineScore == null ? undefined : score - baselineScore };
}

export function buildAISummary(store: HealthStore, prefs?: CyclePreferences) {
  const signals = computeFoodSignals(store, 8, prefs).slice(0, 5);
  const groupSignals = computeFoodGroupSignals(store, 8, prefs).slice(0, 5);
  const trends = buildDailyTrends(store, 14);
  return {
    trackingDays: getTrackingDays(store),
    recordCounts: { meals: store.meals.length, symptoms: validSymptoms(store).length, bowel: store.bowel.length, cycle: store.cycle.length, observations: store.observations.length, medications: store.medications.length, appleHealth: store.healthMetrics.length },
    dataQuality: getOverallDataQuality(store),
    foodSignals: signals,
    foodGroupSignals: groupSignals,
    cycleContext: getCycleContext(store, prefs),
    cycleSymptomSignals: computeCycleSymptomSignals(store, prefs).slice(0, 4),
    foodCycleSignals: computeFoodCycleSignals(store, 8, prefs).slice(0, 5),
    recentObservations: store.observations.slice(0, 12),
    recentMedications: store.medications.slice(0, 12),
    recentHealthMetrics: store.healthMetrics.slice(0, 40),
    recentDailyTrends: trends,
  };
}
