import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AIHealthInsight, generateHealthInsight, loadAIConfig, loadAIConsent, loadAIDataScope } from './ai';
import { loadHealthStore } from './storage';
import { AppPreferences, loadAppPreferences, saveAppPreferences } from './preferences';

export const DAILY_AI_TASK = 'noura-daily-ai-analysis';
const LATEST_KEY = 'noura.daily-ai.latest.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

type StoredInsight = {
  insight: AIHealthInsight;
  generatedAt: string;
  automatic: boolean;
};

export async function loadLatestAIInsight(): Promise<StoredInsight | null> {
  const raw = await AsyncStorage.getItem(LATEST_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredInsight; } catch { return null; }
}

export async function saveLatestAIInsight(insight: AIHealthInsight, automatic: boolean): Promise<void> {
  await AsyncStorage.setItem(LATEST_KEY, JSON.stringify({ insight, generatedAt: new Date().toISOString(), automatic } satisfies StoredInsight));
}

async function runBackgroundAnalysis(): Promise<boolean> {
  const prefs = await loadAppPreferences();
  if (!prefs.dailyAIEnabled) return true;
  if (prefs.lastBackgroundAIAt && Date.now() - new Date(prefs.lastBackgroundAIAt).getTime() < DAY_MS * 0.8) return true;

  const [config, consent, scope, store] = await Promise.all([
    loadAIConfig(), loadAIConsent(), loadAIDataScope(), loadHealthStore(),
  ]);
  const records = store.meals.length + store.symptoms.length + store.bowel.length + store.cycle.length + store.observations.length;
  if (!config || !consent || records === 0) return true;

  const insight = await generateHealthInsight(config, store, scope);
  await saveLatestAIInsight(insight, true);
  const current = await loadAppPreferences();
  await saveAppPreferences({ ...current, lastBackgroundAIAt: new Date().toISOString() });
  return true;
}

TaskManager.defineTask(DAILY_AI_TASK, async () => {
  try {
    await runBackgroundAnalysis();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function configureDailyAI(enabled: boolean): Promise<AppPreferences> {
  const current = await loadAppPreferences();
  const next = { ...current, dailyAIEnabled: enabled };
  await saveAppPreferences(next);
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(DAILY_AI_TASK);
    if (enabled && !registered) {
      await BackgroundTask.registerTaskAsync(DAILY_AI_TASK, { minimumInterval: 24 * 60 });
    } else if (!enabled && registered) {
      await BackgroundTask.unregisterTaskAsync(DAILY_AI_TASK);
    }
  } catch {
    // The setting remains saved. iOS can restrict background execution; UI explains this.
  }
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
