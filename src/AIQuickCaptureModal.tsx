import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AIConfig, AIQuickDraft, generateQuickDraft } from './ai';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { MealType } from './types';

type Props = {
  visible: boolean;
  config: AIConfig | null;
  onClose: () => void;
  onOpenAISettings: () => void;
  onConfirm: (draft: AIQuickDraft) => void;
};

const purple = '#71558F';
const purpleSoft = '#F2ECF8';
const bg = '#F7F7F9';
const surface = '#FFFFFF';
const text = '#25242A';
const muted = '#7A7882';
const line = '#E8E5EC';

function clamp(value: number, min = 0, max = 10) { return Math.max(min, Math.min(max, value)); }

function Stepper({ label, value, onChange, max = 10 }: { label: string; value?: number; onChange: (value: number) => void; max?: number }) {
  const current = value ?? 0;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperBox}>
        <TouchableOpacity onPress={() => onChange(clamp(current - 1, 0, max))} style={styles.stepperButton}><Text style={styles.stepperButtonText}>−</Text></TouchableOpacity>
        <Text style={styles.stepperValue}>{value == null ? '–' : `${value}/${max}`}</Text>
        <TouchableOpacity onPress={() => onChange(clamp(current + 1, 0, max))} style={styles.stepperButton}><Text style={styles.stepperButtonText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function SectionToggle({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.toggle, enabled && styles.toggleActive]}><Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>{enabled ? '✓' : ''}</Text></TouchableOpacity>;
}

