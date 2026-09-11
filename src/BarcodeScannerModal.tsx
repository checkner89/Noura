import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarcodeFoodProduct, lookupFoodByBarcode } from './foodLookup';
import { FoodItem } from './types';

type Props = {
  visible: boolean;
  initialCode?: string;
  onClose: () => void;
  onAdd: (food: FoodItem) => void;
  onScanAgain?: () => void;
};

function uid() { return `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function numberLabel(value?: number, suffix = 'g') { return typeof value === 'number' ? `${value.toLocaleString('de-DE')} ${suffix}` : '–'; }

export default function BarcodeScannerModal({ visible, initialCode, onClose, onAdd, onScanAgain }: Props) {
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeFoodProduct | null>(null);
  const [error, setError] = useState('');
  const [notFoundCode, setNotFoundCode] = useState('');
  const [grams, setGrams] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [lastCode, setLastCode] = useState('');

  const calculatedKcal = useMemo(() => {
    const amount = Number(grams.replace(',', '.'));
    const per100 = product?.nutritionPer100g.kcal;
    if (!Number.isFinite(amount) || amount <= 0 || typeof per100 !== 'number') return undefined;
    return Math.round((amount / 100) * per100);
  }, [grams, product]);

  const lookup = async (code: string) => {
    const clean = code.trim().replace(/[\s-]+/g, '');
    if (!clean) return;
    setLastCode(clean);
    setLoading(true);
    setError('');
    setNotFoundCode('');
    setProduct(null);
    try {
      const found = await lookupFoodByBarcode(clean);
      if (!found) {
        setNotFoundCode(clean);
      } else {
        setProduct(found);
        const serving = found.servingSize?.match(/([\d.,]+)\s*g/i)?.[1];
        setGrams(serving ? serving.replace(',', '.') : '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beim Abruf der Produktdaten ist ein Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      setProduct(null);
      setError('');
      setNotFoundCode('');
      setGrams('');
      setManualCode('');
      setLastCode('');
      setLoading(false);
      return;
    }
    if (initialCode) lookup(initialCode);
  }, [visible, initialCode]);

  const addProduct = () => {
    if (!product) return;
    const amountNumber = Number(grams.replace(',', '.'));
    const hasAmount = Number.isFinite(amountNumber) && amountNumber > 0;
    onAdd({
      id: uid(),
      name: product.name,
      amount: hasAmount ? `${String(amountNumber).replace('.', ',')} g` : undefined,
      kcal: calculatedKcal,
      source: 'openfoodfacts',
      barcode: product.barcode,
      brand: product.brand,
      imageUrl: product.imageUrl,
      ingredients: product.ingredients,
      allergens: product.allergens,
      nutritionPer100g: product.nutritionPer100g,
    });
    onClose();
  };

  const headerTitle = loading ? 'Produkt wird gesucht' : product ? 'Produkt gefunden' : 'Barcode';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>ESSEN ERFASSEN</Text>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{headerTitle}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Schließen"><Text style={styles.closeText}>×</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingCard}>
              <View style={styles.scanBadge}><Text style={styles.scanBadgeText}>▦</Text></View>
              <ActivityIndicator size="large" color="#70558E" />
              <Text style={styles.loadingTitle}>Barcode gelesen</Text>
              {!!lastCode && <Text style={styles.code}>{lastCode}</Text>}
              <Text style={styles.muted}>Noura sucht jetzt nach dem passenden Lebensmittel.</Text>
            </View>
          )}

          {!loading && !product && (
            <View style={styles.card}>
              <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>{notFoundCode ? '?' : error ? '!' : '▦'}</Text></View>
              <Text style={styles.cardTitle}>{notFoundCode ? 'Noch kein Produkt gefunden' : error ? 'Produktsuche fehlgeschlagen' : 'Barcode eingeben'}</Text>
              <Text style={styles.muted}>
                {notFoundCode
                  ? `Der Barcode ${notFoundCode} wurde erkannt, ist aber aktuell nicht in Open Food Facts hinterlegt.`
                  : error || 'Du kannst einen Barcode erneut scannen oder die Nummer manuell eingeben.'}
              </Text>

              {!!onScanAgain && (
                <TouchableOpacity onPress={onScanAgain} style={styles.primary}>
                  <Text style={styles.primaryText}>Barcode erneut scannen</Text>
                </TouchableOpacity>
              )}

              <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>ODER</Text><View style={styles.orLine} /></View>
              <View style={styles.manualRow}>
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  keyboardType="number-pad"
                  placeholder="Barcode eingeben"
                  placeholderTextColor="#98939D"
                  style={styles.input}
                />
                <TouchableOpacity disabled={!manualCode.trim()} onPress={() => lookup(manualCode)} style={[styles.smallButton, !manualCode.trim() && styles.disabled]}>
                  <Text style={styles.smallButtonText}>Suchen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!!product && !loading && (
            <>
              <View style={styles.success}><Text style={styles.successText}>✓ Barcode erfolgreich zugeordnet</Text></View>
              <View style={styles.card}>
                <View style={styles.productTop}>
                  {product.imageUrl
                    ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" />
                    : <View style={styles.placeholder}><Text style={styles.placeholderText}>▦</Text></View>}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {!!product.brand && <Text style={styles.brand}>{product.brand}</Text>}
                    <Text style={styles.barcode}>{product.barcode}{product.quantity ? ` · ${product.quantity}` : ''}</Text>
                  </View>
                </View>

                <View style={styles.macroRow}>
                  <View style={styles.macro}><Text style={styles.macroValue}>{numberLabel(product.nutritionPer100g.kcal, 'kcal')}</Text><Text style={styles.macroLabel}>pro 100 g</Text></View>
                  <View style={styles.macro}><Text style={styles.macroValue}>{numberLabel(product.nutritionPer100g.protein)}</Text><Text style={styles.macroLabel}>Eiweiß</Text></View>
                  <View style={styles.macro}><Text style={styles.macroValue}>{numberLabel(product.nutritionPer100g.carbs)}</Text><Text style={styles.macroLabel}>KH</Text></View>
                  <View style={styles.macro}><Text style={styles.macroValue}>{numberLabel(product.nutritionPer100g.fat)}</Text><Text style={styles.macroLabel}>Fett</Text></View>
                </View>

                <Text style={styles.label}>Wie viel hast du gegessen?</Text>
                <View style={styles.amountRow}>
                  <TextInput value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder="z. B. 150" placeholderTextColor="#98939D" style={[styles.input, { flex: 1 }]} />
                  <Text style={styles.unit}>g</Text>
                  <View style={styles.kcalBox}><Text style={styles.kcalValue}>{typeof calculatedKcal === 'number' ? calculatedKcal : '–'}</Text><Text style={styles.kcalLabel}>kcal</Text></View>
                </View>

                {!!product.allergens.length && <View style={styles.info}><Text style={styles.infoTitle}>Deklarierte Allergene</Text><Text style={styles.infoText}>{product.allergens.join(' · ')}</Text></View>}
                {!!product.ingredients && <View style={styles.info}><Text style={styles.infoTitle}>Zutaten</Text><Text style={styles.infoText} numberOfLines={6}>{product.ingredients}</Text></View>}
              </View>

              <TouchableOpacity style={styles.primary} onPress={addProduct}><Text style={styles.primaryText}>Zur Mahlzeit hinzufügen</Text></TouchableOpacity>
              {!!onScanAgain && <TouchableOpacity style={styles.secondary} onPress={onScanAgain}><Text style={styles.secondaryText}>Anderes Produkt scannen</Text></TouchableOpacity>}
              <Text style={styles.disclaimer}>Produktdaten stammen aus Open Food Facts und können unvollständig sein. Die Verpackungsangaben haben Vorrang.</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E5EC', backgroundColor: '#FFFFFF' },
  kicker: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1, color: '#75558F' },
  title: { fontSize: 25, lineHeight: 30, fontWeight: '900', color: '#252329', marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EEF3', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#514D57', fontSize: 25, lineHeight: 27, marginTop: -2 },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  loadingCard: { minHeight: 290, backgroundColor: '#FFFFFF', borderRadius: 25, padding: 24, borderWidth: 1, borderColor: '#EAE7ED', alignItems: 'center', justifyContent: 'center', gap: 12 },
  scanBadge: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#F1EAF6', alignItems: 'center', justifyContent: 'center' },
  scanBadgeText: { fontSize: 28, color: '#70558E' },
  loadingTitle: { color: '#252329', fontSize: 18, fontWeight: '900' },
  code: { color: '#75558F', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  muted: { color: '#7D7883', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 18, borderWidth: 1, borderColor: '#EAE7ED', gap: 13 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#F1EAF6', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  emptyIconText: { fontSize: 24, color: '#70558E', fontWeight: '900' },
  cardTitle: { color: '#252329', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#E1DDE5', backgroundColor: '#FAF9FB', paddingHorizontal: 14, color: '#29262F', fontSize: 15 },
  smallButton: { minHeight: 50, borderRadius: 16, paddingHorizontal: 16, backgroundColor: '#70558E', alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#FFF', fontWeight: '900' },
  disabled: { opacity: 0.4 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#E3E0E6' },
  orText: { color: '#9A959F', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  success: { alignSelf: 'flex-start', backgroundColor: '#EAF5ED', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  successText: { color: '#3E7F56', fontWeight: '900', fontSize: 12 },
  productTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  image: { width: 84, height: 84, borderRadius: 19, backgroundColor: '#F7F5F8' },
  placeholder: { width: 84, height: 84, borderRadius: 19, backgroundColor: '#F7F5F8', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 29, color: '#B7B1BB' },
  productName: { color: '#252329', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  brand: { color: '#6E6973', fontSize: 13, marginTop: 4 },
  barcode: { color: '#9A949F', fontSize: 11, marginTop: 5 },
  macroRow: { flexDirection: 'row', gap: 7 },
  macro: { flex: 1, minHeight: 62, borderRadius: 16, backgroundColor: '#F7F5F8', padding: 8, alignItems: 'center', justifyContent: 'center' },
  macroValue: { color: '#29262F', fontSize: 11.5, fontWeight: '900', textAlign: 'center' },
  macroLabel: { color: '#8B8590', fontSize: 9, marginTop: 4 },
  label: { color: '#4F4A54', fontSize: 12, fontWeight: '800', marginTop: 3 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unit: { color: '#6F6974', fontWeight: '800' },
  kcalBox: { minWidth: 72, minHeight: 50, borderRadius: 16, backgroundColor: '#F1EAF6', alignItems: 'center', justifyContent: 'center' },
  kcalValue: { color: '#70558E', fontSize: 17, fontWeight: '900' },
  kcalLabel: { color: '#8C76A0', fontSize: 9 },
  info: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E3E9', paddingTop: 12 },
  infoTitle: { color: '#29262F', fontWeight: '900', fontSize: 12 },
  infoText: { color: '#6F6974', fontSize: 12, lineHeight: 18, marginTop: 5 },
  primary: { minHeight: 54, borderRadius: 18, backgroundColor: '#70558E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#FFF', fontSize: 14.5, fontWeight: '900' },
  secondary: { minHeight: 50, borderRadius: 18, backgroundColor: '#EFECF2', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#5C5662', fontSize: 14, fontWeight: '800' },
  disclaimer: { color: '#8A8490', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
});
