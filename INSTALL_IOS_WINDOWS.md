# Noura fest auf dem iPhone installieren – Windows

Noura ist für einen **EAS Internal Distribution / Preview Build** vorbereitet. Dieser Build wird über einen Cloud-Mac signiert und kann danach direkt auf einem registrierten iPhone installiert werden. Expo Go und ein laufender Metro-Server sind anschließend nicht erforderlich.

## Voraussetzung

- Windows-PC mit Node.js/npm
- Expo-Konto
- iPhone
- aktive **Apple Developer Program** Mitgliedschaft für iOS-Ad-hoc-Signierung

## Schnellster Weg

Im Noura-Projektordner:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL_IOS.ps1
```

Das Skript führt dich durch npm, EAS-Login, Geräteregistrierung und den Preview-Build.

## Manuell

### 1. Projekt vorbereiten

```powershell
cd C:\Users\Christoph\Downloads\NouraApp\NouraApp
npm.cmd install
npx.cmd eas-cli@latest login
```

Beim ersten Mal kann zusätzlich nötig sein:

```powershell
npx.cmd eas-cli@latest init
```

### 2. iPhone registrieren

```powershell
npx.cmd eas-cli@latest device:create
```

`Website` auswählen und den erzeugten Link auf dem iPhone öffnen. Das Gerät wird damit für die Ad-hoc-Verteilung registriert.

### 3. Standalone-Build erzeugen

```powershell
npx.cmd eas-cli@latest build --platform ios --profile preview
```

Beim ersten iOS-Build mit deiner Apple-ID anmelden und EAS Zertifikat/Provisioning verwalten lassen. Das registrierte iPhone für den Build auswählen.

### 4. Installieren

Wenn EAS fertig ist, zeigt die Build-Seite einen Install-Link bzw. QR-Code. Diesen auf dem iPhone öffnen und Noura installieren.

Danach liegt Noura als eigenständige App auf dem Homescreen und läuft ohne Expo Go.

## Spätere Updates

Nach Änderungen einfach einen neuen Preview-Build starten:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile preview
```

Ein neu hinzugefügtes iPhone muss vor dem Build mit `device:create` registriert werden.

## TestFlight / App Store später

Für Store-Verteilung ist das `production`-Profil vorbereitet:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile production
```

Der Production-Build wird über App Store Connect/TestFlight verteilt und ist nicht direkt als Ad-hoc-Build installierbar.
