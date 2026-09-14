import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GOAL_LABELS, GoalId, SYMPTOM_LABELS, SymptomKey, UserProfile } from './onboarding';

type Props = { visible: boolean; profile: UserProfile; onClose: () => void; onSave: (profile: UserProfile) => void };
const goals = Object.keys(GOAL_LABELS) as GoalId[];
const symptoms = Object.keys(SYMPTOM_LABELS) as SymptomKey[];

function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text>{subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}</View><Switch value={value} onValueChange={onChange} trackColor={{ true: '#BBD7C2' }} /></View>;
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{selected:active}} accessibilityLabel={label} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></TouchableOpacity>;
}

export default function ProfileSettingsModal({ visible, profile, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => { if (visible) setDraft(profile); }, [visible, profile]);
  const patch = (value: Partial<UserProfile>) => setDraft(current => ({ ...current, ...value }));
  const patchTracking = (key: keyof UserProfile['tracking'], value: boolean) => setDraft(current => ({ ...current, tracking: { ...current.tracking, [key]: value } }));
  const toggleGoal = (g: GoalId) => patch({ goals: draft.goals.includes(g) ? draft.goals.filter(x => x !== g) : [...draft.goals, g] });
  const toggleSymptom = (s: SymptomKey) => patch({ symptomsToTrack: draft.symptomsToTrack.includes(s) ? draft.symptomsToTrack.filter(x => x !== s) : [...draft.symptomsToTrack, s] });
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><View><Text style={styles.title}>Einstellungen</Text><Text style={styles.subtitle}>Alles aus deiner Einrichtung – jederzeit änderbar.</Text></View><TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>PERSÖNLICH</Text><View style={styles.card}>
          <Text style={styles.label}>Name</Text><TextInput value={draft.displayName || ''} onChangeText={v => patch({ displayName: v })} placeholder="Dein Name" style={styles.input} />
          <Text style={[styles.label, { marginTop: 14 }]}>Was möchtest du erreichen?</Text><View style={styles.wrap}>{goals.map(g => <Chip key={g} label={GOAL_LABELS[g]} active={draft.goals.includes(g)} onPress={() => toggleGoal(g)} />)}</View>
        </View>
        <Text style={styles.section}>TRACKING</Text><View style={styles.card}>
          <ToggleRow title="Essen & Getränke" value={draft.tracking.meals} onChange={v => patchTracking('meals', v)} />
          <ToggleRow title="Körpergefühl & Beschwerden" value={draft.tracking.symptoms} onChange={v => patchTracking('symptoms', v)} />
          <ToggleRow title="Stuhlgang" value={draft.tracking.bowel} onChange={v => patchTracking('bowel', v)} />
          <ToggleRow title="Zyklus" value={draft.tracking.cycle} onChange={v => patchTracking('cycle', v)} />
          <ToggleRow title="Medikamente & Supplements" subtitle="Als möglichen Kontext dokumentieren" value={draft.tracking.medications} onChange={v => patchTracking('medications', v)} />
          <ToggleRow title="Gewicht" value={draft.tracking.weight} onChange={v => patchTracking('weight', v)} />
          <ToggleRow title="Wasser" value={draft.tracking.water} onChange={v => patchTracking('water', v)} />
          <ToggleRow title="Schlaf" value={draft.tracking.sleep} onChange={v => patchTracking('sleep', v)} />
          <ToggleRow title="Bewegung / Schritte" value={draft.tracking.movement} onChange={v => patchTracking('movement', v)} />
          <ToggleRow title="Temperatur" subtitle="Nur speichern, wenn du aktiv einen Messwert eingibst." value={draft.tracking.temperature} onChange={v => patchTracking('temperature', v)} />
          <ToggleRow title="Energie" value={draft.tracking.energy} onChange={v => patchTracking('energy', v)} />
          <ToggleRow title="Stress" value={draft.tracking.stress} onChange={v => patchTracking('stress', v)} />
        </View>
        <Text style={styles.section}>BESCHWERDEN</Text><View style={styles.card}><View style={styles.wrap}>{symptoms.map(s => <Chip key={s} label={SYMPTOM_LABELS[s]} active={draft.symptomsToTrack.includes(s)} onPress={() => toggleSymptom(s)} />)}</View></View>
        <Text style={styles.section}>ZYKLUS</Text><View style={styles.card}>
          <Text style={styles.label}>Erster Tag der letzten Periode</Text><TextInput value={draft.cyclePreferences.lastPeriodStart ? draft.cyclePreferences.lastPeriodStart.slice(0, 10) : ''} onChangeText={v => setDraft(c => ({ ...c, cyclePreferences: { ...c.cyclePreferences, lastPeriodStart: /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v || undefined } }))} placeholder="JJJJ-MM-TT" keyboardType="numbers-and-punctuation" style={styles.input} />
          <View style={styles.two}><View style={{ flex: 1 }}><Text style={styles.label}>Zykluslänge</Text><TextInput value={String(draft.cyclePreferences.averageCycleLength)} onChangeText={v => setDraft(c => ({ ...c, cyclePreferences: { ...c.cyclePreferences, averageCycleLength: Math.max(18, Math.min(60, Number(v) || 28)) } }))} keyboardType="number-pad" style={styles.input} /></View><View style={{ flex: 1 }}><Text style={styles.label}>Periodenlänge</Text><TextInput value={String(draft.cyclePreferences.periodLength)} onChangeText={v => setDraft(c => ({ ...c, cyclePreferences: { ...c.cyclePreferences, periodLength: Math.max(1, Math.min(14, Number(v) || 5)) } }))} keyboardType="number-pad" style={styles.input} /></View></View>
          <Text style={styles.hint}>Diese Angaben verbessern nur die zeitliche Einordnung. Sie sind kein Ovulationsnachweis.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Änderungen speichern" style={styles.save} onPress={() => onSave({ ...draft, schemaVersion: 5 })}><Text style={styles.saveText}>Änderungen speichern</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F7F7F9'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:18,borderBottomWidth:1,borderBottomColor:'#E9E6EC'},title:{fontSize:25,fontWeight:'900',color:'#242329'},subtitle:{fontSize:11.5,color:'#807B86',marginTop:3},close:{width:36,height:36,borderRadius:18,backgroundColor:'#EEEAF0',alignItems:'center',justifyContent:'center'},closeText:{fontSize:23,color:'#4E4952'},content:{padding:18,paddingBottom:50,gap:12},section:{fontSize:9.5,fontWeight:'900',letterSpacing:1.1,color:'#8A858F',marginTop:6},card:{backgroundColor:'#FFF',borderRadius:22,padding:15,borderWidth:1,borderColor:'#EAE7ED'},row:{minHeight:58,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#ECE9EF'},rowTitle:{fontSize:14,fontWeight:'800',color:'#2A282E'},rowSub:{fontSize:10.5,color:'#85808A',marginTop:3,lineHeight:14},label:{fontSize:11,fontWeight:'800',color:'#5F5A64',marginBottom:7},input:{backgroundColor:'#F6F4F7',borderRadius:14,paddingHorizontal:13,paddingVertical:12,color:'#27242B',fontSize:14,borderWidth:1,borderColor:'#E8E4EA'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderRadius:999,borderWidth:1,borderColor:'#DFDCE3',paddingHorizontal:11,paddingVertical:8,backgroundColor:'#FBFAFC'},chipActive:{backgroundColor:'#EAF4EC',borderColor:'#A9CDAF'},chipText:{fontSize:11,color:'#67626C',fontWeight:'700'},chipTextActive:{color:'#377443'},two:{flexDirection:'row',gap:10,marginTop:14},hint:{fontSize:10.5,color:'#8A858F',lineHeight:15,marginTop:10},save:{backgroundColor:'#4FA85B',paddingVertical:15,borderRadius:17,alignItems:'center',marginTop:4},saveText:{color:'#FFF',fontWeight:'900',fontSize:14}
});
