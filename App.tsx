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
import * as LocalAuthentication from 'expo-local-authentication';

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
  getAITransmissionSummary,
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
  computeFoodGroupSignals,
  computePersonalDayScore,
  computeCycleSymptomSignals,
  computeFoodCycleSignals,
  getTimeline,
  getTodaySummary,
  getTrackingDays,
  getCycleContext,
  getOverallDataQuality,
  isToday,
} from './src/analysis';
import {
  addBowel,
  addCycle,
  addMeal,
  addSymptom,
  addObservation,
  addMedication,
  addHealthMetrics,
  saveDish,
  removeDish,
  updateEntry,
  toggleMealFavorite,
  clearHealthStore,
  clearHealthEncryptionKey,
  createDemoStore,
  emptyHealthStore,
  loadHealthStore,
  removeEntry,
  saveHealthStore,
  mergeHealthStores,
  clearDiaryWithTombstones,
} from './src/storage';
import { BowelEntry, CycleEntry, CycleFlow, CycleMood, EntryKind, FoodItem, HealthMetricEntry, HealthMetricKind, HealthStore, MealEntry, MealType, MedicationEntry, MedicationKind, ObservationCategory, ObservationEntry, SavedDish, SymptomEntry, TimelineItem } from './src/types';
import SetupWizard from './src/SetupWizard';
import BarcodeScannerModal from './src/BarcodeScannerModal';
import { GOAL_LABELS, UserProfile, clearUserProfile, createDefaultUserProfile, loadUserProfile, saveUserProfile } from './src/onboarding';
import AIQuickCaptureModal from './src/AIQuickCaptureModal';
import AddEntrySheet, { ManualEntryMode } from './src/AddEntrySheet';
import { AppPreferences, clearAppPreferences, defaultAppPreferences, loadAppPreferences, saveAppPreferences } from './src/preferences';
import { pickBackupFile, restoreProfileImageFromBackup, shareAutomaticBackup, writeAutomaticBackup } from './src/backup';
import { pickAndPersistProfileImage, removePersistedProfileImage } from './src/profileMedia';
import { clearLatestAIInsight, configureDailyAI, loadLatestAIInsight, runAIAnalysisNow, saveLatestAIInsight, syncDailyAIRegistration } from './src/dailyAI';
import { pickAndImportAppleHealth } from './src/appleHealth';
import ProfileSettingsModal from './src/ProfileSettingsModal';
import EntryEditorModal, { findEntry } from './src/EntryEditorModal';
import { enrichFoodGroups } from './src/foodGroups';
import FoodSearchModal from './src/FoodSearchModal';
import PhotoMealCaptureModal from './src/PhotoMealCaptureModal';
import { addReminderResponseListener, getLastReminderRoute, scheduleMealFollowup, syncRecurringReminders } from './src/reminders';
import { createAndShareHealthReport } from './src/healthReport';
import { clearInsightFeedback, insightFeedbackKey, loadInsightFeedback, saveInsightFeedback } from './src/aiFeedback';

import { getMedicalSafetyAlerts } from './src/medicalSafety';
import { buildWeeklyReview } from './src/weeklyReview';
import { clearAIUsage, loadAIUsage, usagePurposeLabel } from './src/aiUsage';
import { pickPortableExport, sharePortableExport } from './src/dataExport';
import { isDirectHealthKitModulePresent, syncDirectAppleHealth } from './src/healthKitLive';
import { isCloudKitModulePresent, pullCloudSnapshot, pushCloudSnapshot } from './src/cloudSync';
import { parseNouraLink } from './src/shortcuts';
import * as Linking from 'expo-linking';


type Tab = 'Home' | 'Diary' | 'Tracking' | 'Analyse' | 'KI' | 'Profil';
type TrackingMode = 'Essen' | 'Symptome' | 'Auffälligkeit' | 'Stuhlgang' | 'Zyklus' | 'Medikamente' | 'Körperdaten';

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
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
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

function HomeScreen({ store, profile, preferences, aiInsight, onAIQuick, onAdd, onOpenInsights, onDiary, onProfile }: {
  store: HealthStore;
  profile: UserProfile;
  preferences: AppPreferences;
  aiInsight: string;
  onAIQuick: () => void;
  onAdd: (mode: TrackingMode) => void;
  onOpenInsights: () => void;
  onDiary: () => void;
  onProfile: () => void;
}) {
  const day = useMemo(() => computePersonalDayScore(store), [store]);
  const latest = useMemo(() => getTimeline(store, 3), [store]);
  const groupSignal = useMemo(() => computeFoodGroupSignals(store,8,profile.cyclePreferences)[0], [store,profile.cyclePreferences]);
  const cycleSignal = useMemo(() => computeCycleSymptomSignals(store, profile.cyclePreferences).find(x => x.delta > 0.3), [store, profile.cyclePreferences]);
  const cycle = useMemo(() => getCycleContext(store, profile.cyclePreferences), [store, profile.cyclePreferences]);
  const safetyAlerts = useMemo(() => getMedicalSafetyAlerts(store), [store]);
  const weekly = useMemo(() => buildWeeklyReview(store, profile.cyclePreferences), [store, profile.cyclePreferences]);
  const scoreTitle = day.score == null ? 'Noch kein Tagesgefühl' : day.score >= 78 ? 'Heute wirkt eher ruhig' : day.score >= 58 ? 'Ein paar Signale im Blick' : 'Heute genauer hinschauen';
  const deltaText = day.delta == null ? 'Mit weiteren Check-ins entsteht dein persönlicher Vergleich.' : `${day.delta >= 0 ? '+' : ''}${day.delta} Punkte gegenüber deinem persönlichen Schnitt.`;
  const insight = aiInsight || groupSignal?.friendly || (cycleSignal ? `Deine Beschwerden waren in der ${cycleSignal.phase} zuletzt häufiger stärker als sonst.` : 'Noch keine belastbare Auffälligkeit. Kurze, regelmäßige Einträge reichen völlig.');
  return <ScrollView contentContainerStyle={styles.simpleHomeContent} showsVerticalScrollIndicator={false}>
    <View style={styles.simpleHomeHeader}><View style={{flex:1}}><Text style={styles.simpleHomeGreeting}>{profile.displayName ? `Hi ${profile.displayName.split(' ')[0]}` : 'Heute'}</Text><Text style={styles.simpleHomeDate}>{new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</Text></View><ProfileAvatar profile={profile} size={44} onPress={onProfile}/></View>


    {safetyAlerts.length ? <View style={styles.safetyHomeCard}><Text style={styles.safetyHomeIcon}>!</Text><View style={{flex:1}}><Text style={styles.safetyHomeTitle}>{safetyAlerts[0].title}</Text><Text style={styles.safetyHomeText}>{safetyAlerts[0].message}</Text><Text style={styles.safetyHomeAction}>{safetyAlerts[0].action}</Text></View></View> : null}

    <View style={styles.scoreHero}>
      <View style={styles.scoreHeroCircle}><Text style={styles.scoreHeroValue}>{day.score ?? '–'}</Text><Text style={styles.scoreHeroOf}>Tagesgefühl</Text></View>
      <View style={{flex:1}}><Text style={styles.scoreHeroKicker}>NOURA TAGESGEFÜHL</Text><Text style={styles.scoreHeroTitle}>{scoreTitle}</Text><Text style={styles.scoreHeroText}>{deltaText}</Text>{day.score==null?<TouchableOpacity onPress={()=>onAdd('Symptome')} style={styles.scoreHeroButton}><Text style={styles.scoreHeroButtonText}>Kurz eintragen</Text></TouchableOpacity>:null}</View>
    </View>

    <TouchableOpacity style={styles.homeInsightCard} onPress={onOpenInsights} activeOpacity={0.88}>
      <View style={styles.homeInsightTop}><Text style={styles.homeInsightKicker}>WAS NOURA AUFFÄLLT</Text><Text style={styles.homeInsightArrow}>›</Text></View><Text style={styles.homeInsightText} numberOfLines={3}>{insight}</Text><Text style={styles.homeInsightFoot}>Details, Datenlage und nächste Schritte</Text>
    </TouchableOpacity>


    {preferences.weeklyReviewEnabled && weekly.trackingDays >= 3 ? <View style={styles.weeklyHomeCard}><View style={{flex:1}}><Text style={styles.weeklyHomeKicker}>DEINE LETZTEN 7 TAGE</Text><Text style={styles.weeklyHomeTitle}>{weekly.summary}</Text><Text style={styles.weeklyHomeMeta}>{weekly.trackingDays} Tracking-Tage · Datenlage {weekly.dataQuality}</Text></View></View> : null}

    <TouchableOpacity style={styles.tellNouraRow} onPress={onAIQuick} activeOpacity={0.88}><View style={styles.tellNouraIcon}><Text style={styles.tellNouraIconText}>✦</Text></View><View style={{flex:1}}><Text style={styles.tellNouraTitle}>Noura erzählen</Text><Text style={styles.tellNouraSub}>„Ich hatte Pasta und bin jetzt aufgebläht.“</Text></View><Text style={styles.tellNouraArrow}>›</Text></TouchableOpacity>

    <View style={styles.homeTodayCard}><View style={styles.homeTodayHeader}><Text style={styles.homeTodayTitle}>Zuletzt</Text><TouchableOpacity onPress={onDiary}><Text style={styles.homeTodayLink}>Tagebuch ›</Text></TouchableOpacity></View>
      {latest.length ? latest.map((item,index)=><View key={`${item.kind}-${item.id}`} style={[styles.homeLastRow,index<latest.length-1&&{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,paddingBottom:10}]}><View style={{flex:1}}><Text style={styles.homeLastLabel}>{formatDateTime(item.createdAt)}</Text><Text style={[styles.homeLastValue,{textAlign:'left'}]} numberOfLines={1}>{item.title} · {item.subtitle}</Text></View></View>) : <Text style={styles.helper}>Noch keine Einträge. Du kannst einfach Noura erzählen, was gerade war.</Text>}
      {profile.tracking.cycle && cycle.estimatedCycleDay ? <View style={[styles.homeLastRow,{marginTop:8}]}><Text style={styles.homeLastLabel}>Zykluskontext</Text><Text style={styles.homeLastValue}>ca. Tag {cycle.estimatedCycleDay} · {cycle.estimatedPhase}</Text></View>:null}
    </View>
    <Text style={styles.homeScoreDisclaimer}>Das Tagesgefühl vergleicht nur deine eigenen dokumentierten Angaben und ist keine medizinische Bewertung.</Text>
  </ScrollView>;
}

function TimelineRow({ item, border, onPress }: { item: TimelineItem; border?: boolean; onPress?: () => void }) {
  const icons: Record<TimelineItem['kind'], string> = { meal:'🍽️', symptom:'◌', bowel:'◎', cycle:'◐', observation:'!', medication:'✚', metric:'♡' };
  return <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.72} style={[styles.timelineRow,border&&styles.rowBorder]}>
    <View style={styles.timelineIcon}><Text>{icons[item.kind]}</Text></View><View style={{flex:1}}><Text style={styles.timelineTitle}>{item.title}</Text><Text style={styles.timelineSub} numberOfLines={2}>{item.subtitle}</Text><Text style={styles.timelineTime}>{formatDateTime(item.createdAt)}</Text></View>{onPress?<Text style={styles.profileSettingChevron}>›</Text>:null}
  </TouchableOpacity>;
}

