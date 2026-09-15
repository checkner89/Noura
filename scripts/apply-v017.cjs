const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('// NOURA_V017_APPLIED')) {
  console.log('Noura v0.17 patch already applied.');
  process.exit(0);
}
if (!source.includes('// NOURA_V016_APPLIED')) {
  throw new Error('v0.17 patch requires the v0.16 transform first.');
}

function replaceOnce(from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`v0.17 patch failed: ${label}`);
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

function replaceRegex(regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`v0.17 patch failed: ${label}`);
  source = source.replace(regex, replacement);
}

// Native Liquid Glass. Apple recommends using the material for controls and
// navigation rather than turning every content card into translucent glass.
replaceOnce(
  "import * as Linking from 'expo-linking';\n\n// NOURA_V016_APPLIED\n",
  "import * as Linking from 'expo-linking';\nimport { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';\n\n// NOURA_V016_APPLIED\n// NOURA_V017_APPLIED\n",
  'import native glass effect'
);
replaceOnce(
  "  Platform,\n  SafeAreaView,",
  "  Platform,\n  Pressable,\n  SafeAreaView,",
  'import Pressable'
);

const liquidGlassHelper = `
function LiquidGlassSurface({ children, style, tintColor = 'rgba(255,255,255,0.10)', effect = 'regular', interactive = false }: {
  children: React.ReactNode;
  style?: any;
  tintColor?: string;
  effect?: 'clear' | 'regular';
  interactive?: boolean;
}) {
  const available = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  if (available) {
    return <GlassView style={style} glassEffectStyle={effect} tintColor={tintColor} isInteractive={interactive}>{children}</GlassView>;
  }
  return <View style={[style, { backgroundColor: 'rgba(250,250,252,0.94)' }]}>{children}</View>;
}

`;
replaceOnce('function uid(prefix: string) {', liquidGlassHelper + 'function uid(prefix: string) {', 'add Liquid Glass surface helper');

// Apple Health must never enter the native module in a build without the
// HealthKit entitlement. Native entitlement failures can terminate the app
// before a JavaScript try/catch can recover.
replaceOnce(
  "  const syncAppleHealth=async()=>{try{const result=await syncDirectAppleHealth(180);",
  "  const syncAppleHealth=async()=>{if(!isDirectHealthKitModulePresent()){Alert.alert('Apple Health in diesem Build nicht verfügbar','Der direkte Sync benötigt einen mit HealthKit-Capability signierten Build. Der Health-Export-Import funktioniert weiterhin.');return;}try{const result=await syncDirectAppleHealth(180);",
  'guard direct Apple Health sync'
);

// CloudKit has the same entitlement requirement. Do not allow a switch to
// become enabled when this exact binary was built without the capability.
replaceOnce(
  "  const toggleCloudSync=async(enabled:boolean)=>{if(!enabled){await persistPrefs({...preferences,iCloudSyncEnabled:false});return;}try{",
  "  const toggleCloudSync=async(enabled:boolean)=>{if(!enabled){await persistPrefs({...preferences,iCloudSyncEnabled:false});return;}if(!isCloudKitModulePresent()){await persistPrefs({...preferences,iCloudSyncEnabled:false});Alert.alert('iCloud Live-Sync in diesem Build nicht verfügbar','CloudKit benötigt eine passende Apple-Capability und Provisionierung. Backup-Dateien kannst du weiterhin in iCloud Drive sichern.');return;}try{",
  'guard iCloud live sync'
);

