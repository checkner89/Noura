# Noura 0.15 – Quality Release

Noura ist ein privates, diary-first Ernährung-, Symptom-, Verdauungs-, Körper- und Zyklustagebuch mit optionaler eigener KI (BYOK).

## Was 0.15 ergänzt

- medizinische Guardrails für dokumentierte Warnsignale (z. B. Blut im Stuhl, sehr hohe Temperatur, wiederholt starke Schmerzen)
- KI-Transparenz vor dem Senden: Anbieter, Modell, Datenumfang, Zeitraum, grobe Token-Obergrenze und Kostenhinweis
- lokales KI-Nutzungsprotokoll ohne API-Key
- vollständiger Datenexport als ZIP mit JSON + CSV und wieder zusammenführbarer Import
- Apple Health:
  - Export-ZIP-Import bleibt für den kostenlosen Sideload-Build verfügbar
  - optionaler direkter HealthKit-Sync ist für einen HealthKit-fähig signierten Build vorbereitet
  - Tagesaggregation schützt vor doppeltem Zählen mehrerer Gerätequellen; überlappende Schlafintervalle werden zusammengeführt
- iCloud:
  - lokales Backup/Restore bleibt verfügbar
  - optionaler CloudKit-Live-Sync ist für einen entsprechend signierten Build vorbereitet
  - Lösch-Tombstones verhindern, dass gelöschte Tagebucheinträge aus der Cloud wieder auftauchen
  - Pull beim Aktivieren der App sowie verzögerter Push nach Änderungen
- Health-PDF enthält Sicherheits- und Mitfaktorhinweise
- Food-/Symptomanalyse berücksichtigt Gegenbeispiele, Kontrollwerte, Zyklus, Stress, Schlaf, Medikamente/Supplements und Tageszeit
- Wochenrückblick auf der Startseite
- Siri/Kurzbefehle über Noura-Deep-Links
- verbesserte Accessibility-Beschriftung der wichtigsten Schnellaktionen
- zusätzliche Logik-Selbsttests für Analyse, Gegenbeispiele und Safety-Guardrails

## Schon enthalten aus 0.14

- Lebensmittel-Suche, Barcode, Favoriten, zuletzt gegessen, eigene Gerichte
- Essensfoto → KI-Entwurf → prüfen/ändern → speichern
- Sprache/Diktat → KI-Entwurf → prüfen/ändern → speichern
- Medikamente & Supplements
- Gewicht, Wasser, Schlaf, Schritte und Temperatur als optionale Kontextdaten
- lokale Erinnerungen
- Tagebuch mit Tagesnavigation, Bearbeiten, Zurückdatieren, Duplizieren und Undo nach Löschen
- KI-Feedback „Hilfreich / Trifft nicht zu“
- verschlüsselte lokale Gesundheitsdaten und optionale Face-ID-Sperre
- Profilbild, Initialen, App-Icon und Splashscreen

## Windows / schneller Test

```powershell
cd C:\Users\Christoph\Downloads\NouraApp\NouraApp
npm.cmd install
npx.cmd expo start -c
```

Hinweis: native Module wie direkter HealthKit- oder CloudKit-Zugriff laufen nicht in Expo Go. Dafür ist ein nativer Build erforderlich.

## Eigene App auf dem iPhone – kostenloser Apple Account

Der enthaltene Workflow `.github/workflows/build-ios-unsigned.yml` baut bewusst **ohne HealthKit/iCloud-Capabilities**, damit der bestehende GitHub → AltStore/AltServer-Weg mit kostenloser Signierung weiterhin möglichst kompatibel bleibt.

1. Projekt nach GitHub pushen.
2. Workflow **Build Noura iOS IPA (unsigned)** ausführen.
3. Artifact `Noura-unsigned-ipa` laden.
4. IPA über AltServer/AltStore auf das iPhone sideloaden.

Die kostenlose Apple-Signierung muss regelmäßig erneuert werden.

## HealthKit + CloudKit Build

Zusätzlich existiert `.github/workflows/build-ios-full-capabilities.yml`. Dieser Build aktiviert die nativen HealthKit- und CloudKit-Plugins. Die App ist damit technisch für direkten Apple-Health- und iCloud-Zugriff vorbereitet.

Wichtig: HealthKit und CloudKit benötigen passende Apple-Entitlements / App-ID-Capabilities. Eine kostenlose Personal-Team-/AltStore-Signierung kann diese Capabilities nicht zuverlässig bereitstellen. Für die volle Variante ist in der Praxis eine geeignete Apple-Developer-Provisionierung erforderlich.

## Qualitätstest

Nach `npm install`:

```powershell
npm.cmd run test:logic
npm.cmd run typecheck
```

`test:logic` prüft u. a. Lebensmittel-Signale, Kontrollwerte, Gegenbeispiele, Zykluslogik und medizinische Guardrails.

## Datenschutz

- Tagebuchdaten liegen lokal AES-GCM-verschlüsselt.
- Der KI-API-Key liegt im iOS Keychain/SecureStore.
- Externe KI erhält Trackingdaten nur nach expliziter Freigabe.
- Portable Exporte und Backups enthalten keinen API-Key.
- KI-Ergebnisse sind Hypothesen und keine Diagnosen.
