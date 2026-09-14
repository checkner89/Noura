import * as SecureStore from 'expo-secure-store';
import { buildAISummary } from './analysis';
import { CycleFlow, CycleMood, HealthStore, MealType, MedicationKind, ObservationCategory } from './types';
import { CyclePreferences } from './onboarding';
import { recordAIUsage } from './aiUsage';
import { safetyPromptSummary } from './medicalSafety';

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'compatible';
export type AIDataScope = 'summary' | 'detailed';
export type AIConfidence = 'low' | 'medium' | 'higher';

export type AIHealthFinding = {
  title: string;
  observation: string;
  evidence?: string;
  uncertainty?: string;
};

export type AIHealthInsight = {
  headline: string;
  summary: string;
  confidence: AIConfidence;
  findings: AIHealthFinding[];
  nextSteps: string[];
  details?: string;
  safetyNote?: string;
  rawText?: string;
};

export type AIQuickFood = { name: string; amount?: string };
export type AIQuickMealDraft = { mealType: MealType; foods: AIQuickFood[]; note?: string };
export type AIQuickSymptomDraft = {
  pain?: number;
  bloating?: number;
  nausea?: number;
  heartburn?: number;
  energy?: number;
  stress?: number;
  temperature?: number;
  note?: string;
};
export type AIQuickBowelDraft = { bristolType: number; urgency: number; note?: string };
export type AIQuickCycleDraft = {
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
export type AIQuickMedicationDraft = { kind: MedicationKind; name: string; dose?: string; note?: string };
export type AIQuickObservationDraft = {
  text: string;
  category: ObservationCategory;
  severity?: number;
  tags?: string[];
};

export type AIQuickDraft = {
  headline: string;
  understood: string;
  meal?: AIQuickMealDraft;
  symptom?: AIQuickSymptomDraft;
  bowel?: AIQuickBowelDraft;
  cycle?: AIQuickCycleDraft;
  observation?: AIQuickObservationDraft;
  medications?: AIQuickMedicationDraft[];
  needsClarification: string[];
};

export type AIConfig = {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
};


export type AIModelOption = {
  id: string;
  label: string;
  detail?: string;
  recommended?: boolean;
};

export const FALLBACK_MODEL_OPTIONS: Record<AIProvider, AIModelOption[]> = {
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', detail: 'höchste Qualität für komplexe Aufgaben', recommended: true },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', detail: 'starker Allrounder', recommended: true },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', detail: 'Balance aus Qualität & Kosten', recommended: true },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', detail: 'schnell & kostengünstig', recommended: true },
    { id: 'gpt-5.6', label: 'GPT-5.6', detail: 'Alias auf GPT-5.6 Sol' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', detail: 'starker Allrounder', recommended: true },
    { id: 'claude-opus-5', label: 'Claude Opus 5', detail: 'höchste Claude-Qualität', recommended: true },
    { id: 'claude-fable-5', label: 'Claude Fable 5', detail: 'aktives Claude-Modell' },
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', detail: 'aktiv' },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', detail: 'aktiv' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', detail: 'aktiv' },
    { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', detail: 'aktiv' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', detail: 'aktiv' },
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', detail: 'aktiv' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', detail: 'schnell & günstig' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', detail: 'aktuelles stabiles Flash-Modell', recommended: true },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', detail: 'stabil' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', detail: 'stabil' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', detail: 'stabil' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', detail: 'schnell & günstig' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', detail: 'stabil' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', detail: 'Preview' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', detail: 'Preview' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', detail: 'stabil' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', detail: 'stabil' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', detail: 'stabil' },
  ],
  compatible: [],
};

const CONFIG_KEY = 'noura.ai.config.v1';
const CONSENT_KEY = 'noura.ai.health-consent.v1';
const SCOPE_KEY = 'noura.ai.data-scope.v1';

