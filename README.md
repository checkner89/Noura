# Noura – Health & Food Diary MVP 0.10

Noura ist ein React-Native/Expo-MVP für ein sehr einfaches Ernährungstagebuch mit Symptom-, Stuhlgang-, Körper- und Zyklustracking. Die UX orientiert sich an modernen Diary-Apps: wenige Taps, chronologische Einträge, ein zentraler Plus-Flow und kurze, klar dargestellte KI-Insights.

## Neu in 0.10

### Neuer Eintrag-Flow

Der große `+`-Flow wurde deutlich reduziert und neu gestaltet:

- kompakter Bottom-Sheet statt übergroßer Liste
- **„Noura einfach erzählen“** bleibt der schnellste Weg
- darunter nur noch klare Direktaktionen für Essen, Gefühl, Auffälligkeit, Stuhlgang und Zyklus
- Typografie und Abstände sind robuster bei größerer iOS-Schrift

### Barcode-Scanner: Callback-Fix

Der native iOS-Scanner hatte einen Race-Condition-Fehler: `launchScanner()` wurde intern zu früh als „Scan beendet“ behandelt. Dadurch konnte iOS einen Barcode sichtbar markieren, während Noura das eigentliche Scan-Event bereits ignorierte.

0.10 hält die Scan-Session nun bis zum echten `onModernBarcodeScanned`-Event offen. Zusätzlich:

- keine unnötige Symbologie-Filterung mehr
- Barcode wird nach dem Scan sofort sichtbar bestätigt
- automatischer Produkt-Lookup
- besserer Lade-/Fehler-/Nicht-gefunden-Zustand
- erneuter Scan und manuelle Barcode-Eingabe bleiben möglich
- Open-Food-Facts-Lookup mit Timeout und UPC/EAN-Fallback

### KI-Anbieter und Modelle als Dropdowns

Unter **Profil → Meine KI** gibt es jetzt zwei getrennte Auswahlfelder:

1. **KI-Anbieter**
   - OpenAI
   - Anthropic
   - Google Gemini
   - OpenAI-kompatibler Anbieter / eigener Gateway

2. **Modell**
   - durchsuchbares Dropdown
   - mit API-Key lädt Noura die **vom jeweiligen Anbieter für genau diesen Account gemeldeten Modelle live**
   - dadurch ist die Liste nicht auf eine hart codierte Auswahl begrenzt
   - ohne API-Key gibt es eine aktuelle Vorauswahl sinnvoller Textmodelle

Das ist robuster als eine statische „alle Modelle“-Liste, weil Anbieter Modelle laufend ergänzen, umbenennen oder entfernen und die Verfügbarkeit außerdem vom Account abhängen kann.

### Fest auf dem iPhone installierbar

Das Projekt ist für **EAS Internal Distribution** vorbereitet. Damit kann Noura als eigenständige App auf deinem iPhone installiert werden:

- eigenes App-Icon im Homescreen
- kein Expo Go nötig
- kein laufender Windows-PC / Metro nötig
- Updates über neue Preview-Builds

Voraussetzung für iOS-Ad-hoc-Builds ist eine aktive Apple Developer Program Mitgliedschaft.

Für Windows liegt `INSTALL_IOS.ps1` bei.

## KI-Schnelleingabe

Über **+ → Noura einfach erzählen** kann der Nutzer schreiben oder über das iOS-Tastaturmikrofon diktieren, z. B.:

> Ich hatte gerade einen Latte und ein Croissant. Jetzt bin ich ziemlich aufgebläht und habe leichte Bauchschmerzen.

Die verbundene KI erzeugt daraus nur einen **Entwurf**. Der Nutzer kann erkannte Mahlzeiten, Mengen, Symptome, Auffälligkeiten, Zyklus- oder Stuhlgangsdaten ändern oder abwählen. Erst nach der Bestätigung wird gespeichert.

## Phase 2 – Diary First

- Heute-Ansicht
- chronologisches Tagebuch
- zentrale Quick-Entry-Navigation
- eigener Datentyp **Auffälligkeit**
- Mahlzeiten, Symptome, Stuhlgang, Zyklus und freie Beobachtungen in einer Timeline
- Barcode-Lookup über Open Food Facts
- KI-Natural-Language-Capture mit Bestätigungs-/Editier-Flow

## Phase 3 – Kontextanalyse

Die lokale Analyse berücksichtigt:

- Zeitfenster nach Mahlzeiten: **0–5 h, 5–10 h, 10–24 h, 24–48 h**
- Symptomniveau nach geschätzter Zyklusphase
- **Lebensmittel × Zyklusphase × Beschwerden**
- freie Auffälligkeiten als Kontext
- Zyklus als möglichen Confounder statt vorschneller Unverträglichkeits-Schlussfolgerung

Die KI-Auswertung zeigt standardmäßig nur:

- wichtigste Erkenntnis
- Datenlage
- bis zu drei kurze Beobachtungen
- nächste Schritte

Ausführliche Begründungen und Unsicherheiten sind optional aufklappbar.

## Lokal mit Expo Go testen

```powershell
cd C:\Users\Christoph\Downloads\NouraApp\NouraApp
npm.cmd install
npx.cmd expo start -c
```

## Fest aufs iPhone installieren

Einfach im Projektordner:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL_IOS.ps1
```

Oder manuell nach `INSTALL_IOS_WINDOWS.md`.

## Datenhaltung im MVP

- API-Key und KI-Einstellungen: `expo-secure-store`
- Trackinghistorie: `@react-native-async-storage/async-storage`
- Setup-Profil: `@react-native-async-storage/async-storage`

AsyncStorage ist persistent, aber **nicht verschlüsselt**. Vor einem produktiven Release müssen Gesundheits- und Zyklusdaten verschlüsselt gespeichert werden. Datenexport/-löschung, Einwilligung, Datenschutz und regulatorische Anforderungen sind ebenfalls separat zu prüfen.

## Medizinisches Prinzip

Noura strukturiert persönliche Tagebuchdaten und zeigt zeitliche/statistische Zusammenhänge. Die App diagnostiziert keine Allergie, Unverträglichkeit, hormonelle Störung oder andere Erkrankung. Zyklusphasen werden nur grob aus dokumentierten Blutungstagen geschätzt; sie sind kein Ovulationsnachweis.
