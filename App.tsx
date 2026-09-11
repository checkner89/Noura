import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { CameraView, useCameraPermissions } from 'expo-camera';

import {
  AIConfig,
  AIDataScope,
  AIHealthInsight,
  AIQuickDraft,
  AIProvider,
  AIModelOption,
  FALLBACK_MODEL_OPTIONS,
  PROVIDER_META,
  listAIModels,
  clearAIConfig,
  generateHealthInsight,
  loadAIConfig,
  loadAIConsent,
  loadAIDataScope,
  saveAIConfig,
  saveAIConsent,
  saveAIDataScope,
  testAIConnection,
} from './src/ai';
import {
  buildDailyTrends,
  computeFoodSignals,
  computeFoodSignalsWindow,
  computeCycleSymptomSignals,
  computeFoodCycleSignals,
  getTimeline,
  getTodaySummary,
  getTrackingDays,
  getCycleContext,
  isToday,
} from './src/analysis';
import {
  addBowel,
  addCycle,
  addMeal,
  addSymptom,
  addObservation,
  clearHealthStore,
  createDemoStore,
  emptyHealthStore,
  loadHealthStore,
  removeEntry,
  saveHealthStore,
} from './src/storage';
import { BowelEntry, CycleEntry, CycleFlow, CycleMood, FoodItem, HealthStore, MealEntry, MealType, ObservationCategory, ObservationEntry, SymptomEntry, TimelineItem } from './src/types';
import SetupWizard from './src/SetupWizard';
import BarcodeScannerModal from './src/BarcodeScannerModal';
import { GOAL_LABELS, UserProfile, createDefaultUserProfile, loadUserProfile, saveUserProfile } from './src/onboarding';
import AIQuickCaptureModal from './src/AIQuickCaptureModal';
import AddEntrySheet, { ManualEntryMode } from './src/AddEntrySheet';
import { AppPreferences, defaultAppPreferences, loadAppPreferences, saveAppPreferences } from './src/preferences';
import { writeAutomaticBackup } from './src/backup';
import { pickAndPersistProfileImage, removePersistedProfileImage } from './src/profileMedia';
import { configureDailyAI, loadLatestAIInsight, saveLatestAIInsight, syncDailyAIRegistration } from './src/dailyAI';

type Tab = 'Home' | 'Diary' | 'Tracking' | 'Analyse' | 'KI' | 'Profil';
type TrackingMode = 'Essen' | 'Symptome' | 'Auffälligkeit' | 'Stuhlgang' | 'Zyklus';

const colors = {
  bg: '#F7F7F9',
  surface: '#FFFFFF',
  text: '#242329',
  muted: '#7F7B86',
  green: '#4FA85B',
  greenDark: '#33743D',
  greenSoft: '#E8F6EC',
  greenTint: '#F2F9F4',
  line: '#EAE7ED',
  orange: '#F08A36',
  orangeSoft: '#FFF1E6',
  purple: '#71558F',
  purpleSoft: '#F2ECF8',
  coral: '#D86B66',
  coralSoft: '#FAECEB',
  red: '#B94A42',
  redSoft: '#FDEBE8',
  blue: '#4A8BC2',
  blueSoft: '#EAF3FA',
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const datePart = sameDay ? 'Heute' : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${datePart} · ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

function bristolLabel(type?: number) {
  if (!type) return '–';
  const labels: Record<number, string> = {
    1: 'sehr hart',
    2: 'hart',
    3: 'eher fest',
    4: 'glatt / weich',
    5: 'weich',
    6: 'breiig',
    7: 'flüssig',
  };
  return `Typ ${type} · ${labels[type] || ''}`;
}

const ShadowCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Pill = ({ label, active, onPress, compact }: { label: string; active?: boolean; onPress?: () => void; compact?: boolean }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.pill, compact && styles.pillCompact, active && styles.pillActive]}>
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
);


type SelectOption = { value: string; label: string; detail?: string; badge?: string };

function DropdownField({ label, value, placeholder, detail, onPress, disabled }: {
  label: string;
  value?: string;
  placeholder: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.dropdownField, disabled && styles.dropdownDisabled]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]} numberOfLines={1}>{value || placeholder}</Text>
          {!!detail && <Text style={styles.dropdownDetail} numberOfLines={1}>{detail}</Text>}
        </View>
        <Text style={styles.dropdownChevron}>⌄</Text>
      </TouchableOpacity>
    </View>
  );
}

