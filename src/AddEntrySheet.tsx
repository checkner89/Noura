import React from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ManualEntryMode = 'Essen' | 'Symptome' | 'Auffälligkeit' | 'Stuhlgang' | 'Zyklus' | 'Medikamente' | 'Körperdaten';

type Props = {
  visible: boolean;
  cycleEnabled: boolean;
  medicationsEnabled?: boolean;
  bodyDataEnabled?: boolean;
  onClose: () => void;
  onAI: () => void;
  onManual: (mode: ManualEntryMode) => void;
};

const items: Array<{ mode: ManualEntryMode; icon: string; title: string; subtitle: string; tint: string; iconColor: string }> = [
  { mode: 'Essen', icon: '🍽', title: 'Essen', subtitle: 'Mahlzeit oder Getränk', tint: '#EAF6EE', iconColor: '#3E7F56' },
  { mode: 'Symptome', icon: '◌', title: 'Gefühl', subtitle: 'Symptome & Befinden', tint: '#FFF0E9', iconColor: '#B76A43' },
  { mode: 'Auffälligkeit', icon: '!', title: 'Beobachtung', subtitle: 'Etwas kurz merken', tint: '#FFF6DC', iconColor: '#9A7825' },
  { mode: 'Stuhlgang', icon: '◎', title: 'Stuhlgang', subtitle: 'Bristol & Dringlichkeit', tint: '#EAF3FA', iconColor: '#4C7695' },
  { mode: 'Zyklus', icon: '◐', title: 'Zyklus', subtitle: 'Periode & Körpergefühl', tint: '#F4EBF8', iconColor: '#75558F' },
  { mode: 'Medikamente', icon: '✚', title: 'Medikamente', subtitle: 'Auch Supplements', tint: '#EEF3FA', iconColor: '#557590' },
  { mode: 'Körperdaten', icon: '♡', title: 'Körperdaten', subtitle: 'Gewicht, Schlaf & mehr', tint: '#EEF7F0', iconColor: '#4D7C58' },
];

export default function AddEntrySheet({ visible, cycleEnabled, medicationsEnabled = false, bodyDataEnabled = false, onClose, onAI, onManual }: Props) {
  const visibleItems = items.filter(item => (cycleEnabled || item.mode !== 'Zyklus') && (medicationsEnabled || item.mode !== 'Medikamente') && (bodyDataEnabled || item.mode !== 'Körperdaten'));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} maxFontSizeMultiplier={1.15}>Neuer Eintrag</Text>
              <Text style={styles.subtitle} maxFontSizeMultiplier={1.15}>Was möchtest du festhalten?</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Schließen" style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
          </View>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Noura erzählen" accessibilityHint="Erstellt aus Sprache oder Text einen prüfbaren Entwurf" style={styles.aiCard} onPress={onAI} activeOpacity={0.88}>
            <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
            <View style={styles.aiCopyWrap}>
              <Text style={styles.aiTitle}>Noura erzählen</Text>
              <Text style={styles.aiCopy} numberOfLines={2}>Schreiben oder diktieren – du bestätigst den fertigen Entwurf.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>ODER DIREKT</Text><View style={styles.divider} /></View>

          <View style={styles.grid}>
            {visibleItems.map(item => (
              <TouchableOpacity key={item.mode} accessibilityRole="button" accessibilityLabel={`${item.title}: ${item.subtitle}`} style={styles.item} onPress={() => onManual(item.mode)} activeOpacity={0.8}>
                <View style={[styles.itemIcon, { backgroundColor: item.tint }]}><Text style={[styles.itemIconText, { color: item.iconColor }]}>{item.icon}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemTitle} numberOfLines={1} maxFontSizeMultiplier={1.1}>{item.title}</Text>
                  <Text style={styles.itemSub} numberOfLines={1} maxFontSizeMultiplier={1.08}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,16,23,0.25)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: { backgroundColor: '#FAFAFC', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 4 : 16 },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: '#D0CDD5', alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  title: { color: '#242229', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: '#8A8690', fontSize: 11.5, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0EEF3', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: '#504C56', lineHeight: 24, marginTop: -2 },
  aiCard: { flexDirection: 'row', gap: 11, alignItems: 'center', backgroundColor: '#70558E', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 13 },
  aiIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: '#FFF', fontSize: 19, fontWeight: '900' },
  aiCopyWrap: { flex: 1, minWidth: 0 },
  aiTitle: { color: '#FFF', fontSize: 15.5, fontWeight: '900' },
  aiCopy: { color: '#EEE8F4', fontSize: 10.5, lineHeight: 14.5, marginTop: 2 },
  chevron: { color: '#FFF', fontSize: 27, fontWeight: '300' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 11 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#E2DFE6' },
  dividerText: { color: '#96919C', fontSize: 8.8, fontWeight: '900', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '48.8%', minHeight: 66, backgroundColor: '#FFF', borderRadius: 17, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#ECE9EF', flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemIconText: { fontSize: 17, fontWeight: '800' },
  itemTitle: { color: '#29272E', fontSize: 13.5, fontWeight: '800' },
  itemSub: { color: '#8B8791', fontSize: 9.2, marginTop: 2 },
});
