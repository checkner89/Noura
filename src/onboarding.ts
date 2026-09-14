import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoalId = 'triggers' | 'digestion' | 'symptoms' | 'wellbeing' | 'cycle';
export type SymptomKey = 'pain' | 'bloating' | 'nausea' | 'heartburn';

export type TrackingPreferences = {
  meals: boolean;
  symptoms: boolean;
  bowel: boolean;
  cycle: boolean;
  medications: boolean;
  temperature: boolean;
  energy: boolean;
  stress: boolean;
  weight: boolean;
  water: boolean;
  sleep: boolean;
  movement: boolean;
};

export type CyclePreferences = {
  averageCycleLength: number;
  periodLength: number;
  lastPeriodStart?: string;
};

export type UserProfile = {
  schemaVersion: 5;
  completed: boolean;
  displayName?: string;
  profileImageUri?: string;
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
    schemaVersion: 5,
    completed: false,
    goals: ['triggers', 'digestion'],
    symptomsToTrack: ['pain', 'bloating'],
    tracking: {
      meals: true,
      symptoms: true,
      bowel: true,
      cycle: false,
      medications: false,
      temperature: true,
      energy: true,
      stress: true,
      weight: false,
      water: false,
      sleep: true,
      movement: true,
    },
    cyclePreferences: { averageCycleLength: 28, periodLength: 5 },
    createdAt: new Date().toISOString(),
  };
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function migrateUserProfile(value: unknown): UserProfile {
  const fallback = createDefaultUserProfile();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as any;
  if (!Array.isArray(candidate.goals) || !Array.isArray(candidate.symptomsToTrack) || !candidate.tracking) return fallback;
  return {
    schemaVersion: 5,
    completed: !!candidate.completed,
    displayName: candidate.displayName,
    profileImageUri: candidate.profileImageUri,
    goals: candidate.goals,
    symptomsToTrack: candidate.symptomsToTrack,
    tracking: {
      meals: candidate.tracking.meals !== false,
      symptoms: candidate.tracking.symptoms !== false,
      bowel: candidate.tracking.bowel !== false,
      cycle: candidate.tracking.cycle === true,
      medications: candidate.tracking.medications === true,
      temperature: candidate.tracking.temperature !== false,
      energy: candidate.tracking.energy !== false,
      stress: candidate.tracking.stress !== false,
      weight: candidate.tracking.weight === true,
      water: candidate.tracking.water === true,
      sleep: candidate.tracking.sleep !== false,
      movement: candidate.tracking.movement !== false,
    },
    cyclePreferences: {
      averageCycleLength: safeNumber(candidate.cyclePreferences?.averageCycleLength, 28, 18, 60),
      periodLength: safeNumber(candidate.cyclePreferences?.periodLength, 5, 1, 14),
      lastPeriodStart: typeof candidate.cyclePreferences?.lastPeriodStart === 'string' ? candidate.cyclePreferences.lastPeriodStart : undefined,
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

export async function saveUserProfile(profile: UserProfile): Promise<void> { await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, schemaVersion: 5 })); }
export async function clearUserProfile(): Promise<void> { await AsyncStorage.removeItem(PROFILE_KEY); }
