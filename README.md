# Noura 0.12

Noura ist ein persönliches Ernährung-, Symptom-, Verdauungs- und Zyklustagebuch mit optionaler BYOK-KI.

## Neu in 0.12

- kompakter neuer „+“-Dialog statt gequetschtem Fullscreen-Sheet
- vereinfachter Startbildschirm mit persönlichem Tages-Score, wichtigster Erkenntnis und drei Schnellaktionen
- Profilbild aus der iPhone-Fotomediathek; ohne Bild zeigt Noura automatisch die Initialen des Namens
- im Profil sind die Inhalte des Einrichtungsassistenten als einzelne Einstellungen erreichbar: Name/Ziele, Tracking, Körper-Check-in, Zyklus sowie Datenschutz/Hinweise
- eigene KI: Anbieter- und Modell-Dropdowns bleiben erhalten; mit API-Key kann Noura die Modellliste live vom Anbieter laden
- optional tägliche automatische KI-Analyse über `expo-background-task`
- optional automatischer Backup-Snapshot in den Documents-Bereich der App; iOS kann diesen im Gerätebackup in iCloud mitsichern
- Profilbild wird dauerhaft in den Documents-Bereich kopiert
- kostenloser Windows/iPhone-Sideload-Workflow über GitHub macOS Runner + AltStore bleibt enthalten

## Start auf Windows

```powershell
cd C:\Users\Christoph\Downloads\NouraApp\NouraApp
npm.cmd install
npx.cmd expo start -c
```

## Wichtige iOS-Hinweise

### Automatische KI

iOS führt Background Tasks nicht minutengenau aus. Noura registriert einen täglichen Hintergrundtask mit einem Mindestintervall von 24 Stunden. iOS entscheidet anhand von Akku, Netzwerk und Nutzungsverhalten, wann er tatsächlich läuft. Wird die App im App-Switcher aktiv beendet, führt iOS den Task nicht aus, bis Noura wieder gestartet wurde.

Voraussetzungen in Noura:
- eigene KI verbunden
- Trackingdaten für KI-Analyse freigegeben
- „Tägliche automatische KI-Analyse“ im Profil aktiviert

### Backup

Noura schreibt bei aktiviertem Backup nach Änderungen einen JSON-Snapshot nach `Documents/Noura/noura-backup.json`. API-Keys werden nicht in diese Datei geschrieben. Dateien im Documents-Bereich sind für das iOS-Gerätebackup vorgesehen, wenn iCloud Backup auf dem iPhone aktiviert ist. Das ist aktuell **kein CloudKit-Echtzeit-Sync zwischen mehreren Geräten**.

## Eigene App auf dem iPhone ohne bezahlte Membership

Siehe `INSTALL_FREE_IOS_WINDOWS.md`. Der GitHub-Workflow baut eine unsignierte IPA auf einem macOS-Runner. AltStore/AltServer signiert sie mit deinem kostenlosen Apple Account. Bei kostenloser Apple-Signierung muss die App regelmäßig erneuert werden.
