import React from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ManualEntryMode = 'Essen' | 'Symptome' | 'Auffälligkeit' | 'Stuhlgang' | 'Zyklus';

type Props = {
  visible: boolean;
  cycleEnabled: boolean;
  onClose: () => void;
  onAI: () => void;
  onManual: (mode: ManualEntryMode) => void;
};

const items: Array<{ mode: ManualEntryMode; icon: string; title: string; subtitle: string; tint: string; iconColor: string }> = [
  { mode: 'Essen', icon: '⌁', title: 'Essen', subtitle: 'Mahlzeit oder Getränk', tint: '#EAF6EE', iconColor: '#3E7F56' },
  { mode: 'Symptome', icon: '◌', title: 'Gefühl', subtitle: 'Symptome & Befinden', tint: '#FFF0E9', iconColor: '#B76A43' },
  { mode: 'Auffälligkeit', icon: '!', title: 'Auffällig', subtitle: 'Etwas kurz merken', tint: '#FFF6DC', iconColor: '#9A7825' },
  { mode: 'Stuhlgang', icon: '◎', title: 'Stuhlgang', subtitle: 'Bristol & Dringlichkeit', tint: '#EAF3FA', iconColor: '#4C7695' },
  { mode: 'Zyklus', icon: '◐', title: 'Zyklus', subtitle: 'Periode & Zyklusgefühl', tint: '#F4EBF8', iconColor: '#75558F' },
];

export default function AddEntrySheet({ visible, cycleEnabled, onClose, onAI, onManual }: Props) {
  const visibleItems = items.filter(item => cycleEnabled || item.mode !== 'Zyklus');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow} maxFontSizeMultiplier={1.15}>NEUER EINTRAG</Text>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} maxFontSizeMultiplier={1.2}>Was ist gerade passiert?</Text>
              <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>In wenigen Sekunden festhalten.</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Schließen" style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.aiCard} onPress={onAI} activeOpacity={0.88}>
            <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
            <View style={styles.aiCopyWrap}>
              <Text style={styles.aiKicker} maxFontSizeMultiplier={1.1}>AM SCHNELLSTEN</Text>
              <Text style={styles.aiTitle} maxFontSizeMultiplier={1.15}>Noura einfach erzählen</Text>
              <Text style={styles.aiCopy} maxFontSizeMultiplier={1.15}>Schreiben oder diktieren. Noura erstellt nur einen Entwurf – du bestätigst ihn.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ODER DIREKT</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.grid}>
            {visibleItems.map(item => (
              <TouchableOpacity
                key={item.mode}
                style={styles.item}
                onPress={() => onManual(item.mode)}
                activeOpacity={0.8}
              >
                <View style={[styles.itemIcon, { backgroundColor: item.tint }]}> 
                  <Text style={[styles.itemIconText, { color: item.iconColor }]}>{item.icon}</Text>
                </View>
                <Text style={styles.itemTitle} numberOfLines={1} maxFontSizeMultiplier={1.15}>{item.title}</Text>
                <Text style={styles.itemSub} numberOfLines={2} maxFontSizeMultiplier={1.1}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,16,23,0.28)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#FAFAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D0CDD5', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#7A5D95', fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
  title: { color: '#242229', fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#8A8690', fontSize: 13, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EEF3', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 25, color: '#504C56', lineHeight: 27, marginTop: -2 },
  aiCard: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    backgroundColor: '#70558E',
    borderRadius: 24,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  aiIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  aiCopyWrap: { flex: 1, minWidth: 0 },
  aiKicker: { color: '#E2D7EC', fontSize: 9, fontWeight: '900', letterSpacing: 1.0 },
  aiTitle: { color: '#FFF', fontSize: 17, fontWeight: '900', marginTop: 2 },
  aiCopy: { color: '#EEE8F4', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  chevron: { color: '#FFF', fontSize: 29, fontWeight: '300', marginLeft: 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 15 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#E2DFE6' },
  dividerText: { color: '#96919C', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: '48.5%',
    minHeight: 116,
    backgroundColor: '#FFF',
    borderRadius: 21,
    padding: 13,
    borderWidth: 1,
    borderColor: '#ECE9EF',
  },
  itemIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  itemIconText: { fontSize: 20, fontWeight: '800' },
  itemTitle: { color: '#29272E', fontSize: 15, fontWeight: '800' },
  itemSub: { color: '#8B8791', fontSize: 10.5, lineHeight: 14, marginTop: 3 },
});
