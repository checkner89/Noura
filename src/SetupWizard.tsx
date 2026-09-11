import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GOAL_LABELS,
  GoalId,
  SYMPTOM_LABELS,
  SymptomKey,
  UserProfile,
} from './onboarding';

const colors = {
  bg: '#F8F5F0',
  surface: '#FFFDF9',
  text: '#292522',
  muted: '#7B746D',
  green: '#637A67',
  greenDark: '#435847',
  greenSoft: '#EAF0E9',
  greenTint: '#F4F7F2',
  line: '#E8E1D9',
  purple: '#8B77A8',
  purpleSoft: '#F0EBF6',
  orange: '#C9895E',
  orangeSoft: '#F8ECE2',
};

const GOAL_META: Array<{ id: GoalId; icon: string; title: string; text: string }> = [
  { id: 'triggers', icon: '⌁', title: GOAL_LABELS.triggers, text: 'Zeitliche Muster zwischen Lebensmitteln und Beschwerden beobachten.' },
  { id: 'digestion', icon: '◉', title: GOAL_LABELS.digestion, text: 'Mahlzeiten, Stuhlgang und Körpergefühl gemeinsam betrachten.' },
  { id: 'symptoms', icon: '＋', title: GOAL_LABELS.symptoms, text: 'Beschwerden einheitlich erfassen und Veränderungen sichtbar machen.' },
  { id: 'wellbeing', icon: '○', title: GOAL_LABELS.wellbeing, text: 'Energie, Stress und weitere Körperdaten im Verlauf beobachten.' },
  { id: 'cycle', icon: '◐', title: GOAL_LABELS.cycle, text: 'Zyklusdaten mit Verdauung, Beschwerden und Ernährung gemeinsam betrachten.' },
];

const SYMPTOM_META: Array<{ id: SymptomKey; icon: string }> = [
  { id: 'pain', icon: '◌' },
  { id: 'bloating', icon: '○' },
  { id: 'nausea', icon: '∿' },
  { id: 'heartburn', icon: '◇' },
];

type Props = {
  initialProfile: UserProfile;
  editing?: boolean;
  startStep?: number;
  onComplete: (profile: UserProfile, connectAI: boolean) => void;
  onCancel?: () => void;
};

function ChoiceCard({ selected, icon, title, text, onPress }: {
  selected: boolean;
  icon: string;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={[styles.choiceCard, selected && styles.choiceCardSelected]}>
      <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}><Text style={styles.choiceIconText}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceText}>{text}</Text>
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>{selected && <Text style={styles.checkMark}>✓</Text>}</View>
    </TouchableOpacity>
  );
}

function ToggleRow({ title, text, value, onChange, disabled }: {
  title: string;
  text: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleText}>{text}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: '#A9D2B4' }}
        thumbColor={value ? colors.green : undefined}
      />
    </View>
  );
}

