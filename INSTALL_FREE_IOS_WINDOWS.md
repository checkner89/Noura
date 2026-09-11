# Noura auf dem eigenen iPhone installieren – Windows + kostenloser Apple Account

Dieser Weg ist für **persönliches Testen** gedacht. Er nutzt:

1. GitHub Actions auf einem macOS-Runner zum Kompilieren einer **unsignierten IPA**.
2. AltStore Classic / AltServer unter Windows, um die IPA mit deinem **kostenlosen Apple Account** zu signieren und auf dein eigenes iPhone zu installieren.

## Einschränkungen des kostenlosen Apple Accounts

- Die Signierung läuft nach **7 Tagen** ab und muss erneuert werden.
- Apple begrenzt kostenlose persönliche Provisionierung u. a. auf **3 gleichzeitig installierte Apps pro Gerät**.
- AltStore kann Apps automatisch erneuern, wenn iPhone und der Windows-PC mit laufendem AltServer regelmäßig im selben WLAN sind.
- Das ist Sideloading zum persönlichen Testen, keine App-Store-Veröffentlichung.

## Teil A – IPA in GitHub bauen

### 1. Neues GitHub-Repository erstellen

Erstelle z. B. ein privates Repository namens `Noura`.

### 2. Diesen Projektordner hochladen

Wichtig: Der Ordner `.github/workflows/` muss mit hochgeladen werden.

Mit Git auf Windows beispielsweise:

```powershell
git init
git add .
git commit -m "Noura iOS sideload build"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/Noura.git
git push -u origin main
```

### 3. Workflow ausführen

Auf GitHub:

- Repository öffnen
- **Actions**
- **Build Noura iOS IPA (unsigned)**
- **Run workflow**

Nach erfolgreichem Lauf findest du unten unter **Artifacts**:

`Noura-unsigned-ipa`

Herunterladen und ZIP entpacken. Darin liegt:

`Noura-unsigned.ipa`

## Teil B – AltStore Classic unter Windows installieren

### 1. Voraussetzungen

Installiere AltServer für Windows sowie die für AltStore benötigten Apple-Komponenten. Folge hierfür der offiziellen AltStore-Windows-Anleitung.

### 2. iPhone verbinden

- iPhone per USB an Windows anschließen.
- Auf dem iPhone **Diesem Computer vertrauen** bestätigen.
- AltServer unter Windows als Administrator starten.
- AltStore auf das iPhone installieren und mit dem kostenlosen Apple Account anmelden.
- Auf iOS 16 oder neuer **Entwicklermodus** aktivieren, wenn iOS danach fragt.

## Teil C – Noura installieren

Es gibt zwei Wege.

### Direkt über AltServer unter Windows

- Halte **Shift** gedrückt und klicke auf das AltServer-Symbol im Infobereich.
- Wähle **Sideload .ipa…**.
- Wähle `Noura-unsigned.ipa`.
- Wähle dein iPhone und melde dich mit dem Apple Account an, falls gefragt.

### Oder über AltStore auf dem iPhone

Übertrage die IPA auf das iPhone (z. B. Dateien/iCloud Drive), öffne sie mit AltStore und installiere sie dort.

## Alle 7 Tage

Mit einem kostenlosen Account läuft die persönliche Signierung nach sieben Tagen ab. Lass AltServer regelmäßig auf deinem PC laufen und sorge dafür, dass iPhone und PC im selben WLAN sind. AltStore versucht dann, die App im Hintergrund zu erneuern. Alternativ kannst du manuell **Refresh All** ausführen.

## Wenn etwas fehlschlägt

Typische Punkte:

- iTunes/iCloud/Apple-Gerätetreiber nicht korrekt installiert.
- iPhone und PC vertrauen einander noch nicht.
- Entwicklermodus auf dem iPhone ist aus.
- AltServer läuft nicht als Administrator.
- 3-App-Limit bzw. App-ID-Limit des kostenlosen Accounts erreicht.
- Bei Apple-ID-Fehlern kann je nach Account ein app-spezifisches Passwort nötig sein.

Die Noura-App verwendet derzeit keine kostenpflichtigen Apple-Capabilities wie Push Notifications, iCloud oder HealthKit. Kamera, Netzwerkzugriff und lokale Speicherung sind für diesen Testweg grundsätzlich passend.

## Hinweis ab Noura 0.12

Noura nutzt jetzt zusätzliche native Module für Profilbild, Background Tasks und Dateisystem. Nach dem Update musst du die IPA **neu über den GitHub-Workflow bauen**; ein reines JavaScript-Refresh reicht für diese Funktionen nicht.

Die tägliche KI-Analyse ist auf iOS opportunistisch: iOS entscheidet den tatsächlichen Ausführungszeitpunkt. Wenn du Noura im App-Switcher aktiv beendest, werden Hintergrundaufgaben bis zum nächsten Start nicht ausgeführt.
