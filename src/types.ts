export type MealType = 'Frühstück' | 'Mittagessen' | 'Abendessen' | 'Snack';

export type FoodNutrition = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugars?: number;
  fiber?: number;
};

export type FoodGroupId =
  | 'dairy'
  | 'lactose'
  | 'wheat'
  | 'gluten'
  | 'fructose'
  | 'polyols'
  | 'caffeine'
  | 'alcohol'
  | 'spicy'
  | 'high-fat';

export type FoodItem = {
  id: string;
  name: string;
  amount?: string;
  kcal?: number;
  source?: 'manual' | 'openfoodfacts' | 'catalog' | 'ai' | 'photo-ai' | 'saved-dish';
  barcode?: string;
  brand?: string;
  imageUrl?: string;
  ingredients?: string;
  allergens?: string[];
  nutritionPer100g?: FoodNutrition;
  groups?: FoodGroupId[];
};

export type MealEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  mealType: MealType;
  foods: FoodItem[];
  note?: string;
  favorite?: boolean;
  photoUri?: string;
};

export type SavedDish = {
  id: string;
  name: string;
  mealType?: MealType;
  foods: FoodItem[];
  note?: string;
  createdAt: string;
  updatedAt?: string;
};

export type SymptomEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  pain?: number;
  bloating?: number;
  nausea?: number;
  heartburn?: number;
  energy?: number;
  stress?: number;
  temperature?: number;
  note?: string;
};

export type BowelEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  bristolType: number;
  urgency?: number;
  mucus?: boolean;
  blood?: boolean;
  pain?: number;
  note?: string;
};

export type CycleFlow = 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleMood = 'low' | 'neutral' | 'good';

export type CycleEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  bleeding: boolean;
  flow?: CycleFlow;
  cramps?: number;
  cravings?: number;
  headache?: number;
  breastTenderness?: number;
  mood?: CycleMood;
  basalTemperature?: number;
  note?: string;
};

export type ObservationCategory = 'food' | 'symptom' | 'cycle' | 'body' | 'general';

export type ObservationEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  text: string;
  category?: ObservationCategory;
  severity?: number;
  tags?: string[];
};

export type MedicationKind = 'medication' | 'supplement';
export type MedicationEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  kind: MedicationKind;
  name: string;
  dose?: string;
  note?: string;
};

export type HealthMetricKind =
  | 'weight'
  | 'bodyTemperature'
  | 'sleep'
  | 'steps'
  | 'restingHeartRate'
  | 'activeEnergy'
  | 'water';

export type HealthMetricEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  kind: HealthMetricKind;
  value: number;
  unit: string;
  endAt?: string;
  source: 'manual' | 'apple-health-export' | 'apple-health-direct';
  sourceName?: string;
};


export type DeletionTombstone = {
  id: string;
  kind: EntryKind;
  deletedAt: string;
};

export type HealthStore = {
  schemaVersion: 6;
  meals: MealEntry[];
  symptoms: SymptomEntry[];
  bowel: BowelEntry[];
  cycle: CycleEntry[];
  observations: ObservationEntry[];
  medications: MedicationEntry[];
  healthMetrics: HealthMetricEntry[];
  savedDishes: SavedDish[];
  deleted: DeletionTombstone[];
};

export type TimelineItem =
  | { kind: 'meal'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'meal' }
  | { kind: 'symptom'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'symptom' }
  | { kind: 'bowel'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'bowel' }
  | { kind: 'cycle'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'cycle' }
  | { kind: 'observation'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'observation' }
  | { kind: 'medication'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'medication' }
  | { kind: 'metric'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'metric' };

export type EntryKind = 'meal' | 'symptom' | 'bowel' | 'cycle' | 'observation' | 'medication' | 'metric';