export default function SetupWizard({ initialProfile, editing = false, startStep, onComplete, onCancel }: Props) {
  const firstStep = editing ? Math.max(1, Math.min(5, startStep ?? 1)) : 0;
  const [step, setStep] = useState(firstStep);
  const [profile, setProfile] = useState<UserProfile>({ ...initialProfile, tracking: { ...initialProfile.tracking } });
  const [connectAI, setConnectAI] = useState(false);
  const [understandsLocal, setUnderstandsLocal] = useState(editing);
  const [understandsMedical, setUnderstandsMedical] = useState(editing);

  const steps = 6;
  const progress = Math.max(0, Math.min(1, (step + 1) / steps));

  const bodyTrackingEnabled = profile.tracking.symptoms;
  const canContinue = useMemo(() => {
    if (step === 1) return profile.goals.length > 0;
    if (step === 2) return profile.tracking.meals || profile.tracking.symptoms || profile.tracking.bowel || profile.tracking.cycle;
    if (step === 3 && bodyTrackingEnabled) return profile.symptomsToTrack.length > 0 || profile.tracking.temperature || profile.tracking.energy || profile.tracking.stress;
    if (step === 5) return understandsLocal && understandsMedical;
    return true;
  }, [step, profile, bodyTrackingEnabled, understandsLocal, understandsMedical]);

  const toggleGoal = (id: GoalId) => {
    setProfile(current => ({
      ...current,
      goals: current.goals.includes(id) ? current.goals.filter(x => x !== id) : [...current.goals, id],
    }));
  };

  const toggleSymptom = (id: SymptomKey) => {
    setProfile(current => ({
      ...current,
      symptomsToTrack: current.symptomsToTrack.includes(id)
        ? current.symptomsToTrack.filter(x => x !== id)
        : [...current.symptomsToTrack, id],
    }));
  };

  const next = () => {
    if (!canContinue) return;
    if (step < steps - 1) {
      setStep(current => current + 1);
      return;
    }
    onComplete({
      ...profile,
      displayName: profile.displayName?.trim() || undefined,
      completed: true,
      completedAt: new Date().toISOString(),
    }, connectAI);
  };

  const back = () => {
    if (step > firstStep) setStep(current => current - 1);
    else if (editing && onCancel) onCancel();
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <View style={styles.heroWrap}>
          <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
          <Text style={styles.brand}>Noura</Text>
          <Text style={styles.heroTitle}>Lerne deine Ernährung und deinen Körper besser kennen.</Text>
          <Text style={styles.heroCopy}>Noura verbindet deine eigenen Tagebuchdaten zu nachvollziehbaren Mustern – ohne aus Korrelationen vorschnell Diagnosen zu machen.</Text>
          <View style={styles.benefitStack}>
            <View style={styles.benefit}><Text style={styles.benefitIcon}>🍽️</Text><View style={{ flex: 1 }}><Text style={styles.benefitTitle}>Einfach dokumentieren</Text><Text style={styles.benefitText}>Mahlzeiten, Beschwerden und Verdauung an einem Ort.</Text></View></View>
            <View style={styles.benefit}><Text style={styles.benefitIcon}>⌁</Text><View style={{ flex: 1 }}><Text style={styles.benefitTitle}>Muster sichtbar machen</Text><Text style={styles.benefitText}>Zeitliche Zusammenhänge werden lokal und nachvollziehbar ausgewertet.</Text></View></View>
            <View style={styles.benefit}><Text style={styles.benefitIcon}>✦</Text><View style={{ flex: 1 }}><Text style={styles.benefitTitle}>Deine KI, wenn du möchtest</Text><Text style={styles.benefitText}>Du kannst später deinen eigenen KI-Anbieter verbinden.</Text></View></View>
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <>
          <Text style={styles.kicker}>DEIN PROFIL</Text>
          <Text style={styles.title}>Was möchtest du mit Noura erreichen?</Text>
          <Text style={styles.subtitle}>Damit passen wir Tracking und Hinweise an. Du kannst alles später ändern.</Text>

          <Text style={styles.inputLabel}>Wie dürfen wir dich nennen? <Text style={styles.optional}>optional</Text></Text>
          <TextInput
            value={profile.displayName || ''}
            onChangeText={(displayName: string) => setProfile(current => ({ ...current, displayName }))}
            placeholder="Vorname oder Spitzname"
            placeholderTextColor="#98A19B"
            style={styles.input}
            autoCapitalize="words"
          />

          <Text style={styles.sectionLabel}>Deine Ziele · mehrere möglich</Text>
          {GOAL_META.map(item => (
            <ChoiceCard
              key={item.id}
              selected={profile.goals.includes(item.id)}
              icon={item.icon}
              title={item.title}
              text={item.text}
              onPress={() => toggleGoal(item.id)}
            />
          ))}
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <Text style={styles.kicker}>TRACKING</Text>
          <Text style={styles.title}>Was möchtest du regelmäßig dokumentieren?</Text>
          <Text style={styles.subtitle}>Weniger kann mehr sein. Wähle nur Dinge, die du im Alltag wirklich erfassen möchtest.</Text>
          <View style={styles.panel}>
            <ToggleRow title="Mahlzeiten" text="Lebensmittel, Mengen und optionale Notizen." value={profile.tracking.meals} onChange={meals => setProfile(current => ({ ...current, tracking: { ...current.tracking, meals } }))} />
            <View style={styles.divider} />
            <ToggleRow title="Beschwerden & Körperdaten" text="Symptome, Temperatur, Energie und Stress." value={profile.tracking.symptoms} onChange={symptoms => setProfile(current => ({ ...current, tracking: { ...current.tracking, symptoms } }))} />
            <View style={styles.divider} />
            <ToggleRow title="Stuhlgang" text="Bristol-Skala und Dringlichkeit dokumentieren." value={profile.tracking.bowel} onChange={bowel => setProfile(current => ({ ...current, tracking: { ...current.tracking, bowel } }))} />
            <View style={styles.divider} />
            <ToggleRow title="Zyklus" text="Periode, Krämpfe, Cravings, Stimmung und optionale Basaltemperatur." value={profile.tracking.cycle} onChange={cycle => setProfile(current => ({ ...current, goals: cycle && !current.goals.includes('cycle') ? [...current.goals, 'cycle'] : current.goals, tracking: { ...current.tracking, cycle } }))} />
          </View>
          <View style={styles.tipCard}><Text style={styles.tipIcon}>i</Text><Text style={styles.tipText}>Für Lebensmittel-Signale sind Mahlzeiten plus zeitnahe Körper-Check-ins besonders hilfreich.</Text></View>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <Text style={styles.kicker}>KÖRPER-CHECK-IN</Text>
          <Text style={styles.title}>Welche Angaben sollen in deinem Check-in erscheinen?</Text>
          <Text style={styles.subtitle}>{bodyTrackingEnabled ? 'Du kannst den Check-in bewusst schlank halten.' : 'Du hast Körperdaten deaktiviert. Du kannst sie hier wieder aktivieren.'}</Text>

          {!bodyTrackingEnabled && (
            <TouchableOpacity style={styles.restoreButton} onPress={() => setProfile(current => ({ ...current, tracking: { ...current.tracking, symptoms: true } }))}>
              <Text style={styles.restoreButtonText}>Körper-Check-in aktivieren</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.panel, !bodyTrackingEnabled && { opacity: 0.45 }]} pointerEvents={bodyTrackingEnabled ? 'auto' : 'none'}>
            {SYMPTOM_META.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity style={styles.symptomRow} onPress={() => toggleSymptom(item.id)}>
                  <View style={styles.symptomIcon}><Text>{item.icon}</Text></View>
                  <Text style={styles.symptomLabel}>{SYMPTOM_LABELS[item.id]}</Text>
                  <View style={[styles.checkCircle, profile.symptomsToTrack.includes(item.id) && styles.checkCircleSelected]}>
                    {profile.symptomsToTrack.includes(item.id) && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            <View style={styles.divider} />
            <ToggleRow title="Körpertemperatur" text="Optionaler Messwert in °C." value={profile.tracking.temperature} onChange={temperature => setProfile(current => ({ ...current, tracking: { ...current.tracking, temperature } }))} />
            <View style={styles.divider} />
            <ToggleRow title="Energielevel" text="Subjektiver Wert von 0 bis 10." value={profile.tracking.energy} onChange={energy => setProfile(current => ({ ...current, tracking: { ...current.tracking, energy } }))} />
            <View style={styles.divider} />
            <ToggleRow title="Stress" text="Subjektiver Wert von 0 bis 10." value={profile.tracking.stress} onChange={stress => setProfile(current => ({ ...current, tracking: { ...current.tracking, stress } }))} />
          </View>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <Text style={styles.kicker}>OPTIONALE KI</Text>
          <Text style={styles.title}>Möchtest du deine eigene KI verbinden?</Text>
          <Text style={styles.subtitle}>Noura funktioniert auch ohne externe KI. Die lokale Analyse bleibt immer verfügbar.</Text>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setConnectAI(false)} style={[styles.aiChoice, !connectAI && styles.aiChoiceSelected]}>
            <View style={styles.aiChoiceIcon}><Text style={{ fontSize: 19 }}>⌁</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.aiChoiceTitle}>Erst einmal ohne KI starten</Text><Text style={styles.aiChoiceText}>Empfohlen zum Kennenlernen. Es werden keine Trackingdaten an einen KI-Anbieter gesendet.</Text></View>
            <View style={[styles.radio, !connectAI && styles.radioSelected]}>{!connectAI && <View style={styles.radioDot} />}</View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setConnectAI(true)} style={[styles.aiChoice, connectAI && styles.aiChoiceSelected]}>
            <View style={[styles.aiChoiceIcon, { backgroundColor: colors.purpleSoft }]}><Text style={{ fontSize: 19, color: colors.purple }}>✦</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.aiChoiceTitle}>Eigene KI nach der Einrichtung verbinden</Text><Text style={styles.aiChoiceText}>OpenAI, Anthropic, Gemini oder eine OpenAI-kompatible API. API-Key und Modell bestimmst du selbst.</Text></View>
            <View style={[styles.radio, connectAI && styles.radioSelected]}>{connectAI && <View style={styles.radioDot} />}</View>
          </TouchableOpacity>

          <View style={styles.privacyMini}>
            <Text style={styles.privacyMiniTitle}>BYOK · Bring your own AI</Text>
            <Text style={styles.privacyMiniText}>Eine KI-Verbindung allein gibt noch keine Trackingdaten frei. Die Datenfreigabe wird separat in Noura aktiviert.</Text>
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={styles.kicker}>DATENSCHUTZ & SICHERHEIT</Text>
        <Text style={styles.title}>{editing ? 'Änderungen speichern?' : 'Fast geschafft.'}</Text>
        <Text style={styles.subtitle}>Zwei Punkte sind wichtig, bevor du Noura verwendest.</Text>

        <TouchableOpacity style={[styles.legalCard, understandsLocal && styles.legalCardChecked]} onPress={() => setUnderstandsLocal(v => !v)}>
          <View style={[styles.checkSquare, understandsLocal && styles.checkSquareSelected]}>{understandsLocal && <Text style={styles.checkMark}>✓</Text>}</View>
          <View style={{ flex: 1 }}><Text style={styles.legalTitle}>Lokale Speicherung im MVP verstanden</Text><Text style={styles.legalText}>Trackingdaten bleiben in dieser Testversion grundsätzlich auf dem Gerät. Der aktuelle Prototyp nutzt dafür noch keinen verschlüsselten Gesundheitsdatenspeicher.</Text></View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.legalCard, understandsMedical && styles.legalCardChecked]} onPress={() => setUnderstandsMedical(v => !v)}>
          <View style={[styles.checkSquare, understandsMedical && styles.checkSquareSelected]}>{understandsMedical && <Text style={styles.checkMark}>✓</Text>}</View>
          <View style={{ flex: 1 }}><Text style={styles.legalTitle}>Keine medizinische Diagnose</Text><Text style={styles.legalText}>Noura dokumentiert Angaben und zeigt statistische Signale. Die App diagnostiziert keine Allergien, Unverträglichkeiten oder Erkrankungen und ersetzt keine medizinische Abklärung.</Text></View>
        </TouchableOpacity>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryKicker}>DEINE EINRICHTUNG</Text>
          <Text style={styles.summaryTitle}>{profile.displayName ? `Bereit für dich, ${profile.displayName.trim()}.` : 'Noura ist bereit.'}</Text>
          <Text style={styles.summaryText}>{profile.goals.length} Ziele · {[profile.tracking.meals && 'Mahlzeiten', profile.tracking.symptoms && 'Körper-Check-ins', profile.tracking.bowel && 'Stuhlgang', profile.tracking.cycle && 'Zyklus'].filter(Boolean).join(' · ') || 'Tracking individuell reduziert'}</Text>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        {(step > 0 || editing) ? <TouchableOpacity onPress={back} style={styles.navButton}><Text style={styles.navButtonText}>‹</Text></TouchableOpacity> : <View style={styles.navSpacer} />}
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        {editing && onCancel ? <TouchableOpacity onPress={onCancel} style={styles.closeTextButton}><Text style={styles.closeText}>Schließen</Text></TouchableOpacity> : <View style={styles.navSpacer} />}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity disabled={!canContinue} onPress={next} style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{step === 0 ? 'Noura einrichten' : step === steps - 1 ? (editing ? 'Änderungen speichern' : 'Einrichtung abschließen') : 'Weiter'}</Text>
        </TouchableOpacity>
        {step > 0 && step < steps - 1 && <Text style={styles.stepText}>Schritt {step} von {steps - 1}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 4 },
  navButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  navButtonText: { fontSize: 31, color: colors.text, lineHeight: 33, marginTop: -3 },
  navSpacer: { width: 42 },
  progressTrack: { flex: 1, height: 5, backgroundColor: '#DFE6E0', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 999 },
  closeTextButton: { width: 64, alignItems: 'flex-end', paddingVertical: 10 },
  closeText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 12 },
  heroWrap: { alignItems: 'center', paddingTop: 22 },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFF', fontWeight: '900', fontSize: 35, letterSpacing: -1.5 },
  brand: { color: colors.green, fontWeight: '900', fontSize: 18, marginTop: 14 },
  heroTitle: { color: colors.text, fontSize: 29, lineHeight: 35, textAlign: 'center', fontWeight: '900', letterSpacing: -0.8, marginTop: 8 },
  heroCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, paddingHorizontal: 6 },
  benefitStack: { width: '100%', gap: 9, marginTop: 28 },
  benefit: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 },
  benefitIcon: { width: 31, textAlign: 'center', fontSize: 19, color: colors.green },
  benefitTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  benefitText: { color: colors.muted, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  kicker: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
  inputLabel: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 12 },
  optional: { color: colors.muted, fontWeight: '600' },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, color: colors.text, fontSize: 15 },
  sectionLabel: { color: colors.muted, fontSize: 11.5, fontWeight: '800', marginTop: 12, marginBottom: 2 },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 },
  choiceCardSelected: { backgroundColor: colors.greenTint, borderColor: '#A9CDB5' },
  choiceIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F0F3F0', alignItems: 'center', justifyContent: 'center' },
  choiceIconSelected: { backgroundColor: colors.greenSoft },
  choiceIconText: { color: colors.green, fontSize: 18, fontWeight: '900' },
  choiceTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  choiceText: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  checkCircle: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8D0CA', alignItems: 'center', justifyContent: 'center' },
  checkCircleSelected: { backgroundColor: colors.green, borderColor: colors.green },
  checkMark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  panel: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, marginTop: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 16 },
  toggleTitle: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
  toggleText: { color: colors.muted, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.line },
  tipCard: { flexDirection: 'row', gap: 11, backgroundColor: colors.greenSoft, borderRadius: 17, padding: 14, marginTop: 3 },
  tipIcon: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#CBE2D2', color: colors.greenDark, fontWeight: '900' },
  tipText: { flex: 1, color: colors.greenDark, fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  symptomRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 11 },
  symptomIcon: { width: 31, height: 31, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  symptomLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  restoreButton: { backgroundColor: colors.greenSoft, borderRadius: 15, paddingVertical: 13, alignItems: 'center' },
  restoreButtonText: { color: colors.green, fontWeight: '800', fontSize: 13 },
  aiChoice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 4 },
  aiChoiceSelected: { borderColor: '#A9CDB5', backgroundColor: colors.greenTint },
  aiChoiceIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiChoiceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  aiChoiceText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  radio: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: '#BFC8C1', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.green },
  privacyMini: { backgroundColor: colors.purpleSoft, borderRadius: 18, padding: 15, marginTop: 8 },
  privacyMiniTitle: { color: colors.purple, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  privacyMiniText: { color: colors.text, fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  legalCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderRadius: 19, borderWidth: 1, borderColor: colors.line, padding: 15, marginTop: 3 },
  legalCardChecked: { borderColor: '#A9CDB5', backgroundColor: colors.greenTint },
  checkSquare: { width: 25, height: 25, borderRadius: 8, borderWidth: 1.5, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center' },
  checkSquareSelected: { backgroundColor: colors.green, borderColor: colors.green },
  legalTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  legalText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  summaryCard: { backgroundColor: colors.orangeSoft, borderRadius: 20, padding: 17, marginTop: 8 },
  summaryKicker: { color: colors.orange, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  summaryTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 5 },
  summaryText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: '#E8ECE8' },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryButtonDisabled: { opacity: 0.38 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  stepText: { color: colors.muted, textAlign: 'center', fontSize: 10.5, marginTop: 8 },
});
