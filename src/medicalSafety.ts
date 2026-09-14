import { HealthStore } from './types';

export type SafetyLevel = 'info' | 'contact' | 'urgent';
export type SafetyAlert = { id: string; level: SafetyLevel; title: string; message: string; action: string };

const HOUR = 3600000;
const DAY = 24 * HOUR;

export function getMedicalSafetyAlerts(store: HealthStore, now = Date.now()): SafetyAlert[] {
  const recentSymptoms = store.symptoms.filter(x => now - new Date(x.createdAt).getTime() <= 48 * HOUR);
  const recentBowel = store.bowel.filter(x => now - new Date(x.createdAt).getTime() <= 72 * HOUR);
  const alerts: SafetyAlert[] = [];

  const highTemp = recentSymptoms.find(x => typeof x.temperature === 'number' && x.temperature >= 39.5);
  if (highTemp) alerts.push({
    id: 'high-fever', level: 'urgent', title: 'Sehr hohe Temperatur dokumentiert',
    message: `Du hast ${highTemp.temperature?.toFixed(1)} °C dokumentiert. Noura sollte das nicht als Ernährungsmuster interpretieren.`,
    action: 'Bei starkem Krankheitsgefühl, Atemnot, Kreislaufproblemen oder rascher Verschlechterung medizinische Hilfe holen; sonst zeitnah ärztlich abklären.',
  });

  const blood = recentBowel.find(x => x.blood);
  if (blood) alerts.push({
    id: 'blood-stool', level: 'contact', title: 'Blut im Stuhl dokumentiert',
    message: 'Blut im Stuhl sollte unabhängig von vermuteten Lebensmittel-Triggern medizinisch eingeordnet werden.',
    action: 'Zeitnah ärztlich abklären. Bei starker Blutung, Schwindel, Schwäche oder starken Schmerzen dringend Hilfe holen.',
  });

  const severePain = recentSymptoms.filter(x => typeof x.pain === 'number' && x.pain >= 8);
  if (severePain.length >= 2 || (severePain[0] && blood)) alerts.push({
    id: 'severe-pain', level: 'urgent', title: 'Starke Bauchschmerzen wiederholt dokumentiert',
    message: 'Wiederholt starke Schmerzen sind kein sinnvoller Anlass für Selbsttests mit Lebensmitteln.',
    action: 'Bei anhaltend starken oder zunehmenden Schmerzen medizinisch abklären; bei akut sehr starken Beschwerden dringend Hilfe holen.',
  });

  const persistentFeverDays = new Set(recentSymptoms.filter(x => typeof x.temperature === 'number' && x.temperature >= 38.0 && now - new Date(x.createdAt).getTime() <= 3 * DAY).map(x => new Date(x.createdAt).toDateString())).size;
  if (persistentFeverDays >= 3) alerts.push({
    id: 'persistent-fever', level: 'contact', title: 'Erhöhte Temperatur über mehrere Tage',
    message: 'Mehrere Tage erhöhte Temperatur sollten nicht nur mit Ernährung erklärt werden.',
    action: 'Ärztlich abklären, besonders wenn weitere Beschwerden dazukommen.',
  });

  return alerts;
}

export function safetyPromptSummary(store: HealthStore) {
  return getMedicalSafetyAlerts(store).map(x => `${x.level.toUpperCase()}: ${x.title} – ${x.message}`).join('\n');
}