// Capability-aware profile rows: unsupported native features are shown as
// unavailable instead of presenting a control that can never succeed.
replaceOnce(
  '<ProfileSettingRow icon="♥" title="Direkt mit Apple Health synchronisieren" detail={`${directHealthLabel}. ${isDirectHealthKitModulePresent()?\'Modul im Build vorhanden.\':\'In diesem Build nicht enthalten.\'}`} onPress={onSyncAppleHealth}/>',
  "{isDirectHealthKitModulePresent()?<ProfileSettingRow icon=\"♥\" title=\"Direkt mit Apple Health synchronisieren\" detail={`${directHealthLabel}. HealthKit ist für diesen Build freigeschaltet.`} onPress={onSyncAppleHealth}/>:<ProfileSettingRow icon=\"♥\" title=\"Apple Health Direkt-Sync\" detail=\"In diesem Sideload-Build nicht freigeschaltet. Nutze unten den Health-Export-Import.\"/>}",
  'make Apple Health row capability aware'
);
replaceOnce(
  '<ProfileSettingRow icon="⇄" title="iCloud Live-Sync" detail={`${cloudLabel}. ${isCloudKitModulePresent()?\'CloudKit-Modul im Build vorhanden.\':\'In diesem Build nicht enthalten.\'}`} right={<Switch value={preferences.iCloudSyncEnabled} onValueChange={onToggleCloudSync} trackColor={{true:\'#B8DCC1\'}} thumbColor={preferences.iCloudSyncEnabled?colors.green:undefined}/>}/>',
  "{isCloudKitModulePresent()?<ProfileSettingRow icon=\"⇄\" title=\"iCloud Live-Sync\" detail={`${cloudLabel}. CloudKit ist für diesen Build freigeschaltet.`} right={<Switch value={preferences.iCloudSyncEnabled} onValueChange={onToggleCloudSync} trackColor={{true:'#B8DCC1'}} thumbColor={preferences.iCloudSyncEnabled?colors.green:undefined}/>}/>:<ProfileSettingRow icon=\"⇄\" title=\"iCloud Live-Sync\" detail=\"In diesem Sideload-Build nicht verfügbar. Automatische Backup-Datei und iCloud Drive bleiben nutzbar.\"/>}",
  'make iCloud row capability aware'
);

// Home: replace the dense text-only "Zuletzt" block with an iOS-like inset
// activity list: separate hierarchy, icon, title/subtitle and compact time.
replaceOnce(
  "  const insight = aiInsight || groupSignal?.friendly || (cycleSignal ? `Deine Beschwerden waren in der ${cycleSignal.phase} zuletzt häufiger stärker als sonst.` : 'Noch keine belastbare Auffälligkeit. Kurze, regelmäßige Einträge reichen völlig.');\n",
  "  const insight = aiInsight || groupSignal?.friendly || (cycleSignal ? `Deine Beschwerden waren in der ${cycleSignal.phase} zuletzt häufiger stärker als sonst.` : 'Noch keine belastbare Auffälligkeit. Kurze, regelmäßige Einträge reichen völlig.');\n  const recentMeta:Record<TimelineItem['kind'],{icon:string,label:string}>={meal:{icon:'↗',label:'Mahlzeit'},symptom:{icon:'◌',label:'Check-in'},bowel:{icon:'◎',label:'Verdauung'},cycle:{icon:'◐',label:'Zyklus'},observation:{icon:'!',label:'Beobachtung'},medication:{icon:'✚',label:'Medikation'},metric:{icon:'♡',label:'Körperwert'}};\n  const compactRecentTime=(iso:string)=>{const d=new Date(iso);const today=new Date();return d.toDateString()===today.toDateString()?d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});};\n",
  'add recent activity metadata'
);

const oldRecent = `    <View style={styles.homeTodayCard}><View style={styles.homeTodayHeader}><Text style={styles.homeTodayTitle}>Zuletzt</Text><TouchableOpacity onPress={onDiary}><Text style={styles.homeTodayLink}>Tagebuch ›</Text></TouchableOpacity></View>
      {latest.length ? latest.map((item,index)=><View key={\`${'${item.kind}'}-${'${item.id}'}\`} style={[styles.homeLastRow,index<latest.length-1&&{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,paddingBottom:10}]}><View style={{flex:1}}><Text style={styles.homeLastLabel}>{formatDateTime(item.createdAt)}</Text><Text style={[styles.homeLastValue,{textAlign:'left'}]} numberOfLines={1}>{item.title} · {item.subtitle}</Text></View></View>) : <Text style={styles.helper}>Noch keine Einträge. Du kannst einfach Noura erzählen, was gerade war.</Text>}
      {profile.tracking.cycle && cycle.estimatedCycleDay ? <View style={[styles.homeLastRow,{marginTop:8}]}><Text style={styles.homeLastLabel}>Zykluskontext</Text><Text style={styles.homeLastValue}>ca. Tag {cycle.estimatedCycleDay} · {cycle.estimatedPhase}</Text></View>:null}
    </View>`;
