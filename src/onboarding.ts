import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoalId = 'triggers' | 'digestion' | 'symptoms' | 'wellbeing' | 'cycle';
export type SymptomKey = 'pain' | 'bloating' | 'nausea' | 'heartburn';

export type TrackingPreferences = {
  meals: boolean;
  symptoms: boolean;
  bowel: boolean;
  cycle: boolean;
  temperature: boolean;
  energy: boolean;
  stress: boolean;
};

export type CyclePreferences = {
  averageCycleLength: number;
  periodLength: number;
};

export type UserProfile = {
  schemaVersion: 2;
  completed: boolean;
  displayName?: string;
  goals: GoalId[];
  symptomsToTrack: SymptomKey[];
  tracking: TrackingPreferences;
  cyclePreferences: CyclePreferences;
  createdAt: string;
  completedAt?: string;
};

const PROFILE_KEY = 'noura.user-profile.v1';

export const GOAL_LABELS: Record<GoalId, string> = {
  triggers: 'Mögliche Lebensmittel-Trigger erkennen',
  digestion: 'Verdauung besser verstehen',
  symptoms: 'Beschwerden strukturiert dokumentieren',
  wellbeing: 'Allgemeines Wohlbefinden beobachten',
  cycle: 'Zyklus als Einflussfaktor einbeziehen',
};

export const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  pain: 'Bauchschmerzen',
  bloating: 'Blähungen',
  nausea: 'Übelkeit',
  heartburn: 'Sodbrennen',
};

export function createDefaultUserProfile(): UserProfile {
  return {
    schemaVersion: 2,
    completed: false,
    goals: ['triggers', 'digestion'],
    symptomsToTrack: ['pain', 'bloating'],
    tracking: { meals: true, symptoms: true, bowel: true, cycle: false, temperature: true, energy: true, stress: true },
    cyclePreferences: { averageCycleLength: 28, periodLength: 5 },
    createdAt: new Date().toISOString(),
  };
}

function migrateUserProfile(value: unknown): UserProfile {
  const fallback = createDefaultUserProfile();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as any;
  if (!Array.isArray(candidate.goals) || !Array.isArray(candidate.symptomsToTrack) || !candidate.tracking) return fallback;
  return {
    schemaVersion: 2,
    completed: !!candidate.completed,
    displayName: candidate.displayName,
    goals: candidate.goals,
    symptomsToTrack: candidate.symptomsToTrack,
    tracking: {
      meals: candidate.tracking.meals !== false,
      symptoms: candidate.tracking.symptoms !== false,
      bowel: candidate.tracking.bowel !== false,
      cycle: candidate.tracking.cycle === true,
      temperature: candidate.tracking.temperature !== false,
      energy: candidate.tracking.energy !== false,
      stress: candidate.tracking.stress !== false,
    },
    cyclePreferences: {
      averageCycleLength: Number(candidate.cyclePreferences?.averageCycleLength) || 28,
      periodLength: Number(candidate.cyclePreferences?.periodLength) || 5,
    },
    createdAt: candidate.createdAt || new Date().toISOString(),
    completedAt: candidate.completedAt,
  };
}

export async function loadUserProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return createDefaultUserProfile();
  try { return migrateUserProfile(JSON.parse(raw)); } catch { return createDefaultUserProfile(); }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> { await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
export async function clearUserProfile(): Promise<void> { await AsyncStorage.removeItem(PROFILE_KEY); }