export const PROVIDER_META: Record<AIProvider, { label: string; defaultModel: string; defaultBaseUrl?: string; hint: string }> = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5.6-terra',
    defaultBaseUrl: 'https://api.openai.com/v1',
    hint: 'Eigener OpenAI API-Key. Der Key wird lokal im geschützten Gerätespeicher abgelegt.',
  },
  anthropic: {
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-5',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    hint: 'Eigener Anthropic API-Key. Modell-ID kann frei geändert werden.',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    hint: 'Eigener Gemini API-Key. Modell-ID kann frei geändert werden.',
  },
  compatible: {
    label: 'OpenAI-kompatibel',
    defaultModel: '',
    defaultBaseUrl: '',
    hint: 'Für eigene Gateways oder Anbieter mit Chat-Completions-kompatibler API.',
  },
};

export async function loadAIConfig(): Promise<AIConfig | null> {
  const raw = await SecureStore.getItemAsync(CONFIG_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AIConfig; } catch { return null; }
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(config), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function clearAIConfig(): Promise<void> { await SecureStore.deleteItemAsync(CONFIG_KEY); }
export async function loadAIConsent(): Promise<boolean> { return (await SecureStore.getItemAsync(CONSENT_KEY)) === 'yes'; }
export async function saveAIConsent(enabled: boolean): Promise<void> { await SecureStore.setItemAsync(CONSENT_KEY, enabled ? 'yes' : 'no'); }
export async function loadAIDataScope(): Promise<AIDataScope> { return (await SecureStore.getItemAsync(SCOPE_KEY)) === 'detailed' ? 'detailed' : 'summary'; }
export async function saveAIDataScope(scope: AIDataScope): Promise<void> { await SecureStore.setItemAsync(SCOPE_KEY, scope); }

const HEALTH_SYSTEM_PROMPT = `Du bist Noura, eine vorsichtige Assistenz für Ernährungstagebuch und Wohlbefinden.
Analysiere ausschließlich die bereitgestellten Trackingdaten. Suche nach plausiblen zeitlichen Mustern und formuliere sie als Hypothesen, niemals als Diagnose.

Regeln:
- Keine Diagnose von Unverträglichkeiten, Allergien, Infektionen oder anderen Erkrankungen.
- Korrelation klar von Kausalität unterscheiden.
- Zyklusdaten als möglichen Einflussfaktor bzw. Confounder mitprüfen, wenn sie vorhanden sind.
- Lebensmittel-Zyklus-Interaktionen erwähnen, wenn die Daten sie plausibel stützen.
- Auffälligkeiten/Freitextnotizen als subjektiven Kontext nutzen, nicht als harte Messwerte.
- Unsicherheit, fehlende Kontrollvariablen und kleine Datenmengen ausdrücklich benennen.
- Keine radikalen Eliminationsdiäten oder medizinischen Behandlungen empfehlen.
- Bei starken, neuen, anhaltenden oder alarmierenden Beschwerden zu professioneller medizinischer Abklärung raten.
- Keine erfundenen Fakten oder Laborwerte.
- Antworte auf Deutsch.

Die STANDARDANSICHT muss extrem leicht erfassbar sein:
- headline: maximal 8 Wörter.
- summary: maximal 2 kurze Sätze und höchstens ca. 220 Zeichen.
- findings: maximal 3; observation jeweils genau 1 kurzer Satz.
- nextSteps: maximal 3 kurze, konkrete Schritte.
- details: optionaler längerer Erläuterungstext für eine aufklappbare Detailansicht.

Antworte ausschließlich als valides JSON-Objekt ohne Markdown oder zusätzlichen Text:
{
  "headline": "kurze verständliche Überschrift",
  "summary": "maximal zwei kurze Sätze",
  "confidence": "low | medium | higher",
  "findings": [
    {
      "title": "kurzer Name",
      "observation": "ein kurzer Satz",
      "evidence": "konkrete Zahlen/Beobachtungen, wenn vorhanden",
      "uncertainty": "kurzer Unsicherheitshinweis"
    }
  ],
  "nextSteps": ["maximal drei kurze nächste Schritte"],
  "details": "optional: verständliche ausführlichere Erläuterung für Mehr erfahren",
  "safetyNote": "nur wenn medizinische Abklärung oder besondere Vorsicht sinnvoll ist, sonst leer"
}`;

const QUICK_CAPTURE_SYSTEM_PROMPT = `Du bist die schnelle Eingabehilfe der Tagebuch-App Noura.
Der Nutzer erzählt in natürlicher Sprache, was er gerade oder kürzlich gegessen/getrunken hat und/oder wie er sich fühlt. Forme daraus ausschließlich einen ENTWURF, der vor dem Speichern bestätigt oder geändert wird.

Wichtig:
- Erfinde keine Lebensmittel, Mengen, Symptome, Messwerte oder Diagnosen.
- Wenn keine Menge genannt ist, amount weglassen.
- Intensitäten nur ableiten, wenn sprachlich sinnvoll. Nutze 0-10. "leicht"≈2-3, "mittel"≈5, "stark"≈7-8, "sehr stark"≈9. Nicht genannte Werte vollständig weglassen.
- mealType anhand Tageszeit/Benennung vorsichtig wählen; bei Unsicherheit Snack.
- Energie, Stress, Temperatur und Zykluswerte niemals mit Neutral-/Standardwerten auffüllen. Nur angeben, wenn der Nutzer sie wirklich genannt oder eindeutig beschrieben hat.
- Stuhlgang nur anlegen, wenn ausdrücklich erwähnt und eine Bristol-Zuordnung plausibel ist. Sonst nicht raten.
- Zyklus nur anlegen, wenn Periode/Blutung oder andere explizite Zyklusangaben genannt werden.
- Eine observation anlegen, wenn der Nutzer eine Auffälligkeit, zeitliche Beziehung oder freie Beobachtung beschreibt.
- Medikamente oder Supplements nur anlegen, wenn ausdrücklich genannt. Medikamentenname und Dosis niemals ergänzen oder erraten.
- Keine medizinische Interpretation. Nur strukturieren.
- Antworte auf Deutsch.

Antworte ausschließlich als valides JSON ohne Markdown:
{
  "headline": "Entwurf erkannt",
  "understood": "ein kurzer Satz, was verstanden wurde",
  "meal": {"mealType":"Frühstück|Mittagessen|Abendessen|Snack","foods":[{"name":"...","amount":"optional"}],"note":"optional"},
  "symptom": {"pain":"optional 0-10","bloating":"optional 0-10","nausea":"optional 0-10","heartburn":"optional 0-10","energy":"optional 0-10","stress":"optional 0-10","temperature":"optional Zahl","note":"optional"},
  "bowel": {"bristolType":4,"urgency":1,"note":"optional"},
  "cycle": {"bleeding":false,"flow":"optional spotting|light|medium|heavy","cramps":"optional 0-10","cravings":"optional 0-10","headache":"optional 0-10","breastTenderness":"optional 0-10","mood":"optional low|neutral|good","basalTemperature":"optional Zahl","note":"optional"},
  "observation": {"text":"...","category":"food|symptom|cycle|body|general","severity":0,"tags":["..."]},
  "medications": [{"kind":"medication|supplement","name":"...","dose":"optional","note":"optional"}],
  "needsClarification": ["kurze Rückfragen, nur wenn wirklich nötig"]
}
Lasse ganze Objekte weg, wenn sie aus der Aussage nicht hervorgehen.`;

function buildUserPrompt(store: HealthStore, scope: AIDataScope, cyclePreferences?: CyclePreferences): string {
  const summary = buildAISummary(store, cyclePreferences);
  const context: Record<string, unknown> = { summary };
  if (scope === 'detailed') {
    context.recentRecords = {
      meals: store.meals.slice(0, 40),
      symptoms: store.symptoms.slice(0, 60),
      bowel: store.bowel.slice(0, 40),
      cycle: store.cycle.slice(0, 60),
      observations: store.observations.slice(0, 40),
      medications: store.medications.slice(0, 40),
      appleHealth: store.healthMetrics.slice(0, 60),
    };
  }
  const safety = safetyPromptSummary(store);
  return `Datenschutz-Modus: ${scope === 'summary' ? 'nur aggregierte Zusammenfassung' : 'Zusammenfassung plus begrenzte Detail-Timeline'}\n\nTrackingdaten:\n${JSON.stringify(context, null, 2)}${safety ? `\n\nLokale Sicherheitsmarker (nicht diagnostisch):\n${safety}` : ''}\n\nLeite daraus nur vorsichtige, nachvollziehbare Muster ab.`;
}

export function getAITransmissionSummary(store: HealthStore, scope: AIDataScope, cyclePreferences?: CyclePreferences) {
  const prompt = buildUserPrompt(store, scope, cyclePreferences);
  const dates = [
    ...store.meals.map(x=>x.createdAt), ...store.symptoms.map(x=>x.createdAt), ...store.bowel.map(x=>x.createdAt),
    ...store.cycle.map(x=>x.createdAt), ...store.observations.map(x=>x.createdAt), ...store.medications.map(x=>x.createdAt), ...store.healthMetrics.map(x=>x.createdAt),
  ].map(x=>new Date(x).getTime()).filter(Number.isFinite);
  const daysIncluded = dates.length ? Math.max(1, Math.ceil((Date.now()-Math.min(...dates))/86400000)) : 0;
  return {
    scope,
    payloadCharacters: prompt.length,
    approximateKilobytes: Math.round((new TextEncoder().encode(prompt).length/1024)*10)/10,
    daysIncluded,
    categories: scope === 'summary' ? ['Aggregierte Muster & Kennzahlen'] : ['Aggregierte Muster & Kennzahlen','bis zu 40 Mahlzeiten','bis zu 60 Körper-Check-ins','bis zu 40 Stuhlgang-Einträge','bis zu 60 Zyklus-Einträge','bis zu 40 Beobachtungen','bis zu 40 Medikamente/Supplements','bis zu 60 Health-Werte'],
  };
}

function titleFromModelId(id: string) {
  return id
    .replace(/^models\//, '')
    .split(/[-_:]/g)
    .filter(Boolean)
    .map(part => (/^\d/.test(part) || part.length <= 2 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function uniqueModels(items: AIModelOption[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const id = item.id.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sortModels(provider: AIProvider, items: AIModelOption[]) {
  const recommended = new Set(FALLBACK_MODEL_OPTIONS[provider].filter(x => x.recommended).map(x => x.id));
  return uniqueModels(items).sort((a, b) => {
    const ar = recommended.has(a.id) ? 0 : 1;
    const br = recommended.has(b.id) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' });
  });
}

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { method: 'GET', headers });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* raw stays available */ }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || raw || `HTTP ${response.status}`);
  return data;
}

/**
 * Loads the model catalogue visible to the user's own API key.
 * This avoids maintaining a permanently stale hard-coded list.
 */
export async function listAIModels(config: Pick<AIConfig, 'provider' | 'apiKey' | 'baseUrl'>): Promise<AIModelOption[]> {
  const key = config.apiKey.trim();
  if (!key) return FALLBACK_MODEL_OPTIONS[config.provider];

  if (config.provider === 'openai') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.openai.defaultBaseUrl!);
    const data = await getJson(`${base}/models`, { Authorization: `Bearer ${key}` });
    const items = Array.isArray(data?.data) ? data.data.map((m: any) => ({
      id: String(m?.id || ''),
      label: String(m?.id || ''),
      detail: m?.owned_by ? `Owner: ${m.owned_by}` : undefined,
    })) : [];
    return sortModels('openai', items.length ? items : FALLBACK_MODEL_OPTIONS.openai);
  }

  if (config.provider === 'anthropic') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.anthropic.defaultBaseUrl!);
    const data = await getJson(`${base}/models?limit=100`, {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    const items = Array.isArray(data?.data) ? data.data.map((m: any) => ({
      id: String(m?.id || ''),
      label: String(m?.display_name || m?.id || ''),
      detail: m?.created_at ? `Verfügbar · ${String(m.created_at).slice(0, 10)}` : 'Verfügbar',
    })) : [];
    return sortModels('anthropic', items.length ? items : FALLBACK_MODEL_OPTIONS.anthropic);
  }

  if (config.provider === 'gemini') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.gemini.defaultBaseUrl!);
    let pageToken = '';
    const items: AIModelOption[] = [];
    for (let page = 0; page < 10; page += 1) {
      const qs = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) qs.set('pageToken', pageToken);
      const data = await getJson(`${base}/models?${qs.toString()}`, { 'x-goog-api-key': key });
      const models = Array.isArray(data?.models) ? data.models : [];
      for (const m of models) {
        const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
          ? m.supportedGenerationMethods
          : Array.isArray(m?.supportedActions) ? m.supportedActions : [];
        if (methods.length && !methods.includes('generateContent')) continue;
        const id = String(m?.baseModelId || m?.name || '').replace(/^models\//, '');
        if (!id) continue;
        items.push({ id, label: String(m?.displayName || titleFromModelId(id)), detail: m?.description ? String(m.description) : 'generateContent' });
      }
      pageToken = String(data?.nextPageToken || '');
      if (!pageToken) break;
    }
    return sortModels('gemini', items.length ? items : FALLBACK_MODEL_OPTIONS.gemini);
  }

  const base = trimSlash(config.baseUrl || '');
  if (!base) return [];
  const data = await getJson(`${base}/models`, { Authorization: `Bearer ${key}` });
  const source = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  const items = source.map((m: any) => {
    const id = typeof m === 'string' ? m : String(m?.id || m?.name || '');
    return { id, label: typeof m === 'string' ? m : String(m?.display_name || m?.displayName || id), detail: 'Vom Anbieter gemeldet' };
  });
  return sortModels('compatible', items);
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* raw stays available */ }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || raw || `HTTP ${response.status}`);
  return data;
}