const newRecent = `    <View style={styles.homeTodayCard}>
      <View style={styles.homeTodayHeader}><View><Text style={styles.recentKicker}>LETZTE EINTRÄGE</Text><Text style={styles.homeTodayTitle}>Was du zuletzt erfasst hast</Text></View><Pressable onPress={onDiary} hitSlop={8}><Text style={styles.homeTodayLink}>Alle anzeigen</Text></Pressable></View>
      {latest.length?<View style={styles.recentList}>{latest.map((item,index)=><View key={\`${'${item.kind}'}-${'${item.id}'}\`} style={[styles.recentActivityRow,index<latest.length-1&&styles.recentActivityBorder]}><View style={styles.recentActivityIcon}><Text style={styles.recentActivityIconText}>{recentMeta[item.kind].icon}</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.recentActivityType}>{recentMeta[item.kind].label}</Text><Text style={styles.recentActivityTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.recentActivitySubtitle} numberOfLines={1}>{item.subtitle}</Text></View><Text style={styles.recentActivityTime}>{compactRecentTime(item.createdAt)}</Text></View>)}</View>:<View style={styles.recentEmpty}><Text style={styles.recentEmptyTitle}>Noch nichts erfasst</Text><Text style={styles.recentEmptyText}>Ein kurzer Eintrag reicht – Noura baut daraus nach und nach deinen persönlichen Verlauf.</Text></View>}
      {profile.tracking.cycle&&cycle.estimatedCycleDay?<View style={styles.recentCyclePill}><Text style={styles.recentCycleLabel}>◐ Zyklus</Text><Text style={styles.recentCycleValue}>ca. Tag {cycle.estimatedCycleDay} · {cycle.estimatedPhase}</Text></View>:null}
    </View>`;
replaceOnce(oldRecent, newRecent, 'redesign Home recent entries');

// Real native glass for the prominent quick action as well. Pressable avoids
// opacity animation on a GlassView, which breaks refraction on iOS.
replaceOnce(
  '<TouchableOpacity style={styles.tellNouraRow} onPress={onAIQuick} activeOpacity={0.88}><View style={styles.tellNouraIcon}><Text style={styles.tellNouraIconText}>✦</Text></View><View style={{flex:1}}><Text style={styles.tellNouraTitle}>Noura erzählen</Text><Text style={styles.tellNouraSub}>„Ich hatte Pasta und bin jetzt aufgebläht.“</Text></View><Text style={styles.tellNouraArrow}>›</Text></TouchableOpacity>',
  '<Pressable onPress={onAIQuick}><LiquidGlassSurface style={styles.tellNouraRow} effect="regular" tintColor="rgba(113,85,143,0.40)" interactive><View style={styles.tellNouraIcon}><Text style={styles.tellNouraIconText}>✦</Text></View><View style={{flex:1}}><Text style={styles.tellNouraTitle}>Noura erzählen</Text><Text style={styles.tellNouraSub}>„Ich hatte Pasta und bin jetzt aufgebläht.“</Text></View><Text style={styles.tellNouraArrow}>›</Text></LiquidGlassSurface></Pressable>',
  'native glass quick action'
);

