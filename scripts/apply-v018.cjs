const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('// NOURA_V018_APPLIED')) {
  console.log('Noura v0.18 patch already applied.');
  process.exit(0);
}
if (!source.includes('// NOURA_V017_APPLIED')) {
  throw new Error('v0.18 patch requires the v0.17 transform first.');
}

function replaceOnce(from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`v0.18 patch failed: ${label}`);
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

replaceOnce(
  '// NOURA_V017_APPLIED\n',
  '// NOURA_V017_APPLIED\n// NOURA_V018_APPLIED\n',
  'insert v0.18 marker'
);

// Bring the Noura accent back to an unmistakable, saturated purple. Native
// Liquid Glass still refracts the content below, but the controls no longer
// read as greyed-out lavender.
replaceOnce("  purple: '#71558F',", "  purple: '#8551B5',", 'restore saturated purple');
replaceOnce("  purpleSoft: '#F2ECF8',", "  purpleSoft: '#F1E7FA',", 'restore purple soft surface');
replaceOnce(
  'tintColor="rgba(113,85,143,0.40)"',
  'tintColor="rgba(133,81,181,0.78)"',
  'strengthen quick action glass tint'
);
replaceOnce(
  'tintColor="rgba(113,85,143,0.38)"',
  'tintColor="#8551B5"',
  'strengthen add button glass tint'
);

// Center the add control relative to the actual navigation bar width. The
// wrapper is pointer-events transparent, so the surrounding tabs stay tappable.
const oldAdd = '<Pressable accessibilityRole="button" accessibilityLabel="Eintrag hinzufügen" style={styles.floatingAdd} onPress={()=>setAddSheetOpen(true)}><LiquidGlassSurface style={styles.floatingAddGlass} effect="regular" tintColor="#8551B5" interactive><View style={styles.plusGlyph} pointerEvents="none"><View style={styles.plusHorizontal}/><View style={styles.plusVertical}/></View></LiquidGlassSurface></Pressable>';
const newAdd = '<View style={styles.floatingAddLayer} pointerEvents="box-none"><Pressable accessibilityRole="button" accessibilityLabel="Eintrag hinzufügen" style={styles.floatingAdd} onPress={()=>setAddSheetOpen(true)}><LiquidGlassSurface style={styles.floatingAddGlass} effect="regular" tintColor="#8551B5" interactive><View style={styles.plusGlyph} pointerEvents="none"><View style={styles.plusHorizontal}/><View style={styles.plusVertical}/></View></LiquidGlassSurface></Pressable></View>';
replaceOnce(oldAdd, newAdd, 'center add button with nav-width layer');

replaceOnce(
  "  floatingAdd: { position:'absolute', width:64, height:64, borderRadius:32, left:'50%', marginLeft:-32, top:-20, shadowColor:'#3A274D', shadowOpacity:0.22, shadowRadius:18, shadowOffset:{width:0,height:9}, elevation:10 },\n  floatingAddGlass: { flex:1, borderRadius:32, overflow:'hidden', alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.72)' },\n  plusGlyph: { width:28, height:28, position:'relative' },\n  plusHorizontal: { position:'absolute', left:3, right:3, top:12.75, height:2.5, borderRadius:2, backgroundColor:'#FFFFFF' },\n  plusVertical: { position:'absolute', top:3, bottom:3, left:12.75, width:2.5, borderRadius:2, backgroundColor:'#FFFFFF' },",
  "  floatingAddLayer: { position:'absolute', left:0, right:0, top:-20, height:64, alignItems:'center', justifyContent:'center', zIndex:10 },\n  floatingAdd: { width:64, height:64, borderRadius:32, shadowColor:'#3A274D', shadowOpacity:0.28, shadowRadius:18, shadowOffset:{width:0,height:9}, elevation:10 },\n  floatingAddGlass: { width:64, height:64, borderRadius:32, overflow:'hidden', alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.76)' },\n  plusGlyph: { width:24, height:24, position:'relative' },\n  plusHorizontal: { position:'absolute', left:1, right:1, top:10.5, height:3, borderRadius:2, backgroundColor:'#FFFFFF' },\n  plusVertical: { position:'absolute', top:1, bottom:1, left:10.5, width:3, borderRadius:2, backgroundColor:'#FFFFFF' },",
  'replace add button geometry'
);

// Stronger active-state contrast inside the glass bar. The glass itself stays
// neutral, while selection remains clearly Noura-purple.
replaceOnce(
  "  bottomNavIconBoxActive: { backgroundColor: colors.purpleSoft },",
  "  bottomNavIconBoxActive: { backgroundColor: 'rgba(133,81,181,0.18)' },",
  'strengthen active nav selection'
);

replaceOnce('<Text style={styles.versionLabel}>Noura · Version 0.17</Text>', '<Text style={styles.versionLabel}>Noura · Version 0.18</Text>', 'version label');

fs.writeFileSync(appPath, source, 'utf8');
console.log('Applied Noura v0.18: exact centered add control and restored saturated Noura purple.');
