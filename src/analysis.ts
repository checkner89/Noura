import { HealthStore, TimelineItem } from './types';

export type FoodSignal = {
  food: string;
  occurrences: number;
  symptomMatches: number;
  exposedScore: number;
  baselineScore: number;
  delta: number;
  confidence: 'niedrig' | 'mittel' | 'höher';
  windowLabel?: string;
};

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

export type CycleSymptomSignal = {
  phase: CyclePhase;
  symptomScore: number;
  samples: number;
  baseline: number;
  delta: number;
};

export type FoodCycleSignal = {
  food: string;
  phase: CyclePhase;
  occurrences: number;
  symptomMatches: number;
  averageScore: number;
  baselineScore: number;
  delta: number;
};

function startOfDay(value: Date) { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; }
function dayKey(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isToday(iso: string) { return dayKey(iso) === dayKey(new Date()); }
export function symptomScore(entry: HealthStore['symptoms'][number]) { return (entry.pain + entry.bloating + entry.nausea + entry.heartburn) / 4; }
function cycleSymptomScore(entry: HealthStore['cycle'][number]) { return (entry.cramps + entry.cravings + entry.headache + entry.breastTenderness) / 4; }

function getBleedingDayKeys(store: HealthStore) {
  return new Set(store.cycle.filter(x => x.bleeding).map(x => dayKey(x.createdAt)));
}

function getPeriodStarts(store: HealthStore): Date[] {
  const bleedingKeys = Array.from(getBleedingDayKeys(store)).sort();
  const starts: Date[] = [];
  let previous: Date | undefined;
  for (const key of bleedingKeys) {
    const date = startOfDay(new Date(`${key}T12:00:00`));
    if (!previous || Math.round((date.getTime() - previous.getTime()) / 86400000) > 2) starts.push(date);
    previous = date;
  }
  return starts;
}

export function estimateCycleDayForDate(store: HealthStore, dateValue: string | Date): number | undefined {
  const target = startOfDay(typeof dateValue === 'string' ? new Date(dateValue) : dateValue);
  const starts = getPeriodStarts(store).filter(x => x.getTime() <= target.getTime()).sort((a, b) => b.getTime() - a.getTime());
  const last = starts[0];
  if (!last) return undefined;
  const day = Math.floor((target.getTime() - last.getTime()) / 86400000) + 1;
  return day > 0 && day <= 45 ? day : undefined;
}

export function phaseForCycleDay(day?: number): CyclePhase {
  if (!day) return 'Unklar';
  if (day <= 5) return 'Menstruation';
  if (day <= 12) return 'Follikelphase';
  if (day <= 16) return 'Ovulationsfenster';
  if (day <= 35) return 'Lutealphase';
  return 'Unklar';
}

export function cyclePhaseForDate(store: HealthStore, dateValue: string | Date): CyclePhase {
  const key = dayKey(dateValue);
  if (store.cycle.some(x => dayKey(x.createdAt) === key && x.bleeding)) return 'Menstruation';
  return phaseForCycleDay(estimateCycleDayForDate(store, dateValue));
}

export function getCycleContext(store: HealthStore): CycleContext {
  const sorted = store.cycle.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = sorted.slice(0, 7);
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const starts = getPeriodStarts(store).sort((a, b) => b.getTime() - a.getTime());
  const lastPeriodStart = starts[0];
  const estimatedCycleDay = estimateCycleDayForDate(store, new Date());
  return {
    latestEntry: sorted[0],
    bleedingToday: store.cycle.some(x => isToday(x.createdAt) && x.bleeding),
    cycleEntries: store.cycle.length,
    lastPeriodStart: lastPeriodStart?.toISOString(),
    estimatedCycleDay,
    estimatedPhase: phaseForCycleDay(estimatedCycleDay),
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
  const kcal = meals.reduce((sum, meal) => sum + meal.foods.reduce((inner, food) => inner + (food.kcal || 0), 0), 0);
  return {
    mealCount: meals.length,
    kcal,
    latestTemperature: latestSymptom?.temperature,
    latestBristol: latestBowel?.bristolType,
    symptomScore: latestSymptom ? symptomScore(latestSymptom) : undefined,
    latestCycle,
    observationCount: observations.length,
    trackedToday: meals.length + symptoms.length + bowel.length + cycle.length + observations.length,
  };
}

export function getTimeline(store: HealthStore, limit = 10): TimelineItem[] {
  const meals: TimelineItem[] = store.meals.map(entry => ({ kind: 'meal', id: entry.id, createdAt: entry.createdAt, title: entry.mealType, subtitle: entry.foods.map(x => x.name).join(', ') || 'Keine Lebensmittel', accent: 'meal' }));
  const symptoms: TimelineItem[] = store.symptoms.map(entry => ({ kind: 'symptom', id: entry.id, createdAt: entry.createdAt, title: 'Wie es dir ging', subtitle: `Blähungen ${entry.bloating}/10 · Schmerzen ${entry.pain}/10${entry.temperature ? ` · ${entry.temperature.toFixed(1)} °C` : ''}`, accent: 'symptom' }));
  const bowel: TimelineItem[] = store.bowel.map(entry => ({ kind: 'bowel', id: entry.id, createdAt: entry.createdAt, title: 'Stuhlgang', subtitle: `Bristol Typ ${entry.bristolType} · Dringlichkeit ${entry.urgency}/3`, accent: 'bowel' }));
  const cycle: TimelineItem[] = store.cycle.map(entry => ({ kind: 'cycle', id: entry.id, createdAt: entry.createdAt, title: 'Zyklus', subtitle: entry.bleeding ? `Periode · ${entry.flow || 'Stärke offen'} · Krämpfe ${entry.cramps}/10` : `Keine Blutung · Krämpfe ${entry.cramps}/10 · Cravings ${entry.cravings}/10`, accent: 'cycle' }));
  const observations: TimelineItem[] = store.observations.map(entry => ({ kind: 'observation', id: entry.id, createdAt: entry.createdAt, title: 'Auffälligkeit', subtitle: entry.text, accent: 'observation' }));
  return [...meals, ...symptoms, ...bowel, ...cycle, ...observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function buildDailyTrends(store: HealthStore, days = 7): DailyTrend[] {
  const result: DailyTrend[] = [];
  const today = startOfDay(new Date());
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today); date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    const symptoms = store.symptoms.filter(x => dayKey(x.createdAt) === key);
    const cycles = store.cycle.filter(x => dayKey(x.createdAt) === key);
    const temps = symptoms.map(x => x.temperature).filter((x): x is number => typeof x === 'number');
    const scores = symptoms.map(symptomScore);
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

export function computeFoodSignalsWindow(store: HealthStore, startHour = 0, endHour = 8): FoodSignal[] {
  if (store.meals.length < 3 || store.symptoms.length < 3 || endHour <= startHour) return [];
  const baselineScores = store.symptoms.map(symptomScore);
  const baseline = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length;
  const occurrences = new Map<string, { display: string; meals: typeof store.meals }>();
  for (const meal of store.meals) {
    const uniqueNames = new Set(meal.foods.map(x => normaliseFood(x.name)).filter(Boolean));
    for (const name of uniqueNames) {
      const existing = occurrences.get(name) || { display: meal.foods.find(x => normaliseFood(x.name) === name)?.name || name, meals: [] };
      existing.meals.push(meal); occurrences.set(name, existing);
    }
  }
  const signals: FoodSignal[] = [];
  for (const [, item] of occurrences) {
    if (item.meals.length < 2) continue;
    const scores: number[] = []; let matchedMeals = 0;
    for (const meal of item.meals) {
      const mealTime = new Date(meal.createdAt).getTime();
      const start = mealTime + startHour * 60 * 60 * 1000;
      const end = mealTime + endHour * 60 * 60 * 1000;
      const matches = store.symptoms.filter(sym => { const time = new Date(sym.createdAt).getTime(); return time >= start && time <= end; });
      if (matches.length) { matchedMeals += 1; scores.push(Math.max(...matches.map(symptomScore))); }
    }
    if (!scores.length) continue;
    const exposed = scores.reduce((a, b) => a + b, 0) / scores.length; const delta = exposed - baseline;
    const confidence: FoodSignal['confidence'] = item.meals.length >= 7 && matchedMeals >= 5 ? 'höher' : item.meals.length >= 4 && matchedMeals >= 3 ? 'mittel' : 'niedrig';
    signals.push({ food: item.display, occurrences: item.meals.length, symptomMatches: matchedMeals, exposedScore: exposed, baselineScore: baseline, delta, confidence, windowLabel: `${startHour}–${endHour} h` });
  }
  return signals.filter(x => x.delta > 0.35).sort((a, b) => b.delta - a.delta).slice(0, 8);
}

export function computeFoodSignals(store: HealthStore, windowHours = 8): FoodSignal[] {
  return computeFoodSignalsWindow(store, 0, windowHours);
}

export function computeCycleSymptomSignals(store: HealthStore): CycleSymptomSignal[] {
  if (store.symptoms.length < 4) return [];
  const baselineValues = store.symptoms.map(symptomScore);
  const baseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  const buckets = new Map<CyclePhase, number[]>();
  for (const entry of store.symptoms) {
    const phase = cyclePhaseForDate(store, entry.createdAt);
    if (phase === 'Unklar') continue;
    const values = buckets.get(phase) || [];
    values.push(symptomScore(entry));
    buckets.set(phase, values);
  }
  return Array.from(buckets.entries()).map(([phase, values]) => {
    const score = values.reduce((a, b) => a + b, 0) / values.length;
    return { phase, symptomScore: score, samples: values.length, baseline, delta: score - baseline };
  }).filter(x => x.samples >= 2).sort((a, b) => b.delta - a.delta);
}

export function computeFoodCycleSignals(store: HealthStore, windowHours = 8): FoodCycleSignal[] {
  if (store.meals.length < 6 || store.symptoms.length < 6 || store.cycle.length < 3) return [];
  const baseline = store.symptoms.map(symptomScore).reduce((a, b) => a + b, 0) / store.symptoms.length;
  const map = new Map<string, { food: string; phase: CyclePhase; scores: number[]; occurrences: number }>();
  for (const meal of store.meals) {
    const phase = cyclePhaseForDate(store, meal.createdAt);
    if (phase === 'Unklar') continue;
    const start = new Date(meal.createdAt).getTime();
    const end = start + windowHours * 3600000;
    const matches = store.symptoms.filter(x => {
      const t = new Date(x.createdAt).getTime();
      return t >= start && t <= end;
    });
    const uniqueFoods = Array.from(new Set(meal.foods.map(x => x.name.trim()).filter(Boolean)));
    for (const food of uniqueFoods) {
      const key = `${normaliseFood(food)}|${phase}`;
      const current = map.get(key) || { food, phase, scores: [], occurrences: 0 };
      current.occurrences += 1;
      if (matches.length) current.scores.push(Math.max(...matches.map(symptomScore)));
      map.set(key, current);
    }
  }
  return Array.from(map.values()).filter(x => x.occurrences >= 2 && x.scores.length >= 2).map(x => {
    const averageScore = x.scores.reduce((a, b) => a + b, 0) / x.scores.length;
    return { food: x.food, phase: x.phase, occurrences: x.occurrences, symptomMatches: x.scores.length, averageScore, baselineScore: baseline, delta: averageScore - baseline };
  }).filter(x => x.delta > 0.5).sort((a, b) => b.delta - a.delta).slice(0, 8);
}

export function getTrackingDays(store: HealthStore) {
  const keys = new Set<string>();
  for (const x of store.meals) keys.add(dayKey(x.createdAt));
  for (const x of store.symptoms) keys.add(dayKey(x.createdAt));
  for (const x of store.bowel) keys.add(dayKey(x.createdAt));
  for (const x of store.cycle) keys.add(dayKey(x.createdAt));
  for (const x of store.observations) keys.add(dayKey(x.createdAt));
  return keys.size;
}

export function buildAISummary(store: HealthStore) {
  const signals = computeFoodSignals(store).slice(0, 5);
  const trends = buildDailyTrends(store, 14);
  return {
    trackingDays: getTrackingDays(store),
    recordCounts: { meals: store.meals.length, symptoms: store.symptoms.length, bowel: store.bowel.length, cycle: store.cycle.length, observations: store.observations.length },
    foodSignals: signals,
    cycleContext: getCycleContext(store),
    cycleSymptomSignals: computeCycleSymptomSignals(store).slice(0, 4),
    foodCycleSignals: computeFoodCycleSignals(store).slice(0, 5),
    recentObservations: store.observations.slice(0, 12),
    recentDailyTrends: trends,
  };
}
