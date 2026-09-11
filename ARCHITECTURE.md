# Noura 0.12 – Architektur

## Kernbereiche

- `App.tsx`: Navigation, Startseite, Profil/Einstellungen, Tagebuch, Tracking, Analyse und KI-Ansichten
- `src/SetupWizard.tsx`: Ersteinrichtung; im Profil auch gezielt ab einzelnen Schritten als Einstellung editierbar
- `src/AddEntrySheet.tsx`: kompakter Schnellstart für neue Einträge
- `src/AIQuickCaptureModal.tsx`: natürliche Sprache → prüfbarer Entwurf
- `src/ai.ts`: BYOK-Provider, Modelllisten, strukturierte KI-Ergebnisse
- `src/analysis.ts`: lokale Korrelationen Essen/Symptome/Zyklus
- `src/storage.ts`: lokale Tagebuchdaten
- `src/onboarding.ts`: Profil und Trackingpräferenzen
- `src/preferences.ts`: App-Automationen und Backuppräferenzen
- `src/profileMedia.ts`: persistentes Profilbild
- `src/backup.ts`: lokaler Backup-Snapshot im Documents-Verzeichnis
- `src/dailyAI.ts`: täglicher opportunistischer iOS/Android-Background-Task

## Datenschutzlogik

- Gesundheitsdaten werden im MVP lokal gespeichert.
- API-Key liegt in `expo-secure-store`.
- Backup-Snapshot enthält keinen API-Key.
- Externe KI erhält Trackingdaten nur nach separater Datenfreigabe.
- Automatische KI verwendet dieselben Freigabe- und Scope-Einstellungen wie die manuelle KI-Analyse.

## Background AI

`expo-background-task` nutzt auf iOS `BGTaskScheduler`. Ein 24h-Intervall ist ein Mindestintervall, kein exakter Termin. Ergebnisse werden lokal persistiert und beim nächsten Aktivieren der App auf dem Startbildschirm übernommen.

## Backup

Der Snapshot liegt im iOS-Documents-Bereich. Damit ist er für das Gerätebackup vorgesehen. Ein expliziter CloudKit-Sync und ein In-App-Restore-Assistent sind spätere Ausbaustufen.