export default function AIQuickCaptureModal({ visible, config, onClose, onOpenAISettings, onConfirm }: Props) {
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<AIQuickDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [includeMeal, setIncludeMeal] = useState(true);
  const [includeSymptom, setIncludeSymptom] = useState(true);
  const [includeBowel, setIncludeBowel] = useState(true);
  const [includeCycle, setIncludeCycle] = useState(true);
  const [includeObservation, setIncludeObservation] = useState(true);
  const [includeMedications, setIncludeMedications] = useState(true);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');

  useSpeechRecognitionEvent('result', (event: any) => {
    const textValue = String(event?.results?.[0]?.transcript || event?.transcript || '').trim();
    if (textValue) setInput(textValue);
    if (event?.isFinal) setListening(false);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (event: any) => {
    setListening(false);
    const code = String(event?.error || event?.message || '');
    if (code && code !== 'aborted') setSpeechError('Spracherkennung konnte nicht gestartet werden. Du kannst weiterhin tippen.');
  });

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setDraft(null);
    setError('');
    setLoading(false);
    setListening(false);
    setSpeechError('');
  }, [visible]);

  const canConfirm = useMemo(() => !!draft && (
    (!!draft.meal && includeMeal) || (!!draft.symptom && includeSymptom) || (!!draft.bowel && includeBowel) || (!!draft.cycle && includeCycle) || (!!draft.observation && includeObservation) || (!!draft.medications?.length && includeMedications)
  ), [draft, includeMeal, includeSymptom, includeBowel, includeCycle, includeObservation, includeMedications]);

  const understand = async () => {
    if (!config || !input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const next = await generateQuickDraft(config, input.trim());
      setDraft(next);
      setIncludeMeal(!!next.meal);
      setIncludeSymptom(!!next.symptom);
      setIncludeBowel(!!next.bowel);
      setIncludeCycle(!!next.cycle);
      setIncludeObservation(!!next.observation);
      setIncludeMedications(!!next.medications?.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noura konnte die Eingabe nicht verstehen.');
    } finally {
      setLoading(false);
    }
  };

  const startListening = async () => {
    setSpeechError('');
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission?.granted) { setSpeechError('Mikrofon oder Spracherkennung wurde nicht freigegeben.'); return; }
      setListening(true);
      ExpoSpeechRecognitionModule.start({ lang: 'de-DE', interimResults: true, continuous: false });
    } catch { setListening(false); setSpeechError('Spracherkennung ist auf diesem Gerät gerade nicht verfügbar.'); }
  };
  const stopListening = () => { try { ExpoSpeechRecognitionModule.stop(); } catch {} setListening(false); };

  const updateDraft = (updater: (current: AIQuickDraft) => AIQuickDraft) => setDraft(current => current ? updater(current) : current);

  const confirm = () => {
    if (!draft) return;
    onConfirm({
      ...draft,
      meal: includeMeal ? draft.meal : undefined,
      symptom: includeSymptom ? draft.symptom : undefined,
      bowel: includeBowel ? draft.bowel : undefined,
      cycle: includeCycle ? draft.cycle : undefined,
      observation: includeObservation ? draft.observation : undefined,
      medications: includeMedications ? draft.medications : undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>SCHNELL EINTRAGEN</Text>
                <Text style={styles.title}>Erzähl Noura einfach, was war.</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            </View>

            <View style={styles.hero}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={listening ? 'Spracherkennung stoppen' : 'Spracherkennung starten'} onPress={listening ? stopListening : startListening} style={[styles.mic, listening && styles.micListening]}><Text style={styles.micText}>{listening ? '■' : '🎙'}</Text></TouchableOpacity>
              <Text style={styles.heroTitle}>Essen + Gefühl in einem Satz</Text>
              <Text style={styles.heroText}>Zum Beispiel: „Ich hatte gerade einen Latte und ein Croissant. Jetzt bin ich ziemlich aufgebläht und habe leichte Bauchschmerzen.“</Text>
              <TouchableOpacity onPress={listening ? stopListening : startListening}><Text style={styles.dictationHint}>{listening ? 'Ich höre zu … Tippe zum Stoppen.' : '🎙  Direkt diktieren'}</Text></TouchableOpacity>{speechError ? <Text style={styles.speechError}>{speechError}</Text> : null}
            </View>

            {!config ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Noch keine KI verbunden</Text>
                <Text style={styles.infoText}>Für diese Funktion nutzt Noura ausschließlich die KI, die du selbst verbunden hast.</Text>
                <TouchableOpacity style={styles.primary} onPress={onOpenAISettings}><Text style={styles.primaryText}>Eigene KI verbinden</Text></TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Was hast du gegessen und wie fühlst du dich?"
                  placeholderTextColor="#9A98A1"
                  multiline
                  style={styles.bigInput}
                />
                <View style={styles.privacyHint}><Text style={styles.privacyHintText}>Nur dieser Text wird für den Entwurf an deinen verbundenen KI-Anbieter gesendet. Gespeichert wird erst nach deiner Bestätigung.</Text></View>
                <TouchableOpacity disabled={!input.trim() || loading} onPress={understand} style={[styles.primary, (!input.trim() || loading) && styles.disabled]}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{draft ? 'Neu interpretieren' : 'Vorschlag erstellen'}</Text>}
                </TouchableOpacity>
              </>
            )}

            {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}

            {!!draft && (
              <View style={styles.draftWrap}>
                <View style={styles.draftSummary}>
                  <Text style={styles.draftKicker}>NOURA HAT VERSTANDEN</Text>
                  <Text style={styles.draftTitle}>{draft.understood}</Text>
                  <Text style={styles.draftHint}>Prüfe den Vorschlag. Du kannst Werte ändern oder einzelne Bereiche abwählen.</Text>
                </View>

                {!!draft.meal && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconMeal}><Text>🍽️</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Mahlzeit</Text><Text style={styles.sectionSub}>Was du gegessen hast</Text></View>
                      <SectionToggle enabled={includeMeal} onPress={() => setIncludeMeal(v => !v)} />
                    </View>
                    {includeMeal && <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                        {(['Frühstück','Mittagessen','Abendessen','Snack'] as MealType[]).map(type => (
                          <TouchableOpacity key={type} onPress={() => updateDraft(d => ({ ...d, meal: d.meal ? { ...d.meal, mealType: type } : d.meal }))} style={[styles.pill, draft.meal?.mealType === type && styles.pillActive]}>
                            <Text style={[styles.pillText, draft.meal?.mealType === type && styles.pillTextActive]}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {draft.meal.foods.map((food, index) => (
                        <View key={`${index}-${food.name}`} style={styles.foodEditRow}>
                          <TextInput value={food.name} onChangeText={(value: string) => updateDraft(d => ({ ...d, meal: d.meal ? { ...d.meal, foods: d.meal.foods.map((x, i) => i === index ? { ...x, name: value } : x) } : d.meal }))} style={[styles.smallInput, { flex: 1.4 }]} placeholder="Lebensmittel" />
                          <TextInput value={food.amount || ''} onChangeText={(value: string) => updateDraft(d => ({ ...d, meal: d.meal ? { ...d.meal, foods: d.meal.foods.map((x, i) => i === index ? { ...x, amount: value || undefined } : x) } : d.meal }))} style={[styles.smallInput, { flex: 0.75 }]} placeholder="Menge" />
                          <TouchableOpacity onPress={() => updateDraft(d => ({ ...d, meal: d.meal ? { ...d.meal, foods: d.meal.foods.filter((_, i) => i !== index) } : d.meal }))} style={styles.removeFood}><Text style={styles.removeFoodText}>×</Text></TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => updateDraft(d => ({ ...d, meal: d.meal ? { ...d.meal, foods: [...d.meal.foods, { name: '' }] } : d.meal }))} style={styles.addFoodButton}><Text style={styles.addFoodButtonText}>+ Lebensmittel ergänzen</Text></TouchableOpacity>
                    </>}
                  </View>
                )}

                {!!draft.symptom && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconSymptom}><Text>◌</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Wie du dich fühlst</Text><Text style={styles.sectionSub}>Von der KI vorgeschlagene Intensität</Text></View>
                      <SectionToggle enabled={includeSymptom} onPress={() => setIncludeSymptom(v => !v)} />
                    </View>
                    {includeSymptom && <>
                      <Stepper label="Bauchschmerzen" value={draft.symptom.pain} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, pain: value } : d.symptom }))} />
                      <Stepper label="Blähungen" value={draft.symptom.bloating} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, bloating: value } : d.symptom }))} />
                      <Stepper label="Übelkeit" value={draft.symptom.nausea} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, nausea: value } : d.symptom }))} />
                      <Stepper label="Sodbrennen" value={draft.symptom.heartburn} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, heartburn: value } : d.symptom }))} />
                      <Stepper label="Energie" value={draft.symptom.energy} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, energy: value } : d.symptom }))} />
                      <Stepper label="Stress" value={draft.symptom.stress} onChange={value => updateDraft(d => ({ ...d, symptom: d.symptom ? { ...d.symptom, stress: value } : d.symptom }))} />
                    </>}
                  </View>
                )}

                {!!draft.observation && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconObservation}><Text>!</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Beobachtung</Text><Text style={styles.sectionSub}>Freie Beobachtung für spätere Muster</Text></View>
                      <SectionToggle enabled={includeObservation} onPress={() => setIncludeObservation(v => !v)} />
                    </View>
                    {includeObservation && <TextInput value={draft.observation.text} onChangeText={(value: string) => updateDraft(d => ({ ...d, observation: d.observation ? { ...d.observation, text: value } : d.observation }))} multiline style={styles.noteInput} />}
                  </View>
                )}

                {!!draft.cycle && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconCycle}><Text>◐</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Zyklus</Text><Text style={styles.sectionSub}>{draft.cycle.bleeding ? 'Periode/Blutung erkannt' : 'Zyklusbezug erkannt'}</Text></View>
                      <SectionToggle enabled={includeCycle} onPress={() => setIncludeCycle(v => !v)} />
                    </View>
                    {includeCycle && <>
                      <TouchableOpacity onPress={() => updateDraft(d => ({ ...d, cycle: d.cycle ? { ...d.cycle, bleeding: !d.cycle.bleeding } : d.cycle }))} style={styles.binaryRow}><Text style={styles.binaryLabel}>Periode / Blutung</Text><View style={[styles.binaryBadge, draft.cycle.bleeding && styles.binaryBadgeActive]}><Text style={[styles.binaryBadgeText, draft.cycle.bleeding && styles.binaryBadgeTextActive]}>{draft.cycle.bleeding ? 'Ja' : 'Nein'}</Text></View></TouchableOpacity>
                      <Stepper label="Krämpfe" value={draft.cycle.cramps} onChange={value => updateDraft(d => ({ ...d, cycle: d.cycle ? { ...d.cycle, cramps: value } : d.cycle }))} />
                      <Stepper label="Cravings" value={draft.cycle.cravings} onChange={value => updateDraft(d => ({ ...d, cycle: d.cycle ? { ...d.cycle, cravings: value } : d.cycle }))} />
                      <Stepper label="Kopfschmerzen" value={draft.cycle.headache} onChange={value => updateDraft(d => ({ ...d, cycle: d.cycle ? { ...d.cycle, headache: value } : d.cycle }))} />
                      <Stepper label="Brustspannen" value={draft.cycle.breastTenderness} onChange={value => updateDraft(d => ({ ...d, cycle: d.cycle ? { ...d.cycle, breastTenderness: value } : d.cycle }))} />
                    </>}
                  </View>
                )}

                {!!draft.bowel && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconBowel}><Text>◉</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Stuhlgang</Text><Text style={styles.sectionSub}>Vorschlag prüfen und bei Bedarf ändern</Text></View>
                      <SectionToggle enabled={includeBowel} onPress={() => setIncludeBowel(v => !v)} />
                    </View>
                    {includeBowel && <>
                      <Stepper label="Bristol-Typ" max={7} value={draft.bowel.bristolType} onChange={value => updateDraft(d => ({ ...d, bowel: d.bowel ? { ...d.bowel, bristolType: Math.max(1, value) } : d.bowel }))} />
                      <Stepper label="Dringlichkeit" max={3} value={draft.bowel.urgency} onChange={value => updateDraft(d => ({ ...d, bowel: d.bowel ? { ...d.bowel, urgency: value } : d.bowel }))} />
                    </>}
                  </View>
                )}

                {!!draft.medications?.length && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionIconMedication}><Text>＋</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Medikamente / Supplements</Text><Text style={styles.sectionSub}>Nur ausdrücklich genannte Angaben</Text></View>
                      <SectionToggle enabled={includeMedications} onPress={() => setIncludeMedications(v => !v)} />
                    </View>
                    {includeMedications && draft.medications.map((item, index) => <View key={`${item.name}-${index}`} style={styles.binaryRow}><View style={{flex:1}}><Text style={styles.binaryLabel}>{item.name}</Text><Text style={styles.sectionSub}>{item.kind === 'supplement' ? 'Supplement' : 'Medikament'}{item.dose ? ` · ${item.dose}` : ''}</Text></View></View>)}
                  </View>
                )}

                {!!draft.needsClarification.length && (
                  <View style={styles.questionCard}><Text style={styles.questionTitle}>Noch unklar</Text>{draft.needsClarification.map((q, i) => <Text key={`${q}-${i}`} style={styles.questionText}>• {q}</Text>)}</View>
                )}

                <TouchableOpacity disabled={!canConfirm} onPress={confirm} style={[styles.confirm, !canConfirm && styles.disabled]}><Text style={styles.confirmText}>So speichern</Text></TouchableOpacity>
                <Text style={styles.confirmHint}>Noura speichert ausschließlich die oben ausgewählten Entwürfe. Du kannst sie später im Tagebuch löschen.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  content: { padding: 22, paddingBottom: 52, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { color: purple, fontSize: 10, letterSpacing: 1.1, fontWeight: '900' },
  title: { color: text, fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 4 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ECEAF0', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: text, fontSize: 25, marginTop: -2 },
  hero: { backgroundColor: purpleSoft, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#E2D9EC' },
  mic: { width: 48, height: 48, borderRadius: 24, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' },
  micText: { color: '#FFF', fontWeight: '900', fontSize: 21 },
  micListening: { backgroundColor: '#C15D62' },
  heroTitle: { color: text, fontSize: 17, fontWeight: '900', marginTop: 12 },
  heroText: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  dictationHint: { color: purple, fontSize: 11.5, lineHeight: 17, fontWeight: '800', marginTop: 9 },
  speechError: { color: '#A64640', fontSize: 10.5, lineHeight: 15, marginTop: 6 },
  bigInput: { minHeight: 128, backgroundColor: surface, borderWidth: 1, borderColor: line, borderRadius: 24, padding: 17, color: text, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  privacyHint: { backgroundColor: '#F0F5F1', borderRadius: 15, padding: 11 },
  privacyHintText: { color: '#5F6E63', fontSize: 10.8, lineHeight: 16 },
  primary: { backgroundColor: purple, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.42 },
  infoCard: { backgroundColor: surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: line, gap: 9 },
  infoTitle: { color: text, fontWeight: '900', fontSize: 17 },
  infoText: { color: muted, fontSize: 12.5, lineHeight: 18 },
  error: { backgroundColor: '#FDECEA', borderRadius: 16, padding: 13 },
  errorText: { color: '#A64640', fontSize: 12, lineHeight: 17 },
  draftWrap: { gap: 12, marginTop: 4 },
  draftSummary: { backgroundColor: '#F5F0FA', borderRadius: 23, padding: 17 },
  draftKicker: { color: purple, fontWeight: '900', fontSize: 9.5, letterSpacing: 1 },
  draftTitle: { color: text, fontWeight: '900', fontSize: 18, lineHeight: 24, marginTop: 5 },
  draftHint: { color: muted, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  sectionCard: { backgroundColor: surface, borderRadius: 23, padding: 16, borderWidth: 1, borderColor: line },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  sectionIconMeal: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E8F6EC', alignItems: 'center', justifyContent: 'center' },
  sectionIconSymptom: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFF0E9', alignItems: 'center', justifyContent: 'center' },
  sectionIconObservation: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFF6DA', alignItems: 'center', justifyContent: 'center' },
  sectionIconCycle: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F5EAF6', alignItems: 'center', justifyContent: 'center' },
  sectionIconBowel: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#EAF3FA', alignItems: 'center', justifyContent: 'center' },
  sectionIconMedication: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E8F6EC', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: text, fontWeight: '900', fontSize: 15.5 },
  sectionSub: { color: muted, fontSize: 10.5, marginTop: 2 },
  toggle: { width: 30, height: 30, borderRadius: 10, borderWidth: 1.5, borderColor: '#C9C5CF', alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: purple, borderColor: purple },
  toggleText: { color: '#FFF', fontWeight: '900' },
  toggleTextActive: { color: '#FFF' },
  pills: { gap: 8, paddingBottom: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F2F0F4' },
  pillActive: { backgroundColor: purple },
  pillText: { color: '#5F5C66', fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: '#FFF' },
  foodEditRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  removeFood: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F2F0F4', alignItems: 'center', justifyContent: 'center' },
  removeFoodText: { color: '#756F7A', fontSize: 19, marginTop: -1 },
  addFoodButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 2 },
  addFoodButtonText: { color: purple, fontSize: 11.5, fontWeight: '800' },
  binaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line },
  binaryLabel: { flex: 1, color: text, fontSize: 12.5, fontWeight: '700' },
  binaryBadge: { borderRadius: 999, backgroundColor: '#F2F0F4', paddingHorizontal: 12, paddingVertical: 6 },
  binaryBadgeActive: { backgroundColor: purple },
  binaryBadgeText: { color: muted, fontSize: 10.5, fontWeight: '800' },
  binaryBadgeTextActive: { color: '#FFF' },
  smallInput: { backgroundColor: '#F7F7F9', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 10, color: text, fontSize: 12 },
  noteInput: { minHeight: 76, backgroundColor: '#F7F7F9', borderRadius: 15, padding: 12, color: text, fontSize: 12.5, lineHeight: 18, textAlignVertical: 'top' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line },
  stepperLabel: { flex: 1, color: text, fontSize: 12.5, fontWeight: '700' },
  stepperBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F2F6', borderRadius: 12 },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { color: purple, fontSize: 19, fontWeight: '800' },
  stepperValue: { minWidth: 43, textAlign: 'center', color: text, fontSize: 11, fontWeight: '900' },
  questionCard: { backgroundColor: '#FFF7E5', borderRadius: 18, padding: 14 },
  questionTitle: { color: '#765A2B', fontWeight: '900', fontSize: 12.5, marginBottom: 5 },
  questionText: { color: '#765A2B', fontSize: 11.5, lineHeight: 17 },
  confirm: { backgroundColor: '#302A35', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  confirmHint: { color: muted, fontSize: 10.5, textAlign: 'center', lineHeight: 15, paddingHorizontal: 16 },
});