function DiaryScreen({ store, onOpenEntry }: { store: HealthStore; onOpenEntry: (item: TimelineItem) => void }) {
  const [query,setQuery]=useState('');
  const [selectedDay,setSelectedDay]=useState<string|undefined>();
  const timeline=useMemo(()=>getTimeline(store,1000),[store]);
  const dayDate=selectedDay?new Date(`${selectedDay}T12:00:00`):undefined;
  const shiftDay=(delta:number)=>{const d=dayDate?new Date(dayDate):new Date();d.setDate(d.getDate()+delta);setSelectedDay(dateInput(d));};
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase('de-DE');
    return timeline.filter(item=>{
      if(selectedDay&&dateInput(new Date(item.createdAt))!==selectedDay)return false;
      return !needle||`${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(needle);
    });
  },[timeline,query,selectedDay]);
  const grouped=useMemo(()=>{const result:Array<{key:string;label:string;items:TimelineItem[]}>=[];for(const item of filtered){const d=new Date(item.createdAt);const key=d.toDateString();let g=result.find(x=>x.key===key);if(!g){const today=new Date();const y=new Date();y.setDate(today.getDate()-1);const label=d.toDateString()===today.toDateString()?'Heute':d.toDateString()===y.toDateString()?'Gestern':d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});g={key,label,items:[]};result.push(g);}g.items.push(item);}return result;},[filtered]);
  const recentDays=useMemo(()=>Array.from({length:10},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d;}),[]);
  return <ScrollView contentContainerStyle={styles.diaryScreenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.foodlogHeader}><View><Text style={styles.foodlogHeaderTitle}>Tagebuch</Text><Text style={styles.foodlogHeaderSub}>Alles, was du festgehalten hast.</Text></View></View>
    <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Tagebuch durchsuchen" value={query} onChangeText={setQuery} placeholder="Eintrag suchen" placeholderTextColor="#9B98A0" style={styles.searchInput}/></View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFF',borderRadius:18,borderWidth:1,borderColor:colors.line,padding:8}}>
      <TouchableOpacity accessibilityLabel="Vorheriger Tag" onPress={()=>shiftDay(-1)} style={[styles.secondaryButton,{paddingHorizontal:13,paddingVertical:9}]}><Text style={styles.secondaryButtonText}>‹</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>setSelectedDay(selectedDay?undefined:dateInput())} style={{flex:1,alignItems:'center'}}><Text style={{fontWeight:'900',color:colors.text}}>{selectedDay?new Date(`${selectedDay}T12:00:00`).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'long',year:'numeric'}):'Alle Einträge'}</Text><Text style={styles.helper}>{selectedDay?'Antippen für alle Tage':'Tag auswählen oder blättern'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityLabel="Nächster Tag" onPress={()=>shiftDay(1)} disabled={selectedDay===dateInput()} style={[styles.secondaryButton,{paddingHorizontal:13,paddingVertical:9},selectedDay===dateInput()&&styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>›</Text></TouchableOpacity>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:2}}><Pill label="Alle" active={!selectedDay} onPress={()=>setSelectedDay(undefined)} compact/>{recentDays.map((d,i)=>{const key=dateInput(d);return <Pill key={key} label={i===0?'Heute':d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit'})} active={selectedDay===key} onPress={()=>setSelectedDay(key)} compact/>})}</ScrollView>
    {grouped.length?grouped.map(group=><View key={group.key} style={styles.diaryGroup}><Text style={styles.diaryDate}>{group.label}</Text><View style={styles.diaryCard}>{group.items.map((item,index)=><TimelineRow key={`${item.kind}-${item.id}`} item={item} border={index<group.items.length-1} onPress={item.kind==='metric'?undefined:()=>onOpenEntry(item)}/>)}</View></View>):<EmptyState icon="⌕" title="Keine Einträge" text={query?'Versuche einen anderen Suchbegriff.':'Für diesen Tag gibt es noch nichts.'}/>} 
  </ScrollView>;
}
function SeverityPicker({ title, value, onChange, reverse }: { title:string; value?:number; onChange:(v:number|undefined)=>void; reverse?:boolean }) {
  const options:Array<[string,number|undefined]>=[['Nicht erfasst',undefined],['Keine',0],['Leicht',2],['Mittel',5],['Stark',8],['Sehr stark',10]];
  return <ShadowCard><Text style={styles.counterTitle}>{title}</Text><View style={[styles.pillWrap,{marginTop:9}]}>{options.map(([label,v])=><Pill key={label} label={label} active={value===v} onPress={()=>onChange(v)} compact/>)}</View>{reverse?<Text style={styles.helper}>Für Energie bedeutet „stark“ hier bewusst nicht dasselbe – nutze stattdessen die 0–10 Detailangabe unter „Mehr“.</Text>:null}</ShadowCard>;
}

function Counter({ title, value, onChange, onClear, min = 0, max = 10, helper }: { title:string; value?:number; onChange:(v:number)=>void; onClear?:()=>void; min?:number; max?:number; helper?:string }) {
  const current = value ?? Math.round((min + max) / 2);
  return <ShadowCard><View style={styles.counterRow}><View style={{flex:1}}><Text style={styles.counterTitle}>{title}</Text>{helper?<Text style={styles.helper}>{helper}</Text>:null}{value==null?<Text style={styles.helper}>Nicht erfasst</Text>:onClear?<TouchableOpacity onPress={onClear}><Text style={[styles.link,{fontSize:10}]}>Wert entfernen</Text></TouchableOpacity>:null}</View><View style={styles.stepper}><TouchableOpacity onPress={()=>onChange(Math.max(min,current-1))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></TouchableOpacity><Text style={styles.stepValue}>{value==null?'–':`${value}/${max}`}</Text><TouchableOpacity onPress={()=>onChange(Math.min(max,current+1))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></TouchableOpacity></View></View></ShadowCard>;
}

function defaultMealType(): MealType { const h=new Date().getHours(); return h<11?'Frühstück':h<15?'Mittagessen':h<19?'Snack':'Abendessen'; }
function dateInput(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function timeInput(d=new Date()){return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function inputTimestamp(date:string,time:string){const x=new Date(`${date}T${time}:00`);return Number.isNaN(x.getTime())?new Date().toISOString():x.toISOString();}

function TrackingScreen({ store, profile, aiConfig, initialMode, onSaveMeal, onSaveSymptom, onSaveBowel, onSaveCycle, onSaveObservation, onSaveMedication, onSaveMetrics, onSaveDish, onRemoveDish, onDone }: {
  store:HealthStore; profile:UserProfile; aiConfig:AIConfig|null; initialMode:TrackingMode;
  onSaveMeal:(entry:MealEntry)=>void; onSaveSymptom:(entry:SymptomEntry)=>void; onSaveBowel:(entry:BowelEntry)=>void; onSaveCycle:(entry:CycleEntry)=>void; onSaveObservation:(entry:ObservationEntry)=>void; onSaveMedication:(entry:MedicationEntry)=>void; onSaveMetrics:(entries:HealthMetricEntry[])=>void; onSaveDish:(dish:SavedDish)=>void; onRemoveDish:(id:string)=>void; onDone:()=>void;
}) {
  const [mode,setMode]=useState<TrackingMode>(initialMode); useEffect(()=>setMode(initialMode),[initialMode]);
  const [entryDate,setEntryDate]=useState(dateInput()); const [entryTime,setEntryTime]=useState(timeInput());
  const [more,setMore]=useState(false); const [savedMessage,setSavedMessage]=useState('');
  const flash=(m:string)=>{setSavedMessage(m);setTimeout(()=>setSavedMessage(''),1800)};
  const createdAt=()=>inputTimestamp(entryDate,entryTime);

  const [mealType,setMealType]=useState<MealType>(defaultMealType()); const [foodName,setFoodName]=useState(''); const [foodAmount,setFoodAmount]=useState(''); const [foodKcal,setFoodKcal]=useState(''); const [foods,setFoods]=useState<FoodItem[]>([]); const [mealNote,setMealNote]=useState(''); const [mealPhotoUri,setMealPhotoUri]=useState<string|undefined>(); const [scannerOpen,setScannerOpen]=useState(false); const [foodSearchOpen,setFoodSearchOpen]=useState(false); const [photoOpen,setPhotoOpen]=useState(false); const [scannedCode,setScannedCode]=useState(''); const [cameraPermission,requestCameraPermission]=useCameraPermissions(); const [scannerBusy,setScannerBusy]=useState(false); const scannerBusyRef=useRef(false); const cameraApi=CameraView as any;
  const [pain,setPain]=useState<number|undefined>(); const [bloating,setBloating]=useState<number|undefined>(); const [nausea,setNausea]=useState<number|undefined>(); const [heartburn,setHeartburn]=useState<number|undefined>(); const [energy,setEnergy]=useState<number|undefined>(); const [stress,setStress]=useState<number|undefined>(); const [temperature,setTemperature]=useState(''); const [symptomNote,setSymptomNote]=useState('');
  const [observationText,setObservationText]=useState(''); const [observationCategory,setObservationCategory]=useState<ObservationCategory|undefined>(); const [observationSeverity,setObservationSeverity]=useState<number|undefined>();
  const [bristolType,setBristolType]=useState(4); const [urgency,setUrgency]=useState<number|undefined>(); const [mucus,setMucus]=useState(false); const [blood,setBlood]=useState(false); const [bowelPain,setBowelPain]=useState<number|undefined>(); const [bowelNote,setBowelNote]=useState('');
  const [cycleBleeding,setCycleBleeding]=useState(false); const [cycleFlow,setCycleFlow]=useState<CycleFlow>('medium'); const [cycleCramps,setCycleCramps]=useState<number|undefined>(); const [cycleCravings,setCycleCravings]=useState<number|undefined>(); const [cycleHeadache,setCycleHeadache]=useState<number|undefined>(); const [cycleBreastTenderness,setCycleBreastTenderness]=useState<number|undefined>(); const [cycleMood,setCycleMood]=useState<CycleMood|undefined>(); const [cycleBasalTemp,setCycleBasalTemp]=useState(''); const [cycleNote,setCycleNote]=useState('');
  const [medKind,setMedKind]=useState<MedicationKind>('medication'); const [medName,setMedName]=useState(''); const [medDose,setMedDose]=useState(''); const [medNote,setMedNote]=useState('');
  const [metricWeight,setMetricWeight]=useState(''); const [metricWater,setMetricWater]=useState(''); const [metricSleep,setMetricSleep]=useState(''); const [metricSteps,setMetricSteps]=useState(''); const [metricTemp,setMetricTemp]=useState('');

  const hasBodyMetrics=profile.tracking.weight||profile.tracking.water||profile.tracking.sleep||profile.tracking.movement||profile.tracking.temperature;
  const availableModes=useMemo<TrackingMode[]>(()=>[...(profile.tracking.meals?['Essen' as TrackingMode]:[]),...(profile.tracking.symptoms?['Symptome' as TrackingMode]:[]),'Auffälligkeit',...(profile.tracking.bowel?['Stuhlgang' as TrackingMode]:[]),...(profile.tracking.cycle?['Zyklus' as TrackingMode]:[]),...(profile.tracking.medications?['Medikamente' as TrackingMode]:[]),...(hasBodyMetrics?['Körperdaten' as TrackingMode]:[])],[profile.tracking,hasBodyMetrics]);
  const recentMeals=useMemo(()=>store.meals.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5),[store.meals]);
  const favoriteMeals=useMemo(()=>store.meals.filter(x=>x.favorite).slice(0,5),[store.meals]);

  useEffect(()=>{if(typeof cameraApi.onModernBarcodeScanned!=='function')return;const sub=cameraApi.onModernBarcodeScanned((event:{data?:string})=>{const raw=String(event?.data||'').trim();if(!raw||!scannerBusyRef.current)return;scannerBusyRef.current=false;setScannerBusy(false);const clean=raw.replace(/[\s-]+/g,'');const show=()=>{setScannedCode(clean);setScannerOpen(true)};if(Platform.OS==='ios'&&typeof cameraApi.dismissScanner==='function')cameraApi.dismissScanner().catch(()=>undefined).finally(()=>setTimeout(show,80));else setTimeout(show,80);});return()=>sub?.remove?.();},[]);
  const openBarcodeCamera=async()=>{try{let granted=!!cameraPermission?.granted;if(!granted){const r=await requestCameraPermission();granted=!!r.granted;}if(!granted){Alert.alert('Kamera nicht freigegeben','Bitte erlaube Noura den Kamerazugriff.');return;}if(!cameraApi.isModernBarcodeScannerAvailable||typeof cameraApi.launchScanner!=='function'){setScannerOpen(true);return;}scannerBusyRef.current=true;setScannerBusy(true);await cameraApi.launchScanner({isGuidanceEnabled:true,isHighlightingEnabled:true,isPinchToZoomEnabled:true});setScannerBusy(false);}catch{scannerBusyRef.current=false;setScannerBusy(false);setScannerOpen(true);}};

  const addFood=()=>{if(!foodName.trim())return;const parsed=Number(foodKcal.replace(',','.'));const food=enrichFoodGroups({id:uid('food'),name:foodName.trim(),amount:foodAmount.trim()||undefined,kcal:Number.isFinite(parsed)&&parsed>=0?Math.round(parsed):undefined,source:'manual'});setFoods(c=>[...c,food]);setFoodName('');setFoodAmount('');setFoodKcal('');};
  const useMeal=(m:MealEntry)=>{setMealType(m.mealType);setFoods(m.foods.map(f=>({...f,id:uid('food')})));setMealNote(m.note||'');setMealPhotoUri(m.photoUri);};
  const useDish=(d:SavedDish)=>{setMealType(d.mealType||defaultMealType());setFoods(d.foods.map(f=>({...f,id:uid('food'),source:'saved-dish'})));setMealNote(d.note||'');};
  const saveCurrentDish=()=>{
    if(!foods.length)return;
    const suggested=foods.map(f=>f.name).slice(0,2).join(' + ')||'Mein Gericht';
    const persist=(raw?:string)=>{const name=(raw||suggested).trim()||suggested;onSaveDish({id:uid('dish'),name,mealType,foods:foods.map(f=>({...f,id:uid('food')})),note:mealNote.trim()||undefined,createdAt:new Date().toISOString()});flash('Eigenes Gericht gespeichert');};
    if(Platform.OS==='ios' && typeof (Alert as any).prompt==='function') (Alert as any).prompt('Gericht speichern','Wie möchtest du es nennen?',[{text:'Abbrechen',style:'cancel'},{text:'Speichern',onPress:(value?:string)=>persist(value)}],'plain-text',suggested);
    else persist(suggested);
  };
  const saveMeal=()=>{if(!foods.length){Alert.alert('Noch nichts eingetragen','Füge mindestens ein Lebensmittel hinzu.');return;}onSaveMeal({id:uid('meal'),createdAt:createdAt(),mealType,foods:foods.map(enrichFoodGroups),note:mealNote.trim()||undefined,photoUri:mealPhotoUri});flash('Gespeichert');setTimeout(onDone,180);};
  const saveSymptoms=()=>{const temp=Number(temperature.replace(',','.'));const entry:SymptomEntry={id:uid('sym'),createdAt:createdAt(),pain,bloating,nausea,heartburn,energy,stress,temperature:Number.isFinite(temp)&&temperature.trim()?temp:undefined,note:symptomNote.trim()||undefined};if([entry.pain,entry.bloating,entry.nausea,entry.heartburn,entry.energy,entry.stress,entry.temperature].every(v=>v==null)&&!entry.note){Alert.alert('Noch nichts ausgewählt','Wähle mindestens ein Gefühl oder schreibe eine Notiz.');return;}onSaveSymptom(entry);flash('Gespeichert');setTimeout(onDone,180);};
  const saveObservation=()=>{if(!observationText.trim()){Alert.alert('Was ist dir aufgefallen?','Ein kurzer Satz reicht.');return;}onSaveObservation({id:uid('obs'),createdAt:createdAt(),text:observationText.trim(),category:observationCategory,severity:observationSeverity});flash('Beobachtung gespeichert');setTimeout(onDone,180);};
  const saveBowel=()=>{onSaveBowel({id:uid('bowel'),createdAt:createdAt(),bristolType,urgency,mucus:mucus||undefined,blood:blood||undefined,pain:bowelPain,note:bowelNote.trim()||undefined});flash('Gespeichert');setTimeout(onDone,180);};
  const saveCycle=()=>{const bt=Number(cycleBasalTemp.replace(',','.'));onSaveCycle({id:uid('cycle'),createdAt:createdAt(),bleeding:cycleBleeding,flow:cycleBleeding?cycleFlow:undefined,cramps:cycleCramps,cravings:cycleCravings,headache:cycleHeadache,breastTenderness:cycleBreastTenderness,mood:cycleMood,basalTemperature:Number.isFinite(bt)&&cycleBasalTemp.trim()?bt:undefined,note:cycleNote.trim()||undefined});flash('Gespeichert');setTimeout(onDone,180);};
  const saveMedication=()=>{if(!medName.trim()){Alert.alert('Was hast du genommen?','Name des Medikaments oder Supplements reicht.');return;}onSaveMedication({id:uid('med'),createdAt:createdAt(),kind:medKind,name:medName.trim(),dose:medDose.trim()||undefined,note:medNote.trim()||undefined});flash('Gespeichert');setTimeout(onDone,180);};
  const saveMetrics=()=>{const specs:Array<[HealthMetricKind,string,string]>=[['weight',metricWeight,'kg'],['water',metricWater,'ml'],['sleep',metricSleep,'h'],['steps',metricSteps,'Schritte'],['bodyTemperature',metricTemp,'°C']];const entries:HealthMetricEntry[]=specs.flatMap(([kind,raw,unit])=>{const v=Number(raw.replace(',','.'));return raw.trim()&&Number.isFinite(v)?[{id:uid(`metric-${kind}`),createdAt:createdAt(),kind,value:v,unit,source:'manual' as const}]:[];});if(!entries.length){Alert.alert('Noch kein Messwert','Trage mindestens einen Wert ein.');return;}onSaveMetrics(entries);flash('Körperdaten gespeichert');setTimeout(onDone,180);};

  const TimeCard=()=> <View style={styles.infoStrip}><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Text style={{fontSize:18}}>◷</Text><View style={{flex:1}}><Text style={[styles.cardTitle,{fontSize:12}]}>Zeitpunkt</Text><Text style={styles.helper}>Wann war es wirklich?</Text></View><TextInput accessibilityLabel="Datum" value={entryDate} onChangeText={setEntryDate} style={[styles.input,{width:104,paddingVertical:8,fontSize:11}]} /><TextInput accessibilityLabel="Uhrzeit" value={entryTime} onChangeText={setEntryTime} style={[styles.input,{width:67,paddingVertical:8,fontSize:11}]} /></View></View>;
  return <><BarcodeScannerModal visible={scannerOpen} initialCode={scannedCode||undefined} onClose={()=>{setScannerOpen(false);setScannedCode('')}} onScanAgain={()=>{setScannerOpen(false);setTimeout(openBarcodeCamera,180)}} onAdd={food=>{setFoods(c=>[...c,enrichFoodGroups(food)]);flash('Produkt hinzugefügt')}}/>
  <FoodSearchModal visible={foodSearchOpen} onClose={()=>setFoodSearchOpen(false)} onAdd={food=>{setFoods(c=>[...c,enrichFoodGroups(food)]);setFoodSearchOpen(false);flash('Lebensmittel hinzugefügt')}} />
  <PhotoMealCaptureModal visible={photoOpen} config={aiConfig} onClose={()=>setPhotoOpen(false)} onConfirm={(photoFoods,nextMealType,uri)=>{setMealType(nextMealType);setFoods(photoFoods.map(enrichFoodGroups));setMealPhotoUri(uri);flash('Foto-Entwurf übernommen')}}/>
  <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.entryHeader}><View style={{flex:1}}><Text style={styles.entryHeaderKicker}>NEUER EINTRAG</Text><Text style={styles.entryHeaderTitle}>{mode==='Symptome'?'Wie geht es dir?':mode==='Auffälligkeit'?'Beobachtung':mode}</Text><Text style={styles.entryHeaderSub}>Wenig tippen, sauber dokumentieren.</Text></View><TouchableOpacity accessibilityLabel="Eintrag schließen" onPress={onDone} style={styles.entryClose}><Text style={styles.entryCloseText}>×</Text></TouchableOpacity></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.entryModeScroll}>{availableModes.map(x=><TouchableOpacity key={x} accessibilityRole="button" onPress={()=>{setMode(x);setMore(false)}} style={[styles.entryModeChip,mode===x&&styles.entryModeChipActive]}><Text style={[styles.entryModeChipText,mode===x&&styles.entryModeChipTextActive]}>{x==='Symptome'?'Gefühl':x==='Auffälligkeit'?'Beobachtung':x}</Text></TouchableOpacity>)}</ScrollView>
    <TimeCard/>{savedMessage?<View style={styles.savedBanner}><Text style={styles.savedBannerText}>✓ {savedMessage}</Text></View>:null}

    {mode==='Essen'&&<><Text style={styles.sectionTitle}>Was hast du gegessen?</Text><View style={styles.pillWrap}>{(['Frühstück','Mittagessen','Abendessen','Snack'] as MealType[]).map(x=><Pill key={x} label={x} active={mealType===x} onPress={()=>setMealType(x)}/>)}</View>
      <View style={{flexDirection:'row',gap:8}}><TouchableOpacity accessibilityLabel="Lebensmittel suchen" onPress={()=>setFoodSearchOpen(true)} style={[styles.secondaryButton,{flex:1}]}><Text style={styles.secondaryButtonText}>⌕ Suchen</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Barcode scannen" onPress={openBarcodeCamera} style={[styles.secondaryButton,{flex:1}]}><Text style={styles.secondaryButtonText}>{scannerBusy?'Scanner …':'▦ Barcode'}</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Mahlzeit fotografieren" onPress={()=>setPhotoOpen(true)} style={[styles.secondaryButton,{flex:1}]}><Text style={styles.secondaryButtonText}>📷 Foto</Text></TouchableOpacity></View>
      {!!store.savedDishes.length&&<View style={styles.recentFoodBlock}><Text style={styles.recentFoodLabel}>EIGENE GERICHTE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentFoodScroll}>{store.savedDishes.slice(0,8).map(d=><TouchableOpacity key={d.id} onPress={()=>useDish(d)} onLongPress={()=>Alert.alert('Gericht entfernen?',d.name,[{text:'Abbrechen',style:'cancel'},{text:'Entfernen',style:'destructive',onPress:()=>onRemoveDish(d.id)}])} style={styles.recentFoodChip}><Text style={styles.recentFoodChipText}>♡ {d.name}</Text></TouchableOpacity>)}</ScrollView></View>}
      {!!favoriteMeals.length&&<View style={styles.recentFoodBlock}><Text style={styles.recentFoodLabel}>FAVORITEN</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentFoodScroll}>{favoriteMeals.map(m=><TouchableOpacity key={m.id} onPress={()=>useMeal(m)} style={styles.recentFoodChip}><Text style={styles.recentFoodChipText}>★ {m.foods.map(x=>x.name).slice(0,2).join(', ')}</Text></TouchableOpacity>)}</ScrollView></View>}
      {!!recentMeals.length&&<View style={styles.recentFoodBlock}><Text style={styles.recentFoodLabel}>ZULETZT</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentFoodScroll}>{recentMeals.map(m=><TouchableOpacity key={m.id} onPress={()=>useMeal(m)} style={styles.recentFoodChip}><Text style={styles.recentFoodChipText}>↻ {m.foods.map(x=>x.name).slice(0,2).join(', ')}</Text></TouchableOpacity>)}</ScrollView></View>}
      <ShadowCard><Text style={[styles.cardTitle,{marginBottom:8}]}>Oder schnell manuell</Text><TextInput value={foodName} onChangeText={setFoodName} placeholder="Lebensmittel" placeholderTextColor="#98A19B" style={styles.input}/><TextInput value={foodAmount} onChangeText={setFoodAmount} placeholder="Menge, z. B. 150 g (optional)" placeholderTextColor="#98A19B" style={styles.input}/>{more?<TextInput value={foodKcal} onChangeText={setFoodKcal} placeholder="kcal optional" keyboardType="decimal-pad" style={styles.input}/>:null}<TouchableOpacity onPress={addFood} style={[styles.secondaryButton,!foodName.trim()&&styles.buttonDisabled]} disabled={!foodName.trim()}><Text style={styles.secondaryButtonText}>+ Hinzufügen</Text></TouchableOpacity></ShadowCard>
      {!!foods.length&&<ShadowCard><Text style={styles.cardTitle}>Mahlzeit</Text>{mealPhotoUri?<Image source={{uri:mealPhotoUri}} style={{height:120,borderRadius:14,marginTop:8}}/>:null}{foods.map((f,i)=><View key={f.id} style={[styles.foodRow,i<foods.length-1&&styles.rowBorder]}><View style={{flex:1}}><Text style={styles.foodName}>{f.name}</Text><Text style={styles.foodDetail}>{f.amount||'ohne Mengenangabe'}{f.brand?` · ${f.brand}`:''}</Text></View><TouchableOpacity accessibilityLabel={`${f.name} entfernen`} onPress={()=>setFoods(c=>c.filter(x=>x.id!==f.id))}><Text style={styles.removeText}>×</Text></TouchableOpacity></View>)}<TouchableOpacity onPress={saveCurrentDish} style={[styles.secondaryButton,{marginTop:8}]}><Text style={styles.secondaryButtonText}>Als eigenes Gericht merken</Text></TouchableOpacity></ShadowCard>}
      <TouchableOpacity onPress={()=>setMore(v=>!v)}><Text style={styles.link}>{more?'Weniger':'Mehr Angaben'}</Text></TouchableOpacity>{more?<TextInput value={mealNote} onChangeText={setMealNote} placeholder="Optionale Notiz" multiline style={styles.noteInput}/>:null}<TouchableOpacity style={styles.primaryButton} onPress={saveMeal}><Text style={styles.primaryButtonText}>Mahlzeit speichern</Text></TouchableOpacity></>}

    {mode==='Symptome'&&<><Text style={styles.helper}>Nur angeben, was du gerade wirklich bemerkst. Nicht erfasste Werte bleiben leer.</Text>{profile.symptomsToTrack.includes('pain')&&<SeverityPicker title="Bauchschmerzen" value={pain} onChange={setPain}/>} {profile.symptomsToTrack.includes('bloating')&&<SeverityPicker title="Blähungen" value={bloating} onChange={setBloating}/>} {profile.symptomsToTrack.includes('nausea')&&<SeverityPicker title="Übelkeit" value={nausea} onChange={setNausea}/>} {profile.symptomsToTrack.includes('heartburn')&&<SeverityPicker title="Sodbrennen" value={heartburn} onChange={setHeartburn}/>}<TouchableOpacity onPress={()=>setMore(v=>!v)}><Text style={styles.link}>{more?'Weniger':'Mehr: Energie, Stress, Temperatur'}</Text></TouchableOpacity>{more&&<>{profile.tracking.energy?<Counter title="Energie" value={energy} onChange={setEnergy} onClear={()=>setEnergy(undefined)}/>:null}{profile.tracking.stress?<Counter title="Stress" value={stress} onChange={setStress} onClear={()=>setStress(undefined)}/>:null}{profile.tracking.temperature?<TextInput value={temperature} onChangeText={setTemperature} placeholder="Temperatur nur wenn gemessen, z. B. 36,7 °C" keyboardType="decimal-pad" style={styles.input}/>:null}<TextInput value={symptomNote} onChangeText={setSymptomNote} placeholder="Optionale Notiz" multiline style={styles.noteInput}/></>}<TouchableOpacity style={styles.primaryButton} onPress={saveSymptoms}><Text style={styles.primaryButtonText}>Gefühl speichern</Text></TouchableOpacity></>}

    {mode==='Auffälligkeit'&&<><View style={styles.observationHero}><Text style={styles.observationHeroIcon}>!</Text><View style={{flex:1}}><Text style={styles.observationHeroTitle}>Was ist dir aufgefallen?</Text><Text style={styles.observationHeroText}>Ein Satz reicht. Kategorie und Stärke sind optional.</Text></View></View><TextInput value={observationText} onChangeText={setObservationText} placeholder="z. B. Nach dem Latte direkt aufgebläht …" multiline style={styles.observationInput}/><TouchableOpacity onPress={()=>setMore(v=>!v)}><Text style={styles.link}>{more?'Weniger':'Mehr Angaben'}</Text></TouchableOpacity>{more&&<><View style={styles.pillWrap}>{([['food','Essen'],['symptom','Beschwerde'],['cycle','Zyklus'],['body','Körper'],['general','Sonstiges']] as Array<[ObservationCategory,string]>).map(([v,l])=><Pill key={v} label={l} active={observationCategory===v} onPress={()=>setObservationCategory(v)} compact/>)}</View><SeverityPicker title="Wie auffällig?" value={observationSeverity} onChange={setObservationSeverity}/></>}<TouchableOpacity style={styles.primaryButton} onPress={saveObservation}><Text style={styles.primaryButtonText}>Beobachtung speichern</Text></TouchableOpacity></>}

    {mode==='Stuhlgang'&&<><Text style={styles.sectionTitle}>Welche Form passt am ehesten?</Text><View style={styles.bristolGrid}>{[1,2,3,4,5,6,7].map(t=><TouchableOpacity key={t} onPress={()=>setBristolType(t)} style={[styles.bristolCard,bristolType===t&&styles.bristolCardActive]}><Text style={[styles.bristolNumber,bristolType===t&&styles.bristolNumberActive]}>{['●●','●━','━','〰','● ●','≈','≋'][t-1]}</Text><Text style={[styles.bristolText,bristolType===t&&styles.bristolTextActive]}>Typ {t}</Text><Text style={[styles.bristolText,bristolType===t&&styles.bristolTextActive]}>{bristolLabel(t).split('·')[1]?.trim()}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={()=>setMore(v=>!v)}><Text style={styles.link}>{more?'Weniger':'Mehr: Dringlichkeit & Besonderheiten'}</Text></TouchableOpacity>{more&&<><Counter title="Dringlichkeit" value={urgency} onChange={setUrgency} onClear={()=>setUrgency(undefined)} max={3}/><View style={styles.switchRow}><Text style={styles.cardTitle}>Schleim beobachtet</Text><Switch value={mucus} onValueChange={setMucus}/></View><View style={styles.switchRow}><Text style={styles.cardTitle}>Blut beobachtet</Text><Switch value={blood} onValueChange={setBlood}/></View><SeverityPicker title="Schmerzen dabei" value={bowelPain} onChange={setBowelPain}/><TextInput value={bowelNote} onChangeText={setBowelNote} placeholder="Optionale Notiz" multiline style={styles.noteInput}/></>}<TouchableOpacity style={styles.primaryButton} onPress={saveBowel}><Text style={styles.primaryButtonText}>Stuhlgang speichern</Text></TouchableOpacity></>}

    {mode==='Zyklus'&&<><View style={styles.cycleHero}><Text style={styles.cycleHeroIcon}>◐</Text><View style={{flex:1}}><Text style={styles.cycleHeroKicker}>ZYKLUS</Text><Text style={styles.cycleHeroTitle}>Heute kurz festhalten</Text><Text style={styles.cycleHeroText}>Noura nutzt den Zyklus nur als möglichen Kontext.</Text></View></View><ShadowCard><View style={styles.switchRow}><View><Text style={styles.cardTitle}>Periode / Blutung heute</Text></View><Switch value={cycleBleeding} onValueChange={setCycleBleeding}/></View>{cycleBleeding?<View style={styles.pillWrap}>{(['spotting','light','medium','heavy'] as CycleFlow[]).map(f=><Pill key={f} label={f==='spotting'?'Spotting':f==='light'?'Leicht':f==='medium'?'Mittel':'Stark'} active={cycleFlow===f} onPress={()=>setCycleFlow(f)} compact/>)}</View>:null}</ShadowCard><TouchableOpacity onPress={()=>setMore(v=>!v)}><Text style={styles.link}>{more?'Weniger':'Mehr Symptome & Temperatur'}</Text></TouchableOpacity>{more&&<><SeverityPicker title="Krämpfe" value={cycleCramps} onChange={setCycleCramps}/><SeverityPicker title="Heißhunger" value={cycleCravings} onChange={setCycleCravings}/><SeverityPicker title="Kopfschmerzen" value={cycleHeadache} onChange={setCycleHeadache}/><SeverityPicker title="Brustspannen" value={cycleBreastTenderness} onChange={setCycleBreastTenderness}/><View style={styles.pillWrap}><Pill label="Stimmung niedrig" active={cycleMood==='low'} onPress={()=>setCycleMood('low')} compact/><Pill label="Neutral" active={cycleMood==='neutral'} onPress={()=>setCycleMood('neutral')} compact/><Pill label="Gut" active={cycleMood==='good'} onPress={()=>setCycleMood('good')} compact/></View><TextInput value={cycleBasalTemp} onChangeText={setCycleBasalTemp} placeholder="Basaltemperatur nur wenn gemessen" keyboardType="decimal-pad" style={styles.input}/><TextInput value={cycleNote} onChangeText={setCycleNote} placeholder="Optionale Notiz" multiline style={styles.noteInput}/></>}<TouchableOpacity style={styles.primaryButton} onPress={saveCycle}><Text style={styles.primaryButtonText}>Zyklus speichern</Text></TouchableOpacity></>}

    {mode==='Medikamente'&&<><View style={styles.observationHero}><Text style={styles.observationHeroIcon}>✚</Text><View style={{flex:1}}><Text style={styles.observationHeroTitle}>Medikament oder Supplement</Text><Text style={styles.observationHeroText}>Hilft Noura, mögliche Mitfaktoren nicht mit Essen zu verwechseln.</Text></View></View><View style={styles.pillWrap}><Pill label="Medikament" active={medKind==='medication'} onPress={()=>setMedKind('medication')}/><Pill label="Supplement" active={medKind==='supplement'} onPress={()=>setMedKind('supplement')}/></View><TextInput value={medName} onChangeText={setMedName} placeholder="Name, z. B. Magnesium" style={styles.input}/><TextInput value={medDose} onChangeText={setMedDose} placeholder="Dosis, z. B. 300 mg (optional)" style={styles.input}/><TextInput value={medNote} onChangeText={setMedNote} placeholder="Notiz (optional)" multiline style={styles.noteInput}/><TouchableOpacity style={styles.primaryButton} onPress={saveMedication}><Text style={styles.primaryButtonText}>Speichern</Text></TouchableOpacity></>}

    {mode==='Körperdaten'&&<><View style={styles.observationHero}><Text style={styles.observationHeroIcon}>♡</Text><View style={{flex:1}}><Text style={styles.observationHeroTitle}>Körperdaten</Text><Text style={styles.observationHeroText}>Nur Werte eintragen, die du wirklich gemessen hast.</Text></View></View>{profile.tracking.weight?<TextInput value={metricWeight} onChangeText={setMetricWeight} placeholder="Gewicht in kg" keyboardType="decimal-pad" style={styles.input}/>:null}{profile.tracking.water?<TextInput value={metricWater} onChangeText={setMetricWater} placeholder="Wasser in ml" keyboardType="number-pad" style={styles.input}/>:null}{profile.tracking.sleep?<TextInput value={metricSleep} onChangeText={setMetricSleep} placeholder="Schlaf in Stunden" keyboardType="decimal-pad" style={styles.input}/>:null}{profile.tracking.movement?<TextInput value={metricSteps} onChangeText={setMetricSteps} placeholder="Schritte" keyboardType="number-pad" style={styles.input}/>:null}{profile.tracking.temperature?<TextInput value={metricTemp} onChangeText={setMetricTemp} placeholder="Körpertemperatur in °C" keyboardType="decimal-pad" style={styles.input}/>:null}<TouchableOpacity style={styles.primaryButton} onPress={saveMetrics}><Text style={styles.primaryButtonText}>Körperdaten speichern</Text></TouchableOpacity></>}
  </ScrollView></>;
}
function AnalyseScreen({ store, profile, onOpenAI }: { store:HealthStore; profile:UserProfile; onOpenAI:()=>void }) {
  const [details,setDetails]=useState(false); const [windowKey,setWindowKey]=useState<'0-5'|'5-10'|'10-24'|'24-48'>('0-5');
  const window=windowKey==='0-5'?[0,5]:windowKey==='5-10'?[5,10]:windowKey==='10-24'?[10,24]:[24,48];
  const foodGroups=useMemo(()=>computeFoodGroupSignals(store,window[1],profile.cyclePreferences),[store,windowKey,profile.cyclePreferences]); const foods=useMemo(()=>computeFoodSignalsWindow(store,window[0],window[1],profile.cyclePreferences),[store,windowKey,profile.cyclePreferences]); const cycles=useMemo(()=>computeCycleSymptomSignals(store,profile.cyclePreferences),[store,profile.cyclePreferences]); const combos=useMemo(()=>computeFoodCycleSignals(store,8,profile.cyclePreferences),[store,profile.cyclePreferences]);
  const top=foodGroups[0]||foods[0]; const topCycle=cycles.find(x=>x.delta>0.3); const recordCount=store.meals.length+store.symptoms.length+store.bowel.length+store.cycle.length+store.observations.length+store.medications.length+store.healthMetrics.length; const quality=getOverallDataQuality(store);
  return <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}><View style={styles.analysisHeader}><Text style={styles.analysisPageTitle}>Insights</Text><Text style={styles.analysisPageSub}>Erst die verständliche Aussage. Zahlen nur, wenn du sie sehen möchtest.</Text></View>
    <TouchableOpacity style={styles.analysisAIHero} onPress={onOpenAI}><View style={styles.analysisAIIcon}><Text style={styles.analysisAIIconText}>✦</Text></View><View style={{flex:1}}><Text style={styles.analysisAIKicker}>NOURA KI</Text><Text style={styles.analysisAITitle}>Deine wichtigsten Muster erklären</Text><Text style={styles.analysisAICopy}>Kurzfassung, Datenlage und nächster sinnvoller Schritt.</Text></View><Text style={styles.quickAIHomeChevron}>›</Text></TouchableOpacity>
    <View style={styles.insightCard}><Text style={styles.insightCardTitle}>Essen & Beschwerden</Text>{top?<><Text style={[styles.simpleFindingTitle,{marginTop:12}]}>{top.food} fällt momentan häufiger auf</Text><Text style={styles.simpleFindingText}>{top.friendly||`${top.food} war wiederholt zeitnah vor stärkeren Beschwerden dabei.`}</Text><View style={[styles.cleanAIBadge,top.confidence==='höher'?styles.aiConfidenceHigher:top.confidence==='mittel'?styles.aiConfidenceMedium:styles.aiConfidenceLow]}><Text style={styles.cleanAIBadgeText}>Datenlage: {top.confidence}</Text></View></>:<View style={styles.insightEmpty}><Text style={styles.insightEmptyText}>Noch keine belastbare Essens-Auffälligkeit. Das ist völlig normal – wenige gute Einträge sind hilfreicher als viele ungenaue.</Text></View>}
      <View style={[styles.windowSegment,{marginTop:14}]}>{(['0-5','5-10','10-24','24-48'] as const).map(k=><TouchableOpacity key={k} onPress={()=>setWindowKey(k)} style={[styles.windowButton,windowKey===k&&styles.windowButtonActive]}><Text style={[styles.windowButtonText,windowKey===k&&styles.windowButtonTextActive]}>{k}h</Text></TouchableOpacity>)}</View>
    </View>
    {profile.tracking.cycle?<View style={styles.insightCard}><Text style={styles.insightCardTitle}>Zyklus als Kontext</Text>{topCycle?<><Text style={[styles.simpleFindingTitle,{marginTop:12}]}>{topCycle.phase} ist bisher auffälliger</Text><Text style={styles.simpleFindingText}>Deine dokumentierten Beschwerden waren in dieser Phase häufiger stärker als in deinem persönlichen Durchschnitt.</Text></>:<Text style={[styles.simpleFindingText,{marginTop:12}]}>Noch kein stabiles Zyklusmuster. Noura berücksichtigt deine persönliche Zykluslänge und dokumentierte Blutungen.</Text>}{combos[0]?<View style={styles.profileInlineWarning}><Text style={styles.profileInlineWarningText}>{combos[0].food} fällt in der {combos[0].phase} gemeinsam mit Beschwerden auf. Das beweist keine Ursache.</Text></View>:null}</View>:null}
    {store.healthMetrics.length?<View style={styles.insightCard}><Text style={styles.insightCardTitle}>Apple Health</Text><Text style={[styles.simpleFindingText,{marginTop:10}]}>{store.healthMetrics.length} importierte Gesundheitswerte können als Kontext in deine Auswertung einfließen – z. B. Schlaf, Gewicht, Schritte, Ruhepuls und Temperatur.</Text></View>:null}
    <TouchableOpacity style={styles.detailsToggle} onPress={()=>setDetails(v=>!v)}><Text style={styles.detailsToggleText}>{details?'Technische Details ausblenden':'Zahlen & Datengrundlage anzeigen'}</Text><Text style={styles.detailsToggleChevron}>{details?'⌃':'⌄'}</Text></TouchableOpacity>
    {details?<View style={styles.aiDetailsWrap}><View style={styles.aiDetailCard}><Text style={styles.aiDetailTitle}>Datengrundlage</Text><Text style={styles.aiDetailText}>{getTrackingDays(store)} Tracking-Tage · {recordCount} Einträge · Gesamt-Datenlage: {quality.label}.</Text>{top?<><Text style={styles.aiDetailText}>{top.food}: {top.symptomMatches}/{top.occurrences} passende Symptom-Check-ins · {top.counterExamples} Gegenbeispiele · {top.controlSamples} Vergleichs-Check-ins ohne diese Exposition.</Text><Text style={styles.aiDetailText}>Signalabweichung {top.delta.toFixed(1)} · Datenqualität {top.dataQuality}{top.confounders?.length?` · mögliche Mitfaktoren: ${top.confounders.join(', ')}`:''}.</Text></>:null}</View></View>:null}
    <Text style={styles.disclaimer}>Noura zeigt zeitliche Muster in deinen eigenen Daten. Das ist keine Diagnose und beweist keine Unverträglichkeit.</Text>
  </ScrollView>;
}

function AIScreen({ config, store, profile, consent, scope, initialResult, onConsentChange, onScopeChange, onOpenSettings, onInsight }: {
  config: AIConfig | null;
  store: HealthStore;
  profile: UserProfile;
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
  const [feedback, setFeedback] = useState<'helpful'|'not-helpful'|undefined>();
  const trackingDays = useMemo(() => getTrackingDays(store), [store]);
  const signalCount = useMemo(() => computeFoodSignals(store).length + computeCycleSymptomSignals(store).filter(x => x.delta > 0.3).length, [store]);
  const recordCount = store.meals.length + store.symptoms.length + store.bowel.length + store.cycle.length + store.observations.length + store.healthMetrics.length;
  const transmission = useMemo(() => getAITransmissionSummary(store, scope, profile.cyclePreferences), [store, scope, profile.cyclePreferences]);
  const safetyAlerts = useMemo(() => getMedicalSafetyAlerts(store), [store]);

  useEffect(() => { if (initialResult) setResult(initialResult); }, [initialResult]);
  useEffect(() => { if (!result) { setFeedback(undefined); return; } const key=insightFeedbackKey(result.headline,result.details); loadInsightFeedback(key).then(setFeedback).catch(()=>setFeedback(undefined)); }, [result]);

  const runAI = async () => {
    if (!config) return;
    setLoading(true);
    setError('');
    setShowDetails(false);
    try {
      const insight = await generateHealthInsight(config, store, scope, profile.cyclePreferences);
      setResult(insight);
      setFeedback(undefined);
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


          {safetyAlerts.length ? <View style={styles.aiSafetyCard}><Text style={styles.aiSafetyIcon}>!</Text><View style={{flex:1}}><Text style={styles.aiSafetyTitle}>{safetyAlerts[0].title}</Text><Text style={styles.aiSafetyText}>{safetyAlerts[0].message} {safetyAlerts[0].action}</Text></View></View> : null}

          {consent && config ? <View style={styles.aiTransmissionCard}><Text style={styles.aiTransmissionTitle}>Vor dem Senden</Text><Text style={styles.aiTransmissionText}>{PROVIDER_META[config.provider].label} · {config.model}</Text><Text style={styles.aiTransmissionText}>{scope==='summary'?'Nur Zusammenfassung':'Begrenzte Detail-Timeline'} · ca. {transmission.approximateKilobytes} KB · {transmission.daysIncluded} Tage</Text><Text style={styles.aiTransmissionSmall}>{transmission.categories.join(' · ')}</Text><Text style={styles.aiTransmissionSmall}>≈ {Math.max(1,Math.round(transmission.approximateKilobytes*256)).toLocaleString('de-DE')} Text-Tokens als grobe Obergrenze · mögliche API-Kosten richten sich nach deinem Anbieter/Modell.</Text></View> : null}

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

          <View style={{backgroundColor:'#FFF',borderWidth:1,borderColor:colors.line,borderRadius:18,padding:13,gap:9}}><Text style={styles.cardTitle}>War dieser Hinweis hilfreich?</Text><View style={{flexDirection:'row',gap:8}}><TouchableOpacity accessibilityRole="button" onPress={()=>{const key=insightFeedbackKey(result.headline,result.details);saveInsightFeedback(key,'helpful').then(()=>setFeedback('helpful')).catch(()=>undefined)}} style={[styles.secondaryButton,{flex:1},feedback==='helpful'&&{backgroundColor:colors.greenSoft,borderColor:'#AED3B6'}]}><Text style={styles.secondaryButtonText}>✓ Hilfreich</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={()=>{const key=insightFeedbackKey(result.headline,result.details);saveInsightFeedback(key,'not-helpful').then(()=>setFeedback('not-helpful')).catch(()=>undefined)}} style={[styles.secondaryButton,{flex:1},feedback==='not-helpful'&&{backgroundColor:colors.orangeSoft,borderColor:'#EDC49A'}]}><Text style={styles.secondaryButtonText}>Trifft nicht zu</Text></TouchableOpacity></View>{feedback?<Text style={styles.helper}>Danke. Das Feedback bleibt lokal und hilft Noura, Hinweise künftig besser einzuordnen.</Text>:null}</View>

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

function ProfileScreen({ config, store, profile, preferences, aiConsent, onOpenSettings, onOpenProfileSettings, onPickProfileImage, onRemoveProfileImage, onToggleBackup, onToggleDailyAI, onToggleAppLock, onBackupNow, onBackupShare, onBackupRestore, onRunAINow, onImportAppleHealth, onSyncAppleHealth, onToggleCloudSync, onCloudSyncNow, onExportData, onImportData, onShowAIUsage, onShowShortcutHelp, onUpdatePreferences, onCreateReport, onClearDiary, onClearAI, onClearEverything }: {
  config:AIConfig|null; store:HealthStore; profile:UserProfile; preferences:AppPreferences; aiConsent:boolean;
  onOpenSettings:()=>void; onOpenProfileSettings:()=>void; onPickProfileImage:()=>void; onRemoveProfileImage:()=>void; onToggleBackup:(v:boolean)=>void; onToggleDailyAI:(v:boolean)=>void; onToggleAppLock:(v:boolean)=>void; onBackupNow:()=>void; onBackupShare:()=>void; onBackupRestore:()=>void; onRunAINow:()=>void; onImportAppleHealth:()=>void; onSyncAppleHealth:()=>void; onToggleCloudSync:(v:boolean)=>void; onCloudSyncNow:()=>void; onExportData:()=>void; onImportData:()=>void; onShowAIUsage:()=>void; onShowShortcutHelp:()=>void; onUpdatePreferences:(patch:Partial<AppPreferences>)=>void; onCreateReport:()=>void; onClearDiary:()=>void; onClearAI:()=>void; onClearEverything:()=>void;
}) {
  const backupLabel=preferences.lastBackupAt?`Zuletzt ${new Date(preferences.lastBackupAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Noch kein Backup erstellt';
  const dailyLabel=preferences.lastBackgroundAIAt?`Letzte automatische Analyse ${new Date(preferences.lastBackgroundAIAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Noch keine automatische Analyse';
  const healthLabel=preferences.appleHealthLastImportAt?`${preferences.appleHealthImportedRecords||0} Werte · zuletzt ${new Date(preferences.appleHealthLastImportAt).toLocaleDateString('de-DE')}`:'Noch nichts importiert';
  const directHealthLabel=preferences.lastDirectHealthSyncAt?`Zuletzt ${new Date(preferences.lastDirectHealthSyncAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Noch nicht direkt synchronisiert';
  const cloudLabel=preferences.lastCloudSyncAt?`Zuletzt ${new Date(preferences.lastCloudSyncAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Noch nicht synchronisiert';
  return <ScrollView contentContainerStyle={styles.profilePageContent} showsVerticalScrollIndicator={false}><View style={styles.profileTopBar}><View><Text style={styles.profilePageTitle}>Profil</Text><Text style={styles.profilePageSub}>Deine App, deine Daten, deine Einstellungen.</Text></View></View>
    <View style={styles.profileHero}><ProfileAvatar profile={profile} size={76}/><View style={{flex:1}}><Text style={styles.profileHeroName}>{profile.displayName||'Dein Profil'}</Text><Text style={styles.profileHeroSub}>{profile.profileImageUri?'Profilbild aktiv':`Initialen: ${getInitials(profile.displayName)}`}</Text><View style={styles.profilePhotoActions}><TouchableOpacity accessibilityRole="button" onPress={onPickProfileImage}><Text style={styles.profilePhotoLink}>{profile.profileImageUri?'Bild ändern':'Profilbild wählen'}</Text></TouchableOpacity>{profile.profileImageUri?<TouchableOpacity accessibilityRole="button" onPress={onRemoveProfileImage}><Text style={styles.profilePhotoRemove}>Entfernen</Text></TouchableOpacity>:null}</View></View></View>

    <Text style={styles.profileSectionLabel}>PERSÖNLICH & TRACKING</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="◉" title="Persönliche Einstellungen" detail="Name, Ziele, Tracking-Bereiche, Beschwerden & Zyklus" onPress={onOpenProfileSettings}/></View>

    <Text style={styles.profileSectionLabel}>NOURA KI</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="✦" title="Anbieter & Modell" detail={config?`${PROVIDER_META[config.provider].label} · ${config.model}`:'Noch keine eigene KI verbunden'} onPress={onOpenSettings}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="◎" title="KI-Datennutzung" detail="Welche Analysen liefen, mit welchem Modell und welchem Datenumfang" onPress={onShowAIUsage}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↻" title="Automatisch regelmäßig analysieren" detail={`${dailyLabel}. Nur wenn neue Daten vorliegen.`} right={<Switch value={preferences.dailyAIEnabled} onValueChange={onToggleDailyAI} trackColor={{true:'#C6B4D8'}} thumbColor={preferences.dailyAIEnabled?colors.purple:undefined}/>}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="▶" title="Jetzt aktualisieren" detail="Analysiert die neuesten Einträge sofort" onPress={onRunAINow}/>{preferences.dailyAIEnabled&&(!config||!aiConsent)?<View style={styles.profileInlineWarning}><Text style={styles.profileInlineWarningText}>Für automatische Analysen brauchst du eine verbundene KI und Datenfreigabe.</Text></View>:null}</View>

    <Text style={styles.profileSectionLabel}>APPLE HEALTH</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="♥" title="Direkt mit Apple Health synchronisieren" detail={`${directHealthLabel}. ${isDirectHealthKitModulePresent()?'Modul im Build vorhanden.':'In diesem Build nicht enthalten.'}`} onPress={onSyncAppleHealth}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="♡" title="Health-Export importieren" detail={`${healthLabel}. Funktioniert auch mit deinem kostenlosen Sideload-Build.`} onPress={onImportAppleHealth}/><View style={styles.profileInlineWarning}><Text style={styles.profileInlineWarningText}>Noura liest nur die von dir ausgewählten bzw. freigegebenen Daten. Direkter HealthKit-Zugriff funktioniert nur, wenn die App-Signierung die HealthKit-Capability enthält.</Text></View></View>

    <Text style={styles.profileSectionLabel}>ERINNERUNGEN</Text><View style={styles.profileSettingsCard}>
      <ProfileSettingRow icon="☾" title="Abend-Check-in" detail="Lokale Erinnerung auf dem iPhone." right={<Switch value={preferences.eveningReminderEnabled} onValueChange={v=>onUpdatePreferences({eveningReminderEnabled:v})} trackColor={{true:'#B8DCC1'}}/>}/>
      {preferences.eveningReminderEnabled?<View style={{paddingHorizontal:14,paddingBottom:12}}><Text style={styles.helper}>Uhrzeit</Text><TextInput accessibilityLabel="Uhrzeit Abend-Check-in" value={preferences.eveningReminderTime} onChangeText={v=>onUpdatePreferences({eveningReminderTime:v})} placeholder="20:30" style={[styles.input,{marginTop:5}]}/></View>:null}
      <View style={styles.profileSettingDivider}/><ProfileSettingRow icon="◷" title="Nach Mahlzeiten nachfragen" detail={`Optionaler Check-in ${preferences.mealFollowupHours} Std. nach einer gespeicherten Mahlzeit.`} right={<Switch value={preferences.mealFollowupEnabled} onValueChange={v=>onUpdatePreferences({mealFollowupEnabled:v})} trackColor={{true:'#B8DCC1'}}/>}/>
      {preferences.mealFollowupEnabled?<View style={{paddingHorizontal:14,paddingBottom:12}}><Text style={styles.helper}>Stunden danach (1–8)</Text><TextInput accessibilityLabel="Stunden bis Mahlzeiten-Check-in" value={String(preferences.mealFollowupHours)} onChangeText={v=>onUpdatePreferences({mealFollowupHours:Math.max(1,Math.min(8,Number(v)||3))})} keyboardType="number-pad" style={[styles.input,{marginTop:5}]}/></View>:null}
      {profile.tracking.cycle?<><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="◐" title="Zyklus-Check-in" detail="Tägliche lokale Erinnerung, wenn du Zyklus trackst." right={<Switch value={preferences.cycleReminderEnabled} onValueChange={v=>onUpdatePreferences({cycleReminderEnabled:v})} trackColor={{true:'#C6B4D8'}}/>}/>{preferences.cycleReminderEnabled?<View style={{paddingHorizontal:14,paddingBottom:12}}><Text style={styles.helper}>Uhrzeit</Text><TextInput accessibilityLabel="Uhrzeit Zyklus-Check-in" value={preferences.cycleReminderTime} onChangeText={v=>onUpdatePreferences({cycleReminderTime:v})} placeholder="19:00" style={[styles.input,{marginTop:5}]}/></View>:null}</>:null}
      <View style={styles.profileSettingDivider}/><ProfileSettingRow icon="▦" title="Wochenrückblick" detail="Zeigt auf der Startseite eine kurze Zusammenfassung der letzten 7 Tage." right={<Switch value={preferences.weeklyReviewEnabled} onValueChange={v=>onUpdatePreferences({weeklyReviewEnabled:v})} trackColor={{true:'#B8DCC1'}}/>}/>
    </View>

    <Text style={styles.profileSectionLabel}>BERICHT & DATENEXPORT</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="▤" title="Gesundheitsbericht erstellen" detail="Letzte 6 Wochen als übersichtliches PDF – z. B. für einen Arzttermin." onPress={onCreateReport}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↗" title="Alle Daten exportieren" detail="ZIP mit JSON und CSV-Dateien. API-Keys sind nicht enthalten." onPress={onExportData}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↙" title="Datenexport importieren" detail="Importiert einen zuvor erzeugten Noura-Export." onPress={onImportData}/></View>

    <Text style={styles.profileSectionLabel}>KURZBEFEHLE</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="⌘" title="Siri & Kurzbefehle" detail="Noura erzählen, Mahlzeit oder Beschwerden direkt über einen Noura-Link öffnen." onPress={onShowShortcutHelp}/></View>

    <Text style={styles.profileSectionLabel}>DATENSCHUTZ & SICHERHEIT</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="⌁" title="Face ID / App-Sperre" detail="Schützt Noura beim erneuten Öffnen und verdeckt Inhalte im App-Umschalter." right={<Switch value={preferences.appLockEnabled} onValueChange={onToggleAppLock} trackColor={{true:'#B8DCC1'}} thumbColor={preferences.appLockEnabled?colors.green:undefined}/>}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="▣" title="Lokale Gesundheitsdaten" detail="Tagebuchdaten werden AES-GCM-verschlüsselt auf dem Gerät gespeichert."/></View>

    <Text style={styles.profileSectionLabel}>BACKUP & ICLOUD</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="☁" title="Backup-Datei automatisch aktualisieren" detail={`${backupLabel}. Für iOS-Gerätebackup geeignet.`} right={<Switch value={preferences.iCloudBackupEnabled} onValueChange={onToggleBackup} trackColor={{true:'#B8DCC1'}} thumbColor={preferences.iCloudBackupEnabled?colors.green:undefined}/>}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="⇄" title="iCloud Live-Sync" detail={`${cloudLabel}. ${isCloudKitModulePresent()?'CloudKit-Modul im Build vorhanden.':'In diesem Build nicht enthalten.'}`} right={<Switch value={preferences.iCloudSyncEnabled} onValueChange={onToggleCloudSync} trackColor={{true:'#B8DCC1'}} thumbColor={preferences.iCloudSyncEnabled?colors.green:undefined}/>}/>{preferences.iCloudSyncEnabled?<><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↻" title="Jetzt synchronisieren" detail="Führt lokale und iCloud-Daten zusammen und berücksichtigt Löschungen." onPress={onCloudSyncNow}/></>:null}<View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↓" title="Backup jetzt erstellen" detail="Tagebuch, Profilbild und Einstellungen – ohne API-Key" onPress={onBackupNow}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↗" title="Backup-Datei sichern / teilen" detail="Zum Beispiel in iCloud Drive oder Dateien" onPress={onBackupShare}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="↙" title="Backup wiederherstellen" detail="Wählt eine Noura-Backup-Datei aus" onPress={onBackupRestore}/></View>

    <View style={styles.profileStatsCompact}><View><Text style={styles.profileStatsValue}>{getTrackingDays(store)}</Text><Text style={styles.profileStatsLabel}>Tracking-Tage</Text></View><View><Text style={styles.profileStatsValue}>{store.meals.length}</Text><Text style={styles.profileStatsLabel}>Mahlzeiten</Text></View><View><Text style={styles.profileStatsValue}>{store.healthMetrics.length}</Text><Text style={styles.profileStatsLabel}>Health-Werte</Text></View></View>

    <Text style={styles.profileSectionLabel}>DATEN LÖSCHEN</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon="×" title="Nur Tagebuch löschen" detail="Profil und KI-Verbindung bleiben erhalten" onPress={()=>Alert.alert('Tagebuch löschen?','Alle Einträge werden lokal entfernt.',[{text:'Abbrechen',style:'cancel'},{text:'Löschen',style:'destructive',onPress:onClearDiary}])}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="✦" title="Nur KI-Verbindung löschen" detail="Entfernt API-Key, Anbieter, Modell, KI-Ergebnisse und Nutzungsprotokoll" onPress={()=>Alert.alert('KI-Verbindung löschen?','Dein Tagebuch bleibt erhalten.',[{text:'Abbrechen',style:'cancel'},{text:'Löschen',style:'destructive',onPress:onClearAI}])}/><View style={styles.profileSettingDivider}/><ProfileSettingRow icon="!" title="Alle Noura-Daten löschen" detail="Tagebuch, Profil, Einstellungen und KI-Verbindung" onPress={()=>Alert.alert('Wirklich alles löschen?','Dieser Vorgang kann nicht rückgängig gemacht werden.',[{text:'Abbrechen',style:'cancel'},{text:'Alles löschen',style:'destructive',onPress:onClearEverything}])}/></View>
    <Text style={styles.versionLabel}>Noura · Version 0.15</Text>
  </ScrollView>;
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
  const [modelView, setModelView] = useState<'recommended' | 'all'>('recommended');

  useEffect(() => {
    if (!visible) return;
    const nextProvider = config?.provider || 'openai';
    setProvider(nextProvider);
    setApiKey(config?.apiKey || '');
    setModel(config?.model || PROVIDER_META[nextProvider].defaultModel);
    setBaseUrl(config?.baseUrl ?? PROVIDER_META[nextProvider].defaultBaseUrl ?? '');
    setModelOptions(FALLBACK_MODEL_OPTIONS[nextProvider]);
    setModelSource('fallback');
    setModelView('recommended');
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
  const visibleModelOptions = modelView === 'recommended' ? modelOptions.filter(item => item.recommended).length ? modelOptions.filter(item => item.recommended) : modelOptions.slice(0, 6) : modelOptions;
  const modelSelectOptions: SelectOption[] = visibleModelOptions.map(item => ({
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
            <View style={styles.windowSegment}><TouchableOpacity onPress={() => setModelView('recommended')} style={[styles.windowButton, modelView === 'recommended' && styles.windowButtonActive]}><Text style={[styles.windowButtonText, modelView === 'recommended' && styles.windowButtonTextActive]}>Empfohlen</Text></TouchableOpacity><TouchableOpacity onPress={() => setModelView('all')} style={[styles.windowButton, modelView === 'all' && styles.windowButtonActive]}><Text style={[styles.windowButtonText, modelView === 'all' && styles.windowButtonTextActive]}>Alle Modelle</Text></TouchableOpacity></View>

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
          subtitle={modelView === 'recommended' ? 'Empfohlene Modelle für Noura. Unter „Alle Modelle“ findest du die vollständige Liste.' : (modelSource === 'live' ? `Alle aktuell für deinen ${PROVIDER_META[provider].label}-Zugang gemeldeten Modelle.` : 'Vorauswahl. Mit API-Key lädt Noura die vollständige Live-Liste.')}
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

function NouraApp() {
  const [tab,setTab]=useState<Tab>('Home');
  const [store,setStore]=useState<HealthStore>(emptyHealthStore());
  const [userProfile,setUserProfile]=useState<UserProfile>(createDefaultUserProfile());
  const [hydrated,setHydrated]=useState(false);
  const [aiConfig,setAIConfig]=useState<AIConfig|null>(null); const [aiConsent,setAIConsentState]=useState(false); const [aiScope,setAIScopeState]=useState<AIDataScope>('summary'); const [aiSettingsOpen,setAISettingsOpen]=useState(false); const [profileSettingsOpen,setProfileSettingsOpen]=useState(false); const [aiInsight,setAIInsight]=useState(''); const [latestAIResult,setLatestAIResult]=useState<AIHealthInsight|null>(null);
  const [addSheetOpen,setAddSheetOpen]=useState(false); const [quickAIOpen,setQuickAIOpen]=useState(false); const [trackingMode,setTrackingMode]=useState<TrackingMode>('Essen'); const [preferences,setPreferences]=useState<AppPreferences>(defaultAppPreferences());
  const [editTarget,setEditTarget]=useState<{kind:Exclude<EntryKind,'metric'>;entry:any}|null>(null);
  const [undoSnapshot,setUndoSnapshot]=useState<{store:HealthStore;label:string}|null>(null); const undoTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [privacyCover,setPrivacyCover]=useState(false); const [locked,setLocked]=useState(false); const appStateRef=useRef(AppState.currentState); const cloudTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const authenticate=async()=>{try{const available=await LocalAuthentication.hasHardwareAsync();const enrolled=await LocalAuthentication.isEnrolledAsync();if(!available||!enrolled){setLocked(false);Alert.alert('Face ID nicht verfügbar','Auf diesem iPhone ist aktuell keine biometrische Entsperrung eingerichtet.');return false;}const result=await LocalAuthentication.authenticateAsync({promptMessage:'Noura entsperren',cancelLabel:'Abbrechen',fallbackLabel:'Code verwenden'});setLocked(!result.success);setPrivacyCover(!result.success);return result.success;}catch{setLocked(true);return false;}};

  useEffect(()=>{Promise.all([loadHealthStore(),loadAIConfig(),loadAIConsent(),loadAIDataScope(),loadUserProfile(),loadAppPreferences(),loadLatestAIInsight()]).then(([health,config,consent,scope,profile,prefs,latest])=>{setStore(health);setAIConfig(config);setAIConsentState(consent);setAIScopeState(scope);setUserProfile(profile);setPreferences(prefs);if(latest?.insight){setLatestAIResult(latest.insight);setAIInsight(`${latest.insight.headline}: ${latest.insight.summary}`);}syncDailyAIRegistration().catch(()=>undefined);syncRecurringReminders(prefs,profile.tracking.cycle).catch(()=>undefined);if(prefs.appLockEnabled){setLocked(true);setTimeout(()=>authenticate(),350);}}).finally(()=>setHydrated(true));},[]);

  useEffect(()=>{
    const openReminderRoute=(route:'symptoms'|'cycle')=>{setAddSheetOpen(false);setTrackingMode(route==='cycle'?'Zyklus':'Symptome');setTab('Tracking');};
    const sub=addReminderResponseListener(openReminderRoute);
    getLastReminderRoute().then(route=>{if(route)setTimeout(()=>openReminderRoute(route),450);}).catch(()=>undefined);
    return()=>sub.remove();
  },[]);

  useEffect(()=>{
    const openLink=(url?:string|null)=>{if(!url)return;const action=parseNouraLink(url);if(!action)return;setAddSheetOpen(false);if(action==='tell'){setQuickAIOpen(true);return;}const map:Record<string,TrackingMode>={meal:'Essen',symptoms:'Symptome',bowel:'Stuhlgang',cycle:'Zyklus'};setTrackingMode(map[action]||'Essen');setTab('Tracking');};
    const sub=Linking.addEventListener('url',event=>openLink(event.url));
    Linking.getInitialURL().then(openLink).catch(()=>undefined);
    return()=>sub.remove();
  },[]);

  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{const previous=appStateRef.current;appStateRef.current=state;if(state!=='active'){setPrivacyCover(true);return;}loadLatestAIInsight().then(latest=>{if(latest?.insight){setLatestAIResult(latest.insight);setAIInsight(`${latest.insight.headline}: ${latest.insight.summary}`);}}).catch(()=>undefined);loadAppPreferences().then(async prefs=>{
    setPreferences(prefs);
    if(prefs.iCloudSyncEnabled){
      try{
        const [local,profile]=await Promise.all([loadHealthStore(),loadUserProfile()]);
        const remote=await pullCloudSnapshot();
        const merged=remote?mergeHealthStores(local,remote.healthStore):local;
        const mergedProfile=remote?.profile?.completed?{...remote.profile,profileImageUri:profile.profileImageUri||remote.profile.profileImageUri}:profile;
        setStore(merged);setUserProfile(mergedProfile);
        await Promise.all([saveHealthStore(merged),saveUserProfile(mergedProfile)]);
        const pushed=await pushCloudSnapshot(merged,mergedProfile,prefs);
        const stamped={...prefs,lastCloudSyncAt:pushed.updatedAt};setPreferences(stamped);await saveAppPreferences(stamped);
      }catch{/* Live sync must never block app opening. Manual sync shows errors. */}
    }
    if(prefs.appLockEnabled&&previous!=='active'){setLocked(true);await authenticate();}else setPrivacyCover(false);
  }).catch(()=>setPrivacyCover(false));});return()=>sub.remove();},[]);

  const persistPrefs=async(next:AppPreferences)=>{setPreferences(next);await saveAppPreferences(next);};
  const runBackup=async(nextStore=store,nextProfile=userProfile,prefs=preferences)=>{if(!prefs.iCloudBackupEnabled)return;await writeAutomaticBackup(nextStore,nextProfile,prefs);const stamped={...prefs,lastBackupAt:new Date().toISOString()};await persistPrefs(stamped);};
  const queueCloudPush=(nextStore:HealthStore,nextProfile=userProfile,prefs=preferences)=>{if(!prefs.iCloudSyncEnabled)return;if(cloudTimer.current)clearTimeout(cloudTimer.current);cloudTimer.current=setTimeout(()=>{pushCloudSnapshot(nextStore,nextProfile,prefs).then(async r=>{const latest=await loadAppPreferences();await persistPrefs({...latest,lastCloudSyncAt:r.updatedAt});}).catch(()=>undefined);},1800);};
  const commit=(next:HealthStore)=>{setStore(next);saveHealthStore(next).catch(()=>Alert.alert('Speichern fehlgeschlagen','Der Eintrag konnte nicht dauerhaft gespeichert werden.'));if(preferences.iCloudBackupEnabled)runBackup(next,userProfile,preferences).catch(()=>undefined);queueCloudPush(next,userProfile,preferences);};
  const changeConsent=(v:boolean)=>{setAIConsentState(v);saveAIConsent(v).catch(()=>undefined)}; const changeScope=(v:AIDataScope)=>{setAIScopeState(v);saveAIDataScope(v).catch(()=>undefined)};
  const completeSetup=(profile:UserProfile,connectAI:boolean)=>{setUserProfile(profile);saveUserProfile(profile).catch(()=>undefined);setTab('Home');if(connectAI)setAISettingsOpen(true);};
  const saveProfileSettings=async(profile:UserProfile)=>{setUserProfile(profile);setProfileSettingsOpen(false);await saveUserProfile(profile);await syncRecurringReminders(preferences,profile.tracking.cycle).catch(()=>undefined);if(preferences.iCloudBackupEnabled)runBackup(store,profile,preferences).catch(()=>undefined);queueCloudPush(store,profile,preferences);};
  const pickProfileImage=async()=>{try{const uri=await pickAndPersistProfileImage();if(!uri)return;await saveProfileSettings({...userProfile,profileImageUri:uri});}catch(e){Alert.alert('Profilbild nicht geändert',e instanceof Error?e.message:'Bild konnte nicht ausgewählt werden.')}};
  const removeProfileImage=async()=>{const next={...userProfile,profileImageUri:undefined};setUserProfile(next);await saveUserProfile(next);await removePersistedProfileImage();queueCloudPush(store,next,preferences);};
  const toggleBackup=async(enabled:boolean)=>{const next={...preferences,iCloudBackupEnabled:enabled};await persistPrefs(next);if(enabled){try{await runBackup(store,userProfile,next);}catch{Alert.alert('Backup fehlgeschlagen','Die Backup-Datei konnte nicht erstellt werden.')}}};
  const backupNow=async()=>{try{await writeAutomaticBackup(store,userProfile,preferences);await persistPrefs({...preferences,lastBackupAt:new Date().toISOString()});Alert.alert('Backup erstellt','Tagebuch, Profilbild und Einstellungen wurden gesichert. API-Keys sind nicht enthalten.');}catch(e){Alert.alert('Backup fehlgeschlagen',e instanceof Error?e.message:'Unbekannter Fehler')}};
  const backupShare=async()=>{try{await writeAutomaticBackup(store,userProfile,preferences);await shareAutomaticBackup();}catch(e){Alert.alert('Backup konnte nicht geteilt werden',e instanceof Error?e.message:'Unbekannter Fehler')}};
  const backupRestore=async()=>{try{const backup=await pickBackupFile();if(!backup)return;Alert.alert('Backup wiederherstellen?',`Backup vom ${new Date(backup.createdAt).toLocaleString('de-DE')} ersetzt den aktuellen lokalen Stand.`,[{text:'Abbrechen',style:'cancel'},{text:'Wiederherstellen',onPress:async()=>{const image=await restoreProfileImageFromBackup(backup);const profile={...backup.profile,profileImageUri:image||backup.profile.profileImageUri};const prefs={...preferences,...backup.preferences,schemaVersion:4 as const,lastBackupAt:new Date().toISOString()};const restoredStore:HealthStore={...emptyHealthStore(),...backup.healthStore,schemaVersion:6,medications:backup.healthStore.medications||[],healthMetrics:backup.healthStore.healthMetrics||[],savedDishes:backup.healthStore.savedDishes||[],deleted:(backup.healthStore as any).deleted||[]};setStore(restoredStore);setUserProfile(profile);setPreferences(prefs);await Promise.all([saveHealthStore(restoredStore),saveUserProfile(profile),saveAppPreferences(prefs)]);await syncDailyAIRegistration().catch(()=>undefined);Alert.alert('Wiederhergestellt','Dein Noura-Backup ist wieder aktiv.');}}]);}catch(e){Alert.alert('Wiederherstellung fehlgeschlagen',e instanceof Error?e.message:'Ungültige Backup-Datei')}};
  const toggleDailyAI=async(enabled:boolean)=>{const next=await configureDailyAI(enabled);setPreferences(next);if(enabled&&(!aiConfig||!aiConsent))Alert.alert('Noch nicht vollständig','Verbinde eine KI und erlaube die Datenanalyse, damit die automatische Analyse laufen kann.');};
  const runAINow=async()=>{try{const res=await runAIAnalysisNow(false,true);if(!res.ran){Alert.alert('Keine Analyse möglich',res.reason==='missing-prerequisite'?'Bitte KI verbinden, Datenfreigabe aktivieren und mindestens einen Eintrag anlegen.':'Keine neuen Daten.');return;}if(res.insight){setLatestAIResult(res.insight);setAIInsight(`${res.insight.headline}: ${res.insight.summary}`);setTab('KI');}}catch(e){Alert.alert('KI-Analyse fehlgeschlagen',e instanceof Error?e.message:'Unbekannter Fehler')}};
  const toggleAppLock=async(enabled:boolean)=>{if(enabled){const ok=await LocalAuthentication.hasHardwareAsync()&&await LocalAuthentication.isEnrolledAsync();if(!ok){Alert.alert('Face ID nicht eingerichtet','Richte Face ID bzw. Biometrie in iOS ein und versuche es erneut.');return;}}const next={...preferences,appLockEnabled:enabled};await persistPrefs(next);if(enabled)await authenticate();};
  const updatePreferences=async(patch:Partial<AppPreferences>)=>{const next={...preferences,...patch,schemaVersion:4 as const};await persistPrefs(next);try{await syncRecurringReminders(next,userProfile.tracking.cycle);}catch(e){Alert.alert('Erinnerung nicht aktiviert',e instanceof Error?e.message:'Mitteilungen konnten nicht eingerichtet werden.');}};
  const createReport=async()=>{try{await createAndShareHealthReport(store,userProfile,42);}catch(e){Alert.alert('Bericht konnte nicht erstellt werden',e instanceof Error?e.message:'Unbekannter Fehler');}};
  const performAppleHealthImport=async()=>{try{const result=await pickAndImportAppleHealth(180);if(!result)return;let next=addHealthMetrics(store,result.metrics);const existing=new Set(next.cycle.map(x=>x.id));next={...next,cycle:[...result.cycle.filter(x=>!existing.has(x.id)),...next.cycle].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};commit(next);const prefs={...preferences,appleHealthLastImportAt:new Date().toISOString(),appleHealthImportedRecords:result.metrics.length+result.cycle.length};await persistPrefs(prefs);Alert.alert('Apple Health importiert',`${result.metrics.length} Gesundheitswerte und ${result.cycle.length} Zyklus-Einträge wurden übernommen. Doppelte Werte werden beim nächsten Import übersprungen.`);}catch(e){Alert.alert('Apple-Health-Import fehlgeschlagen',e instanceof Error?e.message:'Die Exportdatei konnte nicht gelesen werden.')}};
  const importAppleHealth=async()=>{Alert.alert('Apple Health importieren','Öffne vorher auf dem iPhone: Health → Profilbild → Alle Gesundheitsdaten exportieren. Wähle danach hier die erzeugte export.zip aus. Noura liest daraus nur passende Werte der letzten 180 Tage.',[{text:'Abbrechen',style:'cancel'},{text:'Export auswählen',onPress:()=>performAppleHealthImport().catch(()=>undefined)}]);};

  const syncAppleHealth=async()=>{try{const result=await syncDirectAppleHealth(180);let next=addHealthMetrics(store,result.metrics);const existing=new Set(next.cycle.map(x=>x.id));next={...next,cycle:[...result.cycle.filter(x=>!existing.has(x.id)),...next.cycle].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};commit(next);await persistPrefs({...preferences,lastDirectHealthSyncAt:new Date().toISOString()});Alert.alert('Apple Health synchronisiert',`${result.metrics.length} Gesundheitswerte und ${result.cycle.length} Zyklus-Einträge wurden abgeglichen.`);}catch(e){Alert.alert('Direkter Apple-Health-Sync nicht verfügbar',e instanceof Error?e.message:'Dieser Build hat keinen direkten HealthKit-Zugriff. Nutze stattdessen den Health-Exportimport.');}};
  const syncCloud=async(showResult=true)=>{try{const remote=await pullCloudSnapshot();const merged=remote?mergeHealthStores(store,remote.healthStore):store;const remoteProfile=remote?.profile;const profile=remoteProfile?.completed?{...remoteProfile,profileImageUri:userProfile.profileImageUri||remoteProfile.profileImageUri}:userProfile;setStore(merged);setUserProfile(profile);await Promise.all([saveHealthStore(merged),saveUserProfile(profile)]);const pushed=await pushCloudSnapshot(merged,profile,preferences);await persistPrefs({...preferences,lastCloudSyncAt:pushed.updatedAt});if(showResult)Alert.alert('iCloud synchronisiert','Lokale und iCloud-Daten wurden zusammengeführt. Löschungen werden über Tombstones berücksichtigt.');}catch(e){if(showResult)Alert.alert('iCloud-Sync nicht verfügbar',e instanceof Error?e.message:'Dieser Build ist nicht für CloudKit signiert. Das lokale Backup funktioniert weiterhin.');throw e;}};
  useEffect(()=>{
    if(!hydrated || !preferences.iCloudSyncEnabled) return;
    const timer=setTimeout(()=>{syncCloud(false).catch(()=>undefined);},700);
    return()=>clearTimeout(timer);
  },[hydrated,preferences.iCloudSyncEnabled]);

  const toggleCloudSync=async(enabled:boolean)=>{if(!enabled){await persistPrefs({...preferences,iCloudSyncEnabled:false});return;}try{await pushCloudSnapshot(store,userProfile,{...preferences,iCloudSyncEnabled:true});const next={...preferences,iCloudSyncEnabled:true,lastCloudSyncAt:new Date().toISOString()};await persistPrefs(next);Alert.alert('iCloud Live-Sync aktiviert','Noura gleicht Änderungen künftig zusätzlich mit deiner privaten iCloud-Datenbank ab.');}catch(e){await persistPrefs({...preferences,iCloudSyncEnabled:false});Alert.alert('iCloud Live-Sync nicht aktiviert',e instanceof Error?e.message:'Deine aktuelle App-Signierung enthält die benötigte iCloud-Capability nicht.');}};
  const exportData=async()=>{try{await sharePortableExport(store,userProfile,preferences);}catch(e){Alert.alert('Export fehlgeschlagen',e instanceof Error?e.message:'Die Daten konnten nicht exportiert werden.');}};
  const importData=async()=>{try{const payload=await pickPortableExport();if(!payload)return;Alert.alert('Daten importieren?','Noura führt den Export mit deinen vorhandenen lokalen Einträgen zusammen. Vorhandene IDs werden anhand des neuesten Änderungszeitpunkts abgeglichen.',[{text:'Abbrechen',style:'cancel'},{text:'Zusammenführen',onPress:async()=>{const incoming={...emptyHealthStore(),...payload.store,schemaVersion:6 as const,deleted:(payload.store as any).deleted||[]};const merged=mergeHealthStores(store,incoming);const profile={...userProfile,...payload.profile,profileImageUri:userProfile.profileImageUri||payload.profile.profileImageUri};commit(merged);setUserProfile(profile);await saveUserProfile(profile);Alert.alert('Import abgeschlossen',`${merged.meals.length} Mahlzeiten und ${merged.symptoms.length} Körper-Check-ins sind jetzt im lokalen Tagebuch.`);}}]);}catch(e){Alert.alert('Import fehlgeschlagen',e instanceof Error?e.message:'Die Exportdatei konnte nicht gelesen werden.');}};
  const showAIUsage=async()=>{const usage=await loadAIUsage();if(!usage.length){Alert.alert('KI-Datennutzung','Noch keine KI-Anfragen protokolliert. API-Keys werden hier nie gespeichert.');return;}const lines=usage.slice(0,8).map(x=>`${new Date(x.createdAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${usagePurposeLabel(x.purpose)}\n${PROVIDER_META[x.provider]?.label||x.provider} · ${x.model}${x.scope?` · ${x.scope==='summary'?'Zusammenfassung':'Details'}`:''}${x.daysIncluded?` · ${x.daysIncluded} Tage`:''}${x.payloadCharacters?` · ca. ${Math.round(x.payloadCharacters/1024*10)/10}k Zeichen`:''}`).join('\n\n');Alert.alert('KI-Datennutzung',`${lines}\n\nEs werden nur Metadaten zur Anfrage protokolliert, nicht der API-Key.`,[{text:'Schließen'},{text:'Protokoll löschen',style:'destructive',onPress:()=>clearAIUsage().catch(()=>undefined)}]);};
  const showShortcutHelp=()=>{Alert.alert('Siri & Kurzbefehle','In Apples Kurzbefehle-App kannst du „URL öffnen“ verwenden. Unterstützte Noura-Links:\n\n• noura://tell – Noura erzählen\n• noura://meal – Mahlzeit\n• noura://symptoms – Beschwerden\n• noura://bowel – Stuhlgang\n• noura://cycle – Zyklus\n\nDanach kannst du dem Kurzbefehl einen Siri-Satz geben.');};

  const clearDiary=async()=>{
    const next=preferences.iCloudSyncEnabled?clearDiaryWithTombstones(store):emptyHealthStore();
    setStore(next);
    await saveHealthStore(next);
    queueCloudPush(next,userProfile,preferences);
    setAIInsight('');setLatestAIResult(null);await clearLatestAIInsight();
  };
  const clearAIOnly=async()=>{await clearAIUsage();await clearAIConfig();await saveAIConsent(false);await clearLatestAIInsight();setAIConfig(null);setAIConsentState(false);setLatestAIResult(null);setAIInsight('');};
  const clearEverything=async()=>{
    if(preferences.iCloudSyncEnabled){
      try{
        const cleared=clearDiaryWithTombstones(store);
        await pushCloudSnapshot(cleared,createDefaultUserProfile(),{...defaultAppPreferences(),iCloudSyncEnabled:false});
      }catch{/* Local deletion must still be possible if iCloud is offline. */}
    }
    await Promise.all([clearHealthStore(),clearHealthEncryptionKey(),clearAIConfig(),clearLatestAIInsight(),clearInsightFeedback(),clearAIUsage(),clearUserProfile(),clearAppPreferences(),removePersistedProfileImage(),saveAIConsent(false),saveAIDataScope('summary')]);
    setStore(emptyHealthStore());setUserProfile(createDefaultUserProfile());setAIConfig(null);setAIInsight('');setLatestAIResult(null);setPreferences(defaultAppPreferences());setAIConsentState(false);setAIScopeState('summary');await syncDailyAIRegistration().catch(()=>undefined);await syncRecurringReminders(defaultAppPreferences(),false).catch(()=>undefined);
  };

  const openManual=(mode:ManualEntryMode|TrackingMode)=>{setAddSheetOpen(false);setTrackingMode(mode as TrackingMode);setTab('Tracking')}; const openQuickAI=()=>{setAddSheetOpen(false);setQuickAIOpen(true)};
  const applyQuickDraft=(draft:AIQuickDraft)=>{let next=store;const now=new Date().toISOString();let mealLabel='';if(draft.meal?.foods?.length){mealLabel=draft.meal.foods.map(x=>x.name).slice(0,2).join(', ');next=addMeal(next,{id:uid('meal'),createdAt:now,mealType:draft.meal.mealType,foods:draft.meal.foods.map(food=>enrichFoodGroups({id:uid('food'),name:food.name,amount:food.amount,source:'ai' as const})),note:draft.meal.note});}if(draft.symptom)next=addSymptom(next,{id:uid('sym'),createdAt:now,...draft.symptom});if(draft.bowel)next=addBowel(next,{id:uid('bowel'),createdAt:now,...draft.bowel});if(draft.cycle&&userProfile.tracking.cycle)next=addCycle(next,{id:uid('cycle'),createdAt:now,...draft.cycle});if(draft.observation?.text.trim())next=addObservation(next,{id:uid('obs'),createdAt:now,...draft.observation,text:draft.observation.text.trim()});if(draft.medications?.length&&userProfile.tracking.medications){for(const m of draft.medications)next=addMedication(next,{id:uid('med'),createdAt:now,kind:m.kind,name:m.name,dose:m.dose,note:m.note});}commit(next);if(mealLabel)scheduleMealFollowup(preferences,mealLabel).catch(()=>undefined);setTab('Diary');};
  const openEntry=(item:TimelineItem)=>{if(item.kind==='metric')return;const entry=findEntry(store,item.kind,item.id);if(entry)setEditTarget({kind:item.kind,entry});};
  const saveEdited=(kind:Exclude<EntryKind,'metric'>,entry:any)=>{commit(updateEntry(store,kind,entry));setEditTarget(null);};
  const deleteEdited=(kind:Exclude<EntryKind,'metric'>,id:string)=>{if(undoTimer.current)clearTimeout(undoTimer.current);const before=store;commit(removeEntry(store,kind,id));setEditTarget(null);setUndoSnapshot({store:before,label:'Eintrag gelöscht'});undoTimer.current=setTimeout(()=>setUndoSnapshot(null),6000);};
  const undoDelete=()=>{if(!undoSnapshot)return;commit(undoSnapshot.store);setUndoSnapshot(null);if(undoTimer.current)clearTimeout(undoTimer.current);};
  const duplicateMeal=(meal:MealEntry)=>{const copy={...meal,id:uid('meal'),createdAt:new Date().toISOString(),favorite:false,foods:meal.foods.map(f=>({...f,id:uid('food')}))};commit(addMeal(store,copy));setEditTarget(null);setTab('Diary');};

  if(!hydrated)return <SafeAreaView style={[styles.safe,styles.loadingScreen]}><StatusBar barStyle="dark-content" backgroundColor={colors.bg}/><Image source={require('./assets/icon.png')} style={{width:82,height:82,borderRadius:20}}/><ActivityIndicator color={colors.purple}/></SafeAreaView>;
  if(!userProfile.completed)return <SetupWizard initialProfile={userProfile} editing={false} onComplete={completeSetup}/>;

  const saveMealWithFollowup=(e:MealEntry)=>{commit(addMeal(store,e));scheduleMealFollowup(preferences,e.foods.map(x=>x.name).slice(0,2).join(', ')).catch(()=>undefined);};
  const bodyDataEnabled=userProfile.tracking.weight||userProfile.tracking.water||userProfile.tracking.sleep||userProfile.tracking.movement||userProfile.tracking.temperature;
  const screen=tab==='Home'?<HomeScreen store={store} profile={userProfile} preferences={preferences} aiInsight={aiInsight} onAIQuick={openQuickAI} onAdd={openManual} onOpenInsights={()=>setTab('KI')} onDiary={()=>setTab('Diary')} onProfile={()=>setTab('Profil')}/>:tab==='Diary'?<DiaryScreen store={store} onOpenEntry={openEntry}/>:tab==='Tracking'?<TrackingScreen store={store} profile={userProfile} aiConfig={aiConfig} initialMode={trackingMode} onSaveMeal={saveMealWithFollowup} onSaveSymptom={e=>commit(addSymptom(store,e))} onSaveBowel={e=>commit(addBowel(store,e))} onSaveCycle={e=>commit(addCycle(store,e))} onSaveObservation={e=>commit(addObservation(store,e))} onSaveMedication={e=>commit(addMedication(store,e))} onSaveMetrics={entries=>commit(addHealthMetrics(store,entries))} onSaveDish={dish=>commit(saveDish(store,dish))} onRemoveDish={id=>commit(removeDish(store,id))} onDone={()=>setTab('Diary')}/>:tab==='Analyse'?<AnalyseScreen store={store} profile={userProfile} onOpenAI={()=>setTab('KI')}/>:tab==='KI'?<AIScreen config={aiConfig} store={store} profile={userProfile} consent={aiConsent} scope={aiScope} initialResult={latestAIResult} onConsentChange={changeConsent} onScopeChange={changeScope} onOpenSettings={()=>setAISettingsOpen(true)} onInsight={setAIInsight}/>:<ProfileScreen config={aiConfig} store={store} profile={userProfile} preferences={preferences} aiConsent={aiConsent} onOpenSettings={()=>setAISettingsOpen(true)} onOpenProfileSettings={()=>setProfileSettingsOpen(true)} onPickProfileImage={pickProfileImage} onRemoveProfileImage={removeProfileImage} onToggleBackup={v=>toggleBackup(v).catch(()=>undefined)} onToggleDailyAI={v=>toggleDailyAI(v).catch(()=>undefined)} onToggleAppLock={v=>toggleAppLock(v).catch(()=>undefined)} onBackupNow={()=>backupNow().catch(()=>undefined)} onBackupShare={()=>backupShare().catch(()=>undefined)} onBackupRestore={()=>backupRestore().catch(()=>undefined)} onRunAINow={()=>runAINow().catch(()=>undefined)} onImportAppleHealth={()=>importAppleHealth().catch(()=>undefined)} onSyncAppleHealth={()=>syncAppleHealth().catch(()=>undefined)} onToggleCloudSync={v=>toggleCloudSync(v).catch(()=>undefined)} onCloudSyncNow={()=>syncCloud(true).catch(()=>undefined)} onExportData={()=>exportData().catch(()=>undefined)} onImportData={()=>importData().catch(()=>undefined)} onShowAIUsage={()=>showAIUsage().catch(()=>undefined)} onShowShortcutHelp={showShortcutHelp} onUpdatePreferences={patch=>updatePreferences(patch).catch(()=>undefined)} onCreateReport={()=>createReport().catch(()=>undefined)} onClearDiary={()=>clearDiary().catch(()=>undefined)} onClearAI={()=>clearAIOnly().catch(()=>undefined)} onClearEverything={()=>clearEverything().catch(()=>undefined)}/>;
  const navItems:Array<{tab:Tab;icon:string;label:string}>=[{tab:'Home',icon:'▣',label:'Heute'},{tab:'Diary',icon:'≡',label:'Tagebuch'},{tab:'Analyse',icon:'▥',label:'Insights'},{tab:'Profil',icon:'☷',label:'Profil'}];
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={colors.bg}/><View style={styles.app}>{screen}</View>{tab!=='Tracking'?<View style={styles.bottomNavWrap}><View style={styles.bottomNav}>{navItems.slice(0,2).map(item=>{const active=tab===item.tab;return <TouchableOpacity key={item.tab} style={styles.bottomNavButton} onPress={()=>setTab(item.tab)}><View style={[styles.bottomNavIconBox,active&&styles.bottomNavIconBoxActive]}><Text style={[styles.bottomNavIcon,active&&styles.bottomNavIconActive]}>{item.icon}</Text></View><Text style={[styles.bottomNavLabel,active&&styles.bottomNavLabelActive]}>{item.label}</Text></TouchableOpacity>})}<View style={styles.bottomNavCenterSpace}/>{navItems.slice(2).map(item=>{const active=item.tab==='Analyse'?tab==='Analyse'||tab==='KI':tab===item.tab;return <TouchableOpacity key={item.tab} style={styles.bottomNavButton} onPress={()=>setTab(item.tab)}><View style={[styles.bottomNavIconBox,active&&styles.bottomNavIconBoxActive]}><Text style={[styles.bottomNavIcon,active&&styles.bottomNavIconActive]}>{item.icon}</Text></View><Text style={[styles.bottomNavLabel,active&&styles.bottomNavLabelActive]}>{item.label}</Text></TouchableOpacity>})}</View><TouchableOpacity style={styles.floatingAdd} onPress={()=>setAddSheetOpen(true)}><Text style={styles.floatingAddText}>＋</Text></TouchableOpacity></View>:null}
    <AddEntrySheet visible={addSheetOpen} cycleEnabled={userProfile.tracking.cycle} medicationsEnabled={userProfile.tracking.medications} bodyDataEnabled={bodyDataEnabled} onClose={()=>setAddSheetOpen(false)} onAI={openQuickAI} onManual={openManual}/>
    <AIQuickCaptureModal visible={quickAIOpen} config={aiConfig} onClose={()=>setQuickAIOpen(false)} onOpenAISettings={()=>{setQuickAIOpen(false);setAISettingsOpen(true)}} onConfirm={applyQuickDraft}/>
    <AISettingsModal visible={aiSettingsOpen} config={aiConfig} onClose={()=>setAISettingsOpen(false)} onSaved={setAIConfig}/>
    <ProfileSettingsModal visible={profileSettingsOpen} profile={userProfile} onClose={()=>setProfileSettingsOpen(false)} onSave={saveProfileSettings}/>
    <EntryEditorModal visible={!!editTarget} kind={editTarget?.kind} entry={editTarget?.entry} onClose={()=>setEditTarget(null)} onSave={saveEdited} onDelete={deleteEdited} onDuplicateMeal={duplicateMeal}/>
    {undoSnapshot?<View style={{position:'absolute',left:18,right:18,bottom:104,backgroundColor:'#2D2A31',borderRadius:16,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,zIndex:50}}><Text style={{color:'#FFF',flex:1,fontWeight:'700'}}>{undoSnapshot.label}</Text><TouchableOpacity onPress={undoDelete}><Text style={{color:'#D9C7EA',fontWeight:'900'}}>Rückgängig</Text></TouchableOpacity></View>:null}
    {(privacyCover||locked)?<View style={styles.privacyCover}><Image source={require('./assets/icon.png')} style={{width:76,height:76,borderRadius:20}}/><Text style={styles.privacyCoverTitle}>Noura ist geschützt</Text>{locked?<TouchableOpacity style={styles.primaryButton} onPress={authenticate}><Text style={styles.primaryButtonText}>Mit Face ID entsperren</Text></TouchableOpacity>:null}</View>:null}
  </SafeAreaView>;
}

class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}> {
  state:{error:Error|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error){console.error('Noura UI error',error);}
  render(){
    if(this.state.error){
      return <SafeAreaView style={{flex:1,backgroundColor:'#F7F7F9',alignItems:'center',justifyContent:'center',padding:28,gap:14}}>
        <Image source={require('./assets/icon.png')} style={{width:72,height:72,borderRadius:18}}/>
        <Text style={{fontSize:20,fontWeight:'900',color:'#242329',textAlign:'center'}}>Noura konnte diese Ansicht nicht laden</Text>
        <Text style={{fontSize:12,color:'#7F7B86',lineHeight:18,textAlign:'center'}}>Deine gespeicherten Daten bleiben erhalten. Versuche die Ansicht neu zu laden. Wenn der Fehler wiederkommt, notiere den letzten Schritt vor dem Fehler.</Text>
        <TouchableOpacity accessibilityRole="button" style={{backgroundColor:'#71558F',borderRadius:16,paddingHorizontal:18,paddingVertical:13}} onPress={()=>this.setState({error:null})}><Text style={{color:'#FFF',fontWeight:'900'}}>Erneut versuchen</Text></TouchableOpacity>
      </SafeAreaView>;
    }
    return this.props.children;
  }
}

export default function App(){ return <AppErrorBoundary><NouraApp/></AppErrorBoundary>; }

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
  safetyHomeCard: { flexDirection:'row', gap:11, backgroundColor:'#FFF1E8', borderRadius:20, padding:15, borderWidth:1, borderColor:'#F1C8A8', alignItems:'flex-start' },
  safetyHomeIcon: { width:28, height:28, borderRadius:14, backgroundColor:'#EFA870', color:'#6C3D18', textAlign:'center', lineHeight:28, fontWeight:'900' },
  safetyHomeTitle: { color:'#6C3D18', fontSize:13.5, fontWeight:'900' },
  safetyHomeText: { color:'#74543A', fontSize:11.2, lineHeight:16.5, marginTop:3 },
  safetyHomeAction: { color:'#6C3D18', fontSize:10.8, lineHeight:16, fontWeight:'800', marginTop:5 },
  weeklyHomeCard: { backgroundColor:'#F3EEF8', borderRadius:20, padding:15, borderWidth:1, borderColor:'#E1D5EA' },
  weeklyHomeKicker: { color:colors.purple, fontSize:8.5, fontWeight:'900', letterSpacing:0.9 },
  weeklyHomeTitle: { color:colors.text, fontSize:13.5, lineHeight:19, fontWeight:'800', marginTop:5 },
  weeklyHomeMeta: { color:colors.muted, fontSize:10.5, marginTop:6 },
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
  aiTransmissionCard: { backgroundColor:'#F7F5FA', borderRadius:18, padding:14, borderWidth:1, borderColor:'#E5DFEA', gap:4 },
  aiTransmissionTitle: { color:colors.text, fontSize:12.5, fontWeight:'900' },
  aiTransmissionText: { color:'#55515B', fontSize:11.2, lineHeight:16 },
  aiTransmissionSmall: { color:colors.muted, fontSize:9.8, lineHeight:14.5 },
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

  privacyCover: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#F7F7F9', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },
  privacyCoverTitle: { color: '#242329', fontSize: 20, fontWeight: '900' },
});