// Floating native glass navigation. The bar overlays the scrolling content so
// the native material has something to refract, like the iOS 27 tab bar.
replaceRegex(
  /<View style=\{styles\.bottomNavWrap\}><View style=\{styles\.bottomNav\}>([\s\S]*?)<\/View><TouchableOpacity style=\{styles\.floatingAdd\} onPress=\{\(\)=>setAddSheetOpen\(true\)\}><Text style=\{styles\.floatingAddText\}>\+<\/Text><\/TouchableOpacity><\/View>/,
  '<View style={styles.bottomNavWrap}><LiquidGlassSurface style={styles.bottomNav} effect="regular" tintColor="rgba(255,255,255,0.12)">$1</LiquidGlassSurface><Pressable accessibilityRole="button" accessibilityLabel="Eintrag hinzufügen" style={styles.floatingAdd} onPress={()=>setAddSheetOpen(true)}><LiquidGlassSurface style={styles.floatingAddGlass} effect="regular" tintColor="rgba(113,85,143,0.38)" interactive><View style={styles.plusGlyph} pointerEvents="none"><View style={styles.plusHorizontal}/><View style={styles.plusVertical}/></View></LiquidGlassSurface></Pressable></View>',
  'native glass bottom navigation and centered plus'
);

// Undo the fake all-over translucency from v0.16. Content is solid and quiet;
// actual Liquid Glass stays on navigation and interactive controls.
replaceOnce("  bg: '#F3F4F8',", "  bg: '#F5F5F7',", 'iOS system background');
replaceOnce("  surface: 'rgba(255,255,255,0.84)',", "  surface: '#FFFFFF',", 'solid content surfaces');
replaceOnce(
  "  tellNouraRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.purple, borderRadius: 21, padding: 13 },",
  "  tellNouraRow: { flexDirection:'row', alignItems:'center', gap:11, backgroundColor:'transparent', borderRadius:25, padding:14, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.46)' },",
  'style native glass quick action'
);
replaceOnce(
  "  homeTodayCard: { backgroundColor: colors.surface, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)', padding: 16, shadowColor:'#1C1C1E', shadowOpacity:0.055, shadowRadius:16, shadowOffset:{width:0,height:8}, elevation:2 },",
  "  homeTodayCard: { backgroundColor:'#FFFFFF', borderRadius:28, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(60,60,67,0.12)', padding:16, shadowColor:'#1C1C1E', shadowOpacity:0.045, shadowRadius:14, shadowOffset:{width:0,height:6}, elevation:1 },",
  'solid recent content card'
);

replaceOnce(
  "  homeScoreDisclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: 18 },",
  "  recentKicker: { color:colors.purple, fontSize:8.5, fontWeight:'900', letterSpacing:1.05, marginBottom:4 },\n  recentList: { marginTop:11 },\n  recentActivityRow: { minHeight:64, flexDirection:'row', alignItems:'center', gap:11, paddingVertical:9 },\n  recentActivityBorder: { borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:'rgba(60,60,67,0.10)' },\n  recentActivityIcon: { width:38, height:38, borderRadius:14, backgroundColor:'#F2EEF7', alignItems:'center', justifyContent:'center' },\n  recentActivityIconText: { color:colors.purple, fontSize:17, fontWeight:'900' },\n  recentActivityType: { color:colors.muted, fontSize:8.5, fontWeight:'800', letterSpacing:0.35 },\n  recentActivityTitle: { color:colors.text, fontSize:13.2, fontWeight:'850', marginTop:2 },\n  recentActivitySubtitle: { color:colors.muted, fontSize:10.3, marginTop:2 },\n  recentActivityTime: { color:'#8E8E93', fontSize:10.2, fontWeight:'700', alignSelf:'flex-start', marginTop:13 },\n  recentEmpty: { backgroundColor:'#F7F7FA', borderRadius:18, padding:14, marginTop:12 },\n  recentEmptyTitle: { color:colors.text, fontSize:12.5, fontWeight:'850' },\n  recentEmptyText: { color:colors.muted, fontSize:10.5, lineHeight:15, marginTop:3 },\n  recentCyclePill: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:10, backgroundColor:'#F8F2F8', borderRadius:15, paddingHorizontal:12, paddingVertical:9 },\n  recentCycleLabel: { color:colors.purple, fontSize:10.5, fontWeight:'900' },\n  recentCycleValue: { flex:1, textAlign:'right', color:colors.muted, fontSize:10.2, fontWeight:'700' },\n  homeScoreDisclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: 18 },",
  'add recent activity styles'
);

