import AsyncStorage from '@react-native-async-storage/async-storage';
import { BowelEntry, CycleEntry, HealthStore, MealEntry, ObservationEntry, SymptomEntry } from './types';

const STORAGE_KEY = 'noura.health-store.v1';

export const emptyHealthStore = (): HealthStore => ({
  schemaVersion: 3,
  meals: [],
  symptoms: [],
  bowel: [],
  cycle: [],
  observations: [],
});

function migrateHealthStore(value: unknown): HealthStore {
  if (!value || typeof value !== 'object') return emptyHealthStore();
  const candidate = value as any;
  if (!Array.isArray(candidate.meals) || !Array.isArray(candidate.symptoms) || !Array.isArray(candidate.bowel)) return emptyHealthStore();
  return {
    schemaVersion: 3,
    meals: candidate.meals,
    symptoms: candidate.symptoms,
    bowel: candidate.bowel,
    cycle: Array.isArray(candidate.cycle) ? candidate.cycle : [],
    observations: Array.isArray(candidate.observations) ? candidate.observations : [],
  };
}

export async function loadHealthStore(): Promise<HealthStore> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyHealthStore();
  try { return migrateHealthStore(JSON.parse(raw)); } catch { return emptyHealthStore(); }
}

export async function saveHealthStore(store: HealthStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export async function clearHealthStore(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function addMeal(store: HealthStore, entry: MealEntry): HealthStore { return { ...store, meals: [entry, ...store.meals] }; }
export function addSymptom(store: HealthStore, entry: SymptomEntry): HealthStore { return { ...store, symptoms: [entry, ...store.symptoms] }; }
export function addBowel(store: HealthStore, entry: BowelEntry): HealthStore { return { ...store, bowel: [entry, ...store.bowel] }; }
export function addCycle(store: HealthStore, entry: CycleEntry): HealthStore { return { ...store, cycle: [entry, ...store.cycle] }; }
export function addObservation(store: HealthStore, entry: ObservationEntry): HealthStore { return { ...store, observations: [entry, ...store.observations] }; }

export function removeEntry(store: HealthStore, kind: 'meal' | 'symptom' | 'bowel' | 'cycle' | 'observation', id: string): HealthStore {
  if (kind === 'meal') return { ...store, meals: store.meals.filter(x => x.id !== id) };
  if (kind === 'symptom') return { ...store, symptoms: store.symptoms.filter(x => x.id !== id) };
  if (kind === 'bowel') return { ...store, bowel: store.bowel.filter(x => x.id !== id) };
  if (kind === 'cycle') return { ...store, cycle: store.cycle.filter(x => x.id !== id) };
  return { ...store, observations: store.observations.filter(x => x.id !== id) };
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

  for (let day = 0; day < 28; day += 1) {
    const dairyDay = [1, 3, 5, 8, 10, 12, 15, 18, 22, 25].includes(day);
    const lateLutealLike = day <= 4 || (day >= 24 && day <= 27);
    const bleeding = day >= 10 && day <= 13;
    meals.push({
      id: id('meal', day, 1), createdAt: dateAt(day, 8, 10), mealType: 'Frühstück',
      foods: [
        { id: id('food', day, 1), name: 'Haferflocken', amount: '70 g', kcal: 265 },
        { id: id('food', day, 2), name: dairyDay ? 'Naturjoghurt' : 'Haferdrink', amount: dairyDay ? '150 g' : '180 ml', kcal: dairyDay ? 95 : 72 },
        { id: id('food', day, 3), name: 'Banane', amount: '1 Stück', kcal: 105 },
      ],
    });
    meals.push({ id: id('meal', day, 2), createdAt: dateAt(day, 13), mealType: 'Mittagessen', foods: [
      { id: id('food', day, 4), name: day % 2 === 0 ? 'Pasta' : 'Reis', amount: '1 Portion', kcal: 520 },
      { id: id('food', day, 5), name: 'Gemüse', amount: '200 g', kcal: 90 },
    ] });

    const base = dairyDay ? 4 : 1;
    const cycleBoost = lateLutealLike ? 2 : bleeding ? 1 : 0;
    symptoms.push({
      id: id('sym', day, 1), createdAt: dateAt(day, 11, 30),
      pain: Math.min(10, base + cycleBoost), bloating: Math.min(10, base + 2 + cycleBoost), nausea: dairyDay ? 2 : 0,
      heartburn: day % 4 === 0 ? 2 : 0, energy: lateLutealLike ? 5 : 7, stress: 3 + (day % 3), temperature: 36.4 + ((day % 4) * 0.1),
    });

    if (day % 2 === 0 || day === 1) bowel.push({ id: id('bowel', day, 1), createdAt: dateAt(day, 9), bristolType: dairyDay ? 6 : 4, urgency: dairyDay ? 2 : 1 });

    cycle.push({
      id: id('cycle', day, 1), createdAt: dateAt(day, 20),
      bleeding,
      flow: day === 12 ? 'heavy' : bleeding ? 'medium' : undefined,
      cramps: bleeding ? 5 : lateLutealLike ? 2 : 0,
      cravings: lateLutealLike ? 7 : 2,
      headache: lateLutealLike ? 3 : 0,
      breastTenderness: lateLutealLike ? 5 : 1,
      mood: lateLutealLike ? 'low' : 'good',
      basalTemperature: lateLutealLike ? 36.8 : 36.5,
    });

    if ([1, 5, 10, 24].includes(day)) {
      observations.push({
        id: id('obs', day, 1),
        createdAt: dateAt(day, 15, 15),
        text: day === 10 ? 'Während der Periode deutlich empfindlicher Bauch.' : dairyDay ? 'Nach dem Joghurt heute auffällig aufgebläht.' : 'Heute insgesamt ruhiger Bauch.',
        category: day === 10 ? 'cycle' : dairyDay ? 'food' : 'general',
        severity: dairyDay ? 6 : 2,
        tags: dairyDay ? ['Milchprodukt', 'Blähungen'] : [],
      });
    }
  }

  return { schemaVersion: 3, meals, symptoms, bowel, cycle, observations };
}
