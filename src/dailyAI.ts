import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AIHealthInsight, generateHealthInsight, loadAIConfig, loadAIConsent, loadAIDataScope } from './ai';
import { loadHealthStore } from './storage';
import { AppPreferences, loadAppPreferences, saveAppPreferences } from './preferences';
import { loadUserProfile } from './onboarding';

export const DAILY_AI_TASK = 'noura-daily-ai-analysis';
const LATEST_KEY = 'noura.daily-ai.latest.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

type StoredInsight = { insight: AIHealthInsight; generatedAt: string; automatic: boolean };

export async function loadLatestAIInsight(): Promise<StoredInsight | null> {
  const raw = await AsyncStorage.getItem(LATEST_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredInsight; } catch { return null; }
}
export async function saveLatestAIInsight(insight: AIHealthInsight, automatic: boolean): Promise<void> {
  await AsyncStorage.setItem(LATEST_KEY, JSON.stringify({ insight, generatedAt: new Date().toISOString(), automatic } satisfies StoredInsight));
}
export async function clearLatestAIInsight(): Promise<void> { await AsyncStorage.removeItem(LATEST_KEY); }

function dataSignature(store: Awaited<ReturnType<typeof loadHealthStore>>) {
  const groups = [store.meals, store.symptoms, store.bowel, store.cycle, store.observations, store.medications, store.healthMetrics];
  return groups.map(items => `${items.length}:${items[0]?.createdAt || ''}:${items[0]?.id || ''}`).join('|');
}

export async function runAIAnalysisNow(automatic = false, force = false): Promise<{ ran: boolean; insight?: AIHealthInsight; reason?: string }> {
  const [prefs, config, consent, scope, store, profile] = await Promise.all([
    loadAppPreferences(), loadAIConfig(), loadAIConsent(), loadAIDataScope(), loadHealthStore(), loadUserProfile(),
  ]);
  if (automatic && !prefs.dailyAIEnabled) return { ran: false, reason: 'disabled' };
  const records = store.meals.length + store.symptoms.length + store.bowel.length + store.cycle.length + store.observations.length + store.medications.length + store.healthMetrics.length;
  if (!config || !consent || records === 0) return { ran: false, reason: 'missing-prerequisite' };
  const signature = dataSignature(store);
  if (!force && prefs.lastAIDataSignature === signature) return { ran: false, reason: 'no-new-data' };
  const insight = await generateHealthInsight(config, store, scope, profile.cyclePreferences);
  await saveLatestAIInsight(insight, automatic);
  const next: AppPreferences = {
    ...prefs,
    lastBackgroundAIAt: automatic ? new Date().toISOString() : prefs.lastBackgroundAIAt,
    lastAIDataSignature: signature,
  };
  await saveAppPreferences(next);
  return { ran: true, insight };
}

async function runBackgroundAnalysis(): Promise<boolean> {
  const prefs = await loadAppPreferences();
  if (!prefs.dailyAIEnabled) return true;
  if (prefs.lastBackgroundAIAt && Date.now() - new Date(prefs.lastBackgroundAIAt).getTime() < DAY_MS * 0.8) return true;
  await runAIAnalysisNow(true, false);
  return true;
}

TaskManager.defineTask(DAILY_AI_TASK, async () => {
  try { await runBackgroundAnalysis(); return BackgroundTask.BackgroundTaskResult.Success; }
  catch { return BackgroundTask.BackgroundTaskResult.Failed; }
});

export async function configureDailyAI(enabled: boolean): Promise<AppPreferences> {
  const current = await loadAppPreferences();
  const next = { ...current, dailyAIEnabled: enabled };
  await saveAppPreferences(next);
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(DAILY_AI_TASK);
    if (enabled && !registered) await BackgroundTask.registerTaskAsync(DAILY_AI_TASK, { minimumInterval: 24 * 60 });
    else if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(DAILY_AI_TASK);
  } catch { /* iOS decides background availability */ }
  return next;
}

export async function syncDailyAIRegistration(): Promise<void> {
  const prefs = await loadAppPreferences();
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(DAILY_AI_TASK);
    if (prefs.dailyAIEnabled && !registered) await BackgroundTask.registerTaskAsync(DAILY_AI_TASK, { minimumInterval: 24 * 60 });
    if (!prefs.dailyAIEnabled && registered) await BackgroundTask.unregisterTaskAsync(DAILY_AI_TASK);
  } catch { /* platform may restrict background tasks */ }
}
