export type MealType = 'Frühstück' | 'Mittagessen' | 'Abendessen' | 'Snack';

export type FoodNutrition = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugars?: number;
  fiber?: number;
};

export type FoodItem = {
  id: string;
  name: string;
  amount?: string;
  kcal?: number;
  source?: 'manual' | 'openfoodfacts' | 'ai';
  barcode?: string;
  brand?: string;
  imageUrl?: string;
  ingredients?: string;
  allergens?: string[];
  nutritionPer100g?: FoodNutrition;
};

export type MealEntry = {
  id: string;
  createdAt: string;
  mealType: MealType;
  foods: FoodItem[];
  note?: string;
};

export type SymptomEntry = {
  id: string;
  createdAt: string;
  pain: number;
  bloating: number;
  nausea: number;
  heartburn: number;
  energy: number;
  stress: number;
  temperature?: number;
  note?: string;
};

export type BowelEntry = {
  id: string;
  createdAt: string;
  bristolType: number;
  urgency: number;
  note?: string;
};

export type CycleFlow = 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleMood = 'low' | 'neutral' | 'good';

export type CycleEntry = {
  id: string;
  createdAt: string;
  bleeding: boolean;
  flow?: CycleFlow;
  cramps: number;
  cravings: number;
  headache: number;
  breastTenderness: number;
  mood: CycleMood;
  basalTemperature?: number;
  note?: string;
};

export type ObservationCategory = 'food' | 'symptom' | 'cycle' | 'body' | 'general';

export type ObservationEntry = {
  id: string;
  createdAt: string;
  text: string;
  category: ObservationCategory;
  severity?: number;
  tags?: string[];
};

export type HealthStore = {
  schemaVersion: 3;
  meals: MealEntry[];
  symptoms: SymptomEntry[];
  bowel: BowelEntry[];
  cycle: CycleEntry[];
  observations: ObservationEntry[];
};

export type TimelineItem =
  | { kind: 'meal'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'meal' }
  | { kind: 'symptom'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'symptom' }
  | { kind: 'bowel'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'bowel' }
  | { kind: 'cycle'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'cycle' }
  | { kind: 'observation'; id: string; createdAt: string; title: string; subtitle: string; accent?: 'observation' };