function trimSlash(value: string) { return value.replace(/\/+$/, ''); }

async function callProvider(config: AIConfig, userPrompt: string, systemPrompt = HEALTH_SYSTEM_PROMPT, maxTokens = 1400): Promise<string> {
  if (!config.apiKey.trim()) throw new Error('API-Key fehlt.');
  if (!config.model.trim()) throw new Error('Modell-ID fehlt.');

  if (config.provider === 'openai') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.openai.defaultBaseUrl!);
    const data = await postJson(`${base}/responses`, { Authorization: `Bearer ${config.apiKey}` }, {
      model: config.model,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: maxTokens,
    });
    if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
    const text = (data?.output || []).flatMap((item: any) => item?.content || []).map((part: any) => part?.text).filter(Boolean).join('\n').trim();
    if (!text) throw new Error('Die OpenAI-Antwort enthielt keinen Text.');
    return text;
  }

  if (config.provider === 'anthropic') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.anthropic.defaultBaseUrl!);
    const data = await postJson(`${base}/messages`, {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }, { model: config.model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
    const text = (data?.content || []).map((p: any) => p?.text).filter(Boolean).join('\n').trim();
    if (!text) throw new Error('Die Anthropic-Antwort enthielt keinen Text.');
    return text;
  }

  if (config.provider === 'gemini') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.gemini.defaultBaseUrl!);
    const model = encodeURIComponent(config.model);
    const data = await postJson(`${base}/models/${model}:generateContent`, { 'x-goog-api-key': config.apiKey }, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1, responseMimeType: 'application/json' },
    });
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text).filter(Boolean).join('\n').trim();
    if (!text) throw new Error('Die Gemini-Antwort enthielt keinen Text.');
    return text;
  }

  const base = trimSlash(config.baseUrl || '');
  if (!base) throw new Error('Für einen OpenAI-kompatiblen Anbieter ist eine Base URL erforderlich.');
  const data = await postJson(`${base}/chat/completions`, { Authorization: `Bearer ${config.apiKey}` }, {
    model: config.model,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
  });
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Die kompatible API-Antwort enthielt keinen Text.');
  return text;
}

