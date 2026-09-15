const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('// NOURA_V016_APPLIED')) {
  console.log('Noura v0.16 UI patch already applied.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`v0.16 patch failed: ${label}`);
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

function replaceRegex(regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`v0.16 patch failed: ${label}`);
  source = source.replace(regex, replacement);
}

replaceOnce(
  "import * as Linking from './src/shortcuts';",
  "import * as Linking from './src/shortcuts';",
  'noop guard'
);

// Marker: makes the transform idempotent on npm install / npm ci.
replaceOnce(
  "import * as Linking from 'expo-linking';\n",
  "import * as Linking from 'expo-linking';\n\n// NOURA_V016_APPLIED\n",
  'insert version marker'
);

// ---------------------------------------------------------------------------
// Face ID: prevent the biometric sheet itself from triggering another lock.
// ---------------------------------------------------------------------------
replaceOnce(
  "  const [privacyCover,setPrivacyCover]=useState(false); const [locked,setLocked]=useState(false); const appStateRef=useRef(AppState.currentState); const cloudTimer=useRef<ReturnType<typeof setTimeout>|null>(null);",
  "  const [privacyCover,setPrivacyCover]=useState(false); const [locked,setLocked]=useState(false); const appStateRef=useRef(AppState.currentState); const cloudTimer=useRef<ReturnType<typeof setTimeout>|null>(null);\n  const authInFlightRef=useRef(false); const relockOnActiveRef=useRef(false); const lastUnlockAtRef=useRef(0);",
  'add Face ID guard refs'
);

replaceOnce(
  "  const authenticate=async()=>{try{const available=await LocalAuthentication.hasHardwareAsync();const enrolled=await LocalAuthentication.isEnrolledAsync();if(!available||!enrolled){setLocked(false);Alert.alert('Face ID nicht verfügbar','Auf diesem iPhone ist aktuell keine biometrische Entsperrung eingerichtet.');return false;}const result=await LocalAuthentication.authenticateAsync({promptMessage:'Noura entsperren',cancelLabel:'Abbrechen',fallbackLabel:'Code verwenden'});setLocked(!result.success);setPrivacyCover(!result.success);return result.success;}catch{setLocked(true);return false;}};",
  "  const authenticate=async()=>{\n    if(authInFlightRef.current)return false;\n    if(Date.now()-lastUnlockAtRef.current<2500){setLocked(false);setPrivacyCover(false);return true;}\n    authInFlightRef.current=true;\n    try{\n      const available=await LocalAuthentication.hasHardwareAsync();\n      const enrolled=await LocalAuthentication.isEnrolledAsync();\n      if(!available||!enrolled){setLocked(false);setPrivacyCover(false);Alert.alert('Face ID nicht verfügbar','Auf diesem iPhone ist aktuell keine biometrische Entsperrung eingerichtet.');return false;}\n      const result=await LocalAuthentication.authenticateAsync({promptMessage:'Noura entsperren',cancelLabel:'Abbrechen',fallbackLabel:'Code verwenden'});\n      if(result.success){lastUnlockAtRef.current=Date.now();setLocked(false);setPrivacyCover(false);}else{setLocked(true);setPrivacyCover(true);}\n      return result.success;\n    }catch{setLocked(true);setPrivacyCover(true);return false;}\n    finally{setTimeout(()=>{authInFlightRef.current=false;},450);}\n  };",
  'replace Face ID authentication flow'
);

replaceOnce(
  "if(state!=='active'){setPrivacyCover(true);return;}",
  "if(state!=='active'){if(authInFlightRef.current)return;setPrivacyCover(true);relockOnActiveRef.current=true;return;}",
  'ignore Face ID AppState transitions'
);

replaceOnce(
  "if(prefs.appLockEnabled&&previous!=='active'){setLocked(true);await authenticate();}else setPrivacyCover(false);",
  "if(prefs.appLockEnabled&&previous!=='active'&&relockOnActiveRef.current&&!authInFlightRef.current){relockOnActiveRef.current=false;setLocked(true);await authenticate();}else{relockOnActiveRef.current=false;setPrivacyCover(false);}",
  'guard relock on active'
);

// ---------------------------------------------------------------------------
// Calendar picker for cycle entries – no additional native dependency needed.
// ---------------------------------------------------------------------------
const calendarComponent = `
function CycleDateCalendar({ visible, value, markedDates, onSelect, onClose }: { visible:boolean; value:string; markedDates:string[]; onSelect:(date:string)=>void; onClose:()=>void }) {
  const selectedDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ? new Date(\`${'${value}'}T12:00:00\`) : new Date();
  const [cursor,setCursor]=useState(()=>new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1,12));
  useEffect(()=>{if(visible){const d=/^\\d{4}-\\d{2}-\\d{2}$/.test(value)?new Date(\`${'${value}'}T12:00:00\`):new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1,12));}},[visible,value]);
  const marked=useMemo(()=>new Set(markedDates),[markedDates]);
  const year=cursor.getFullYear(); const month=cursor.getMonth();
  const first=new Date(year,month,1,12); const leading=(first.getDay()+6)%7; const count=new Date(year,month+1,0,12).getDate();
  const cells=Array.from({length:leading+count},(_,i)=>i<leading?null:i-leading+1);
  while(cells.length%7)cells.push(null);
  const monthLabel=cursor.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const move=(delta:number)=>setCursor(new Date(year,month+delta,1,12));
  const choose=(day:number)=>{const next=new Date(year,month,day,12);onSelect(dateInput(next));onClose();};
  const today=dateInput();
  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <View style={{flex:1,justifyContent:'center',padding:18,backgroundColor:'rgba(20,18,26,0.28)'}}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
      <View style={{borderRadius:30,padding:18,backgroundColor:'rgba(252,252,255,0.96)',borderWidth:1,borderColor:'rgba(255,255,255,0.92)',shadowColor:'#1C1C1E',shadowOpacity:0.16,shadowRadius:28,shadowOffset:{width:0,height:16},elevation:9}}>
        <View style={{width:38,height:5,borderRadius:3,backgroundColor:'rgba(120,116,128,0.28)',alignSelf:'center',marginBottom:16}}/>
        <Text style={{fontSize:19,fontWeight:'900',color:colors.text}}>Zyklustag auswählen</Text>
        <Text style={{fontSize:11,color:colors.muted,marginTop:4}}>Punkte markieren Tage, für die bereits Zyklusdaten vorliegen.</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18,marginBottom:12}}>
          <TouchableOpacity onPress={()=>move(-1)} style={{width:38,height:38,borderRadius:19,backgroundColor:'rgba(113,85,143,0.10)',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:25,color:colors.purple}}>‹</Text></TouchableOpacity>
          <Text style={{fontSize:15,fontWeight:'900',color:colors.text,textTransform:'capitalize'}}>{monthLabel}</Text>
          <TouchableOpacity onPress={()=>move(1)} style={{width:38,height:38,borderRadius:19,backgroundColor:'rgba(113,85,143,0.10)',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:25,color:colors.purple}}>›</Text></TouchableOpacity>
        </View>
        <View style={{flexDirection:'row'}}>{['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=><Text key={x} style={{width:'14.2857%',textAlign:'center',fontSize:10,fontWeight:'800',color:colors.muted,paddingVertical:6}}>{x}</Text>)}</View>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>{cells.map((day,index)=>{
          if(day==null)return <View key={\`blank-${'${index}'}\`} style={{width:'14.2857%',height:46}}/>;
          const d=dateInput(new Date(year,month,day,12)); const selected=d===value; const isToday=d===today; const hasEntry=marked.has(d);
          return <TouchableOpacity key={d} onPress={()=>choose(day)} style={{width:'14.2857%',height:46,alignItems:'center',justifyContent:'center'}}>
            <View style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:selected?colors.purple:isToday?'rgba(113,85,143,0.10)':'transparent',borderWidth:isToday&&!selected?1:0,borderColor:'rgba(113,85,143,0.24)'}}><Text style={{fontSize:13,fontWeight:selected?'900':'700',color:selected?'#FFF':colors.text}}>{day}</Text>{hasEntry?<View style={{position:'absolute',bottom:4,width:4,height:4,borderRadius:2,backgroundColor:selected?'#FFF':colors.coral}}/>:null}</View>
          </TouchableOpacity>;
        })}</View>
        <View style={{flexDirection:'row',gap:9,marginTop:14}}><TouchableOpacity onPress={()=>{onSelect(today);onClose();}} style={{flex:1,minHeight:44,borderRadius:15,backgroundColor:'rgba(113,85,143,0.10)',alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.purple,fontWeight:'900'}}>Heute</Text></TouchableOpacity><TouchableOpacity onPress={onClose} style={{flex:1,minHeight:44,borderRadius:15,backgroundColor:colors.purple,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#FFF',fontWeight:'900'}}>Fertig</Text></TouchableOpacity></View>
      </View>
    </View>
  </Modal>;
}

`;
replaceOnce('function TrackingScreen(', calendarComponent + 'function TrackingScreen(', 'insert cycle calendar component');

replaceOnce(
  "  const [entryDate,setEntryDate]=useState(dateInput()); const [entryTime,setEntryTime]=useState(timeInput());",
  "  const [entryDate,setEntryDate]=useState(dateInput()); const [entryTime,setEntryTime]=useState(timeInput()); const [cycleCalendarOpen,setCycleCalendarOpen]=useState(false);",
  'add cycle calendar state'
);

replaceRegex(
  /  const TimeCard=\(\)=> <View style=\{styles\.infoStrip\}>[\s\S]*?<\/View>;\n  return <>/,
  `  const TimeCard=()=> <View style={styles.infoStrip}><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Text style={{fontSize:18}}>◷</Text><View style={{flex:1}}><Text style={[styles.cardTitle,{fontSize:12}]}>Zeitpunkt</Text><Text style={styles.helper}>Wann war es wirklich?</Text></View>{mode==='Zyklus'?<TouchableOpacity accessibilityLabel="Zyklustag im Kalender wählen" onPress={()=>setCycleCalendarOpen(true)} style={[styles.input,{width:112,minHeight:40,marginTop:0,paddingHorizontal:9,paddingVertical:8,justifyContent:'center'}]}><Text style={{fontSize:11,color:colors.text,fontWeight:'700'}}>{new Date(\`${'${entryDate}'}T12:00:00\`).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'})}</Text></TouchableOpacity>:<TextInput accessibilityLabel="Datum" value={entryDate} onChangeText={setEntryDate} style={[styles.input,{width:104,paddingVertical:8,fontSize:11}]} />}<TextInput accessibilityLabel="Uhrzeit" value={entryTime} onChangeText={setEntryTime} style={[styles.input,{width:67,paddingVertical:8,fontSize:11}]} /></View></View>;
  return <>`,
  'replace cycle date input with calendar trigger'
);

replaceRegex(
  /(  <PhotoMealCaptureModal[^\n]*\/>\n)/,
  `$1  <CycleDateCalendar visible={cycleCalendarOpen} value={entryDate} markedDates={store.cycle.map(x=>dateInput(new Date(x.createdAt)))} onSelect={setEntryDate} onClose={()=>setCycleCalendarOpen(false)}/>\n`,
  'mount cycle calendar'
);

// ---------------------------------------------------------------------------
// Demo dataset: expose the existing synthetic 28-day test dataset in Profile.
// ---------------------------------------------------------------------------
replaceOnce(
  "function ProfileScreen({ config, store, profile, preferences, aiConsent, onOpenSettings, onOpenProfileSettings, onPickProfileImage, onRemoveProfileImage, onToggleBackup, onToggleDailyAI, onToggleAppLock, onBackupNow, onBackupShare, onBackupRestore, onRunAINow, onImportAppleHealth, onSyncAppleHealth, onToggleCloudSync, onCloudSyncNow, onExportData, onImportData, onShowAIUsage, onShowShortcutHelp, onUpdatePreferences, onCreateReport, onClearDiary, onClearAI, onClearEverything }: {",
  "function ProfileScreen({ config, store, profile, preferences, aiConsent, onOpenSettings, onOpenProfileSettings, onPickProfileImage, onRemoveProfileImage, onToggleBackup, onToggleDailyAI, onToggleAppLock, onBackupNow, onBackupShare, onBackupRestore, onRunAINow, onImportAppleHealth, onSyncAppleHealth, onToggleCloudSync, onCloudSyncNow, onExportData, onImportData, onShowAIUsage, onShowShortcutHelp, onUpdatePreferences, onCreateReport, onClearDiary, onClearAI, onClearEverything, onLoadDemoData }: {",
  'add demo prop to ProfileScreen'
);
replaceOnce(
  "  onOpenSettings:()=>void; onOpenProfileSettings:()=>void; onPickProfileImage:()=>void; onRemoveProfileImage:()=>void; onToggleBackup:(v:boolean)=>void; onToggleDailyAI:(v:boolean)=>void; onToggleAppLock:(v:boolean)=>void; onBackupNow:()=>void; onBackupShare:()=>void; onBackupRestore:()=>void; onRunAINow:()=>void; onImportAppleHealth:()=>void; onSyncAppleHealth:()=>void; onToggleCloudSync:(v:boolean)=>void; onCloudSyncNow:()=>void; onExportData:()=>void; onImportData:()=>void; onShowAIUsage:()=>void; onShowShortcutHelp:()=>void; onUpdatePreferences:(patch:Partial<AppPreferences>)=>void; onCreateReport:()=>void; onClearDiary:()=>void; onClearAI:()=>void; onClearEverything:()=>void;",
  "  onOpenSettings:()=>void; onOpenProfileSettings:()=>void; onPickProfileImage:()=>void; onRemoveProfileImage:()=>void; onToggleBackup:(v:boolean)=>void; onToggleDailyAI:(v:boolean)=>void; onToggleAppLock:(v:boolean)=>void; onBackupNow:()=>void; onBackupShare:()=>void; onBackupRestore:()=>void; onRunAINow:()=>void; onImportAppleHealth:()=>void; onSyncAppleHealth:()=>void; onToggleCloudSync:(v:boolean)=>void; onCloudSyncNow:()=>void; onExportData:()=>void; onImportData:()=>void; onShowAIUsage:()=>void; onShowShortcutHelp:()=>void; onUpdatePreferences:(patch:Partial<AppPreferences>)=>void; onCreateReport:()=>void; onClearDiary:()=>void; onClearAI:()=>void; onClearEverything:()=>void; onLoadDemoData:()=>void;",
  'type demo prop'
);

replaceOnce(
  "  const clearDiary=async()=>{",
  "  const loadDemoData=async()=>{\n    if(preferences.iCloudSyncEnabled){Alert.alert('iCloud-Sync ist aktiv','Deaktiviere den iCloud Live-Sync kurz, bevor du den Beispieldatensatz lädst. So können synthetische Testdaten nicht in deinen echten Cloud-Stand gelangen.');return;}\n    const demo=createDemoStore();setStore(demo);await saveHealthStore(demo);setAIInsight('');setLatestAIResult(null);await clearLatestAIInsight();setTab('Home');\n  };\n\n  const clearDiary=async()=>{",
  'add demo data loader'
);

replaceOnce(
  "    <Text style={styles.profileSectionLabel}>DATEN LÖSCHEN</Text>",
  "    <Text style={styles.profileSectionLabel}>TEST & DEMO</Text><View style={styles.profileSettingsCard}><ProfileSettingRow icon=\"◇\" title=\"Beispieldatensatz laden\" detail=\"28 synthetische Tage mit Mahlzeiten, Beschwerden, Zyklus, Schlaf, Schritten und bewusst eingebauten Mustern.\" onPress={()=>Alert.alert('Beispieldaten laden?','Der lokale Tagebuchstand wird durch einen synthetischen Testdatensatz ersetzt. Profil und KI-Verbindung bleiben erhalten.',[{text:'Abbrechen',style:'cancel'},{text:'Beispieldaten laden',onPress:onLoadDemoData}])}/></View>\n\n    <Text style={styles.profileSectionLabel}>DATEN LÖSCHEN</Text>",
  'add demo data profile action'
);

replaceOnce(
  "onClearEverything={()=>clearEverything().catch(()=>undefined)}/>",
  "onClearEverything={()=>clearEverything().catch(()=>undefined)} onLoadDemoData={()=>loadDemoData().catch(()=>undefined)}/>",
  'wire demo data action'
);

// ---------------------------------------------------------------------------
// Liquid Glass inspired visual pass – translucent surfaces + fine borders + lift.
// No new native dependency, so the unsigned build stays stable.
// ---------------------------------------------------------------------------
replaceOnce("  bg: '#F7F7F9',", "  bg: '#F3F4F8',", 'glass background');
replaceOnce("  surface: '#FFFFFF',", "  surface: 'rgba(255,255,255,0.84)',", 'glass surfaces');
replaceOnce("  line: '#EAE7ED',", "  line: 'rgba(82,76,94,0.13)',", 'glass hairline');

replaceOnce(
  "  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line },",
  "  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', shadowColor:'#1C1C1E', shadowOpacity:0.07, shadowRadius:18, shadowOffset:{width:0,height:8}, elevation:2 },",
  'glass cards'
);
replaceOnce(
  "  profileSettingsCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },",
  "  profileSettingsCard: { backgroundColor: colors.surface, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', overflow: 'hidden', shadowColor:'#1C1C1E', shadowOpacity:0.055, shadowRadius:16, shadowOffset:{width:0,height:7}, elevation:2 },",
  'glass profile cards'
);
replaceOnce(
  "  homeTodayCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16 },",
  "  homeTodayCard: { backgroundColor: colors.surface, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)', padding: 16, shadowColor:'#1C1C1E', shadowOpacity:0.055, shadowRadius:16, shadowOffset:{width:0,height:8}, elevation:2 },",
  'glass today card'
);
replaceOnce(
  "  homeInsightCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line },",
  "  homeInsightCard: { backgroundColor:'rgba(255,255,255,0.78)', borderRadius: 25, padding: 16, borderWidth: 1, borderColor:'rgba(255,255,255,0.82)', shadowColor:'#1C1C1E', shadowOpacity:0.06, shadowRadius:17, shadowOffset:{width:0,height:8}, elevation:2 },",
  'glass insight card'
);
replaceOnce(
  "  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, height: 50 },",
  "  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor:'rgba(255,255,255,0.76)', borderRadius: 20, borderWidth: 1, borderColor:'rgba(255,255,255,0.82)', paddingHorizontal: 14, height: 50, shadowColor:'#1C1C1E', shadowOpacity:0.04, shadowRadius:12, shadowOffset:{width:0,height:5} },",
  'glass search'
);
replaceOnce(
  "  insightCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 17, borderWidth: 1, borderColor: colors.line },",
  "  insightCard: { backgroundColor:'rgba(255,255,255,0.80)', borderRadius: 27, padding: 17, borderWidth: 1, borderColor:'rgba(255,255,255,0.82)', shadowColor:'#1C1C1E', shadowOpacity:0.06, shadowRadius:18, shadowOffset:{width:0,height:8}, elevation:2 },",
  'glass analysis card'
);
replaceOnce(
  "  dropdownField: { minHeight: 62, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },",
  "  dropdownField: { minHeight: 62, backgroundColor:'rgba(255,255,255,0.78)', borderRadius: 20, borderWidth: 1, borderColor:'rgba(255,255,255,0.82)', paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor:'#1C1C1E', shadowOpacity:0.035, shadowRadius:10, shadowOffset:{width:0,height:4} },",
  'glass dropdowns'
);

replaceOnce(
  "  bottomNavWrap: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 7 : 11, paddingTop: 4 },\n  bottomNav: { height: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 27, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7 },",
  "  bottomNavWrap: { backgroundColor: 'transparent', paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 7 : 11, paddingTop: 4 },\n  bottomNav: { height: 72, flexDirection: 'row', alignItems: 'center', backgroundColor:'rgba(255,255,255,0.82)', borderRadius: 30, borderWidth: 1, borderColor:'rgba(255,255,255,0.86)', paddingHorizontal: 7, shadowColor:'#1C1C1E', shadowOpacity:0.11, shadowRadius:24, shadowOffset:{width:0,height:10}, elevation:7 },",
  'glass bottom navigation'
);
replaceOnce(
  "  floatingAdd: { position: 'absolute', width: 62, height: 62, borderRadius: 31, backgroundColor: colors.purple, left: '50%', marginLeft: -31, top: -12, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.bg },\n  floatingAddText: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '300' },",
  "  floatingAdd: { position: 'absolute', width: 62, height: 62, borderRadius: 31, backgroundColor:'rgba(113,85,143,0.94)', left: '50%', marginLeft: -31, top: -12, alignItems:'center', justifyContent:'center', borderWidth:4, borderColor:'rgba(255,255,255,0.90)', shadowColor:'#3A274D', shadowOpacity:0.22, shadowRadius:16, shadowOffset:{width:0,height:8}, elevation:9 },\n  floatingAddText: { color:'#FFFFFF', width:50, height:50, fontSize:32, lineHeight:48, fontWeight:'300', textAlign:'center', textAlignVertical:'center', includeFontPadding:false },",
  'center and glassify add button'
);
replaceOnce('<Text style={styles.floatingAddText}>＋</Text>', '<Text style={styles.floatingAddText}>+</Text>', 'use centered plus glyph');

replaceOnce("<Text style={styles.versionLabel}>Noura · Version 0.15</Text>", "<Text style={styles.versionLabel}>Noura · Version 0.16</Text>", 'version label');

fs.writeFileSync(appPath, source, 'utf8');
console.log('Applied Noura v0.16: Face ID guard, cycle calendar, demo dataset, centered add button and Liquid Glass visual pass.');
