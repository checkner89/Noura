import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIDataScope, AIProvider } from './ai';

export type AIUsagePurpose = 'health-insight' | 'quick-capture' | 'meal-photo' | 'connection-test' | 'weekly-review';
export type AIUsageEntry = {
  id: string;
  createdAt: string;
  purpose: AIUsagePurpose;
  provider: AIProvider;
  model: string;
  scope?: AIDataScope;
  daysIncluded?: number;
  payloadCharacters?: number;
  responseCharacters?: number;
  outcome: 'success' | 'error';
  error?: string;
};

const KEY = 'noura.ai-usage.v1';
const LIMIT = 100;

export async function loadAIUsage(): Promise<AIUsageEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, LIMIT) : [];
  } catch { return []; }
}

export async function recordAIUsage(entry: Omit<AIUsageEntry, 'id' | 'createdAt'>): Promise<void> {
  const current = await loadAIUsage();
  const next: AIUsageEntry = { id: `aiuse-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, createdAt: new Date().toISOString(), ...entry };
  await AsyncStorage.setItem(KEY, JSON.stringify([next, ...current].slice(0, LIMIT)));
}

export async function clearAIUsage(): Promise<void> { await AsyncStorage.removeItem(KEY); }

export function usagePurposeLabel(purpose: AIUsagePurpose) {
  const labels: Record<AIUsagePurpose, string> = {
    'health-insight': 'Gesundheitsanalyse',
    'quick-capture': 'Schnelleingabe',
    'meal-photo': 'Essensfoto',
    'connection-test': 'Verbindungstest',
    'weekly-review': 'Wochenrückblick',
  };
  return labels[purpose];
}