function cleanJsonText(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseJsonObject(text: string): any {
  const cleaned = cleanJsonText(text);
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  const candidate = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
  return JSON.parse(candidate);
}

function normalizeConfidence(value: unknown): AIConfidence { return value === 'higher' || value === 'medium' ? value : 'low'; }
function clamp(value: unknown, fallback = 0, min = 0, max = 10) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
function optionalNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return undefined;
  return Math.round(number * 10) / 10;
}

function parseInsight(text: string): AIHealthInsight {
  try {
    const parsed = parseJsonObject(text);
    const findings: AIHealthFinding[] = Array.isArray(parsed?.findings)
      ? parsed.findings.slice(0, 3).map((item: any) => ({
          title: String(item?.title || 'Beobachtung'),
          observation: String(item?.observation || ''),
          evidence: item?.evidence ? String(item.evidence) : undefined,
          uncertainty: item?.uncertainty ? String(item.uncertainty) : undefined,
        })).filter((item: AIHealthFinding) => item.observation)
      : [];
    return {
      headline: String(parsed?.headline || 'Deine Noura-Auswertung'),
      summary: String(parsed?.summary || 'Noch keine klare Tendenz.'),
      confidence: normalizeConfidence(parsed?.confidence),
      findings,
      nextSteps: Array.isArray(parsed?.nextSteps) ? parsed.nextSteps.slice(0, 3).map(String).filter(Boolean) : [],
      details: parsed?.details ? String(parsed.details) : undefined,
      safetyNote: parsed?.safetyNote ? String(parsed.safetyNote) : undefined,
      rawText: text,
    };
  } catch {
    return { headline: 'Deine Noura-Auswertung', summary: cleanJsonText(text) || 'Die Antwort konnte nicht strukturiert dargestellt werden.', confidence: 'low', findings: [], nextSteps: [], rawText: text };
  }
}

