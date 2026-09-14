import AsyncStorage from '@react-native-async-storage/async-storage';

export type InsightFeedback = 'helpful' | 'not-helpful';
const KEY = 'noura.ai-feedback.v1';

type FeedbackMap = Record<string, { value: InsightFeedback; at: string }>;

export function insightFeedbackKey(headline: string, raw?: string) {
  let hash = 2166136261;
  const text = `${headline}|${raw || ''}`;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `insight-${(hash >>> 0).toString(36)}`;
}

async function loadMap(): Promise<FeedbackMap> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as FeedbackMap; } catch { return {}; }
}
export async function loadInsightFeedback(key: string) { return (await loadMap())[key]?.value; }
export async function saveInsightFeedback(key: string, value: InsightFeedback) {
  const map = await loadMap(); map[key] = { value, at: new Date().toISOString() }; await AsyncStorage.setItem(KEY, JSON.stringify(map));
}
export async function clearInsightFeedback() { await AsyncStorage.removeItem(KEY); }
