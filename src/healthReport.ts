import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { computeCycleSymptomSignals, computeFoodCycleSignals, computeFoodGroupSignals, getOverallDataQuality, getTrackingDays, severityWord } from './analysis';
import { UserProfile } from './onboarding';
import { HealthStore } from './types';
import { getMedicalSafetyAlerts } from './medicalSafety';

function esc(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c)); }
function date(iso?: string) { return iso ? new Date(iso).toLocaleDateString('de-DE') : '–'; }

function filteredStore(store: HealthStore, days: number): HealthStore {
  const cutoff = Date.now() - days * 86400000;
  const keep = <T extends {createdAt:string}>(items:T[]) => items.filter(x => new Date(x.createdAt).getTime() >= cutoff);
  return { ...store, meals:keep(store.meals),symptoms:keep(store.symptoms),bowel:keep(store.bowel),cycle:keep(store.cycle),observations:keep(store.observations),medications:keep(store.medications),healthMetrics:keep(store.healthMetrics) };
}

export async function createAndShareHealthReport(store: HealthStore, profile: UserProfile, days = 42) {
  const scoped = filteredStore(store, days);
  const groups = computeFoodGroupSignals(scoped, 8, profile.cyclePreferences).slice(0, 5);
  const cycles = computeCycleSymptomSignals(scoped, profile.cyclePreferences).filter(x => x.delta > 0.25).slice(0, 4);
  const combos = computeFoodCycleSignals(scoped, 8, profile.cyclePreferences).slice(0, 5);
  const quality = getOverallDataQuality(scoped);
  const recentSymptoms = scoped.symptoms.filter(x => [x.pain,x.bloating,x.nausea,x.heartburn].some(v => typeof v === 'number')).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20);
  const recentBowel = scoped.bowel.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20);
  const reportDate = new Date().toLocaleDateString('de-DE');
  const safety = getMedicalSafetyAlerts(scoped);
  const rows = groups.map(x => `<tr><td>${esc(x.food)}</td><td>${x.symptomMatches}/${x.occurrences}</td><td>${esc(x.dataQuality)}</td><td>${esc(x.confounders.join(' ') || 'keine eindeutigen')}</td></tr>`).join('');
  const symptomRows = recentSymptoms.map(x => `<tr><td>${date(x.createdAt)}</td><td>${x.bloating==null?'–':severityWord(x.bloating)}</td><td>${x.pain==null?'–':severityWord(x.pain)}</td><td>${x.nausea==null?'–':severityWord(x.nausea)}</td><td>${x.heartburn==null?'–':severityWord(x.heartburn)}</td></tr>`).join('');
  const bowelRows = recentBowel.map(x => `<tr><td>${date(x.createdAt)}</td><td>Typ ${x.bristolType}</td><td>${x.urgency ?? '–'}</td><td>${x.blood?'Blut angegeben':''}${x.mucus?' Schleim angegeben':''}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial;color:#25242A;padding:28px;font-size:12px}h1{font-size:28px;margin:0;color:#71558F}h2{font-size:17px;margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:6px}.muted{color:#777}.box{background:#F6F2F8;border-radius:12px;padding:12px;margin:12px 0}.grid{display:flex;gap:10px}.stat{flex:1;background:#f6f6f7;padding:10px;border-radius:10px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:7px;border-bottom:1px solid #e6e6e6;vertical-align:top}th{font-size:10px;color:#666}.note{font-size:10px;color:#666;line-height:1.4}</style></head><body>
  <h1>Noura Gesundheitsbericht</h1><p class="muted">${esc(profile.displayName || 'Persönlicher Bericht')} · ${days} Tage · erstellt am ${reportDate}</p>
  <div class="box"><strong>Wichtig:</strong> Dieser Bericht fasst persönliche Tagebuchdaten und statistische Signale zusammen. Er enthält keine Diagnose und ersetzt keine medizinische Abklärung.</div>
  ${safety.length?`<div class="box" style="background:#FFF1ED"><strong>Gesundheitshinweise:</strong><ul>${safety.map(x=>`<li><b>${esc(x.title)}</b>: ${esc(x.message)} ${esc(x.action)}</li>`).join('')}</ul></div>`:''}
  <h2>Datenbasis</h2><div class="grid"><div class="stat"><b>${getTrackingDays(scoped)}</b><br>Tage dokumentiert</div><div class="stat"><b>${scoped.meals.length}</b><br>Mahlzeiten</div><div class="stat"><b>${recentSymptoms.length}</b><br>Beschwerde-Check-ins</div><div class="stat"><b>${quality.label}</b><br>Datenlage</div></div>
  <h2>Auffällige Lebensmittelgruppen</h2>${rows?`<table><thead><tr><th>Gruppe</th><th>Treffer</th><th>Datenlage</th><th>Mitfaktoren</th></tr></thead><tbody>${rows}</tbody></table>`:'<p class="muted">Noch keine belastbaren Signale.</p>'}
  <h2>Zykluskontext</h2>${cycles.length?`<ul>${cycles.map(x=>`<li><b>${esc(x.phase)}</b>: ${x.samples} Check-ins, Beschwerden ${x.delta>0?'stärker':'schwächer'} als persönliche Basis.</li>`).join('')}</ul>`:'<p class="muted">Kein ausreichend belastbarer Zyklusvergleich.</p>'}${combos.length?`<p><b>Essen × Zyklus:</b></p><ul>${combos.map(x=>`<li>${esc(x.food)} in ${esc(x.phase)}: ${x.symptomMatches}/${x.occurrences} Treffer.</li>`).join('')}</ul>`:''}
  <h2>Letzte Beschwerde-Check-ins</h2>${symptomRows?`<table><thead><tr><th>Datum</th><th>Blähungen</th><th>Bauchschmerz</th><th>Übelkeit</th><th>Sodbrennen</th></tr></thead><tbody>${symptomRows}</tbody></table>`:'<p class="muted">Keine Einträge.</p>'}
  <h2>Stuhlgang</h2>${bowelRows?`<table><thead><tr><th>Datum</th><th>Bristol</th><th>Dringlichkeit</th><th>Hinweise</th></tr></thead><tbody>${bowelRows}</tbody></table>`:'<p class="muted">Keine Einträge.</p>'}
  <h2>Medikamente & Supplements</h2>${scoped.medications.length?`<ul>${scoped.medications.slice(0,30).map(x=>`<li>${date(x.createdAt)} · ${esc(x.name)}${x.dose?` · ${esc(x.dose)}`:''} (${x.kind==='supplement'?'Supplement':'Medikament'})</li>`).join('')}</ul>`:'<p class="muted">Keine Einträge.</p>'}
  <h2>Eigene Beobachtungen</h2>${scoped.observations.length?`<ul>${scoped.observations.slice(0,30).map(x=>`<li>${date(x.createdAt)} · ${esc(x.text)}</li>`).join('')}</ul>`:'<p class="muted">Keine Einträge.</p>'}
  <p class="note">Noura bewertet zeitliche Zusammenhänge und persönliche Verläufe. Ein statistisches Signal bedeutet nicht, dass ein Lebensmittel oder ein anderer Faktor die Ursache einer Beschwerde ist.</p>
  </body></html>`;
  const result = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType:'application/pdf', UTI:'com.adobe.pdf', dialogTitle:'Noura Gesundheitsbericht teilen' });
  return result.uri;
}