function SelectionSheet({ visible, title, subtitle, options, selected, searchable, loading, onClose, onSelect }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SelectOption[];
  selected?: string;
  searchable?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(item => `${item.label} ${item.value} ${item.detail || ''}`.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.selectBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.selectSheet}>
          <View style={styles.selectHandle} />
          <View style={styles.selectHeader}>
            <View style={{ flex: 1 }}><Text style={styles.selectTitle}>{title}</Text>{!!subtitle && <Text style={styles.selectSubtitle}>{subtitle}</Text>}</View>
            <TouchableOpacity onPress={onClose} style={styles.selectClose}><Text style={styles.selectCloseText}>×</Text></TouchableOpacity>
          </View>
          {searchable && (
            <View style={styles.selectSearchWrap}>
              <Text style={styles.selectSearchIcon}>⌕</Text>
              <TextInput value={query} onChangeText={setQuery} placeholder="Suchen…" placeholderTextColor="#98929D" style={styles.selectSearch} autoCapitalize="none" autoCorrect={false} />
            </View>
          )}
          {loading ? (
            <View style={styles.selectLoading}><ActivityIndicator color={colors.purple} /><Text style={styles.selectLoadingText}>Modelle werden geladen…</Text></View>
          ) : (
            <ScrollView style={styles.selectList} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
              {filtered.map(item => {
                const active = item.value === selected;
                return (
                  <TouchableOpacity key={item.value} onPress={() => { onSelect(item.value); onClose(); }} style={[styles.selectRow, active && styles.selectRowActive]} activeOpacity={0.75}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.selectLabelRow}><Text style={[styles.selectRowLabel, active && styles.selectRowLabelActive]}>{item.label}</Text>{!!item.badge && <View style={styles.selectBadge}><Text style={styles.selectBadgeText}>{item.badge}</Text></View>}</View>
                      <Text style={styles.selectRowValue}>{item.value}</Text>
                      {!!item.detail && <Text style={styles.selectRowDetail} numberOfLines={2}>{item.detail}</Text>}
                    </View>
                    {active && <Text style={styles.selectCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {!filtered.length && <Text style={styles.selectEmpty}>Keine passenden Einträge gefunden.</Text>}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function getInitials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'NU';
}

function ProfileAvatar({ profile, size = 40, onPress }: { profile: UserProfile; size?: number; onPress?: () => void }) {
  const content = profile.profileImageUri
    ? <Image source={{ uri: profile.profileImageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <Text style={[styles.avatarText, { fontSize: Math.max(11, size * 0.31) }]}>{getInitials(profile.displayName)}</Text>;
  const body = <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>{content}</View>;
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{body}</TouchableOpacity> : body;
}

function Header({ title, subtitle, profile, onAvatarPress }: { title: string; subtitle?: string; profile?: UserProfile; onAvatarPress?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {profile ? <ProfileAvatar profile={profile} onPress={onAvatarPress} /> : null}
    </View>
  );
}

function Metric({ icon, title, value, subtitle }: { icon: string; title: string; value: string; subtitle: string }) {
  return (
    <ShadowCard style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSub}>{subtitle}</Text>
    </ShadowCard>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function HomeScreen({ store, profile, aiInsight, onAIQuick, onAdd, onOpenInsights, onDiary, onProfile }: {
  store: HealthStore;
  profile: UserProfile;
  aiInsight: string;
  onAIQuick: () => void;
  onAdd: (mode: TrackingMode) => void;
  onOpenInsights: () => void;
  onDiary: () => void;
  onProfile: () => void;
}) {
  const summary = useMemo(() => getTodaySummary(store), [store]);
  const cycleContext = useMemo(() => getCycleContext(store), [store]);
  const latestMeal = useMemo(() => store.meals.filter(x => isToday(x.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [store]);
  const latestSymptom = useMemo(() => store.symptoms.filter(x => isToday(x.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [store]);
  const topFood = useMemo(() => computeFoodSignals(store)[0], [store]);
  const topCycle = useMemo(() => computeCycleSymptomSignals(store).find(x => x.delta > 0.3), [store]);

  const score = useMemo(() => {
    if (!latestSymptom) return null;
    const burden = (latestSymptom.pain + latestSymptom.bloating + latestSymptom.nausea + latestSymptom.heartburn) / 4;
    const raw = 82 - burden * 5.2 - latestSymptom.stress * 1.6 + latestSymptom.energy * 2.8;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [latestSymptom]);

  const insight = aiInsight
    ? aiInsight
    : topFood ? `${topFood.food} fällt wiederholt vor stärkeren Beschwerden auf. Das ist ein Signal, noch keine Ursache.`
    : topCycle ? `Deine Beschwerden sind in der ${topCycle.phase} bisher etwas stärker als im persönlichen Durchschnitt.`
    : 'Noch keine belastbare Auffälligkeit. Regelmäßige kurze Einträge machen Muster mit der Zeit sichtbar.';

  const scoreCopy = score == null
    ? 'Ein kurzer Gefühl-Check-in reicht, damit Noura dein heutiges Tagesbild berechnen kann.'
    : score >= 75 ? 'Deine heutigen Angaben wirken insgesamt eher ruhig.'
    : score >= 50 ? 'Heute gibt es ein paar Belastungssignale – beobachte, was dir auffällt.'
    : 'Deine heutigen Angaben zeigen eine höhere Belastung. Bei starken oder anhaltenden Beschwerden bitte medizinisch abklären.';

  return (
    <ScrollView contentContainerStyle={styles.simpleHomeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.simpleHomeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.simpleHomeGreeting}>{profile.displayName ? `Hi ${profile.displayName.split(' ')[0]}` : 'Heute'}</Text>
          <Text style={styles.simpleHomeDate}>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</Text>
        </View>
        <ProfileAvatar profile={profile} size={44} onPress={onProfile} />
      </View>

      <View style={styles.scoreHero}>
        <View style={styles.scoreHeroCircle}>
          <Text style={styles.scoreHeroValue}>{score == null ? '–' : score}</Text>
          <Text style={styles.scoreHeroOf}>/ 100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scoreHeroKicker}>DEIN TAGESBILD</Text>
          <Text style={styles.scoreHeroTitle}>{score == null ? 'Wie geht es dir heute?' : score >= 75 ? 'Heute wirkt eher ruhig' : score >= 50 ? 'Ein paar Signale im Blick' : 'Heute genauer hinschauen'}</Text>
          <Text style={styles.scoreHeroText}>{scoreCopy}</Text>
          {score == null && <TouchableOpacity onPress={() => onAdd('Symptome')} style={styles.scoreHeroButton}><Text style={styles.scoreHeroButtonText}>Gefühl eintragen</Text></TouchableOpacity>}
        </View>
      </View>

      <TouchableOpacity style={styles.homeInsightCard} onPress={onOpenInsights} activeOpacity={0.9}>
        <View style={styles.homeInsightTop}><Text style={styles.homeInsightKicker}>WICHTIGSTE ERKENNTNIS</Text><Text style={styles.homeInsightArrow}>›</Text></View>
        <Text style={styles.homeInsightText} numberOfLines={3}>{insight}</Text>
        <Text style={styles.homeInsightFoot}>Tippen für Analyse & Details</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tellNouraRow} onPress={onAIQuick} activeOpacity={0.88}>
        <View style={styles.tellNouraIcon}><Text style={styles.tellNouraIconText}>✦</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.tellNouraTitle}>Noura einfach erzählen</Text><Text style={styles.tellNouraSub}>Essen, Gefühl oder Auffälligkeit in einem Satz.</Text></View>
        <Text style={styles.tellNouraArrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.homeQuickRow}>
        <TouchableOpacity style={styles.homeQuickButton} onPress={() => onAdd('Essen')}><Text style={styles.homeQuickIcon}>🍽</Text><Text style={styles.homeQuickText}>Essen</Text></TouchableOpacity>
        <TouchableOpacity style={styles.homeQuickButton} onPress={() => onAdd('Symptome')}><Text style={styles.homeQuickIcon}>◌</Text><Text style={styles.homeQuickText}>Gefühl</Text></TouchableOpacity>
        <TouchableOpacity style={styles.homeQuickButton} onPress={() => onAdd('Auffälligkeit')}><Text style={styles.homeQuickIcon}>!</Text><Text style={styles.homeQuickText}>Auffällig</Text></TouchableOpacity>
      </View>

      <View style={styles.homeTodayCard}>
        <View style={styles.homeTodayHeader}><Text style={styles.homeTodayTitle}>Heute</Text><TouchableOpacity onPress={onDiary}><Text style={styles.homeTodayLink}>Tagebuch ›</Text></TouchableOpacity></View>
        <View style={styles.homeTodayStats}>
          <View style={styles.homeTodayStat}><Text style={styles.homeTodayValue}>{summary.mealCount}</Text><Text style={styles.homeTodayLabel}>Mahlzeiten</Text></View>
          <View style={styles.homeTodayStat}><Text style={styles.homeTodayValue}>{store.symptoms.filter(x => isToday(x.createdAt)).length}</Text><Text style={styles.homeTodayLabel}>Check-ins</Text></View>
          <View style={styles.homeTodayStat}><Text style={styles.homeTodayValue}>{store.bowel.filter(x => isToday(x.createdAt)).length}</Text><Text style={styles.homeTodayLabel}>Stuhlgang</Text></View>
        </View>
        {latestMeal && <View style={styles.homeLastRow}><Text style={styles.homeLastLabel}>Zuletzt gegessen</Text><Text style={styles.homeLastValue} numberOfLines={1}>{latestMeal.foods.map(x => x.name).join(', ')}</Text></View>}
        {profile.tracking.cycle && <View style={styles.homeLastRow}><Text style={styles.homeLastLabel}>Zyklus</Text><Text style={styles.homeLastValue}>{cycleContext.bleedingToday ? 'Periode heute' : cycleContext.estimatedCycleDay ? `ca. Tag ${cycleContext.estimatedCycleDay} · ${cycleContext.estimatedPhase || ''}` : 'Noch zu wenig Daten'}</Text></View>}
      </View>

      <Text style={styles.homeScoreDisclaimer}>Der Tages-Score ist eine vereinfachte Darstellung deiner eigenen Angaben und keine medizinische Bewertung.</Text>
    </ScrollView>
  );
}

function TimelineRow({ item, border, onDelete }: { item: TimelineItem; border?: boolean; onDelete?: () => void }) {
  const icons = { meal: '🍽️', symptom: '◌', bowel: '◉', cycle: '◐', observation: '!' } as const;
  return (
    <View style={[styles.timelineRow, border && styles.rowBorder]}>
      <View style={styles.timelineIcon}><Text>{icons[item.kind]}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineTitle}>{item.title}</Text>
        <Text style={styles.timelineSub}>{item.subtitle}</Text>
        <Text style={styles.timelineTime}>{formatDateTime(item.createdAt)}</Text>
      </View>
      {!!onDelete && <TouchableOpacity style={styles.deleteMini} onPress={onDelete}><Text style={styles.deleteMiniText}>×</Text></TouchableOpacity>}
    </View>
  );
}


function DiaryScreen({ store, onDelete, onAdd }: {
  store: HealthStore;
  onDelete: (kind: 'meal' | 'symptom' | 'bowel' | 'cycle' | 'observation', id: string) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState('');
  const timeline = useMemo(() => getTimeline(store, 300), [store]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    if (!needle) return timeline;
    return timeline.filter(item => `${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(needle));
  }, [timeline, query]);

  const grouped = useMemo(() => {
    const result: Array<{ key: string; label: string; items: TimelineItem[] }> = [];
    for (const item of filtered) {
      const d = new Date(item.createdAt);
      const key = d.toDateString();
      let group = result.find(x => x.key === key);
      if (!group) {
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        const label = d.toDateString() === today.toDateString() ? 'Heute' : d.toDateString() === yesterday.toDateString() ? 'Gestern' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
        group = { key, label, items: [] };
        result.push(group);
      }
      group.items.push(item);
    }
    return result;
  }, [filtered]);

  return (
    <ScrollView contentContainerStyle={styles.diaryScreenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.foodlogHeader}>
        <View><Text style={styles.foodlogHeaderTitle}>Tagebuch</Text><Text style={styles.foodlogHeaderSub}>Deine Einträge auf einen Blick.</Text></View>
      </View>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Eintrag suchen" placeholderTextColor="#9B98A0" style={styles.searchInput} /></View>

      {grouped.length ? grouped.map(group => (
        <View key={group.key} style={styles.diaryGroup}>
          <Text style={styles.diaryDate}>{group.label}</Text>
          <View style={styles.diaryCard}>
            {group.items.map((item, index) => (
              <TimelineRow
                key={`${item.kind}-${item.id}`}
                item={item}
                border={index < group.items.length - 1}
                onDelete={() => Alert.alert('Eintrag löschen?', 'Der Eintrag wird nur von diesem Gerät entfernt.', [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Löschen', style: 'destructive', onPress: () => onDelete(item.kind, item.id) },
                ])}
              />
            ))}
          </View>
        </View>
      )) : <EmptyState icon="⌕" title="Keine Einträge gefunden" text={query ? 'Versuche einen anderen Suchbegriff.' : 'Lege deinen ersten Tagebucheintrag an.'} />}
    </ScrollView>
  );
}

function Counter({ title, value, onChange, min = 0, max = 10, helper }: {
  title: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  helper?: string;
}) {
  return (
    <ShadowCard>
      <View style={styles.counterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.counterTitle}>{title}</Text>
          {!!helper && <Text style={styles.helper}>{helper}</Text>}
        </View>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></TouchableOpacity>
          <Text style={styles.stepValue}>{value}/{max}</Text>
          <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></TouchableOpacity>
        </View>
      </View>
    </ShadowCard>
  );
}

function TrackingScreen({ store, profile, initialMode, onSaveMeal, onSaveSymptom, onSaveBowel, onSaveCycle, onSaveObservation, onDone }: {
  store: HealthStore;
  profile: UserProfile;
  initialMode: TrackingMode;
  onSaveMeal: (entry: MealEntry) => void;
  onSaveSymptom: (entry: SymptomEntry) => void;
  onSaveBowel: (entry: BowelEntry) => void;
  onSaveCycle: (entry: CycleEntry) => void;
  onSaveObservation: (entry: ObservationEntry) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<TrackingMode>(initialMode);
  const availableModes = useMemo<TrackingMode[]>(() => [
    ...(profile.tracking.meals ? ['Essen' as TrackingMode] : []),
    ...(profile.tracking.symptoms ? ['Symptome' as TrackingMode] : []),
    'Auffälligkeit' as TrackingMode,
    ...(profile.tracking.bowel ? ['Stuhlgang' as TrackingMode] : []),
    ...(profile.tracking.cycle ? ['Zyklus' as TrackingMode] : []),
  ], [profile.tracking.meals, profile.tracking.symptoms, profile.tracking.bowel, profile.tracking.cycle]);

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => {
    if (availableModes.length && !availableModes.includes(mode)) setMode(availableModes[0]!);
  }, [availableModes, mode]);
  const [savedMessage, setSavedMessage] = useState('');

  const [mealType, setMealType] = useState<MealType>('Frühstück');
  const [foodName, setFoodName] = useState('');
  const [foodAmount, setFoodAmount] = useState('');
  const [foodKcal, setFoodKcal] = useState('');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [mealNote, setMealNote] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerBusy, setScannerBusy] = useState(false);
  const scannerBusyRef = useRef(false);
  const cameraApi = CameraView as any;

  const [pain, setPain] = useState(0);
  const [bloating, setBloating] = useState(0);
  const [nausea, setNausea] = useState(0);
  const [heartburn, setHeartburn] = useState(0);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(3);
  const [temperature, setTemperature] = useState(36.6);
  const [symptomNote, setSymptomNote] = useState('');

  const [observationText, setObservationText] = useState('');
  const [observationCategory, setObservationCategory] = useState<ObservationCategory>('general');
  const [observationSeverity, setObservationSeverity] = useState(3);

  const [bristolType, setBristolType] = useState(4);
  const [urgency, setUrgency] = useState(1);
  const [bowelNote, setBowelNote] = useState('');

  const [cycleBleeding, setCycleBleeding] = useState(false);
  const [cycleFlow, setCycleFlow] = useState<CycleFlow>('medium');
  const [cycleCramps, setCycleCramps] = useState(0);
  const [cycleCravings, setCycleCravings] = useState(0);
  const [cycleHeadache, setCycleHeadache] = useState(0);
  const [cycleBreastTenderness, setCycleBreastTenderness] = useState(0);
  const [cycleMood, setCycleMood] = useState<CycleMood>('neutral');
  const [cycleBasalTemp, setCycleBasalTemp] = useState(36.5);
  const [cycleNote, setCycleNote] = useState('');

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const result: FoodItem[] = [];
    const meals = store.meals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const meal of meals) {
      for (const food of meal.foods) {
        const key = food.name.trim().toLocaleLowerCase('de-DE');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(food);
        if (result.length >= 8) return result;
      }
    }
    return result;
  }, [store.meals]);

  useEffect(() => {
    if (typeof cameraApi.onModernBarcodeScanned !== 'function') return;

    const subscription = cameraApi.onModernBarcodeScanned((event: { data?: string; type?: string }) => {
      const raw = String(event?.data || '').trim();
      if (!raw || !scannerBusyRef.current) return;

      // launchScanner() resolves when the native scanner was presented, not when a code
      // was read. Therefore the scan session must stay active until THIS event arrives.
      scannerBusyRef.current = false;
      setScannerBusy(false);

      const clean = raw.replace(/[\s-]+/g, '');
      const showResult = () => {
        setScannedCode(clean);
        setScannerOpen(true);
      };

      if (Platform.OS === 'ios' && typeof cameraApi.dismissScanner === 'function') {
        cameraApi.dismissScanner()
          .catch(() => undefined)
          .finally(() => setTimeout(showResult, 80));
      } else {
        setTimeout(showResult, 80);
      }
    });

    return () => subscription?.remove?.();
  }, []);

  const openBarcodeCamera = async () => {
    try {
      // A previous native scanner can have been dismissed without producing an event.
      // Reset that stale session so the next tap always opens a fresh scanner.
      if (scannerBusyRef.current) {
        scannerBusyRef.current = false;
        if (Platform.OS === 'ios' && typeof cameraApi.dismissScanner === 'function') {
          await cameraApi.dismissScanner().catch(() => undefined);
        }
      }

      let granted = !!cameraPermission?.granted;
      if (!granted) {
        const result = await requestCameraPermission();
        granted = !!result.granted;
      }
      if (!granted) {
        Alert.alert('Kamera nicht freigegeben', 'Bitte erlaube Noura bzw. Expo Go den Kamerazugriff in den iOS-Einstellungen.');
        return;
      }

      if (!cameraApi.isModernBarcodeScannerAvailable || typeof cameraApi.launchScanner !== 'function') {
        setScannedCode('');
        setScannerOpen(true);
        return;
      }

      setScannerOpen(false);
      setScannedCode('');
      scannerBusyRef.current = true;
      setScannerBusy(true);

      // Deliberately do not restrict barcodeTypes here. iOS can visually highlight
      // additional GTIN/UPC symbologies; filtering them caused a visible code to be
      // highlighted without emitting the callback on some devices.
      await cameraApi.launchScanner({
        isGuidanceEnabled: true,
        isHighlightingEnabled: true,
        isPinchToZoomEnabled: true,
      });

      // Important: do NOT clear scannerBusyRef here. The promise resolves after the
      // native scanner is presented. onModernBarcodeScanned above ends the session.
      setScannerBusy(false);
    } catch (e) {
      scannerBusyRef.current = false;
      setScannerBusy(false);
      Alert.alert(
        'Scanner konnte nicht geöffnet werden',
        e instanceof Error ? e.message : 'Der native iPhone-Scanner konnte nicht gestartet werden. Du kannst den Barcode auch manuell eingeben.',
      );
      setScannedCode('');
      setScannerOpen(true);
    }
  };


  const flashSaved = (message: string) => {
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(''), 2200);
  };

  const addFood = () => {
    const name = foodName.trim();
    if (!name) return;
    const parsed = Number(foodKcal.replace(',', '.'));
    setFoods(current => [...current, {
      id: uid('food'),
      name,
      amount: foodAmount.trim() || undefined,
      kcal: Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined,
      source: 'manual',
    }]);
    setFoodName('');
    setFoodAmount('');
    setFoodKcal('');
  };

  const saveMeal = () => {
    if (!foods.length) {
      Alert.alert('Noch kein Lebensmittel', 'Füge mindestens ein Lebensmittel zur Mahlzeit hinzu.');
      return;
    }
    onSaveMeal({ id: uid('meal'), createdAt: new Date().toISOString(), mealType, foods, note: mealNote.trim() || undefined });
    setFoods([]);
    setMealNote('');
    flashSaved('Mahlzeit gespeichert');
    setTimeout(onDone, 220);
  };

  const saveSymptoms = () => {
    onSaveSymptom({
      id: uid('sym'),
      createdAt: new Date().toISOString(),
      pain: profile.symptomsToTrack.includes('pain') ? pain : 0,
      bloating: profile.symptomsToTrack.includes('bloating') ? bloating : 0,
      nausea: profile.symptomsToTrack.includes('nausea') ? nausea : 0,
      heartburn: profile.symptomsToTrack.includes('heartburn') ? heartburn : 0,
      energy: profile.tracking.energy ? energy : 5,
      stress: profile.tracking.stress ? stress : 5,
      temperature: profile.tracking.temperature ? temperature : undefined,
      note: symptomNote.trim() || undefined,
    });
    setSymptomNote('');
    flashSaved('Körper-Check-in gespeichert');
    setTimeout(onDone, 220);
  };

  const saveBowel = () => {
    onSaveBowel({ id: uid('bowel'), createdAt: new Date().toISOString(), bristolType, urgency, note: bowelNote.trim() || undefined });
    setBowelNote('');
    flashSaved('Stuhlgang gespeichert');
    setTimeout(onDone, 220);
  };

  const saveCycle = () => {
    onSaveCycle({
      id: uid('cycle'),
      createdAt: new Date().toISOString(),
      bleeding: cycleBleeding,
      flow: cycleBleeding ? cycleFlow : undefined,
      cramps: cycleCramps,
      cravings: cycleCravings,
      headache: cycleHeadache,
      breastTenderness: cycleBreastTenderness,
      mood: cycleMood,
      basalTemperature: cycleBasalTemp,
      note: cycleNote.trim() || undefined,
    });
    setCycleNote('');
    flashSaved('Zyklus-Check-in gespeichert');
    setTimeout(onDone, 220);
  };

  const saveObservation = () => {
    if (!observationText.trim()) {
      Alert.alert('Was ist dir aufgefallen?', 'Schreibe kurz, was du beobachtet hast.');
      return;
    }
    onSaveObservation({
      id: uid('obs'),
      createdAt: new Date().toISOString(),
      text: observationText.trim(),
      category: observationCategory,
      severity: observationSeverity,
    });
    setObservationText('');
    flashSaved('Auffälligkeit gespeichert');
    setTimeout(onDone, 220);
  };

  return (
    <>
      <BarcodeScannerModal
        visible={scannerOpen}
        initialCode={scannedCode || undefined}
        onClose={() => { setScannerOpen(false); setScannedCode(''); }}
        onScanAgain={() => { setScannerOpen(false); setScannedCode(''); setTimeout(openBarcodeCamera, 220); }}
        onAdd={food => { setFoods(current => [...current, food]); flashSaved('Barcode-Produkt hinzugefügt'); }}
      />
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.entryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryHeaderKicker}>NEUER EINTRAG</Text>
          <Text style={styles.entryHeaderTitle}>{mode === 'Symptome' ? 'Wie geht es dir?' : mode}</Text>
          <Text style={styles.entryHeaderSub}>Nur das Nötigste. Nach dem Speichern landest du direkt im Tagebuch.</Text>
        </View>
        <TouchableOpacity onPress={onDone} style={styles.entryClose}><Text style={styles.entryCloseText}>×</Text></TouchableOpacity>
      </View>
      {availableModes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.entryModeScroll}>
          {availableModes.map(x => (
            <TouchableOpacity key={x} onPress={() => setMode(x)} style={[styles.entryModeChip, mode === x && styles.entryModeChipActive]}>
              <Text style={[styles.entryModeChipText, mode === x && styles.entryModeChipTextActive]}>{x === 'Symptome' ? 'Gefühl' : x}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!!savedMessage && <View style={styles.savedBanner}><Text style={styles.savedBannerText}>✓ {savedMessage}</Text></View>}

      {mode === 'Essen' && (
        <>
          <Text style={styles.sectionTitle}>Mahlzeit</Text>
          <View style={styles.pillWrap}>
            {(['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'] as MealType[]).map(x => <Pill key={x} label={x} active={mealType === x} onPress={() => setMealType(x)} />)}
          </View>

          {!!recentFoods.length && (
            <View style={styles.recentFoodBlock}>
              <Text style={styles.recentFoodLabel}>ZULETZT GEGESSEN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentFoodScroll}>
                {recentFoods.map(food => (
                  <TouchableOpacity key={food.id} onPress={() => setFoods(current => [...current, { ...food, id: uid('food') }])} style={styles.recentFoodChip}>
                    <Text style={styles.recentFoodChipText}>+ {food.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <ShadowCard>
            <Text style={styles.cardTitle}>Lebensmittel hinzufügen</Text>
            <Text style={styles.helper}>Scanne verpackte Lebensmittel oder erfasse frische und selbst gekochte Lebensmittel manuell.</Text>
            <TouchableOpacity onPress={openBarcodeCamera} style={styles.barcodeButton}>
              <View style={styles.barcodeIcon}><Text style={styles.barcodeIconText}>▦</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.barcodeTitle}>{scannerBusy ? 'Scanner geöffnet …' : 'Barcode scannen'}</Text>
                <Text style={styles.barcodeSubtitle}>Barcode auf der Verpackung ins Bild halten</Text>
              </View>
              <Text style={styles.barcodeChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>ODER MANUELL</Text><View style={styles.orLine} /></View>
            <TextInput value={foodName} onChangeText={setFoodName} placeholder="z. B. Naturjoghurt" placeholderTextColor="#98A19B" style={styles.input} returnKeyType="next" />
            <View style={styles.twoInputs}>
              <TextInput value={foodAmount} onChangeText={setFoodAmount} placeholder="Menge, z. B. 150 g" placeholderTextColor="#98A19B" style={[styles.input, { flex: 1 }]} />
              <TextInput value={foodKcal} onChangeText={setFoodKcal} placeholder="kcal" placeholderTextColor="#98A19B" style={[styles.input, { width: 92 }]} keyboardType="decimal-pad" />
            </View>
            <TouchableOpacity onPress={addFood} style={[styles.secondaryButton, !foodName.trim() && styles.buttonDisabled]} disabled={!foodName.trim()}>
              <Text style={styles.secondaryButtonText}>+ Lebensmittel hinzufügen</Text>
            </TouchableOpacity>
          </ShadowCard>

          {!!foods.length && (
            <ShadowCard>
              <Text style={styles.cardTitle}>Diese Mahlzeit</Text>
              {foods.map((item, index) => (
                <View key={item.id} style={[styles.foodRow, index < foods.length - 1 && styles.rowBorder]}>
                  <View style={styles.foodBullet}><Text>•</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{item.name}</Text>
                    <Text style={styles.foodDetail}>{[item.brand, item.amount, typeof item.kcal === 'number' ? `${item.kcal} kcal` : ''].filter(Boolean).join(' · ') || 'ohne Mengenangabe'}</Text>
                    {item.source === 'openfoodfacts' && <Text style={styles.foodSource}>▦ Barcode · Open Food Facts{item.allergens?.length ? ` · Allergene: ${item.allergens.join(', ')}` : ''}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setFoods(current => current.filter(x => x.id !== item.id))}><Text style={styles.removeText}>Entfernen</Text></TouchableOpacity>
                </View>
              ))}
            </ShadowCard>
          )}

          <Text style={styles.sectionTitle}>Notiz</Text>
          <TextInput value={mealNote} onChangeText={setMealNote} placeholder="z. B. Restaurant, große Portion, sehr fettig …" placeholderTextColor="#98A19B" multiline style={styles.noteInput} />
          <TouchableOpacity style={styles.primaryButton} onPress={saveMeal}><Text style={styles.primaryButtonText}>Mahlzeit speichern</Text></TouchableOpacity>
        </>
      )}

      {mode === 'Symptome' && (
        <>
          <View style={styles.infoStrip}><Text style={styles.infoStripText}>Erfasse Beschwerden möglichst dann, wenn sie auftreten. So kann Noura den zeitlichen Abstand zu Mahlzeiten berechnen.</Text></View>
          {profile.symptomsToTrack.includes('pain') && <Counter title="Bauchschmerzen" value={pain} onChange={setPain} helper="0 = keine · 10 = sehr stark" />}
          {profile.symptomsToTrack.includes('bloating') && <Counter title="Blähungen" value={bloating} onChange={setBloating} helper="subjektive Stärke" />}
          {profile.symptomsToTrack.includes('nausea') && <Counter title="Übelkeit" value={nausea} onChange={setNausea} />}
          {profile.symptomsToTrack.includes('heartburn') && <Counter title="Sodbrennen" value={heartburn} onChange={setHeartburn} />}
          {profile.tracking.energy && <Counter title="Energie" value={energy} onChange={setEnergy} helper="0 = erschöpft · 10 = sehr energiegeladen" />}
          {profile.tracking.stress && <Counter title="Stress" value={stress} onChange={setStress} helper="0 = entspannt · 10 = sehr hoch" />}

          {profile.tracking.temperature && <ShadowCard>
            <View style={styles.counterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.counterTitle}>Körpertemperatur</Text>
                <Text style={styles.helper}>Optionaler Messwert</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setTemperature(v => Math.max(34, Math.round((v - 0.1) * 10) / 10))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></TouchableOpacity>
                <Text style={[styles.stepValue, { minWidth: 68 }]}>{temperature.toFixed(1)} °C</Text>
                <TouchableOpacity onPress={() => setTemperature(v => Math.min(42, Math.round((v + 0.1) * 10) / 10))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </ShadowCard>}

          <TextInput value={symptomNote} onChangeText={setSymptomNote} placeholder="Optionale Notiz, z. B. nach Sport / wenig Schlaf …" placeholderTextColor="#98A19B" multiline style={styles.noteInput} />
          <TouchableOpacity style={styles.primaryButton} onPress={saveSymptoms}><Text style={styles.primaryButtonText}>Körper-Check-in speichern</Text></TouchableOpacity>
        </>
      )}

      {mode === 'Auffälligkeit' && (
        <>
          <View style={styles.observationHero}>
            <Text style={styles.observationHeroIcon}>!</Text>
            <View style={{ flex: 1 }}><Text style={styles.observationHeroTitle}>Was ist dir aufgefallen?</Text><Text style={styles.observationHeroText}>Ein Satz reicht. Diese Notizen helfen später, Muster zu verstehen, die in reinen Messwerten fehlen.</Text></View>
          </View>
          <TextInput value={observationText} onChangeText={setObservationText} placeholder="z. B. Nach dem Latte direkt aufgebläht …" placeholderTextColor="#9A98A1" multiline style={styles.observationInput} />
          <Text style={styles.inputLabel}>Kategorie</Text>
          <View style={styles.pillWrap}>
            {([['food','Essen'],['symptom','Beschwerde'],['cycle','Zyklus'],['body','Körper'],['general','Sonstiges']] as Array<[ObservationCategory,string]>).map(([value,label]) => <Pill key={value} label={label} active={observationCategory === value} onPress={() => setObservationCategory(value)} compact />)}
          </View>
          <Counter title="Wie auffällig?" value={observationSeverity} onChange={setObservationSeverity} helper="0 = kaum · 10 = sehr auffällig" />
          <TouchableOpacity style={styles.primaryButton} onPress={saveObservation}><Text style={styles.primaryButtonText}>Auffälligkeit speichern</Text></TouchableOpacity>
        </>
      )}

      {mode === 'Stuhlgang' && (
        <>
          <Text style={styles.sectionTitle}>Bristol-Stuhlformen-Skala</Text>
          <Text style={styles.helper}>Wähle die Form, die am ehesten passt. Die Skala dient hier nur zur Dokumentation.</Text>
          <View style={styles.bristolGrid}>
            {[1, 2, 3, 4, 5, 6, 7].map(type => (
              <TouchableOpacity key={type} onPress={() => setBristolType(type)} style={[styles.bristolCard, bristolType === type && styles.bristolCardActive]}>
                <Text style={[styles.bristolNumber, bristolType === type && styles.bristolNumberActive]}>{type}</Text>
                <Text style={[styles.bristolText, bristolType === type && styles.bristolTextActive]}>{bristolLabel(type).split('·')[1]?.trim()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Counter title="Dringlichkeit" value={urgency} onChange={setUrgency} max={3} helper="0 = keine Eile · 3 = sehr dringend" />
          <TextInput value={bowelNote} onChangeText={setBowelNote} placeholder="Optionale Notiz …" placeholderTextColor="#98A19B" multiline style={styles.noteInput} />
          <TouchableOpacity style={styles.primaryButton} onPress={saveBowel}><Text style={styles.primaryButtonText}>Stuhlgang speichern</Text></TouchableOpacity>
        </>
      )}

      {mode === 'Zyklus' && (
        <>
          <View style={styles.cycleHero}>
            <Text style={styles.cycleHeroIcon}>◐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cycleHeroKicker}>ZYKLUS-CHECK-IN</Text>
              <Text style={styles.cycleHeroTitle}>Zyklus als Kontext, nicht als Erklärung für alles.</Text>
              <Text style={styles.cycleHeroText}>Noura nutzt diese Angaben später als möglichen Einflussfaktor bei Verdauung, Beschwerden, Appetit und Temperatur.</Text>
            </View>
          </View>

          <ShadowCard>
            <Text style={styles.cardTitle}>Periode heute?</Text>
            <View style={styles.pillRow}>
              <Pill label="Nein" active={!cycleBleeding} onPress={() => setCycleBleeding(false)} />
              <Pill label="Ja" active={cycleBleeding} onPress={() => setCycleBleeding(true)} />
            </View>
            {cycleBleeding && <>
              <Text style={[styles.helper, { marginTop: 10 }]}>Blutungsstärke</Text>
              <View style={styles.pillWrap}>
                {([['spotting','Spotting'],['light','Leicht'],['medium','Mittel'],['heavy','Stark']] as Array<[CycleFlow,string]>).map(([value,label]) => <Pill key={value} label={label} active={cycleFlow === value} onPress={() => setCycleFlow(value)} compact />)}
              </View>
            </>}
          </ShadowCard>

          <Counter title="Krämpfe / Unterleibsschmerz" value={cycleCramps} onChange={setCycleCramps} helper="0 = keine · 10 = sehr stark" />
          <Counter title="Heißhunger / Cravings" value={cycleCravings} onChange={setCycleCravings} helper="0 = keine · 10 = sehr stark" />
          <Counter title="Kopfschmerzen" value={cycleHeadache} onChange={setCycleHeadache} />
          <Counter title="Brustspannen" value={cycleBreastTenderness} onChange={setCycleBreastTenderness} />

          <ShadowCard>
            <Text style={styles.cardTitle}>Stimmung</Text>
            <View style={styles.pillRow}>
              <Pill label="Eher niedrig" active={cycleMood === 'low'} onPress={() => setCycleMood('low')} />
              <Pill label="Neutral" active={cycleMood === 'neutral'} onPress={() => setCycleMood('neutral')} />
              <Pill label="Gut" active={cycleMood === 'good'} onPress={() => setCycleMood('good')} />
            </View>
          </ShadowCard>

          <ShadowCard>
            <View style={styles.counterRow}>
              <View style={{ flex: 1 }}><Text style={styles.counterTitle}>Basaltemperatur</Text><Text style={styles.helper}>Optional · morgens vor dem Aufstehen gemessen</Text></View>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setCycleBasalTemp(v => Math.max(34, Math.round((v - 0.1) * 10) / 10))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></TouchableOpacity>
                <Text style={[styles.stepValue, { minWidth: 68 }]}>{cycleBasalTemp.toFixed(1)} °C</Text>
                <TouchableOpacity onPress={() => setCycleBasalTemp(v => Math.min(42, Math.round((v + 0.1) * 10) / 10))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </ShadowCard>

          <TextInput value={cycleNote} onChangeText={setCycleNote} placeholder="Optionale Notiz, z. B. Eisprung vermutet, Schlaf schlecht …" placeholderTextColor="#98938B" multiline style={styles.noteInput} />
          <TouchableOpacity style={styles.primaryButton} onPress={saveCycle}><Text style={styles.primaryButtonText}>Zyklus-Check-in speichern</Text></TouchableOpacity>
        </>
      )}

    </ScrollView>
    </>
  );
}

function AnalyseScreen({ store, onOpenAI }: { store: HealthStore; onOpenAI: () => void }) {
  const [windowKey, setWindowKey] = useState<'0-5' | '5-10' | '10-24' | '24-48'>('0-5');
  const [days, setDays] = useState<7 | 14 | 30 | 180>(14);
  const window = windowKey === '0-5' ? [0, 5] : windowKey === '5-10' ? [5, 10] : windowKey === '10-24' ? [10, 24] : [24, 48];
  const signals = useMemo(() => computeFoodSignalsWindow(store, window[0], window[1]), [store, windowKey]);
  const cycleSignals = useMemo(() => computeCycleSymptomSignals(store), [store]);
  const foodCycleSignals = useMemo(() => computeFoodCycleSignals(store, 8), [store]);
  const trends = useMemo(() => buildDailyTrends(store, Math.min(days, 30)), [store, days]);
  const trackingDays = useMemo(() => getTrackingDays(store), [store]);
  const recordCount = store.meals.length + store.symptoms.length + store.bowel.length + store.cycle.length + store.observations.length;

  const topSignal = signals[0];
  const topCycle = cycleSignals[0];

  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <View style={styles.analysisHeader}>
        <Text style={styles.analysisPageTitle}>Insights</Text>
        <Text style={styles.analysisPageSub}>Muster aus deinem Tagebuch – verständlich statt technisch.</Text>
      </View>

      <View style={styles.periodSegment}>
        {([7,14,30,180] as const).map(value => <TouchableOpacity key={value} onPress={() => setDays(value)} style={[styles.periodButton, days === value && styles.periodButtonActive]}><Text style={[styles.periodButtonText, days === value && styles.periodButtonTextActive]}>{value === 180 ? '6 Monate' : value === 30 ? '1 Monat' : `${value} Tage`}</Text></TouchableOpacity>)}
      </View>

      <TouchableOpacity style={styles.analysisAIHero} onPress={onOpenAI} activeOpacity={0.9}>
        <View style={styles.analysisAIIcon}><Text style={styles.analysisAIIconText}>✦</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.analysisAIKicker}>NOURA KI</Text><Text style={styles.analysisAITitle}>Lass dir deine Muster erklären</Text><Text style={styles.analysisAICopy}>Kurzfassung zuerst. Details nur, wenn du sie öffnen möchtest.</Text></View>
        <Text style={styles.quickAIHomeChevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.analysisStats}>
        <View style={styles.analysisStat}><Text style={styles.analysisStatBig}>{trackingDays}</Text><Text style={styles.analysisStatSmall}>Tracking-Tage</Text></View>
        <View style={styles.analysisStat}><Text style={styles.analysisStatBig}>{recordCount}</Text><Text style={styles.analysisStatSmall}>Einträge</Text></View>
        <View style={styles.analysisStat}><Text style={styles.analysisStatBig}>{signals.length + cycleSignals.filter(x => x.delta > 0.3).length}</Text><Text style={styles.analysisStatSmall}>aktuelle Signale</Text></View>
      </View>

      <View style={styles.insightCard}>
        <View style={styles.insightCardHeader}>
          <View style={[styles.insightSquare, { backgroundColor: '#FFE9E3' }]}><Text style={{ color: '#E2674D', fontSize: 20 }}>⌁</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.insightCardTitle}>Essen → Beschwerden</Text><Text style={styles.insightCardSub}>Wie lange nach einer Mahlzeit?</Text></View>
        </View>
        <View style={styles.windowSegment}>
          {(['0-5','5-10','10-24','24-48'] as const).map(key => <TouchableOpacity key={key} onPress={() => setWindowKey(key)} style={[styles.windowButton, windowKey === key && styles.windowButtonActive]}><Text style={[styles.windowButtonText, windowKey === key && styles.windowButtonTextActive]}>{key}h</Text></TouchableOpacity>)}
        </View>
        {topSignal ? (
          <View style={styles.simpleFinding}>
            <View style={{ flex: 1 }}><Text style={styles.simpleFindingKicker}>AUFFÄLLIGSTES SIGNAL</Text><Text style={styles.simpleFindingTitle}>{topSignal.food}</Text><Text style={styles.simpleFindingText}>{topSignal.symptomMatches} von {topSignal.occurrences} passenden Mahlzeiten hatten einen Symptom-Eintrag im Fenster {topSignal.windowLabel}.</Text></View>
            <View style={[styles.simpleDelta, topSignal.confidence === 'höher' ? styles.simpleDeltaGood : topSignal.confidence === 'mittel' ? styles.simpleDeltaMedium : styles.simpleDeltaLow]}><Text style={styles.simpleDeltaValue}>+{topSignal.delta.toFixed(1)}</Text><Text style={styles.simpleDeltaLabel}>vs. Basis</Text></View>
          </View>
        ) : <View style={styles.insightEmpty}><Text style={styles.insightEmptyIcon}>!</Text><Text style={styles.insightEmptyText}>Für dieses Zeitfenster gibt es noch kein belastbares Signal. Mehr regelmäßige Einträge helfen.</Text></View>}
        {signals.slice(1, 4).map(signal => <View key={`${signal.food}-${windowKey}`} style={styles.compactSignalRow}><Text style={styles.compactSignalName}>{signal.food}</Text><Text style={styles.compactSignalMeta}>{signal.symptomMatches}/{signal.occurrences} · +{signal.delta.toFixed(1)}</Text></View>)}
      </View>

      {store.cycle.length > 0 && (
        <View style={styles.insightCard}>
          <View style={styles.insightCardHeader}>
            <View style={[styles.insightSquare, { backgroundColor: colors.purpleSoft }]}><Text style={{ color: colors.purple, fontSize: 20 }}>◐</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.insightCardTitle}>Zyklus & Beschwerden</Text><Text style={styles.insightCardSub}>Phase als Kontext für Verdauung und Wohlbefinden</Text></View>
          </View>
          {topCycle ? (
            <View style={styles.simpleFinding}>
              <View style={{ flex: 1 }}><Text style={styles.simpleFindingKicker}>AKTUELL AUFFÄLLIG</Text><Text style={styles.simpleFindingTitle}>{topCycle.phase}</Text><Text style={styles.simpleFindingText}>{topCycle.samples} Symptom-Check-ins in dieser Phase. Durchschnitt {topCycle.symptomScore.toFixed(1)} gegenüber {topCycle.baseline.toFixed(1)} insgesamt.</Text></View>
              <View style={styles.simpleDelta}><Text style={styles.simpleDeltaValue}>{topCycle.delta >= 0 ? '+' : ''}{topCycle.delta.toFixed(1)}</Text><Text style={styles.simpleDeltaLabel}>Abweichung</Text></View>
            </View>
          ) : <View style={styles.insightEmpty}><Text style={styles.insightEmptyText}>Noch zu wenige Check-ins mit erkennbarem Zykluskontext.</Text></View>}
          <Text style={styles.signalDisclaimer}>Die Phase wird aus dokumentierten Blutungstagen grob geschätzt. Das ist kein Ovulationsnachweis.</Text>
        </View>
      )}

      {foodCycleSignals.length > 0 && (
        <View style={styles.insightCard}>
          <View style={styles.insightCardHeader}>
            <View style={[styles.insightSquare, { backgroundColor: '#FFF6DA' }]}><Text style={{ color: '#A57A18', fontSize: 19 }}>✦</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.insightCardTitle}>Essen × Zyklus</Text><Text style={styles.insightCardSub}>Phase 3: Kombinationen statt Einzelursachen</Text></View>
          </View>
          {foodCycleSignals.slice(0, 4).map(signal => (
            <View key={`${signal.food}-${signal.phase}`} style={styles.foodCycleRow}>
              <View style={{ flex: 1 }}><Text style={styles.foodCycleTitle}>{signal.food}</Text><Text style={styles.foodCycleSub}>{signal.phase} · {signal.symptomMatches}/{signal.occurrences} mit Beschwerden</Text></View>
              <View style={styles.foodCycleBadge}><Text style={styles.foodCycleBadgeText}>+{signal.delta.toFixed(1)}</Text></View>
            </View>
          ))}
          <Text style={styles.signalDisclaimer}>Das Signal zeigt nur, dass beides gemeinsam auffällig war. Es beweist weder eine Unverträglichkeit noch einen Zykluseffekt.</Text>
        </View>
      )}

      <View style={styles.insightCard}>
        <View style={styles.insightCardHeader}>
          <View style={[styles.insightSquare, { backgroundColor: '#EAF3FA' }]}><Text style={{ color: colors.blue, fontSize: 18 }}>▥</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.insightCardTitle}>Beschwerden im Verlauf</Text><Text style={styles.insightCardSub}>{days > 30 ? 'Letzte 30 Tage im Diagramm' : `Letzte ${days} Tage`}</Text></View>
        </View>
        <View style={styles.trendChart}>
          {trends.map(day => {
            const height = Math.max(3, Math.min(100, day.symptomScore * 10));
            return <View key={day.key} style={styles.trendColumn}><View style={styles.trendTrack}><View style={[styles.trendBar, { height: `${height}%`, backgroundColor: day.bleeding ? colors.purple : '#EF8B72' }]} /></View><Text style={styles.trendLabel}>{day.label}</Text></View>;
          })}
        </View>
      </View>

      <Text style={styles.disclaimer}>Noura sucht zeitliche Zusammenhänge in deinen eigenen Einträgen. Andere Faktoren können dieselben Muster erklären.</Text>
    </ScrollView>
  );
}

function AIScreen({ config, store, consent, scope, initialResult, onConsentChange, onScopeChange, onOpenSettings, onInsight }: {
  config: AIConfig | null;
  store: HealthStore;
  consent: boolean;
  scope: AIDataScope;
  initialResult?: AIHealthInsight | null;
  onConsentChange: (value: boolean) => void;
  onScopeChange: (scope: AIDataScope) => void;
  onOpenSettings: () => void;
  onInsight: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIHealthInsight | null>(initialResult || null);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const trackingDays = useMemo(() => getTrackingDays(store), [store]);
  const signalCount = useMemo(() => computeFoodSignals(store).length + computeCycleSymptomSignals(store).filter(x => x.delta > 0.3).length, [store]);
  const recordCount = store.meals.length + store.symptoms.length + store.bowel.length + store.cycle.length + store.observations.length;

  useEffect(() => { if (initialResult) setResult(initialResult); }, [initialResult]);

  const runAI = async () => {
    if (!config) return;
    setLoading(true);
    setError('');
    setShowDetails(false);
    try {
      const insight = await generateHealthInsight(config, store, scope);
      setResult(insight);
      onInsight(`${insight.headline}: ${insight.summary}`);
      saveLatestAIInsight(insight, false).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die KI-Anfrage ist fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const confidenceLabel = result?.confidence === 'higher' ? 'gute Datenlage' : result?.confidence === 'medium' ? 'mittlere Datenlage' : 'frühe Tendenz';

  return (
    <ScrollView contentContainerStyle={styles.aiPageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.analysisHeader}>
        <Text style={styles.analysisPageTitle}>Noura KI</Text>
        <Text style={styles.analysisPageSub}>Die wichtigsten Punkte zuerst. Details nur auf Wunsch.</Text>
      </View>

      {!result && (
        <>
          <View style={styles.aiSimpleHero}>
            <View style={styles.aiSimpleHeroIcon}><Text style={styles.aiSimpleHeroIconText}>✦</Text></View>
            <Text style={styles.aiSimpleHeroTitle}>Was fällt in deinem Tagebuch auf?</Text>
            <Text style={styles.aiSimpleHeroText}>Noura verbindet Essen, Beschwerden, Auffälligkeiten und – wenn aktiviert – Zykluskontext. Das Ergebnis bleibt eine Hypothese, keine Diagnose.</Text>
          </View>

          <View style={styles.aiConnectionRow}>
            <View style={{ flex: 1 }}><Text style={styles.aiConnectionTitle}>{config ? 'Eigene KI verbunden' : 'Noch keine KI verbunden'}</Text><Text style={styles.aiConnectionSub}>{config ? `${PROVIDER_META[config.provider].label} · ${config.model}` : 'Du bestimmst Anbieter und Modell selbst.'}</Text></View>
            <TouchableOpacity onPress={onOpenSettings}><Text style={styles.link}>{config ? 'Ändern' : 'Verbinden'}</Text></TouchableOpacity>
          </View>

          <View style={styles.aiPrivacyCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Trackingdaten für Analyse freigeben</Text><Text style={styles.helper}>Ohne Freigabe sendet Noura keine gespeicherten Gesundheitsdaten.</Text></View>
              <Switch value={consent} onValueChange={onConsentChange} trackColor={{ true: '#C6B4D8' }} thumbColor={consent ? colors.purple : undefined} />
            </View>
            {consent && <View style={styles.aiScopeRow}><Pill label="Zusammenfassung" active={scope === 'summary'} onPress={() => onScopeChange('summary')} compact /><Pill label="Detail-Timeline" active={scope === 'detailed'} onPress={() => onScopeChange('detailed')} compact /></View>}
          </View>

          <View style={styles.dataPreview}>
            <View><Text style={styles.dataPreviewBig}>{trackingDays}</Text><Text style={styles.dataPreviewSmall}>Tage</Text></View>
            <View><Text style={styles.dataPreviewBig}>{recordCount}</Text><Text style={styles.dataPreviewSmall}>Einträge</Text></View>
            <View><Text style={styles.dataPreviewBig}>{signalCount}</Text><Text style={styles.dataPreviewSmall}>lokale Signale</Text></View>
          </View>

          <TouchableOpacity onPress={runAI} disabled={!config || !consent || !recordCount || loading} style={[styles.primaryButton, styles.aiRunButton, (!config || !consent || !recordCount || loading) && styles.buttonDisabled]}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Jetzt verständlich auswerten</Text>}
          </TouchableOpacity>
          {!config && <Text style={styles.centerHint}>Verbinde zuerst deine eigene KI.</Text>}
          {!!config && !consent && <Text style={styles.centerHint}>Aktiviere die Datenfreigabe für diese Analyse.</Text>}
        </>
      )}

      {!!error && <View style={styles.errorCard}><Text style={styles.errorTitle}>Anfrage fehlgeschlagen</Text><Text style={styles.errorText}>{error}</Text></View>}

      {!!result && (
        <View style={styles.cleanAIResult}>
          <View style={styles.cleanAIHero}>
            <View style={styles.cleanAITopline}>
              <View style={styles.cleanAIIcon}><Text style={styles.cleanAIIconText}>✦</Text></View>
              <View style={[styles.cleanAIBadge, result.confidence === 'higher' ? styles.aiConfidenceHigher : result.confidence === 'medium' ? styles.aiConfidenceMedium : styles.aiConfidenceLow]}><Text style={styles.cleanAIBadgeText}>{confidenceLabel}</Text></View>
            </View>
            <Text style={styles.cleanAIHeadline}>{result.headline}</Text>
            <Text style={styles.cleanAISummary}>{result.summary}</Text>
          </View>

          {!!result.findings.length && (
            <View style={styles.cleanSection}>
              <Text style={styles.cleanSectionTitle}>Das fällt auf</Text>
              {result.findings.map((finding, index) => (
                <View key={`${finding.title}-${index}`} style={styles.cleanFindingCard}>
                  <View style={styles.cleanFindingNumber}><Text style={styles.cleanFindingNumberText}>{index + 1}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.cleanFindingTitle}>{finding.title}</Text><Text style={styles.cleanFindingObservation}>{finding.observation}</Text></View>
                </View>
              ))}
            </View>
          )}

          {!!result.nextSteps.length && (
            <View style={styles.cleanActionCard}>
              <Text style={styles.cleanActionKicker}>ALS NÄCHSTES</Text>
              <Text style={styles.cleanActionTitle}>{result.nextSteps[0]}</Text>
              {result.nextSteps.slice(1).map((step, index) => <View key={`${step}-${index}`} style={styles.cleanActionRow}><Text style={styles.cleanActionDot}>•</Text><Text style={styles.cleanActionText}>{step}</Text></View>)}
            </View>
          )}

          <TouchableOpacity style={styles.detailsToggle} onPress={() => setShowDetails(v => !v)}><Text style={styles.detailsToggleText}>{showDetails ? 'Details ausblenden' : 'Warum sagt Noura das?'}</Text><Text style={styles.detailsToggleChevron}>{showDetails ? '⌃' : '⌄'}</Text></TouchableOpacity>

          {showDetails && (
            <View style={styles.aiDetailsWrap}>
              {result.findings.map((finding, index) => (
                <View key={`detail-${index}`} style={styles.aiDetailCard}>
                  <Text style={styles.aiDetailTitle}>{finding.title}</Text>
                  {!!finding.evidence && <><Text style={styles.aiDetailLabel}>Datengrundlage</Text><Text style={styles.aiDetailText}>{finding.evidence}</Text></>}
                  {!!finding.uncertainty && <><Text style={styles.aiDetailLabel}>Was noch unsicher ist</Text><Text style={styles.aiDetailText}>{finding.uncertainty}</Text></>}
                </View>
              ))}
              {!!result.details && <View style={styles.aiDetailCard}><Text style={styles.aiDetailTitle}>Erläuterung</Text><Text style={styles.aiDetailText}>{result.details}</Text></View>}
              <View style={styles.aiDetailMeta}><Text style={styles.aiDetailMetaText}>{trackingDays} Tracking-Tage · {recordCount} Einträge · {scope === 'summary' ? 'Zusammenfassung' : 'Detail-Timeline'}</Text></View>
            </View>
          )}

          {!!result.safetyNote && <View style={styles.aiSafetyCard}><Text style={styles.aiSafetyIcon}>!</Text><View style={{ flex: 1 }}><Text style={styles.aiSafetyTitle}>Gesundheitshinweis</Text><Text style={styles.aiSafetyText}>{result.safetyNote}</Text></View></View>}

          <TouchableOpacity onPress={runAI} disabled={loading} style={styles.secondaryButton}>{loading ? <ActivityIndicator color={colors.purple} /> : <Text style={[styles.secondaryButtonText, { color: colors.purple }]}>Neu auswerten</Text>}</TouchableOpacity>
          <Text style={styles.aiResultFootnote}>KI-Ergebnisse sind Hinweise aus deinen Einträgen und können sich mit neuen Daten verändern. Sie ersetzen keine medizinische Diagnose.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function ProfileSettingRow({ icon, title, detail, onPress, right }: { icon: string; title: string; detail?: string; onPress?: () => void; right?: React.ReactNode }) {
  const body = (
    <View style={styles.profileSettingRow}>
      <View style={styles.profileSettingIcon}><Text style={styles.profileSettingIconText}>{icon}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.profileSettingTitle}>{title}</Text>{!!detail && <Text style={styles.profileSettingDetail} numberOfLines={2}>{detail}</Text>}</View>
      {right ?? (onPress ? <Text style={styles.profileSettingChevron}>›</Text> : null)}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{body}</TouchableOpacity> : body;
}

function ProfileScreen({ config, store, profile, preferences, aiConsent, onOpenSettings, onEditSetup, onPickProfileImage, onRemoveProfileImage, onToggleBackup, onToggleDailyAI, onBackupNow, onLoadDemo, onClearData }: {
  config: AIConfig | null;
  store: HealthStore;
  profile: UserProfile;
  preferences: AppPreferences;
  aiConsent: boolean;
  onOpenSettings: () => void;
  onEditSetup: (step: number) => void;
  onPickProfileImage: () => void;
  onRemoveProfileImage: () => void;
  onToggleBackup: (enabled: boolean) => void;
  onToggleDailyAI: (enabled: boolean) => void;
  onBackupNow: () => void;
  onLoadDemo: () => void;
  onClearData: () => void;
}) {
  const backupLabel = preferences.lastBackupAt ? `Zuletzt ${new Date(preferences.lastBackupAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Noch kein Backup-Snapshot erstellt';
  const dailyLabel = preferences.lastBackgroundAIAt ? `Letzte automatische Analyse ${new Date(preferences.lastBackgroundAIAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Noch keine automatische Analyse';
  return (
    <ScrollView contentContainerStyle={styles.profilePageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileTopBar}><View><Text style={styles.profilePageTitle}>Profil</Text><Text style={styles.profilePageSub}>Persönlich, Tracking & Automationen</Text></View></View>

      <View style={styles.profileHero}>
        <ProfileAvatar profile={profile} size={76} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileHeroName}>{profile.displayName || 'Dein Profil'}</Text>
          <Text style={styles.profileHeroSub}>{profile.profileImageUri ? 'Profilbild aktiv' : `Initialen: ${getInitials(profile.displayName)}`}</Text>
          <View style={styles.profilePhotoActions}>
            <TouchableOpacity onPress={onPickProfileImage}><Text style={styles.profilePhotoLink}>{profile.profileImageUri ? 'Bild ändern' : 'Profilbild wählen'}</Text></TouchableOpacity>
            {!!profile.profileImageUri && <TouchableOpacity onPress={onRemoveProfileImage}><Text style={styles.profilePhotoRemove}>Entfernen</Text></TouchableOpacity>}
          </View>
        </View>
      </View>

      <Text style={styles.profileSectionLabel}>DEINE EINSTELLUNGEN</Text>
      <View style={styles.profileSettingsCard}>
        <ProfileSettingRow icon="◉" title="Name & Ziele" detail={`${profile.displayName || 'Kein Name'} · ${profile.goals.length} Ziele`} onPress={() => onEditSetup(1)} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="☷" title="Tracking-Bereiche" detail={[profile.tracking.meals && 'Essen', profile.tracking.symptoms && 'Gefühl', profile.tracking.bowel && 'Stuhlgang', profile.tracking.cycle && 'Zyklus'].filter(Boolean).join(' · ')} onPress={() => onEditSetup(2)} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="♡" title="Körper-Check-in" detail={`${profile.symptomsToTrack.length} Symptome · ${profile.tracking.temperature ? 'Temperatur · ' : ''}${profile.tracking.energy ? 'Energie · ' : ''}${profile.tracking.stress ? 'Stress' : ''}`.replace(/ · $/, '')} onPress={() => onEditSetup(3)} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="◐" title="Zyklus" detail={profile.tracking.cycle ? 'Aktiv und in Analysen einbezogen' : 'Deaktiviert'} onPress={() => onEditSetup(2)} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="✓" title="Datenschutz & Hinweise" detail="Freigaben und medizinische Hinweise" onPress={() => onEditSetup(5)} />
      </View>

      <Text style={styles.profileSectionLabel}>KI</Text>
      <View style={styles.profileSettingsCard}>
        <ProfileSettingRow icon="✦" title="Anbieter & Modell" detail={config ? `${PROVIDER_META[config.provider].label} · ${config.model}` : 'Noch keine eigene KI verbunden'} onPress={onOpenSettings} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="↻" title="Tägliche automatische KI-Analyse" detail={`${dailyLabel}. iOS entscheidet den tatsächlichen Ausführungszeitpunkt.`} right={<Switch value={preferences.dailyAIEnabled} onValueChange={onToggleDailyAI} trackColor={{ true: '#C6B4D8' }} thumbColor={preferences.dailyAIEnabled ? colors.purple : undefined} />} />
        {preferences.dailyAIEnabled && (!config || !aiConsent) && <View style={styles.profileInlineWarning}><Text style={styles.profileInlineWarningText}>Für die automatische Analyse brauchst du eine verbundene KI und aktivierte Datenfreigabe.</Text></View>}
      </View>

      <Text style={styles.profileSectionLabel}>BACKUP & DATEN</Text>
      <View style={styles.profileSettingsCard}>
        <ProfileSettingRow icon="☁" title="Automatischer iCloud-Gerätebackup-Snapshot" detail={`${backupLabel}. Die Backup-Datei enthält keine API-Keys.`} right={<Switch value={preferences.iCloudBackupEnabled} onValueChange={onToggleBackup} trackColor={{ true: '#B8DCC1' }} thumbColor={preferences.iCloudBackupEnabled ? colors.green : undefined} />} />
        <View style={styles.profileSettingDivider} />
        <ProfileSettingRow icon="↓" title="Backup jetzt aktualisieren" detail="Speichert Tagebuch & Profil im Documents-Bereich" onPress={onBackupNow} />
      </View>

      <View style={styles.profileStatsCompact}>
        <View><Text style={styles.profileStatsValue}>{getTrackingDays(store)}</Text><Text style={styles.profileStatsLabel}>Tracking-Tage</Text></View>
        <View><Text style={styles.profileStatsValue}>{store.meals.length}</Text><Text style={styles.profileStatsLabel}>Mahlzeiten</Text></View>
        <View><Text style={styles.profileStatsValue}>{store.symptoms.length}</Text><Text style={styles.profileStatsLabel}>Check-ins</Text></View>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => Alert.alert('Demo-Daten laden?', 'Damit wird dein aktueller lokaler Datenbestand durch Beispieldaten ersetzt.', [
        { text: 'Abbrechen', style: 'cancel' }, { text: 'Demo laden', onPress: onLoadDemo },
      ])}><Text style={styles.secondaryButtonText}>Demo-Daten laden</Text></TouchableOpacity>

      <TouchableOpacity style={styles.destructiveButton} onPress={() => Alert.alert('Alle Trackingdaten löschen?', 'Dieser Vorgang kann in der App nicht rückgängig gemacht werden.', [
        { text: 'Abbrechen', style: 'cancel' }, { text: 'Alle löschen', style: 'destructive', onPress: onClearData },
      ])}><Text style={styles.destructiveButtonText}>Alle Trackingdaten löschen</Text></TouchableOpacity>

      <Text style={styles.versionLabel}>Noura MVP · Version 0.12</Text>
    </ScrollView>
  );
}

function AISettingsModal({ visible, config, onClose, onSaved }: {
  visible: boolean;
  config: AIConfig | null;
  onClose: () => void;
  onSaved: (config: AIConfig | null) => void;
}) {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_META.openai.defaultModel);
  const [baseUrl, setBaseUrl] = useState(PROVIDER_META.openai.defaultBaseUrl || '');
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelOptions, setModelOptions] = useState<AIModelOption[]>(FALLBACK_MODEL_OPTIONS.openai);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSource, setModelSource] = useState<'fallback' | 'live'>('fallback');

  useEffect(() => {
    if (!visible) return;
    const nextProvider = config?.provider || 'openai';
    setProvider(nextProvider);
    setApiKey(config?.apiKey || '');
    setModel(config?.model || PROVIDER_META[nextProvider].defaultModel);
    setBaseUrl(config?.baseUrl ?? PROVIDER_META[nextProvider].defaultBaseUrl ?? '');
    setModelOptions(FALLBACK_MODEL_OPTIONS[nextProvider]);
    setModelSource('fallback');
    setMessage('');
  }, [visible, config]);

  const chooseProvider = (next: AIProvider) => {
    setProvider(next);
    setModel(PROVIDER_META[next].defaultModel);
    setBaseUrl(PROVIDER_META[next].defaultBaseUrl || '');
    setModelOptions(FALLBACK_MODEL_OPTIONS[next]);
    setModelSource('fallback');
    setMessage('');
  };

  const draft = (): AIConfig => ({ provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() || undefined });

  const validate = () => {
    if (!apiKey.trim()) return 'Bitte API-Key eingeben.';
    if (!model.trim()) return 'Bitte ein Modell auswählen.';
    if (provider === 'compatible' && !baseUrl.trim()) return 'Für einen kompatiblen Anbieter wird eine Base URL benötigt.';
    return '';
  };

  const refreshModels = async () => {
    if (!apiKey.trim()) {
      setModelOptions(FALLBACK_MODEL_OPTIONS[provider]);
      setModelSource('fallback');
      setMessage('API-Key eingeben, damit Noura alle für deinen Account verfügbaren Modelle live laden kann.');
      return;
    }
    if (provider === 'compatible' && !baseUrl.trim()) {
      setMessage('Bitte zuerst die Base URL des kompatiblen Anbieters eingeben.');
      return;
    }
    setLoadingModels(true);
    setMessage('');
    try {
      const live = await listAIModels({ provider, apiKey, baseUrl: baseUrl.trim() || undefined });
      setModelOptions(live);
      setModelSource('live');
      if (!live.some(item => item.id === model) && live[0]) setModel(live[0].id);
      setMessage(`✓ ${live.length} verfügbare Modelle geladen.`);
    } catch (e) {
      setModelOptions(FALLBACK_MODEL_OPTIONS[provider]);
      setModelSource('fallback');
      setMessage(`Modellliste konnte nicht geladen werden: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const openModels = () => {
    setModelPickerOpen(true);
    if (modelSource !== 'live' && apiKey.trim()) refreshModels().catch(() => undefined);
  };

  const test = async () => {
    const problem = validate();
    if (problem) { setMessage(problem); return; }
    setTesting(true);
    setMessage('');
    try {
      await testAIConnection(draft());
      setMessage('✓ Verbindung erfolgreich. Es wurden keine Gesundheitsdaten übertragen.');
    } catch (e) {
      setMessage(`Verbindung fehlgeschlagen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setMessage(problem); return; }
    const value = draft();
    try {
      await saveAIConfig(value);
      onSaved(value);
      onClose();
    } catch (e) {
      setMessage(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    }
  };

  const clear = async () => {
    await clearAIConfig();
    onSaved(null);
    onClose();
  };

  const providerOptions: SelectOption[] = (Object.keys(PROVIDER_META) as AIProvider[]).map(item => ({
    value: item,
    label: PROVIDER_META[item].label,
    detail: item === 'compatible' ? 'Eigener Gateway / OpenAI-kompatible API' : PROVIDER_META[item].hint,
  }));
  const modelSelectOptions: SelectOption[] = modelOptions.map(item => ({
    value: item.id,
    label: item.label || item.id,
    detail: item.detail,
    badge: item.recommended ? 'Empfohlen' : undefined,
  }));
  const selectedModel = modelOptions.find(item => item.id === model);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <View><Text style={styles.headerTitle}>Meine KI</Text><Text style={styles.headerSubtitle}>Anbieter & Modell auswählen</Text></View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></TouchableOpacity>
            </View>

            <ShadowCard style={styles.aiSettingsIntro}>
              <View style={styles.aiSettingsIntroIcon}><Text style={styles.aiSettingsIntroIconText}>✦</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.aiSettingsIntroTitle}>Deine KI, deine Wahl</Text><Text style={styles.aiSettingsIntroText}>Noura lädt die verfügbaren Modelle direkt von deinem Anbieter. So bleibt die Liste aktuell und zeigt, was dein API-Key wirklich verwenden kann.</Text></View>
            </ShadowCard>

            <DropdownField
              label="KI-Anbieter"
              value={PROVIDER_META[provider].label}
              placeholder="Anbieter auswählen"
              detail={provider === 'compatible' ? 'Eigener / kompatibler Anbieter' : 'Direkte Verbindung mit deinem eigenen API-Key'}
              onPress={() => setProviderPickerOpen(true)}
            />

            <Text style={styles.inputLabel}>API-Key</Text>
            <TextInput
              value={apiKey}
              onChangeText={(value) => { setApiKey(value); setModelSource('fallback'); }}
              placeholder="API-Key"
              placeholderTextColor="#98A19B"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            {provider === 'compatible' && (
              <>
                <Text style={styles.inputLabel}>Base URL</Text>
                <TextInput value={baseUrl} onChangeText={(value) => { setBaseUrl(value); setModelSource('fallback'); }} placeholder="https://…/v1" placeholderTextColor="#98A19B" autoCapitalize="none" autoCorrect={false} style={styles.input} />
              </>
            )}

            <DropdownField
              label="Modell"
              value={selectedModel?.label || model || undefined}
              placeholder={loadingModels ? 'Modelle werden geladen…' : 'Modell auswählen'}
              detail={model ? `${model}${modelSource === 'live' ? ' · live vom Anbieter' : ' · Vorauswahl'}` : undefined}
              onPress={openModels}
              disabled={loadingModels}
            />

            <View style={styles.modelToolsRow}>
              <TouchableOpacity onPress={refreshModels} disabled={loadingModels} style={styles.modelRefreshButton}>
                {loadingModels ? <ActivityIndicator size="small" color={colors.purple} /> : <Text style={styles.modelRefreshText}>↻ Alle Modelle laden</Text>}
              </TouchableOpacity>
              <Text style={styles.modelCountText}>{modelOptions.length ? `${modelOptions.length} Modelle` : 'Noch keine Modelle'}</Text>
            </View>

            <View style={styles.infoStrip}><Text style={styles.infoStripText}>{PROVIDER_META[provider].hint} Bei OpenAI und kompatiblen APIs können auch spezialisierte Modelle in der Live-Liste erscheinen; der Verbindungstest prüft, ob das gewählte Modell für Noura antworten kann.</Text></View>

            {!!message && <View style={styles.messageCard}><Text style={styles.messageText}>{message}</Text></View>}

            <TouchableOpacity style={styles.secondaryButton} onPress={test} disabled={testing}>
              {testing ? <ActivityIndicator color={colors.green} /> : <Text style={styles.secondaryButtonText}>Verbindung & Modell testen</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={save}><Text style={styles.primaryButtonText}>KI-Verbindung speichern</Text></TouchableOpacity>
            {!!config && <TouchableOpacity style={styles.textButton} onPress={clear}><Text style={styles.destructiveText}>Verbindung entfernen</Text></TouchableOpacity>}

            <Text style={styles.disclaimer}>Der API-Key wird über Expo SecureStore im geschützten Gerätespeicher abgelegt und nicht in den App-Code geschrieben. Noura kommuniziert bei BYOK direkt mit dem ausgewählten Anbieter.</Text>
          </ScrollView>
        </KeyboardAvoidingView>

        <SelectionSheet
          visible={providerPickerOpen}
          title="KI-Anbieter"
          subtitle="Wähle, welche KI Noura verwenden soll."
          options={providerOptions}
          selected={provider}
          onClose={() => setProviderPickerOpen(false)}
          onSelect={(value) => chooseProvider(value as AIProvider)}
        />
        <SelectionSheet
          visible={modelPickerOpen}
          title="KI-Modell"
          subtitle={modelSource === 'live' ? `Alle aktuell für deinen ${PROVIDER_META[provider].label}-Zugang gemeldeten Modelle.` : 'Vorauswahl. Mit API-Key lädt Noura die vollständige Live-Liste.'}
          options={modelSelectOptions}
          selected={model}
          searchable
          loading={loadingModels}
          onClose={() => setModelPickerOpen(false)}
          onSelect={setModel}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const [store, setStore] = useState<HealthStore>(emptyHealthStore());
  const [userProfile, setUserProfile] = useState<UserProfile>(createDefaultUserProfile());
  const [editingSetupStep, setEditingSetupStep] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [aiConsent, setAIConsentState] = useState(false);
  const [aiScope, setAIScopeState] = useState<AIDataScope>('summary');
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);
  const [aiInsight, setAIInsight] = useState('');
  const [latestAIResult, setLatestAIResult] = useState<AIHealthInsight | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [quickAIOpen, setQuickAIOpen] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('Essen');
  const [preferences, setPreferences] = useState<AppPreferences>(defaultAppPreferences());

  useEffect(() => {
    Promise.all([loadHealthStore(), loadAIConfig(), loadAIConsent(), loadAIDataScope(), loadUserProfile(), loadAppPreferences(), loadLatestAIInsight()])
      .then(([health, config, consent, scope, profile, prefs, latest]) => {
        setStore(health);
        setAIConfig(config);
        setAIConsentState(consent);
        setAIScopeState(scope);
        setUserProfile(profile);
        setPreferences(prefs);
        if (latest?.insight) { setLatestAIResult(latest.insight); setAIInsight(`${latest.insight.headline}: ${latest.insight.summary}`); }
        syncDailyAIRegistration().catch(() => undefined);
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadLatestAIInsight().then(latest => {
          if (latest?.insight) { setLatestAIResult(latest.insight); setAIInsight(`${latest.insight.headline}: ${latest.insight.summary}`); }
        }).catch(() => undefined);
        loadAppPreferences().then(setPreferences).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  const updateBackupStamp = (value: AppPreferences) => {
    const stamped = { ...value, lastBackupAt: new Date().toISOString() };
    setPreferences(stamped);
    saveAppPreferences(stamped).catch(() => undefined);
  };

  const runBackup = async (nextStore: HealthStore = store, nextProfile: UserProfile = userProfile, prefs: AppPreferences = preferences) => {
    if (!prefs.iCloudBackupEnabled) return;
    await writeAutomaticBackup(nextStore, nextProfile, prefs);
    updateBackupStamp(prefs);
  };

  const commit = (next: HealthStore) => {
    setStore(next);
    saveHealthStore(next).catch(() => Alert.alert('Speichern fehlgeschlagen', 'Der Eintrag konnte lokal nicht dauerhaft gespeichert werden.'));
    if (preferences.iCloudBackupEnabled) runBackup(next, userProfile, preferences).catch(() => undefined);
  };

  const changeConsent = (value: boolean) => {
    setAIConsentState(value);
    saveAIConsent(value).catch(() => undefined);
  };

  const changeScope = (scope: AIDataScope) => {
    setAIScopeState(scope);
    saveAIDataScope(scope).catch(() => undefined);
  };

  const clearAllData = async () => {
    setStore(emptyHealthStore());
    setAIInsight('');
    await clearHealthStore();
  };

  const loadDemo = () => {
    const demo = createDemoStore();
    commit(demo);
    setTab('Analyse');
  };

  const completeSetup = (profile: UserProfile, connectAI: boolean) => {
    const wasEditing = editingSetupStep !== null;
    setUserProfile(profile);
    setEditingSetupStep(null);
    saveUserProfile(profile).catch(() => Alert.alert('Speichern fehlgeschlagen', 'Deine Einrichtung konnte nicht dauerhaft gespeichert werden.'));
    if (preferences.iCloudBackupEnabled) runBackup(store, profile, preferences).catch(() => undefined);
    setTab(wasEditing ? 'Profil' : 'Home');
    if (connectAI) setAISettingsOpen(true);
  };

  const pickProfileImage = async () => {
    try {
      const uri = await pickAndPersistProfileImage();
      if (!uri) return;
      const next = { ...userProfile, profileImageUri: uri };
      setUserProfile(next);
      await saveUserProfile(next);
      if (preferences.iCloudBackupEnabled) await runBackup(store, next, preferences);
    } catch (e) {
      Alert.alert('Profilbild nicht geändert', e instanceof Error ? e.message : 'Das Bild konnte nicht ausgewählt werden.');
    }
  };

  const removeProfileImage = async () => {
    const next = { ...userProfile, profileImageUri: undefined };
    setUserProfile(next);
    await saveUserProfile(next);
    await removePersistedProfileImage();
    if (preferences.iCloudBackupEnabled) runBackup(store, next, preferences).catch(() => undefined);
  };

  const toggleBackup = async (enabled: boolean) => {
    const next = { ...preferences, iCloudBackupEnabled: enabled };
    setPreferences(next);
    await saveAppPreferences(next);
    if (enabled) {
      try { await writeAutomaticBackup(store, userProfile, next); updateBackupStamp(next); }
      catch { Alert.alert('Backup konnte nicht erstellt werden', 'Noura konnte die lokale Backup-Datei nicht aktualisieren.'); }
    }
  };

  const backupNow = async () => {
    try {
      await writeAutomaticBackup(store, userProfile, preferences);
      updateBackupStamp(preferences);
      Alert.alert('Backup aktualisiert', 'Noura hat einen aktuellen Backup-Snapshot im Documents-Bereich gespeichert. iOS kann diesen über das Gerätebackup in iCloud sichern.');
    } catch {
      Alert.alert('Backup fehlgeschlagen', 'Der Backup-Snapshot konnte nicht gespeichert werden.');
    }
  };

  const toggleDailyAI = async (enabled: boolean) => {
    const next = await configureDailyAI(enabled);
    setPreferences(next);
    if (enabled && (!aiConfig || !aiConsent)) {
      Alert.alert('Automatische KI vorbereitet', 'Aktiviere zusätzlich eine KI-Verbindung und die Datenfreigabe. Erst dann kann Noura im Hintergrund analysieren.');
    }
  };

  const openManual = (mode: ManualEntryMode | TrackingMode) => {
    setAddSheetOpen(false);
    setTrackingMode(mode as TrackingMode);
    setTab('Tracking');
  };

  const openQuickAI = () => {
    setAddSheetOpen(false);
    setQuickAIOpen(true);
  };

  const applyQuickDraft = (draft: AIQuickDraft) => {
    let next = store;
    const now = new Date().toISOString();
    if (draft.meal?.foods?.length) {
      next = addMeal(next, {
        id: uid('meal'),
        createdAt: now,
        mealType: draft.meal.mealType,
        foods: draft.meal.foods.map(food => ({ id: uid('food'), name: food.name, amount: food.amount, source: 'ai' as const })),
        note: draft.meal.note,
      });
    }
    if (draft.symptom) {
      next = addSymptom(next, { id: uid('sym'), createdAt: now, ...draft.symptom });
    }
    if (draft.bowel) {
      next = addBowel(next, { id: uid('bowel'), createdAt: now, ...draft.bowel });
    }
    if (draft.cycle && userProfile.tracking.cycle) {
      next = addCycle(next, { id: uid('cycle'), createdAt: now, ...draft.cycle });
    }
    if (draft.observation?.text.trim()) {
      next = addObservation(next, { id: uid('obs'), createdAt: now, ...draft.observation, text: draft.observation.text.trim() });
    }
    commit(next);
    setTab('Diary');
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={[styles.safe, styles.loadingScreen]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <Text style={[styles.loadingLogo, { color: colors.purple }]}>Noura</Text>
        <ActivityIndicator color={colors.purple} />
      </SafeAreaView>
    );
  }

  if (!userProfile.completed || editingSetupStep !== null) {
    const editing = editingSetupStep !== null;
    return <SetupWizard initialProfile={userProfile} editing={editing} startStep={editingSetupStep ?? undefined} onCancel={editing ? () => setEditingSetupStep(null) : undefined} onComplete={completeSetup} />;
  }

  const screen = tab === 'Home'
    ? <HomeScreen
        store={store}
        profile={userProfile}
        aiInsight={aiInsight}
        onAIQuick={openQuickAI}
        onAdd={openManual}
        onOpenInsights={() => setTab('KI')}
        onDiary={() => setTab('Diary')}
        onProfile={() => setTab('Profil')}
      />
    : tab === 'Diary'
      ? <DiaryScreen store={store} onDelete={(kind, id) => commit(removeEntry(store, kind, id))} onAdd={() => setAddSheetOpen(true)} />
    : tab === 'Tracking'
      ? <TrackingScreen
          store={store}
          profile={userProfile}
          initialMode={trackingMode}
          onSaveMeal={entry => commit(addMeal(store, entry))}
          onSaveSymptom={entry => commit(addSymptom(store, entry))}
          onSaveBowel={entry => commit(addBowel(store, entry))}
          onSaveCycle={entry => commit(addCycle(store, entry))}
          onSaveObservation={entry => commit(addObservation(store, entry))}
          onDone={() => setTab('Diary')}
        />
    : tab === 'Analyse'
      ? <AnalyseScreen store={store} onOpenAI={() => setTab('KI')} />
    : tab === 'KI'
      ? <AIScreen
          config={aiConfig}
          store={store}
          consent={aiConsent}
          scope={aiScope}
          initialResult={latestAIResult}
          onConsentChange={changeConsent}
          onScopeChange={changeScope}
          onOpenSettings={() => setAISettingsOpen(true)}
          onInsight={setAIInsight}
        />
      : <ProfileScreen
          config={aiConfig}
          store={store}
          profile={userProfile}
          preferences={preferences}
          aiConsent={aiConsent}
          onOpenSettings={() => setAISettingsOpen(true)}
          onEditSetup={step => setEditingSetupStep(step)}
          onPickProfileImage={pickProfileImage}
          onRemoveProfileImage={removeProfileImage}
          onToggleBackup={enabled => { toggleBackup(enabled).catch(() => undefined); }}
          onToggleDailyAI={enabled => { toggleDailyAI(enabled).catch(() => undefined); }}
          onBackupNow={() => { backupNow().catch(() => undefined); }}
          onLoadDemo={loadDemo}
          onClearData={clearAllData}
        />;

  const navItems: Array<{ tab: Tab; icon: string; label: string }> = [
    { tab: 'Home', icon: '▣', label: 'Heute' },
    { tab: 'Diary', icon: '≡', label: 'Tagebuch' },
    { tab: 'Analyse', icon: '▥', label: 'Insights' },
    { tab: 'Profil', icon: '☷', label: 'Profil' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.app}>{screen}</View>

      {tab !== 'Tracking' && (
        <View style={styles.bottomNavWrap}>
          <View style={styles.bottomNav}>
            {navItems.slice(0, 2).map(item => {
              const active = tab === item.tab;
              return <TouchableOpacity key={item.tab} style={styles.bottomNavButton} onPress={() => setTab(item.tab)}><View style={[styles.bottomNavIconBox, active && styles.bottomNavIconBoxActive]}><Text style={[styles.bottomNavIcon, active && styles.bottomNavIconActive]}>{item.icon}</Text></View><Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{item.label}</Text></TouchableOpacity>;
            })}
            <View style={styles.bottomNavCenterSpace} />
            {navItems.slice(2).map(item => {
              const active = item.tab === 'Analyse' ? tab === 'Analyse' || tab === 'KI' : tab === item.tab;
              return <TouchableOpacity key={item.tab} style={styles.bottomNavButton} onPress={() => setTab(item.tab)}><View style={[styles.bottomNavIconBox, active && styles.bottomNavIconBoxActive]}><Text style={[styles.bottomNavIcon, active && styles.bottomNavIconActive]}>{item.icon}</Text></View><Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{item.label}</Text></TouchableOpacity>;
            })}
          </View>
          <TouchableOpacity style={styles.floatingAdd} onPress={() => setAddSheetOpen(true)} activeOpacity={0.88}><Text style={styles.floatingAddText}>＋</Text></TouchableOpacity>
        </View>
      )}

      <AddEntrySheet visible={addSheetOpen} cycleEnabled={userProfile.tracking.cycle} onClose={() => setAddSheetOpen(false)} onAI={openQuickAI} onManual={openManual} />
      <AIQuickCaptureModal
        visible={quickAIOpen}
        config={aiConfig}
        onClose={() => setQuickAIOpen(false)}
        onOpenAISettings={() => { setQuickAIOpen(false); setAISettingsOpen(true); }}
        onConfirm={applyQuickDraft}
      />
      <AISettingsModal visible={aiSettingsOpen} config={aiConfig} onClose={() => setAISettingsOpen(false)} onSaved={setAIConfig} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 20 : 0 },
  app: { flex: 1 },
  loadingScreen: { alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingLogo: { fontSize: 36, fontWeight: '900', color: colors.green, letterSpacing: -1 },
  screenContent: { padding: 20, paddingBottom: 34, gap: 14 },

  simpleHomeContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 118, gap: 14 },
  simpleHomeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  simpleHomeGreeting: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  simpleHomeDate: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  scoreHero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#F0F5F1', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#DFE9E1' },
  scoreHeroCircle: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#FFFFFF', borderWidth: 7, borderColor: '#8DB799', alignItems: 'center', justifyContent: 'center' },
  scoreHeroValue: { color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 30 },
  scoreHeroOf: { color: colors.muted, fontSize: 9.5, fontWeight: '700' },
  scoreHeroKicker: { color: colors.greenDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.0 },
  scoreHeroTitle: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  scoreHeroText: { color: colors.muted, fontSize: 11.2, lineHeight: 16, marginTop: 4 },
  scoreHeroButton: { alignSelf: 'flex-start', marginTop: 9, backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  scoreHeroButtonText: { color: '#FFF', fontSize: 10.5, fontWeight: '800' },
  homeInsightCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line },
  homeInsightTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  homeInsightKicker: { color: colors.purple, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  homeInsightArrow: { color: colors.purple, fontSize: 26, lineHeight: 26 },
  homeInsightText: { color: colors.text, fontSize: 15.5, lineHeight: 21, fontWeight: '800', marginTop: 7 },
  homeInsightFoot: { color: colors.muted, fontSize: 10.5, marginTop: 8 },
  tellNouraRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.purple, borderRadius: 21, padding: 13 },
  tellNouraIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tellNouraIconText: { color: '#FFF', fontSize: 19, fontWeight: '900' },
  tellNouraTitle: { color: '#FFF', fontSize: 14.5, fontWeight: '900' },
  tellNouraSub: { color: '#ECE6F2', fontSize: 10.2, marginTop: 2, lineHeight: 14 },
  tellNouraArrow: { color: '#FFF', fontSize: 27 },
  homeQuickRow: { flexDirection: 'row', gap: 9 },
  homeQuickButton: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: 8 },
  homeQuickIcon: { fontSize: 18, marginBottom: 5 },
  homeQuickText: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  homeTodayCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16 },
  homeTodayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  homeTodayTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  homeTodayLink: { color: colors.purple, fontSize: 11.5, fontWeight: '800' },
  homeTodayStats: { flexDirection: 'row', marginTop: 14, marginBottom: 12 },
  homeTodayStat: { flex: 1, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  homeTodayValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  homeTodayLabel: { color: colors.muted, fontSize: 9.5, marginTop: 2 },
  homeLastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10, marginTop: 2 },
  homeLastLabel: { color: colors.muted, fontSize: 10.5, width: 88 },
  homeLastValue: { flex: 1, color: colors.text, fontSize: 11.5, fontWeight: '700', textAlign: 'right' },
  homeScoreDisclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: 18 },

  profilePageContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 120, gap: 12 },
  profileTopBar: { marginBottom: 2 },
  profilePageTitle: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  profilePageSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: colors.surface, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.line },
  profileHeroName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  profileHeroSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  profilePhotoActions: { flexDirection: 'row', gap: 14, marginTop: 9 },
  profilePhotoLink: { color: colors.purple, fontSize: 11, fontWeight: '800' },
  profilePhotoRemove: { color: colors.red, fontSize: 11, fontWeight: '700' },
  profileSectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 5, marginLeft: 4 },
  profileSettingsCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  profileSettingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  profileSettingIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  profileSettingIconText: { color: colors.purple, fontSize: 15, fontWeight: '900' },
  profileSettingTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  profileSettingDetail: { color: colors.muted, fontSize: 10.3, lineHeight: 14.5, marginTop: 2 },
  profileSettingChevron: { color: colors.muted, fontSize: 26, marginLeft: 4 },
  profileSettingDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 58 },
  profileInlineWarning: { backgroundColor: '#FFF7E4', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1E0B5' },
  profileInlineWarningText: { color: '#8E6B1D', fontSize: 10.3, lineHeight: 14 },
  profileStatsCompact: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingVertical: 14 },
  profileStatsValue: { color: colors.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  profileStatsLabel: { color: colors.muted, fontSize: 9.5, textAlign: 'center', marginTop: 2 },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 2 },
  entryHeaderKicker: { color: colors.purple, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  entryHeaderTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7, marginTop: 3 },
  entryHeaderSub: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  entryClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ECEAF0', alignItems: 'center', justifyContent: 'center' },
  entryCloseText: { color: colors.text, fontSize: 25, marginTop: -2 },
  entryModeScroll: { gap: 8, paddingVertical: 2, paddingRight: 6 },
  entryModeChip: { borderRadius: 999, backgroundColor: '#ECEAF0', paddingHorizontal: 13, paddingVertical: 8 },
  entryModeChipActive: { backgroundColor: colors.purple },
  entryModeChipText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' },
  entryModeChipTextActive: { color: '#FFF' },
  recentFoodBlock: { marginTop: 2 },
  recentFoodLabel: { color: colors.muted, fontSize: 8.8, fontWeight: '900', letterSpacing: 1 },
  recentFoodScroll: { gap: 8, paddingTop: 8, paddingRight: 8 },
  recentFoodChip: { backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#CFE7D4' },
  recentFoodChipText: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  headerSubtitle: { fontSize: 14, color: colors.muted, marginTop: 3, lineHeight: 19 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.green, fontWeight: '900' },
  dateLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  welcomeCard: { backgroundColor: colors.greenSoft, borderRadius: 26, padding: 22 },
  wellnessCard: { backgroundColor: '#EAF3EC', borderRadius: 26, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  scoreCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 8, borderColor: '#78AB8A', backgroundColor: '#F8FBF8', alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 29, fontWeight: '900', color: colors.text },
  scoreSub: { fontSize: 9.5, color: colors.muted, marginTop: -1 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: colors.green, letterSpacing: 1.1 },
  heroTitle: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 6, lineHeight: 25 },
  heroCopy: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  primaryButtonInline: { alignSelf: 'flex-start', backgroundColor: colors.green, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48.5%', minHeight: 122 },
  metricIcon: { fontSize: 18 },
  metricTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 8 },
  metricValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 4 },
  metricSub: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 15 },
  aiInsight: { backgroundColor: colors.greenSoft, borderRadius: 22, padding: 18, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  aiIcon: { fontSize: 24, color: colors.green },
  aiLabel: { fontSize: 10, fontWeight: '900', color: colors.green, letterSpacing: 0.8 },
  aiTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 5, lineHeight: 21 },
  aiCopy: { fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 },
  chevron: { fontSize: 30, color: colors.green, marginTop: 20 },
  chevronSmall: { fontSize: 30, color: colors.green },
  disclaimer: { color: '#858F89', fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  link: { color: colors.green, fontWeight: '800', fontSize: 13 },
  helper: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 4 },
  bodyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  miniMuted: { color: colors.muted, fontSize: 11 },
  segmented: { backgroundColor: '#E7ECE8', padding: 4, borderRadius: 14, flexDirection: 'row' },
  segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  segmentButtonActive: { backgroundColor: colors.surface },
  segmentText: { fontWeight: '700', fontSize: 12, color: colors.muted },
  segmentTextActive: { color: colors.text },
  savedBanner: { backgroundColor: colors.greenSoft, borderRadius: 14, padding: 12, alignItems: 'center' },
  savedBannerText: { color: colors.green, fontWeight: '800' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  pillCompact: { paddingHorizontal: 10, paddingVertical: 7 },
  pillActive: { backgroundColor: colors.greenSoft, borderColor: '#B9D8C3' },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  pillTextActive: { color: colors.green },
  inputLabel: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: -6, marginTop: 2 },
  input: { minHeight: 48, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, color: colors.text, marginTop: 10 },
  twoInputs: { flexDirection: 'row', gap: 8 },
  noteInput: { minHeight: 92, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, textAlignVertical: 'top', color: colors.text },
  secondaryButton: { borderRadius: 15, borderWidth: 1, borderColor: '#B9D8C3', backgroundColor: colors.greenTint, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: colors.green, fontWeight: '800', fontSize: 13 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 2 },
  primaryButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.42 },
  barcodeButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: '#CFE4D5', borderRadius: 16, padding: 13, marginTop: 14, marginBottom: 14 },
  barcodeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  barcodeIconText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  barcodeTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  barcodeSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  barcodeChevron: { color: colors.green, fontSize: 28, fontWeight: '500' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#8A958E' },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  foodBullet: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 14, fontWeight: '800', color: colors.text },
  foodDetail: { fontSize: 11, color: colors.muted, marginTop: 2 },
  foodSource: { fontSize: 9, color: colors.green, marginTop: 3, fontWeight: '700' },
  removeText: { color: colors.red, fontSize: 11, fontWeight: '700' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  counterTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { color: colors.greenDark, fontSize: 17, fontWeight: '800' },
  stepValue: { minWidth: 54, textAlign: 'center', fontWeight: '800', color: colors.text },
  infoStrip: { backgroundColor: colors.blueSoft, borderRadius: 16, padding: 14 },
  infoStripText: { color: colors.blue, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  cycleHero: { flexDirection: 'row', gap: 14, backgroundColor: colors.coralSoft, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#EBCFCB' },
  cycleHeroIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#FFF8F6', color: colors.coral, textAlign: 'center', textAlignVertical: 'center', fontSize: 22, lineHeight: 42, fontWeight: '900' },
  cycleHeroKicker: { color: colors.coral, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  cycleHeroTitle: { color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 21, marginTop: 4 },
  cycleHeroText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  bristolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bristolCard: { width: '31%', minHeight: 90, borderRadius: 16, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'space-between' },
  bristolCardActive: { backgroundColor: colors.greenSoft, borderColor: '#9CC7AB' },
  bristolNumber: { fontSize: 24, fontWeight: '900', color: colors.text },
  bristolNumberActive: { color: colors.green },
  bristolText: { fontSize: 10.5, color: colors.muted, lineHeight: 14 },
  bristolTextActive: { color: colors.greenDark },
  timelineRow: { flexDirection: 'row', gap: 11, paddingVertical: 11, alignItems: 'flex-start' },
  timelineIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { color: colors.text, fontWeight: '800', fontSize: 13.5 },
  timelineSub: { color: colors.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  timelineTime: { color: '#98A19B', fontSize: 10.5, marginTop: 4 },
  deleteMini: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  deleteMiniText: { color: colors.red, fontSize: 18, lineHeight: 20 },
  emptyState: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: 'center' },
  emptyIcon: { fontSize: 28, color: colors.green },
  emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 7 },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  analysisSummaryRow: { flexDirection: 'row', gap: 8 },
  analysisSummaryCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  analysisBig: { fontSize: 23, fontWeight: '900', color: colors.text },
  analysisSmall: { fontSize: 10.5, color: colors.muted, marginTop: 3, textAlign: 'center' },
  trendChart: { height: 188, flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 16 },
  trendColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  trendTrack: { flex: 1, width: '60%', backgroundColor: colors.greenTint, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: '#8EBB9C', borderRadius: 8, minHeight: 4 },
  trendValue: { fontSize: 9.5, color: colors.muted, marginTop: 5 },
  trendLabel: { fontSize: 10.5, color: colors.text, fontWeight: '700', marginTop: 2 },
  signalHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  signalFood: { fontSize: 17, fontWeight: '900', color: colors.text },
  confidenceBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  confLow: { backgroundColor: colors.orangeSoft },
  confMedium: { backgroundColor: colors.blueSoft },
  confHigher: { backgroundColor: colors.greenSoft },
  confidenceText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  deltaRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 14 },
  deltaValue: { fontSize: 26, fontWeight: '900', color: colors.orange },
  deltaCopy: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 17 },
  signalDisclaimer: { fontSize: 10.5, color: '#8C958F', lineHeight: 15, marginTop: 12 },
  methodCard: { backgroundColor: colors.greenTint },
  aiHero: { backgroundColor: colors.purpleSoft, borderRadius: 26, padding: 22 },
  aiHeroIcon: { fontSize: 30, color: colors.purple },
  aiHeroTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 10, lineHeight: 26 },
  aiHeroCopy: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dataPreview: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingVertical: 16 },
  dataPreviewBig: { textAlign: 'center', color: colors.text, fontSize: 22, fontWeight: '900' },
  dataPreviewSmall: { textAlign: 'center', color: colors.muted, fontSize: 10.5, marginTop: 2 },
  cycleAIHint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.coralSoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EBCFCB' },
  cycleAIHintIcon: { color: colors.coral, fontSize: 20, fontWeight: '900' },
  cycleAIHintText: { flex: 1, color: '#6F5752', fontSize: 11.5, lineHeight: 17 },
  centerHint: { textAlign: 'center', color: colors.muted, fontSize: 11.5 },
  errorCard: { backgroundColor: colors.redSoft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F2CBC7' },
  errorTitle: { color: colors.red, fontWeight: '800' },
  errorText: { color: colors.red, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  aiResultWrap: { gap: 14, marginTop: 2 },
  aiResultHero: { backgroundColor: '#F4F1FF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#DDD5FF' },
  aiResultHeroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiResultSpark: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#7258C7', alignItems: 'center', justifyContent: 'center' },
  aiResultSparkText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  aiResultKicker: { color: '#7258C7', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  aiResultHeadline: { color: colors.text, fontSize: 18, fontWeight: '900', lineHeight: 23, marginTop: 3 },
  aiConfidenceBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, maxWidth: 92 },
  aiConfidenceHigher: { backgroundColor: '#DDEFE3' },
  aiConfidenceMedium: { backgroundColor: '#E6EEFA' },
  aiConfidenceLow: { backgroundColor: '#FFF0E1' },
  aiConfidenceText: { color: colors.text, fontSize: 8.5, fontWeight: '900', textAlign: 'center', lineHeight: 12 },
  aiResultSummary: { color: '#435248', fontSize: 13.5, lineHeight: 20, marginTop: 14 },
  aiResultMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  aiResultMetaPill: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  aiResultMetaValue: { color: colors.text, fontSize: 11, fontWeight: '900' },
  aiResultMetaLabel: { color: colors.muted, fontSize: 9.5, fontWeight: '700' },
  aiSectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 9, marginTop: 2 },
  aiFindingCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 10 },
  aiFindingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiFindingIndex: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiFindingIndexText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  aiFindingTitle: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: '900', lineHeight: 19 },
  aiFindingObservation: { color: '#4D5D54', fontSize: 12.5, lineHeight: 19, marginTop: 11 },
  aiEvidenceBox: { backgroundColor: colors.greenTint, borderRadius: 14, padding: 12, marginTop: 12 },
  aiEvidenceLabel: { color: colors.green, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  aiEvidenceText: { color: '#385044', fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  aiUncertaintyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 11 },
  aiUncertaintyIcon: { color: colors.orange, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  aiUncertaintyText: { flex: 1, color: colors.muted, fontSize: 10.8, lineHeight: 16 },
  aiNextCard: { backgroundColor: '#EEF7F1', borderRadius: 22, padding: 17, borderWidth: 1, borderColor: '#D2E6D8' },
  aiSectionKicker: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  aiNextTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', lineHeight: 20, marginTop: 4, marginBottom: 11 },
  aiNextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  aiNextNumber: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CFE4D5' },
  aiNextNumberText: { color: colors.greenDark, fontSize: 10.5, fontWeight: '900' },
  aiNextText: { flex: 1, color: '#425349', fontSize: 11.8, lineHeight: 17 },
  aiSafetyCard: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.orangeSoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#F0D7BA' },
  aiSafetyIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F0C790', color: '#714A1F', textAlign: 'center', textAlignVertical: 'center', fontWeight: '900', lineHeight: 26 },
  aiSafetyTitle: { color: '#714A1F', fontSize: 12, fontWeight: '900' },
  aiSafetyText: { color: '#795B39', fontSize: 10.8, lineHeight: 16, marginTop: 3 },
  aiResultFootnote: { color: '#8A958E', fontSize: 10.5, lineHeight: 15.5, paddingHorizontal: 4 },
  profileStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  settingLabel: { color: colors.muted, fontSize: 13 },
  settingValue: { color: colors.text, fontWeight: '800' },
  clickableCard: { flexDirection: 'row', alignItems: 'center' },
  privacyCard: { backgroundColor: colors.orangeSoft, borderColor: '#F0D7BA' },
  privacyKicker: { color: colors.orange, fontWeight: '900', fontSize: 9.5, letterSpacing: 0.8, marginBottom: 6 },
  destructiveButton: { borderRadius: 15, borderWidth: 1, borderColor: '#EFC7C3', backgroundColor: colors.redSoft, paddingVertical: 13, alignItems: 'center' },
  destructiveButtonText: { color: colors.red, fontWeight: '800' },
  destructiveText: { color: colors.red, fontWeight: '800', fontSize: 12 },
  textButton: { alignItems: 'center', padding: 10 },
  versionLabel: { textAlign: 'center', color: '#9AA39D', fontSize: 10.5, marginTop: 8 },
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: 20, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8ECE9', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 24, color: colors.text, marginTop: -2 },
  messageCard: { backgroundColor: colors.greenTint, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line },
  messageText: { color: colors.text, fontSize: 11.5, lineHeight: 17 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 8 : 10, paddingHorizontal: 5 },
  tabButton: { flex: 1, alignItems: 'center', gap: 2 },
  tabIconCircle: { width: 32, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabIconCircleActive: { backgroundColor: colors.greenSoft },
  tabIconAdd: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.coral, marginTop: -18, borderWidth: 4, borderColor: colors.surface },
  tabIconAddText: { color: '#FFFFFF', fontSize: 27, lineHeight: 31, fontWeight: '500' },
  tabIcon: { fontSize: 17, color: '#847B73' },
  tabText: { fontSize: 9.5, color: '#7B8580', fontWeight: '600' },
  tabActive: { color: colors.green, fontWeight: '900' },

  // v0.8 diary-first / FoodLog-inspired UI
  homeContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124, gap: 15 },
  foodlogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  foodlogHeaderTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  foodlogHeaderSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  headerSpark: { width: 43, height: 43, borderRadius: 16, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  headerSparkText: { color: colors.purple, fontSize: 20, fontWeight: '900' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  weekDay: { width: 39, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekDayToday: { backgroundColor: colors.purple },
  weekName: { color: '#9A969F', fontSize: 9.5, fontWeight: '700', textTransform: 'capitalize' },
  weekNameToday: { color: '#E9DFF2' },
  weekNumber: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  weekNumberToday: { color: '#FFFFFF' },
  quickAIHome: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.purple, borderRadius: 25, padding: 16 },
  quickAIHomeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  quickAIHomeIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
  quickAIHomeKicker: { color: '#DED1EA', fontSize: 8.8, fontWeight: '900', letterSpacing: 0.9 },
  quickAIHomeTitle: { color: '#FFFFFF', fontSize: 16.2, fontWeight: '900', marginTop: 2 },
  quickAIHomeText: { color: '#EFE7F6', fontSize: 10.7, lineHeight: 15.5, marginTop: 4 },
  quickAIHomeChevron: { color: '#FFFFFF', fontSize: 27, fontWeight: '300' },
  quickActionRow: { gap: 9, paddingRight: 6 },
  quickActionCard: { width: 112, minHeight: 104, borderRadius: 21, padding: 13, justifyContent: 'space-between' },
  quickActionIcon: { fontSize: 21 },
  quickActionTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', marginTop: 11 },
  quickActionSub: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  nowGrid: { flexDirection: 'row', gap: 9 },
  nowCard: { flex: 1, minHeight: 108, backgroundColor: colors.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  nowCardObservation: { backgroundColor: '#FFFBEF', borderColor: '#F2E8BC' },
  nowKicker: { color: colors.green, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  nowTitle: { color: colors.text, fontSize: 14, fontWeight: '900', lineHeight: 19, marginTop: 7 },
  nowSub: { color: colors.muted, fontSize: 10, marginTop: 5 },
  miniInsightCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#F7F2FA', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#E8DFF0' },
  miniInsightIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  miniInsightKicker: { color: colors.purple, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  miniInsightText: { color: colors.text, fontSize: 12.3, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  diaryCard: { backgroundColor: colors.surface, borderRadius: 23, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  homeEmpty: { backgroundColor: colors.surface, borderRadius: 23, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  homeEmptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purpleSoft, color: colors.purple, fontSize: 25, textAlign: 'center', lineHeight: 42, fontWeight: '400' },
  homeEmptyTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', marginTop: 10 },
  homeEmptyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 5, maxWidth: 280 },
  cycleContextCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#F8F0F8', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#EBDDEC' },
  cycleContextIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FFFFFF', color: colors.purple, fontSize: 18, textAlign: 'center', lineHeight: 36 },
  cycleContextTitle: { color: colors.text, fontWeight: '900', fontSize: 13.5 },
  cycleContextText: { color: colors.muted, fontSize: 10.7, lineHeight: 15.5, marginTop: 3 },
  diaryScreenContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124, gap: 15 },
  headerAdd: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  headerAddText: { color: '#FFF', fontSize: 24, lineHeight: 27 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, height: 50 },
  searchIcon: { color: '#69656E', fontSize: 24, marginRight: 9 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  diaryGroup: { gap: 8 },
  diaryDate: { color: colors.muted, fontSize: 12.5, fontWeight: '800', paddingLeft: 3 },
  observationHero: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF8DE', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#F0E2A9' },
  observationHeroIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF', color: '#A47A1E', textAlign: 'center', lineHeight: 40, fontWeight: '900', fontSize: 18 },
  observationHeroTitle: { color: colors.text, fontWeight: '900', fontSize: 15 },
  observationHeroText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  observationInput: { minHeight: 116, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 15, color: colors.text, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },

  // v0.8 phase 3 analysis
  analysisContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124, gap: 14 },
  analysisHeader: { marginBottom: 2 },
  analysisPageTitle: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  analysisPageSub: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  periodSegment: { flexDirection: 'row', backgroundColor: '#EEEAF0', borderRadius: 18, padding: 4 },
  periodButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  periodButtonActive: { backgroundColor: colors.purple },
  periodButtonText: { color: '#615D66', fontSize: 11.5, fontWeight: '700' },
  periodButtonTextActive: { color: '#FFFFFF', fontWeight: '900' },
  analysisAIHero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purple, borderRadius: 23, padding: 15 },
  analysisAIIcon: { width: 45, height: 45, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  analysisAIIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 19 },
  analysisAIKicker: { color: '#DED1EA', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  analysisAITitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '900', marginTop: 2 },
  analysisAICopy: { color: '#EEE6F4', fontSize: 10.3, lineHeight: 14.5, marginTop: 3 },
  analysisStats: { flexDirection: 'row', gap: 8 },
  analysisStat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  analysisStatBig: { color: colors.text, fontSize: 21, fontWeight: '900' },
  analysisStatSmall: { color: colors.muted, fontSize: 9.5, textAlign: 'center', marginTop: 2 },
  insightCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 17, borderWidth: 1, borderColor: colors.line },
  insightCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  insightSquare: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  insightCardTitle: { color: colors.text, fontWeight: '900', fontSize: 16.5 },
  insightCardSub: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  windowSegment: { flexDirection: 'row', backgroundColor: '#F0EDF2', borderRadius: 16, padding: 4, marginBottom: 14 },
  windowButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 39, borderRadius: 12 },
  windowButtonActive: { backgroundColor: colors.purple },
  windowButtonText: { color: '#625E67', fontSize: 11, fontWeight: '700' },
  windowButtonTextActive: { color: '#FFFFFF', fontWeight: '900' },
  simpleFinding: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FAF9FB', borderRadius: 18, padding: 14 },
  simpleFindingKicker: { color: colors.purple, fontSize: 8.2, fontWeight: '900', letterSpacing: 0.7 },
  simpleFindingTitle: { color: colors.text, fontSize: 16.5, fontWeight: '900', marginTop: 4 },
  simpleFindingText: { color: colors.muted, fontSize: 10.8, lineHeight: 15.5, marginTop: 4 },
  simpleDelta: { minWidth: 62, borderRadius: 15, backgroundColor: colors.purpleSoft, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 9 },
  simpleDeltaGood: { backgroundColor: colors.greenSoft },
  simpleDeltaMedium: { backgroundColor: colors.blueSoft },
  simpleDeltaLow: { backgroundColor: colors.orangeSoft },
  simpleDeltaValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  simpleDeltaLabel: { color: colors.muted, fontSize: 8.2, marginTop: 2 },
  insightEmpty: { backgroundColor: '#F7F5F8', borderRadius: 18, padding: 18, alignItems: 'center' },
  insightEmptyIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#B8B3BC', color: '#99949E', textAlign: 'center', lineHeight: 31, fontWeight: '900' },
  insightEmptyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  compactSignalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  compactSignalName: { color: colors.text, fontSize: 12.2, fontWeight: '800' },
  compactSignalMeta: { color: colors.muted, fontSize: 10.5, fontWeight: '700' },
  foodCycleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  foodCycleTitle: { color: colors.text, fontWeight: '900', fontSize: 12.8 },
  foodCycleSub: { color: colors.muted, fontSize: 10.2, marginTop: 2 },
  foodCycleBadge: { backgroundColor: '#FFF5D6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  foodCycleBadgeText: { color: '#8D6A14', fontWeight: '900', fontSize: 10.5 },

  // v0.8 simplified AI result
  aiPageContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124, gap: 14 },
  aiSimpleHero: { backgroundColor: colors.purpleSoft, borderRadius: 27, padding: 20, borderWidth: 1, borderColor: '#E4D8EE' },
  aiSimpleHeroIcon: { width: 48, height: 48, borderRadius: 21, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  aiSimpleHeroIconText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  aiSimpleHeroTitle: { color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 25, marginTop: 13 },
  aiSimpleHeroText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  aiConnectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: colors.line },
  aiConnectionTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  aiConnectionSub: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  aiPrivacyCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: colors.line },
  aiScopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  aiRunButton: { backgroundColor: colors.purple },
  cleanAIResult: { gap: 13 },
  cleanAIHero: { backgroundColor: colors.purple, borderRadius: 28, padding: 20 },
  cleanAITopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cleanAIIcon: { width: 43, height: 43, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  cleanAIIconText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  cleanAIBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  cleanAIBadgeText: { color: '#38333D', fontSize: 8.7, fontWeight: '900' },
  cleanAIHeadline: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 30, marginTop: 17, letterSpacing: -0.4 },
  cleanAISummary: { color: '#EFE8F5', fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  cleanSection: { gap: 8 },
  cleanSectionTitle: { color: colors.text, fontSize: 16.5, fontWeight: '900', marginBottom: 2 },
  cleanFindingCard: { flexDirection: 'row', gap: 11, backgroundColor: colors.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  cleanFindingNumber: { width: 31, height: 31, borderRadius: 12, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  cleanFindingNumberText: { color: colors.purple, fontSize: 11, fontWeight: '900' },
  cleanFindingTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  cleanFindingObservation: { color: colors.muted, fontSize: 11.5, lineHeight: 16.5, marginTop: 3 },
  cleanActionCard: { backgroundColor: colors.greenSoft, borderRadius: 22, padding: 17, borderWidth: 1, borderColor: '#D3EAD8' },
  cleanActionKicker: { color: colors.greenDark, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  cleanActionTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 },
  cleanActionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  cleanActionDot: { color: colors.greenDark, fontWeight: '900', lineHeight: 17 },
  cleanActionText: { flex: 1, color: '#455C4B', fontSize: 11.2, lineHeight: 17 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, borderColor: colors.line },
  detailsToggleText: { color: colors.purple, fontSize: 12.5, fontWeight: '900' },
  detailsToggleChevron: { color: colors.purple, fontSize: 18, fontWeight: '800' },
  aiDetailsWrap: { gap: 9 },
  aiDetailCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.line },
  aiDetailTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  aiDetailLabel: { color: colors.purple, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7, marginTop: 10 },
  aiDetailText: { color: colors.muted, fontSize: 11.2, lineHeight: 17, marginTop: 3 },
  aiDetailMeta: { alignItems: 'center', paddingVertical: 5 },
  aiDetailMetaText: { color: '#9A969F', fontSize: 9.5 },

  // Floating bottom navigation
  bottomNavWrap: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 7 : 11, paddingTop: 4 },
  bottomNav: { height: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 27, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7 },
  bottomNavButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  bottomNavCenterSpace: { width: 66 },
  bottomNavIconBox: { width: 39, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bottomNavIconBoxActive: { backgroundColor: colors.purpleSoft },
  bottomNavIcon: { color: '#7D7983', fontSize: 18, fontWeight: '700' },
  bottomNavIconActive: { color: colors.purple },
  bottomNavLabel: { color: '#8D8992', fontSize: 8.8, fontWeight: '700' },
  bottomNavLabelActive: { color: colors.purple, fontWeight: '900' },
  floatingAdd: { position: 'absolute', width: 62, height: 62, borderRadius: 31, backgroundColor: colors.purple, left: '50%', marginLeft: -31, top: -12, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.bg },
  floatingAddText: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '300' },

  // v0.9 AI provider/model dropdowns
  dropdownField: { minHeight: 62, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownDisabled: { opacity: 0.55 },
  dropdownValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  dropdownPlaceholder: { color: '#98929D', fontWeight: '700' },
  dropdownDetail: { color: colors.muted, fontSize: 9.8, marginTop: 3 },
  dropdownChevron: { color: colors.purple, fontSize: 23, fontWeight: '800', marginTop: -5 },
  selectBackdrop: { flex: 1, backgroundColor: 'rgba(20,17,25,0.38)', justifyContent: 'flex-end' },
  selectSheet: { maxHeight: '82%', minHeight: '45%', backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 17, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 18 : 12 },
  selectHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: '#D1CCD4', alignSelf: 'center', marginBottom: 12 },
  selectHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
  selectTitle: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  selectSubtitle: { color: colors.muted, fontSize: 10.8, lineHeight: 15.5, marginTop: 3 },
  selectClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  selectCloseText: { color: colors.text, fontSize: 23, lineHeight: 25 },
  selectSearchWrap: { height: 48, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 8, marginBottom: 10 },
  selectSearchIcon: { color: colors.muted, fontSize: 19 },
  selectSearch: { flex: 1, color: colors.text, fontSize: 13 },
  selectList: { flexGrow: 0 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 13, marginBottom: 7, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  selectRowActive: { borderColor: '#CDB9DE', backgroundColor: colors.purpleSoft },
  selectLabelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  selectRowLabel: { color: colors.text, fontSize: 13.2, fontWeight: '900' },
  selectRowLabelActive: { color: '#5E4079' },
  selectRowValue: { color: colors.muted, fontSize: 9.7, marginTop: 2 },
  selectRowDetail: { color: '#8B8690', fontSize: 9.3, lineHeight: 13.5, marginTop: 4 },
  selectCheck: { color: colors.purple, fontSize: 18, fontWeight: '900' },
  selectBadge: { backgroundColor: '#E5D8EF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  selectBadgeText: { color: '#66467D', fontSize: 7.8, fontWeight: '900' },
  selectEmpty: { color: colors.muted, textAlign: 'center', paddingVertical: 32, fontSize: 12 },
  selectLoading: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 42 },
  selectLoadingText: { color: colors.muted, fontSize: 11.5 },
  aiSettingsIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.purpleSoft, borderColor: '#E3D6EC' },
  aiSettingsIntroIcon: { width: 43, height: 43, borderRadius: 18, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  aiSettingsIntroIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  aiSettingsIntroTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  aiSettingsIntroText: { color: colors.muted, fontSize: 10.5, lineHeight: 15.5, marginTop: 4 },
  modelToolsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -1 },
  modelRefreshButton: { minHeight: 38, borderRadius: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleSoft },
  modelRefreshText: { color: colors.purple, fontSize: 10.5, fontWeight: '900' },
  modelCountText: { color: colors.muted, fontSize: 9.8, fontWeight: '700' },
});
