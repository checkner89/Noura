# Noura 0.10 – Architektur

## UX

Noura folgt einer Diary-First-Struktur:

- **Heute**: schneller Tageskontext und letzte Einträge
- **Tagebuch**: chronologische Historie
- **+**: zentraler Eintrags-Flow
- **Analyse / KI**: Muster und verständliche Insights
- **Profil**: Tracking, Datenschutz und eigene KI

Der Add-Flow ist bewusst kurz: KI-Schnelleingabe als bevorzugter Weg, alternativ Direktaktionen für Essen, Gefühl, Auffälligkeit, Stuhlgang und Zyklus.

## Datenmodell

HealthStore enthält weiterhin:

- meals
- symptoms
- bowel
- cycles
- observations

Die lokale Analyse verbindet Ereignisse über Zeitfenster und berücksichtigt Zykluskontext als möglichen Confounder.

## Barcode

Ablauf auf iOS:

1. `CameraView.launchScanner()` öffnet den nativen DataScanner.
2. Die Session bleibt aktiv, bis `CameraView.onModernBarcodeScanned()` tatsächlich ein Scan-Event liefert.
3. Der Scanner wird geschlossen.
4. Der gelesene Code wird sofort in der Ergebnisansicht angezeigt.
5. Open Food Facts wird abgefragt.
6. Der Nutzer ergänzt die gegessene Menge und bestätigt das Lebensmittel.

Wichtig: Das Promise von `launchScanner()` wird nicht als Scan-Ergebnis interpretiert. Genau dadurch wird der frühere Fall verhindert, bei dem iOS den Barcode optisch erkannte, Noura das spätere Event aber ignorierte.

## KI / BYOK

Provider-Layer:

- OpenAI
- Anthropic
- Google Gemini
- OpenAI-kompatible APIs

Provider und Modell werden getrennt über Dropdowns ausgewählt. Nach Eingabe des API-Keys lädt `listAIModels()` den Modellkatalog live vom jeweiligen Anbieter. Dadurch kann Noura alle für den konkreten Account gemeldeten Modelle darstellen, statt eine dauerhaft veraltende statische Liste zu pflegen.

Der Key liegt in Expo SecureStore. Trackingdaten werden nur nach expliziter Freigabe für die normale Analyse übertragen. Die KI-Schnelleingabe sendet ausschließlich den gerade eingegebenen Text und erzeugt einen editierbaren Entwurf.

## iOS-Verteilung unter Windows

`eas.json` enthält einen `preview`-Build mit `distribution: internal`. EAS baut und signiert den iOS-Build auf einem Cloud-Mac. Für Ad-hoc-Installation müssen die Zielgeräte registriert und in einem Apple-Provisioning-Profil enthalten sein.

Enthalten:

- `INSTALL_IOS.cmd`
- `INSTALL_IOS.ps1`
- `INSTALL_IOS_WINDOWS.md`

Der Preview-Build läuft anschließend eigenständig und benötigt weder Expo Go noch Metro.

## Vor Produktion

Das MVP speichert Gesundheitsdaten weiterhin in AsyncStorage. Vor einem produktiven Gesundheitsprodukt sind mindestens verschlüsselte Speicherung, Datenexport/-löschung, Datenschutzkonzept, Consent-Management und regulatorische Prüfung erforderlich.