replaceOnce(
  "  bottomNavWrap: { backgroundColor: 'transparent', paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 7 : 11, paddingTop: 4 },\n  bottomNav: { height: 72, flexDirection: 'row', alignItems: 'center', backgroundColor:'rgba(255,255,255,0.82)', borderRadius: 30, borderWidth: 1, borderColor:'rgba(255,255,255,0.86)', paddingHorizontal: 7, shadowColor:'#1C1C1E', shadowOpacity:0.11, shadowRadius:24, shadowOffset:{width:0,height:10}, elevation:7 },",
  "  bottomNavWrap: { position:'absolute', left:0, right:0, bottom:0, backgroundColor:'transparent', paddingHorizontal:12, paddingBottom:Platform.OS==='ios'?6:10, paddingTop:8 },\n  bottomNav: { height:70, flexDirection:'row', alignItems:'center', backgroundColor:'transparent', borderRadius:35, overflow:'hidden', paddingHorizontal:7, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.58)', shadowColor:'#1C1C1E', shadowOpacity:0.14, shadowRadius:24, shadowOffset:{width:0,height:11}, elevation:8 },",
  'native glass nav styles'
);
replaceOnce(
  "  floatingAdd: { position: 'absolute', width: 62, height: 62, borderRadius: 31, backgroundColor:'rgba(113,85,143,0.94)', left: '50%', marginLeft: -31, top: -12, alignItems:'center', justifyContent:'center', borderWidth:4, borderColor:'rgba(255,255,255,0.90)', shadowColor:'#3A274D', shadowOpacity:0.22, shadowRadius:16, shadowOffset:{width:0,height:8}, elevation:9 },\n  floatingAddText: { color:'#FFFFFF', width:50, height:50, fontSize:32, lineHeight:48, fontWeight:'300', textAlign:'center', textAlignVertical:'center', includeFontPadding:false },",
  "  floatingAdd: { position:'absolute', width:64, height:64, borderRadius:32, left:'50%', marginLeft:-32, top:-20, shadowColor:'#3A274D', shadowOpacity:0.22, shadowRadius:18, shadowOffset:{width:0,height:9}, elevation:10 },\n  floatingAddGlass: { flex:1, borderRadius:32, overflow:'hidden', alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.72)' },\n  plusGlyph: { width:28, height:28, position:'relative' },\n  plusHorizontal: { position:'absolute', left:3, right:3, top:12.75, height:2.5, borderRadius:2, backgroundColor:'#FFFFFF' },\n  plusVertical: { position:'absolute', top:3, bottom:3, left:12.75, width:2.5, borderRadius:2, backgroundColor:'#FFFFFF' },",
  'precisely center plus with vector bars'
);

// Fix the RN 0.86 TypeScript change while we are touching this release.
replaceOnce(
  "  privacyCover: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#F7F7F9', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },",
  "  privacyCover: { position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:9999, backgroundColor:'#F5F5F7', alignItems:'center', justifyContent:'center', gap:16, padding:30 },",
  'fix privacy cover absolute fill typing'
);

replaceOnce('<Text style={styles.versionLabel}>Noura · Version 0.16</Text>', '<Text style={styles.versionLabel}>Noura · Version 0.17</Text>', 'version label');

fs.writeFileSync(appPath, source, 'utf8');
console.log('Applied Noura v0.17: native Liquid Glass controls, safe HealthKit/CloudKit UI, redesigned recent activity and exact centered add control.');