function parseQuickDraft(text: string): AIQuickDraft {
  const parsed = parseJsonObject(text);
  const mealType: MealType[] = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];
  const flow: CycleFlow[] = ['spotting', 'light', 'medium', 'heavy'];
  const mood: CycleMood[] = ['low', 'neutral', 'good'];
  const categories: ObservationCategory[] = ['food', 'symptom', 'cycle', 'body', 'general'];

  const result: AIQuickDraft = {
    headline: String(parsed?.headline || 'Entwurf erkannt'),
    understood: String(parsed?.understood || 'Noura hat deine Eingabe strukturiert.'),
    needsClarification: Array.isArray(parsed?.needsClarification) ? parsed.needsClarification.slice(0, 3).map(String).filter(Boolean) : [],
  };

  if (parsed?.meal && Array.isArray(parsed.meal.foods) && parsed.meal.foods.length) {
    result.meal = {
      mealType: mealType.includes(parsed.meal.mealType) ? parsed.meal.mealType : 'Snack',
      foods: parsed.meal.foods.slice(0, 12).map((food: any) => ({ name: String(food?.name || '').trim(), amount: food?.amount ? String(food.amount) : undefined })).filter((food: AIQuickFood) => !!food.name),
      note: parsed.meal.note ? String(parsed.meal.note) : undefined,
    };
  }
  if (parsed?.symptom) {
    const symptom: AIQuickSymptomDraft = { note: parsed.symptom.note ? String(parsed.symptom.note) : undefined };
    for (const key of ['pain','bloating','nausea','heartburn','energy','stress'] as const) {
      if (parsed.symptom[key] !== undefined && parsed.symptom[key] !== null && parsed.symptom[key] !== '') symptom[key] = clamp(parsed.symptom[key]);
    }
    symptom.temperature = optionalNumber(parsed.symptom.temperature, 34, 42);
    if (Object.values(symptom).some(v => v !== undefined)) result.symptom = symptom;
  }
  if (parsed?.bowel && Number.isFinite(Number(parsed.bowel.bristolType))) {
    result.bowel = { bristolType: clamp(parsed.bowel.bristolType, 4, 1, 7), urgency: clamp(parsed.bowel.urgency, 1, 0, 3), note: parsed.bowel.note ? String(parsed.bowel.note) : undefined };
  }
  if (parsed?.cycle) {
    const cycleDraft: AIQuickCycleDraft = {
      bleeding: !!parsed.cycle.bleeding,
      flow: flow.includes(parsed.cycle.flow) ? parsed.cycle.flow : undefined,
      mood: mood.includes(parsed.cycle.mood) ? parsed.cycle.mood : undefined,
      basalTemperature: optionalNumber(parsed.cycle.basalTemperature, 34, 42),
      note: parsed.cycle.note ? String(parsed.cycle.note) : undefined,
    };
    for (const key of ['cramps','cravings','headache','breastTenderness'] as const) {
      if (parsed.cycle[key] !== undefined && parsed.cycle[key] !== null && parsed.cycle[key] !== '') cycleDraft[key] = clamp(parsed.cycle[key]);
    }
    result.cycle = cycleDraft;
  }
  if (parsed?.observation?.text) {
    result.observation = {
      text: String(parsed.observation.text),
      category: categories.includes(parsed.observation.category) ? parsed.observation.category : 'general',
      severity: optionalNumber(parsed.observation.severity, 0, 10),
      tags: Array.isArray(parsed.observation.tags) ? parsed.observation.tags.slice(0, 6).map(String).filter(Boolean) : undefined,
    };
  }
  if (Array.isArray(parsed?.medications)) {
    result.medications = parsed.medications.slice(0, 6).map((item: any) => ({
      kind: item?.kind === 'supplement' ? 'supplement' as const : 'medication' as const,
      name: String(item?.name || '').trim(),
      dose: item?.dose ? String(item.dose).trim() : undefined,
      note: item?.note ? String(item.note).trim() : undefined,
    })).filter((item: AIQuickMedicationDraft) => !!item.name);
    if (!result.medications.length) delete result.medications;
  }
  return result;
}


const PHOTO_MEAL_SYSTEM_PROMPT = `Du bist die Foto-Eingabehilfe von Noura. Analysiere ausschließlich sichtbar erkennbare Lebensmittel und Getränke im Bild.
- Erfinde nichts, das nicht sichtbar oder plausibel erkennbar ist.
- Mengen nur als vorsichtige, grobe Schätzung angeben und mit "ca." kennzeichnen.
- Keine Kalorien oder Diagnosen schätzen.
- Bei Unsicherheit das Lebensmittel allgemein benennen (z. B. "Nudeln mit Sauce") statt Zutaten zu erfinden.
- Antworte ausschließlich als valides JSON im Format des Noura-Schnellentwurfs mit headline, understood, meal und needsClarification.
- mealType anhand Tageszeit nur vorsichtig wählen.
- meal.foods ist eine Liste aus {name, amount?}.`;

async function callVisionProvider(config: AIConfig, base64: string, mimeType: string, prompt: string): Promise<string> {
  if (!config.apiKey.trim()) throw new Error('API-Key fehlt.');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  if (config.provider === 'openai') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.openai.defaultBaseUrl!);
    const data = await postJson(`${base}/responses`, { Authorization: `Bearer ${config.apiKey}` }, {
      model: config.model, instructions: PHOTO_MEAL_SYSTEM_PROMPT,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: dataUrl }] }],
      max_output_tokens: 900,
    });
    if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
    return (data?.output || []).flatMap((item: any) => item?.content || []).map((part: any) => part?.text).filter(Boolean).join('\n').trim();
  }
  if (config.provider === 'anthropic') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.anthropic.defaultBaseUrl!);
    const data = await postJson(`${base}/messages`, { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, {
      model: config.model, max_tokens: 900, system: PHOTO_MEAL_SYSTEM_PROMPT, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: prompt }] }],
    });
    return (data?.content || []).map((part: any) => part?.text).filter(Boolean).join('\n').trim();
  }
  if (config.provider === 'gemini') {
    const base = trimSlash(config.baseUrl || PROVIDER_META.gemini.defaultBaseUrl!);
    const model = encodeURIComponent(config.model);
    const data = await postJson(`${base}/models/${model}:generateContent`, { 'x-goog-api-key': config.apiKey }, {
      systemInstruction: { parts: [{ text: PHOTO_MEAL_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      generationConfig: { maxOutputTokens: 900, temperature: 0.1, responseMimeType: 'application/json' },
    });
    return (data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text).filter(Boolean).join('\n').trim();
  }
  const base = trimSlash(config.baseUrl || '');
  if (!base) throw new Error('Für den kompatiblen Anbieter ist eine Base URL erforderlich.');
  const data = await postJson(`${base}/chat/completions`, { Authorization: `Bearer ${config.apiKey}` }, { model: config.model, temperature: 0.1, max_tokens: 900, messages: [{ role: 'system', content: PHOTO_MEAL_SYSTEM_PROMPT }, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] });
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

export async function generateMealPhotoDraft(config: AIConfig, base64: string, mimeType = 'image/jpeg'): Promise<AIQuickDraft> {
  const prompt = `Analysiere diese Mahlzeit. Zeitpunkt: ${new Date().toLocaleString('de-DE')}. Erstelle einen prüfbaren Entwurf.`;
  try {
    const text = await callVisionProvider(config, base64, mimeType, prompt);
    if (!text) throw new Error('Die KI konnte aus dem Foto keinen Entwurf erstellen.');
    await recordAIUsage({purpose:'meal-photo',provider:config.provider,model:config.model,payloadCharacters:prompt.length+base64.length,responseCharacters:text.length,outcome:'success'}).catch(()=>undefined);
    return parseQuickDraft(text);
  } catch (error) { await recordAIUsage({purpose:'meal-photo',provider:config.provider,model:config.model,payloadCharacters:prompt.length+base64.length,outcome:'error',error:error instanceof Error?error.message:'Fehler'}).catch(()=>undefined); throw error; }
}
export async function generateHealthInsight(config: AIConfig, store: HealthStore, scope: AIDataScope, cyclePreferences?: CyclePreferences): Promise<AIHealthInsight> {
  const prompt=buildUserPrompt(store,scope,cyclePreferences); const tx=getAITransmissionSummary(store,scope,cyclePreferences);
  try { const raw=await callProvider(config,prompt,HEALTH_SYSTEM_PROMPT); await recordAIUsage({purpose:'health-insight',provider:config.provider,model:config.model,scope,daysIncluded:tx.daysIncluded,payloadCharacters:prompt.length,responseCharacters:raw.length,outcome:'success'}).catch(()=>undefined); return parseInsight(raw); }
  catch(error){ await recordAIUsage({purpose:'health-insight',provider:config.provider,model:config.model,scope,daysIncluded:tx.daysIncluded,payloadCharacters:prompt.length,outcome:'error',error:error instanceof Error?error.message:'Fehler'}).catch(()=>undefined); throw error; }
}

export async function generateQuickDraft(config: AIConfig, text: string): Promise<AIQuickDraft> {
  const prompt = `Nutzereingabe:\n${text.trim()}\n\nHeute ist ${new Date().toLocaleString('de-DE')}. Erstelle nur einen speicherbaren Entwurf. Nichts diagnostizieren.`;
  try { const raw=await callProvider(config,prompt,QUICK_CAPTURE_SYSTEM_PROMPT,1000); await recordAIUsage({purpose:'quick-capture',provider:config.provider,model:config.model,payloadCharacters:prompt.length,responseCharacters:raw.length,outcome:'success'}).catch(()=>undefined); return parseQuickDraft(raw); }
  catch(error){ await recordAIUsage({purpose:'quick-capture',provider:config.provider,model:config.model,payloadCharacters:prompt.length,outcome:'error',error:error instanceof Error?error.message:'Fehler'}).catch(()=>undefined); throw error; }
}

export async function testAIConnection(config: AIConfig): Promise<void> {
  const prompt='Dies ist ausschließlich ein Verbindungstest. Es werden keine Gesundheitsdaten übermittelt. Gib valides JSON zurück und schreibe in summary nur: Verbindung erfolgreich.';
  try { const result = await callProvider(config,prompt,HEALTH_SYSTEM_PROMPT,500); if (!result) throw new Error('Keine Antwort vom KI-Anbieter erhalten.'); await recordAIUsage({purpose:'connection-test',provider:config.provider,model:config.model,payloadCharacters:prompt.length,responseCharacters:result.length,outcome:'success'}).catch(()=>undefined); }
  catch(error){ await recordAIUsage({purpose:'connection-test',provider:config.provider,model:config.model,payloadCharacters:prompt.length,outcome:'error',error:error instanceof Error?error.message:'Fehler'}).catch(()=>undefined); throw error; }
}
